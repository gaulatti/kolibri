import {
  GetSecretValueCommand,
  SecretsManagerClient,
  type SecretsManagerClientConfig,
} from '@aws-sdk/client-secrets-manager';
import { systemSecretName } from './runtime-namespace';

export type KolibriSystemSecret = Record<string, unknown>;

export interface SystemSecretClient {
  send(command: GetSecretValueCommand): Promise<{ SecretString?: string }>;
}

export async function loadKolibriSystemSecret(
  environment: NodeJS.ProcessEnv = process.env,
  client?: SystemSecretClient,
): Promise<KolibriSystemSecret | null> {
  const secretName = systemSecretName(environment);

  const secretsClient =
    client ??
    new SecretsManagerClient({
      region: environment.AWS_REGION,
    } satisfies SecretsManagerClientConfig);

  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName }),
    );
    if (!response.SecretString?.trim()) return null;

    let value: unknown;
    try {
      value = JSON.parse(response.SecretString) as unknown;
    } catch {
      throw new Error('Kolibri system configuration is invalid');
    }
    if (!isObject(value)) {
      throw new Error('Kolibri system configuration is invalid');
    }
    return value;
  } catch (error) {
    if (isMissingSecret(error) || isMissingAwsCredentials(error)) return null;
    if (
      error instanceof Error &&
      error.message === 'Kolibri system configuration is invalid'
    ) {
      throw error;
    }
    throw new Error('Kolibri system configuration is unavailable');
  }
}

function isMissingAwsCredentials(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'CredentialsProviderError' ||
      error.message.includes('Could not load credentials'))
  );
}

function isMissingSecret(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'ResourceNotFoundException'
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
