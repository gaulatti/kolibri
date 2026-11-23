import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { loadKolibriSystemSecret } from './kolibri-system-secret';

const ENVELOPE_ENVIRONMENT = {
  AWS_REGION: 'us-east-1',
  SECRET_ARN:
    'arn:aws:secretsmanager:us-east-1:111111111111:secret:shared-AbCdEf',
  UNIQUE_KEY: 'opaque-kolibri-key',
};

describe('Kolibri system secret', () => {
  it('reads only Kolibri entry of the shared envelope, without interpreting its content', async () => {
    const entry = {
      postgresql: { username: 'runtime-user' },
      anotherRuntimeService: { enabled: true },
    };
    const send = jest.fn().mockResolvedValue({
      SecretString: JSON.stringify({
        'someone-elses-key': { password: 'not-for-kolibri' },
        'opaque-kolibri-key': entry,
      }),
    });

    await expect(
      loadKolibriSystemSecret(ENVELOPE_ENVIRONMENT, { send }),
    ).resolves.toEqual(entry);
    expect(send).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
    expect(sentCommand(send).input).toEqual({
      SecretId: ENVELOPE_ENVIRONMENT.SECRET_ARN,
    });
  });

  it('is not configured, and reads nothing, when neither envelope variable is set', async () => {
    const send = jest.fn();
    await expect(loadKolibriSystemSecret({}, { send })).resolves.toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    { SECRET_ARN: 'arn:only' },
    { UNIQUE_KEY: 'only-the-key' },
    { SECRET_ARN: '  ', UNIQUE_KEY: 'key' },
    { SECRET_ARN: 'arn:x', UNIQUE_KEY: ' ' },
  ])('refuses half an envelope reference %j', async (environment) => {
    const send = jest.fn();
    await expect(
      loadKolibriSystemSecret(environment, { send }),
    ).rejects.toThrow('SECRET_ARN and UNIQUE_KEY must be set together');
    expect(send).not.toHaveBeenCalled();
  });

  it('reads process.env when no environment is given', async () => {
    const saved = { ...process.env };
    delete process.env.SECRET_ARN;
    delete process.env.UNIQUE_KEY;
    try {
      await expect(loadKolibriSystemSecret()).resolves.toBeNull();
    } finally {
      process.env = saved;
    }
  });

  it('returns null when the envelope has no data', async () => {
    const send = jest.fn().mockResolvedValue({});
    await expect(
      loadKolibriSystemSecret(ENVELOPE_ENVIRONMENT, { send }),
    ).resolves.toBeNull();
  });

  it('returns a safe error without leaking AWS details or secret content', async () => {
    const send = jest
      .fn()
      .mockRejectedValue(new Error('sensitive AWS response detail'));

    await expect(
      loadKolibriSystemSecret(ENVELOPE_ENVIRONMENT, { send }),
    ).rejects.toThrow('Kolibri system configuration is unavailable');
  });

  it.each([
    'not-json',
    '[]',
    '{"other-key":{}}',
    '{"opaque-kolibri-key":"text"}',
    '{"opaque-kolibri-key":[]}',
  ])(
    'rejects a malformed envelope or a missing entry %s',
    async (SecretString) => {
      const send = jest.fn().mockResolvedValue({ SecretString });
      await expect(
        loadKolibriSystemSecret(ENVELOPE_ENVIRONMENT, { send }),
      ).rejects.toThrow('Kolibri system configuration is invalid');
    },
  );

  it('treats a missing envelope and unavailable credentials as no configuration', async () => {
    await expect(
      loadKolibriSystemSecret(ENVELOPE_ENVIRONMENT, {
        send: jest
          .fn()
          .mockRejectedValue({ name: 'ResourceNotFoundException' }),
      }),
    ).resolves.toBeNull();
    const byName = new Error('another failure');
    byName.name = 'CredentialsProviderError';
    await expect(
      loadKolibriSystemSecret(ENVELOPE_ENVIRONMENT, {
        send: jest.fn().mockRejectedValue(byName),
      }),
    ).resolves.toBeNull();
    await expect(
      loadKolibriSystemSecret(ENVELOPE_ENVIRONMENT, {
        send: jest
          .fn()
          .mockRejectedValue(
            new Error('Could not load credentials from any providers'),
          ),
      }),
    ).resolves.toBeNull();
  });
});

function sentCommand(send: jest.Mock): GetSecretValueCommand {
  const calls = send.mock.calls as unknown[][];
  return calls[0][0] as GetSecretValueCommand;
}
