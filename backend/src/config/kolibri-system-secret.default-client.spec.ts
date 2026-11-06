import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { loadKolibriSystemSecret } from './kolibri-system-secret';

describe('Kolibri system secret default client', () => {
  afterEach(() => jest.restoreAllMocks());

  it('builds a Secrets Manager client for the configured region when none is injected', async () => {
    const send = jest
      .spyOn(SecretsManagerClient.prototype, 'send')
      .mockResolvedValue({ SecretString: '{"postgresql":{}}' } as never);
    await expect(
      loadKolibriSystemSecret({ AWS_REGION: 'us-east-1' }),
    ).resolves.toEqual({ postgresql: {} });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
