import { applyProductionEnvironment } from './production-environment';

const PRODUCTION = {
  NODE_ENV: 'production',
  AWS_REGION: 'us-east-1',
  SECRET_ARN: 'arn:aws:secretsmanager:us-east-1:1:secret:shared',
  UNIQUE_KEY: 'opaque-kolibri-key',
};

function envelope(entry: unknown): { send: jest.Mock } {
  return {
    send: jest.fn().mockResolvedValue({
      SecretString: JSON.stringify({ 'opaque-kolibri-key': entry }),
    }),
  };
}

const GOOD_ENTRY = {
  cognito: {
    userPoolId: ' us-east-1_Pool ',
    appClientId: 'client-id',
    ignoredSecret: 'never-copied',
  },
  cors: { allowedOrigins: [' https://a.example ', 'https://b.example'] },
  postgresql: { password: 'never-copied-into-the-environment' },
  unlistedKey: 'never-copied',
};

describe('applyProductionEnvironment', () => {
  it('does nothing outside production, and reads no secret', async () => {
    const environment: NodeJS.ProcessEnv = { NODE_ENV: 'development' };
    const client = envelope(GOOD_ENTRY);
    await applyProductionEnvironment(environment, client);
    expect(client.send).not.toHaveBeenCalled();
    expect(environment).toEqual({ NODE_ENV: 'development' });
  });

  it('copies only the allow-listed Cognito and CORS fields and replaces what was set', async () => {
    const environment: NodeJS.ProcessEnv = {
      ...PRODUCTION,
      COGNITO_USER_POOL_ID: 'stale-pool',
      CORS_ALLOWED_ORIGINS: 'https://stale.example',
    };
    await applyProductionEnvironment(environment, envelope(GOOD_ENTRY));
    expect(environment).toEqual({
      ...PRODUCTION,
      COGNITO_USER_POOL_ID: 'us-east-1_Pool',
      COGNITO_APP_CLIENT_ID: 'client-id',
      CORS_ALLOWED_ORIGINS: 'https://a.example,https://b.example',
    });
  });

  it('defaults to process.env and the real mode when called with no arguments', async () => {
    const saved = { ...process.env };
    process.env.NODE_ENV = 'test';
    delete process.env.KOLIBRI_RUNTIME_MODE;
    try {
      await expect(applyProductionEnvironment()).resolves.toBeUndefined();
    } finally {
      process.env = saved;
    }
  });

  it('fails the start when production has no envelope configuration', async () => {
    await expect(
      applyProductionEnvironment({ NODE_ENV: 'production' }),
    ).rejects.toThrow('Kolibri production system configuration is required');
  });

  it.each([
    [{ ...GOOD_ENTRY, cognito: undefined }, 'cognito field'],
    [{ ...GOOD_ENTRY, cognito: [] }, 'cognito field'],
    [{ ...GOOD_ENTRY, cognito: { appClientId: 'c' } }, 'cognito.userPoolId'],
    [
      { ...GOOD_ENTRY, cognito: { userPoolId: 'p', appClientId: ' ' } },
      'cognito.appClientId',
    ],
    [{ ...GOOD_ENTRY, cors: undefined }, 'cors field'],
    [{ ...GOOD_ENTRY, cors: {} }, 'cors.allowedOrigins'],
    [{ ...GOOD_ENTRY, cors: { allowedOrigins: [] } }, 'cors.allowedOrigins'],
    [
      { ...GOOD_ENTRY, cors: { allowedOrigins: ['ok', ' '] } },
      'cors.allowedOrigins',
    ],
    [
      { ...GOOD_ENTRY, cors: { allowedOrigins: 'https://a.example' } },
      'cors.allowedOrigins',
    ],
  ])('stops the start for an invalid entry %#', async (entry, field) => {
    const environment: NodeJS.ProcessEnv = { ...PRODUCTION };
    await expect(
      applyProductionEnvironment(environment, envelope(entry)),
    ).rejects.toThrow(field);
    expect(environment).toEqual(PRODUCTION);
  });
});
