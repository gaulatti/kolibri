import { Injectable } from '@nestjs/common';
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { loadKolibriSystemSecret } from './kolibri-system-secret';
import { runtimeMode } from './runtime-mode';
import { LocalRuntimeConfigurationClient } from '../secrets/local-runtime-configuration.client';

export const DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org';

@Injectable()
export class SystemConfigurationService {
  private npmRegistryPromise: Promise<string> | null = null;
  private localConfigurationClient: LocalRuntimeConfigurationClient | null =
    null;

  npmRegistry(): Promise<string> {
    this.npmRegistryPromise ??= this.loadNpmRegistry();
    return this.npmRegistryPromise;
  }

  private async loadNpmRegistry(): Promise<string> {
    let value: unknown;
    if (runtimeMode(process.env) === 'local') {
      this.localConfigurationClient ??= new LocalRuntimeConfigurationClient(
        'data/system-configuration.sqlite',
        JSON.stringify({ npm: { registry: DEFAULT_NPM_REGISTRY } }),
      );
      const response = await this.localConfigurationClient.send(
        new GetSecretValueCommand({ SecretId: 'kolibri-local/system' }),
      );
      value = objectValue(
        parseConfiguration(response.SecretString).npm,
      ).registry;
    } else {
      const configuration = await loadKolibriSystemSecret(process.env);
      value = objectValue(configuration?.npm).registry;
    }
    const configured =
      typeof value === 'string' && value.trim()
        ? value.trim()
        : DEFAULT_NPM_REGISTRY;
    return validateRegistry(configured).href;
  }
}

function parseConfiguration(
  value: string | undefined,
): Record<string, unknown> {
  if (!value?.trim()) return {};
  try {
    return objectValue(JSON.parse(value) as unknown);
  } catch {
    throw new Error('Local system configuration is invalid');
  }
}

function validateRegistry(value: string): URL {
  const registry = new URL(value);
  if (
    registry.protocol !== 'https:' &&
    !(
      registry.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '::1'].includes(registry.hostname)
    )
  ) {
    throw new Error('npm registry must use HTTPS');
  }
  if (
    registry.username ||
    registry.password ||
    registry.search ||
    registry.hash
  ) {
    throw new Error('npm registry system configuration is invalid');
  }
  if (!registry.pathname.endsWith('/')) registry.pathname += '/';
  return registry;
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
