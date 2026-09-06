import {
  GetSecretValueCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalRuntimeConfigurationClient } from './local-runtime-configuration.client';

describe('LocalRuntimeConfigurationClient', () => {
  let directory: string;
  let filename: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'kolibri-runtime-'));
    filename = join(directory, 'runtime.sqlite');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('initializes an empty object and persists configuration in SQLite', async () => {
    const client = new LocalRuntimeConfigurationClient(filename);
    await expect(
      client.send(new GetSecretValueCommand({ SecretId: 'local' })),
    ).resolves.toEqual({ SecretString: '{}' });

    const configuration = JSON.stringify({
      'c1994330-51c5-4104-a54a-c90d940e03b3': {
        figma: { accessToken: 'local-sensitive-token' },
      },
    });
    await client.send(
      new PutSecretValueCommand({
        SecretId: 'local',
        SecretString: configuration,
      }),
    );

    const reopened = new LocalRuntimeConfigurationClient(filename);
    await expect(
      reopened.send(new GetSecretValueCommand({ SecretId: 'local' })),
    ).resolves.toEqual({ SecretString: configuration });
  });

  it('persists a valid initial object for a local secret substitute', async () => {
    const initial = JSON.stringify({
      npm: { registry: 'https://registry.npmjs.org' },
    });
    const client = new LocalRuntimeConfigurationClient(filename, initial);

    await expect(
      client.send(new GetSecretValueCommand({ SecretId: 'local-system' })),
    ).resolves.toEqual({ SecretString: initial });
  });

  it('rejects missing JSON writes and unsupported commands', async () => {
    const client = new LocalRuntimeConfigurationClient(filename);
    await expect(
      client.send(new PutSecretValueCommand({ SecretId: 'local' })),
    ).rejects.toThrow('must be JSON');
    await expect(client.send({} as never)).rejects.toThrow('Unsupported');
  });

  it('propagates non-missing database read failures', async () => {
    await expect(
      new LocalRuntimeConfigurationClient(directory).send(
        new GetSecretValueCommand({ SecretId: 'local' }),
      ),
    ).rejects.toBeDefined();
  });
});
