import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { loadKolibriSystemSecret } from './kolibri-system-secret';

describe('Kolibri system secret', () => {
  it('retrieves a JSON object without interpreting unrelated configuration', async () => {
    const value = {
      postgresql: { username: 'runtime-user' },
      anotherRuntimeService: { enabled: true },
    };
    const send = jest.fn().mockResolvedValue({
      SecretString: JSON.stringify(value),
    });

    await expect(
      loadKolibriSystemSecret(
        {
          AWS_REGION: 'us-east-1',
          KOLIBRI_STACK_NAME: 'KolibriRuntime',
        },
        { send },
      ),
    ).resolves.toEqual(value);
    expect(send).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
    expect(sentCommand(send).input).toEqual({
      SecretId: 'KolibriRuntime/system',
    });
  });

  it('uses the default system-secret name and returns null when it has no data', async () => {
    const send = jest.fn().mockResolvedValue({});
    await expect(loadKolibriSystemSecret({}, { send })).resolves.toBeNull();
    expect(sentCommand(send).input).toEqual({
      SecretId: 'kolibri/system',
    });
  });

  it('falls back when local AWS credentials are unavailable', async () => {
    const error = new Error('Could not load credentials from any providers');
    error.name = 'CredentialsProviderError';
    const send = jest.fn().mockRejectedValue(error);

    await expect(loadKolibriSystemSecret({}, { send })).resolves.toBeNull();
  });

  it('returns a safe error without leaking AWS details or secret content', async () => {
    const send = jest
      .fn()
      .mockRejectedValue(new Error('sensitive AWS response detail'));

    await expect(
      loadKolibriSystemSecret(
        { KOLIBRI_STACK_NAME: 'KolibriRuntime' },
        { send },
      ),
    ).rejects.toThrow('Kolibri system configuration is unavailable');
  });

  it.each(['not-json', '[]'])(
    'rejects malformed system configuration %s',
    async (SecretString) => {
      const send = jest.fn().mockResolvedValue({ SecretString });
      await expect(loadKolibriSystemSecret({}, { send })).rejects.toThrow(
        'Kolibri system configuration is invalid',
      );
    },
  );

  it('treats a missing secret version and missing credential error name as unavailable configuration', async () => {
    await expect(
      loadKolibriSystemSecret(
        {},
        {
          send: jest
            .fn()
            .mockRejectedValue({ name: 'ResourceNotFoundException' }),
        },
      ),
    ).resolves.toBeNull();
    const error = new Error('another failure');
    error.name = 'CredentialsProviderError';
    await expect(
      loadKolibriSystemSecret({}, { send: jest.fn().mockRejectedValue(error) }),
    ).resolves.toBeNull();
  });
});

function sentCommand(send: jest.Mock): GetSecretValueCommand {
  const calls = send.mock.calls as unknown[][];
  return calls[0][0] as GetSecretValueCommand;
}
