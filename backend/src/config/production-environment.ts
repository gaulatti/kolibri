import {
  loadKolibriSystemSecret,
  type SystemSecretClient,
} from './kolibri-system-secret';
import { runtimeMode } from './runtime-mode';

/**
 * In production the envelope entry is authoritative for the settings the
 * Nest modules read from the process environment: Cognito and CORS. Only these
 * allow-listed fields are copied; any other key in the entry is ignored, and
 * an existing environment value is replaced, never kept as a fallback. A
 * missing or malformed value stops the start. Local runs are not touched.
 * Call it before the application module is created.
 */
export async function applyProductionEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  client?: SystemSecretClient,
): Promise<void> {
  if (runtimeMode(environment) !== 'production') return;

  const entry = await loadKolibriSystemSecret(environment, client);
  if (!entry) {
    throw new Error('Kolibri production system configuration is required');
  }

  const cognito = objectField(entry, 'cognito');
  const userPoolId = stringField(cognito, 'cognito.userPoolId', 'userPoolId');
  const appClientId = stringField(
    cognito,
    'cognito.appClientId',
    'appClientId',
  );
  const origins = objectField(entry, 'cors').allowedOrigins;
  if (
    !Array.isArray(origins) ||
    origins.length === 0 ||
    !origins.every(
      (origin): origin is string =>
        typeof origin === 'string' && origin.trim() !== '',
    )
  ) {
    throw new Error(
      'Kolibri system configuration has an invalid cors.allowedOrigins field',
    );
  }

  environment.COGNITO_USER_POOL_ID = userPoolId;
  environment.COGNITO_APP_CLIENT_ID = appClientId;
  environment.CORS_ALLOWED_ORIGINS = origins
    .map((origin) => origin.trim())
    .join(',');
}

function objectField(
  entry: Record<string, unknown>,
  name: string,
): Record<string, unknown> {
  const value = entry[name];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(
      `Kolibri system configuration has an invalid ${name} field`,
    );
  }
  return value as Record<string, unknown>;
}

function stringField(
  source: Record<string, unknown>,
  label: string,
  key: string,
): string {
  const value = source[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `Kolibri system configuration has an invalid ${label} field`,
    );
  }
  return value.trim();
}
