import {
  GetSecretValueCommand,
  SecretsManagerClient,
  type SecretsManagerClientConfig,
} from '@aws-sdk/client-secrets-manager';

export type KolibriSystemSecret = Record<string, unknown>;

export interface SystemSecretClient {
  send(command: GetSecretValueCommand): Promise<{ SecretString?: string }>;
}

/**
 * Kolibri's production settings live in one entry of the shared Secrets Manager
 * envelope, the way Angelina and Pompeii keep theirs: `SECRET_ARN` names the
 * envelope (a JSON object) and `UNIQUE_KEY` the opaque key of Kolibri's entry.
 * The entry has the shape the system secret always had (`postgresql`,
 * `storage`, `npm`, plus `cognito` and `cors`). Returns null when neither
 * variable is set (local development) or the envelope cannot be read for lack
 * of credentials or because it does not exist; callers that need production
 * settings treat null as a startup failure.
 */
export async function loadKolibriSystemSecret(
  environment: NodeJS.ProcessEnv = process.env,
  client?: SystemSecretClient,
): Promise<KolibriSystemSecret | null> {
  const secretId = environment.SECRET_ARN?.trim();
  const entryKey = environment.UNIQUE_KEY?.trim();
  if (!secretId && !entryKey) return null;
  if (!secretId || !entryKey) {
    throw new Error('SECRET_ARN and UNIQUE_KEY must be set together');
  }

  const secretsClient =
    client ??
    new SecretsManagerClient({
      region: environment.AWS_REGION,
    } satisfies SecretsManagerClientConfig);

  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretId }),
    );
    if (!response.SecretString?.trim()) return null;

    let envelope: unknown;
    try {
      envelope = JSON.parse(response.SecretString) as unknown;
    } catch {
      throw new Error('Kolibri system configuration is invalid');
    }
    if (!isObject(envelope) || !isObject(envelope[entryKey])) {
      throw new Error('Kolibri system configuration is invalid');
    }
    return envelope[entryKey];
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
