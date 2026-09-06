import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DataSource } from 'typeorm';
import {
  loadDatabaseOptions,
  loadRuntimeDatabaseOptions,
} from './database.config';

const environment: NodeJS.ProcessEnv = {
  DATABASE_HOST: 'database.internal',
  DATABASE_PORT: '5433',
  DATABASE_NAME: 'kolibri_test',
  DATABASE_USER: 'kolibri_test_user',
  DATABASE_PASSWORD: 'test-placeholder-not-a-secret',
  DATABASE_SSL: 'true',
  DATABASE_SSL_REJECT_UNAUTHORIZED: 'true',
};

describe('database configuration', () => {
  it('loads PostgreSQL and migration settings without connecting', () => {
    const options = loadDatabaseOptions(environment);

    expect(options).toMatchObject({
      type: 'postgres',
      host: 'database.internal',
      port: 5433,
      database: 'kolibri_test',
      username: 'kolibri_test_user',
      uuidExtension: 'pgcrypto',
      installExtensions: false,
      synchronize: false,
      migrationsRun: false,
      migrationsTableName: 'kolibri_migrations',
      logging: false,
      ssl: { rejectUnauthorized: true },
    });
    expect(options.entities).toHaveLength(4);
    expect(options.migrations).toHaveLength(5);
    expect(() => new DataSource(options)).not.toThrow();
  });

  it('rejects missing or unsafe configuration without echoing values', () => {
    expect(() =>
      loadDatabaseOptions({
        ...environment,
        DATABASE_PASSWORD: undefined,
      }),
    ).toThrow('DATABASE_PASSWORD');
    expect(() =>
      loadDatabaseOptions({
        ...environment,
        DATABASE_PORT: '70000',
      }),
    ).toThrow('DATABASE_PORT');
    expect(() =>
      loadDatabaseOptions({
        ...environment,
        DATABASE_SSL: 'sometimes',
      }),
    ).toThrow('DATABASE_SSL must be true or false');
  });

  it('loads PostgreSQL configuration from the runtime system secret', async () => {
    const send = jest.fn().mockResolvedValue({
      SecretString: JSON.stringify({
        postgresql: {
          host: 'secret-database.internal',
          port: 5434,
          database: 'kolibri_runtime',
          username: 'kolibri_runtime_user',
          password: 'runtime-placeholder-not-a-secret',
          ssl: true,
          sslRejectUnauthorized: false,
        },
        futureConfiguration: { supported: true },
      }),
    });

    const options = await loadRuntimeDatabaseOptions(
      {
        ...environment,
        NODE_ENV: 'development',
        KOLIBRI_RUNTIME_MODE: 'production',
        KOLIBRI_STACK_NAME: 'KolibriRuntime',
      },
      { send },
    );

    expect(send).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
    // Jest's mock call tuple is dynamic; the command itself is asserted above.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect((send.mock.calls[0][0] as GetSecretValueCommand).input).toEqual({
      SecretId: 'KolibriRuntime/system',
    });
    expect(options).toMatchObject({
      host: 'secret-database.internal',
      port: 5434,
      database: 'kolibri_runtime',
      username: 'kolibri_runtime_user',
      ssl: { rejectUnauthorized: false },
    });
  });

  it('uses local Docker PostgreSQL without contacting AWS outside production', async () => {
    const send = jest.fn();
    const options = await loadRuntimeDatabaseOptions(
      { NODE_ENV: 'development' },
      { send },
    );

    expect(send).not.toHaveBeenCalled();
    expect(options).toMatchObject({
      type: 'postgres',
      host: 'postgres',
      port: 5432,
      database: 'kolibri',
      username: 'kolibri',
      synchronize: false,
    });
    expect(options.migrations).toHaveLength(5);
  });

  it('allows explicit local PostgreSQL connection overrides', async () => {
    const options = await loadRuntimeDatabaseOptions({
      NODE_ENV: 'development',
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: '5438',
      DATABASE_NAME: 'kolibri_override',
      DATABASE_USER: 'override_user',
      DATABASE_PASSWORD: 'override-password',
    });

    expect(options).toMatchObject({
      type: 'postgres',
      host: 'localhost',
      port: 5438,
      database: 'kolibri_override',
      username: 'override_user',
    });
  });

  it('requires the system secret in production', async () => {
    const send = jest.fn().mockResolvedValue({});
    await expect(
      loadRuntimeDatabaseOptions(
        { NODE_ENV: 'production', AWS_REGION: 'us-east-1' },
        { send },
      ),
    ).rejects.toThrow('production system configuration is required');
  });

  it('rejects missing, malformed, and incomplete production PostgreSQL configuration', async () => {
    const production = { NODE_ENV: 'production', AWS_REGION: 'us-east-1' };
    for (const value of [
      {},
      { postgresql: [] },
      { postgresql: { host: '' } },
      {
        postgresql: {
          host: 'db',
          database: 'kolibri',
          username: 'user',
          password: 'pass',
          port: [],
        },
      },
    ]) {
      const send = jest
        .fn()
        .mockResolvedValue({ SecretString: JSON.stringify(value) });
      await expect(
        loadRuntimeDatabaseOptions(production, { send }),
      ).rejects.toThrow();
    }
  });

  it('applies production PostgreSQL scalar defaults', async () => {
    const send = jest.fn().mockResolvedValue({
      SecretString: JSON.stringify({
        postgresql: {
          host: 'db',
          database: 'kolibri',
          username: 'user',
          password: 'pass',
        },
      }),
    });
    await expect(
      loadRuntimeDatabaseOptions({ NODE_ENV: 'production' }, { send }),
    ).resolves.toMatchObject({ port: 5432, ssl: false });
  });

  it('accepts trimmed string PostgreSQL scalar settings', async () => {
    const send = jest.fn().mockResolvedValue({
      SecretString: JSON.stringify({
        postgresql: {
          host: 'db',
          port: '5435',
          database: 'kolibri',
          username: 'user',
          password: 'pass',
          ssl: 'false',
        },
      }),
    });
    await expect(
      loadRuntimeDatabaseOptions({ NODE_ENV: 'production' }, { send }),
    ).resolves.toMatchObject({ port: 5435 });
  });
});
