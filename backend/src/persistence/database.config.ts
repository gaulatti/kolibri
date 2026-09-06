import type { DataSourceOptions } from 'typeorm';
import {
  loadKolibriSystemSecret,
  type KolibriSystemSecret,
  type SystemSecretClient,
} from '../config/kolibri-system-secret';
import { runtimeMode } from '../config/runtime-mode';
import { InitialPersistenceSchema1785600000000 } from './migrations/1785600000000-InitialPersistenceSchema';
import { SeparateDesignSystemRuntimeConfiguration1785600000001 } from './migrations/1785600000001-SeparateDesignSystemRuntimeConfiguration';
import { AddNpmPublicationTracking1785600000002 } from './migrations/1785600000002-AddNpmPublicationTracking';
import { AddGenerationContract1785600000003 } from './migrations/1785600000003-AddGenerationContract';
import { SnapshotGenerationContract1785600000004 } from './migrations/1785600000004-SnapshotGenerationContract';
import { PERSISTENCE_ENTITIES } from './persistence.entities';

const LOCAL_DOCKER_DATABASE_ENVIRONMENT: NodeJS.ProcessEnv = {
  DATABASE_HOST: 'postgres',
  DATABASE_PORT: '5432',
  DATABASE_NAME: 'kolibri',
  DATABASE_USER: 'kolibri',
  DATABASE_PASSWORD: 'kolibri-local-development',
  DATABASE_SSL: 'false',
  DATABASE_SSL_REJECT_UNAUTHORIZED: 'true',
};

function required(
  environment: NodeJS.ProcessEnv,
  variableName: string,
): string {
  const value = environment[variableName]?.trim();
  if (!value) {
    throw new Error(
      `Missing required database environment variable: ${variableName}`,
    );
  }
  return value;
}

function port(environment: NodeJS.ProcessEnv): number {
  const raw = environment.DATABASE_PORT?.trim() || '5432';
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error('DATABASE_PORT must be an integer between 1 and 65535');
  }
  return value;
}

function boolean(
  environment: NodeJS.ProcessEnv,
  variableName: string,
  defaultValue: boolean,
): boolean {
  const raw = environment[variableName]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${variableName} must be true or false`);
}

export function loadDatabaseOptions(
  environment: NodeJS.ProcessEnv = process.env,
): DataSourceOptions {
  const sslEnabled = boolean(environment, 'DATABASE_SSL', false);

  return {
    type: 'postgres',
    host: required(environment, 'DATABASE_HOST'),
    port: port(environment),
    username: required(environment, 'DATABASE_USER'),
    password: required(environment, 'DATABASE_PASSWORD'),
    database: required(environment, 'DATABASE_NAME'),
    applicationName: 'kolibri-backend',
    uuidExtension: 'pgcrypto',
    installExtensions: false,
    ssl: sslEnabled
      ? {
          rejectUnauthorized: boolean(
            environment,
            'DATABASE_SSL_REJECT_UNAUTHORIZED',
            true,
          ),
        }
      : false,
    logging: false,
    entities: [...PERSISTENCE_ENTITIES],
    migrations: [
      InitialPersistenceSchema1785600000000,
      SeparateDesignSystemRuntimeConfiguration1785600000001,
      AddNpmPublicationTracking1785600000002,
      AddGenerationContract1785600000003,
      SnapshotGenerationContract1785600000004,
    ],
    migrationsTableName: 'kolibri_migrations',
    migrationsRun: false,
    migrationsTransactionMode: 'all',
    synchronize: false,
  };
}

export async function loadRuntimeDatabaseOptions(
  environment: NodeJS.ProcessEnv = process.env,
  client?: SystemSecretClient,
): Promise<DataSourceOptions> {
  if (runtimeMode(environment) === 'local') {
    return loadDatabaseOptions({
      ...LOCAL_DOCKER_DATABASE_ENVIRONMENT,
      ...databaseOverrides(environment),
    });
  }

  const systemSecret = await loadKolibriSystemSecret(environment, client);
  if (!systemSecret) {
    throw new Error('Kolibri production system configuration is required');
  }
  const secretDatabaseEnvironment = postgresqlEnvironment(systemSecret);
  if (!secretDatabaseEnvironment) {
    throw new Error('Kolibri production PostgreSQL configuration is required');
  }
  return loadDatabaseOptions(secretDatabaseEnvironment);
}

function databaseOverrides(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(environment).filter(
      ([key, value]) => key.startsWith('DATABASE_') && value !== undefined,
    ),
  );
}

function postgresqlEnvironment(
  systemSecret: KolibriSystemSecret,
): NodeJS.ProcessEnv | null {
  const value = systemSecret.postgresql;
  if (value === undefined || value === null) return null;
  if (!isObject(value))
    throw new Error('Invalid postgresql system configuration');

  return {
    DATABASE_HOST: stringValue(value, 'host'),
    DATABASE_PORT: optionalScalar(value, 'port') ?? '5432',
    DATABASE_NAME: stringValue(value, 'database'),
    DATABASE_USER: stringValue(value, 'username'),
    DATABASE_PASSWORD: stringValue(value, 'password'),
    DATABASE_SSL: optionalScalar(value, 'ssl') ?? 'false',
    DATABASE_SSL_REJECT_UNAUTHORIZED:
      optionalScalar(value, 'sslRejectUnauthorized') ?? 'true',
  };
}

function stringValue(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== 'string' || !field.trim()) {
    throw new Error(
      `Kolibri system configuration has an invalid postgresql.${key} field`,
    );
  }
  return field;
}

function optionalScalar(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  if (typeof field === 'string' && field.trim()) return field;
  if (typeof field === 'number' || typeof field === 'boolean') {
    return String(field);
  }
  throw new Error(
    `Kolibri system configuration has an invalid postgresql.${key} field`,
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
