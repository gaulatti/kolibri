import {
  GetSecretValueCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import {
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { DesignSystem } from '../persistence/entities';
import { DesignSystemSecretsService } from './design-system-secrets.service';

const owner: AuthenticatedUser = {
  userReferenceId: 'fd803cd2-fb10-4d16-85ed-d93eb25a8e4f',
  cognitoSub: 'owner-cognito-sub',
};
const designSystemId = 'c1994330-51c5-4104-a54a-c90d940e03b3';
const secretName = 'kolibri/runtime/design-systems';
const runtimeInput = {
  figmaFileKey: 'AbCdEf_123-xyz',
  packageName: '@kolibri/ui',
};
const packageConfiguration = {
  name: runtimeInput.packageName,
  version: '1.0.0',
};
const credentialsInput = {
  figmaAccessToken: 'sensitive-figma-token',
  npmToken: 'sensitive-npm-token',
};

function record(): DesignSystem {
  return {
    id: designSystemId,
    ownerId: owner.userReferenceId,
    name: 'Kolibri UI',
    description: 'Shared application components',
    lastPublishedVersion: null,
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    updatedAt: new Date('2026-08-01T12:00:00.000Z'),
    owner: undefined as never,
    generationRuns: [],
  };
}

describe('DesignSystemSecretsService', () => {
  const loggerError = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
  const findOne = jest.fn();
  const send = jest.fn();
  const resolveNextVersion = jest.fn();
  const npmRegistry = jest.fn();
  let service: DesignSystemSecretsService;

  function sentCommand(index: number): unknown {
    return (send.mock.calls as unknown[][])[index]?.[0];
  }

  beforeEach(() => {
    jest.clearAllMocks();
    findOne.mockResolvedValue(record());
    resolveNextVersion.mockResolvedValue({
      version: '1.0.0',
      registry: 'https://registry.npmjs.org/',
    });
    npmRegistry.mockResolvedValue('https://registry.npmjs.org/');
    send.mockImplementation((command: unknown) =>
      Promise.resolve(
        command instanceof GetSecretValueCommand
          ? { SecretString: JSON.stringify({}) }
          : {},
      ),
    );
    service = new DesignSystemSecretsService(
      { findOne } as unknown as Repository<DesignSystem>,
      { send },
      secretName,
      { resolveNextVersion } as never,
      { npmRegistry } as never,
    );
  });

  it('stores runtime configuration under the PostgreSQL design-system ID', async () => {
    const otherId = '32026b57-f1d9-4bfd-a55a-e4dd98750f04';
    send.mockResolvedValueOnce({
      SecretString: JSON.stringify({
        [designSystemId]: {
          figma: { fileKey: 'old-key', accessToken: 'old-token' },
          package: {
            name: '@old/package',
            version: '0.1.0',
            registry: 'https://registry.example.com',
          },
          npm: { token: 'preserved-npm-token' },
        },
        [otherId]: {
          figma: { fileKey: 'other-key', accessToken: 'other-token' },
        },
      }),
    });

    const result = await service.setRuntimeConfiguration(
      owner,
      designSystemId,
      runtimeInput,
    );

    expect(result).toMatchObject({
      designSystemId,
      packageVersion: '1.0.0',
      npmRegistry: 'https://registry.npmjs.org/',
    });
    expect(sentCommand(0)).toBeInstanceOf(GetSecretValueCommand);
    expect(sentCommand(1)).toBeInstanceOf(PutSecretValueCommand);
    expect(sentCommand(1)).toEqual(
      expect.objectContaining({
        input: {
          SecretId: secretName,
          SecretString: JSON.stringify({
            [designSystemId]: {
              figma: {
                fileKey: runtimeInput.figmaFileKey,
                accessToken: 'old-token',
              },
              package: {
                name: runtimeInput.packageName,
                version: '1.0.0',
              },
              npm: { token: 'preserved-npm-token' },
            },
            [otherId]: {
              figma: { fileKey: 'other-key', accessToken: 'other-token' },
            },
          }),
        },
      }),
    );
  });

  it.each([[{ name: 'ResourceNotFoundException' }], [null]])(
    'initializes an unversioned or empty CDK secret as an object',
    async (initial) => {
      if (initial)
        send.mockRejectedValueOnce(initial).mockResolvedValueOnce({});
      else
        send
          .mockResolvedValueOnce({ SecretString: '' })
          .mockResolvedValueOnce({});

      await service.setRuntimeConfiguration(
        owner,
        designSystemId,
        runtimeInput,
      );

      const write = sentCommand(1) as PutSecretValueCommand;
      expect(write).toBeInstanceOf(PutSecretValueCommand);
      expect(JSON.parse(write.input.SecretString!)).toEqual({
        [designSystemId]: {
          figma: {
            fileKey: runtimeInput.figmaFileKey,
          },
          package: {
            name: runtimeInput.packageName,
            version: '1.0.0',
          },
        },
      });
    },
  );

  it('updates credentials separately without returning or replacing readable settings', async () => {
    send.mockResolvedValueOnce({
      SecretString: JSON.stringify({
        [designSystemId]: {
          figma: { fileKey: runtimeInput.figmaFileKey },
          package: {
            ...packageConfiguration,
          },
        },
      }),
    });

    const result = await service.setRuntimeCredentials(
      owner,
      designSystemId,
      credentialsInput,
    );

    expect(result).toEqual({ designSystemId, configured: true });
    expect(JSON.stringify(result)).not.toContain(
      credentialsInput.figmaAccessToken,
    );
    const write = sentCommand(1) as PutSecretValueCommand;
    expect(JSON.parse(write.input.SecretString!)).toEqual({
      [designSystemId]: {
        figma: {
          fileKey: runtimeInput.figmaFileKey,
          accessToken: credentialsInput.figmaAccessToken,
        },
        package: {
          ...packageConfiguration,
        },
        npm: { token: credentialsInput.npmToken },
      },
    });
  });

  it('adds an npm token without requiring or replacing the Figma token', async () => {
    send.mockResolvedValueOnce({
      SecretString: JSON.stringify({
        [designSystemId]: {
          figma: {
            fileKey: runtimeInput.figmaFileKey,
            accessToken: credentialsInput.figmaAccessToken,
          },
          package: packageConfiguration,
        },
      }),
    });

    await service.setRuntimeCredentials(owner, designSystemId, {
      npmToken: credentialsInput.npmToken,
    });

    const write = sentCommand(1) as PutSecretValueCommand;
    expect(JSON.parse(write.input.SecretString!) as unknown).toEqual({
      [designSystemId]: {
        figma: {
          fileKey: runtimeInput.figmaFileKey,
          accessToken: credentialsInput.figmaAccessToken,
        },
        package: packageConfiguration,
        npm: { token: credentialsInput.npmToken },
      },
    });
  });

  it('rotates the Figma token without requiring or replacing the npm token', async () => {
    send.mockResolvedValueOnce({
      SecretString: JSON.stringify({
        [designSystemId]: {
          figma: { fileKey: runtimeInput.figmaFileKey, accessToken: 'old' },
          package: packageConfiguration,
          npm: { token: credentialsInput.npmToken },
        },
      }),
    });

    await service.setRuntimeCredentials(owner, designSystemId, {
      figmaAccessToken: credentialsInput.figmaAccessToken,
    });

    const write = sentCommand(1) as PutSecretValueCommand;
    expect(JSON.parse(write.input.SecretString!) as unknown).toEqual({
      [designSystemId]: {
        figma: {
          fileKey: runtimeInput.figmaFileKey,
          accessToken: credentialsInput.figmaAccessToken,
        },
        package: packageConfiguration,
        npm: { token: credentialsInput.npmToken },
      },
    });
  });

  it('returns readable settings and token status without exposing tokens', async () => {
    send.mockResolvedValueOnce({
      SecretString: JSON.stringify({
        [designSystemId]: {
          figma: {
            fileKey: runtimeInput.figmaFileKey,
            accessToken: credentialsInput.figmaAccessToken,
          },
          package: {
            ...packageConfiguration,
          },
          npm: { token: credentialsInput.npmToken },
        },
      }),
    });

    const view = await service.getRuntimeConfigurationView(
      owner,
      designSystemId,
    );

    expect(view).toEqual({
      designSystemId,
      figmaFileKey: runtimeInput.figmaFileKey,
      packageName: runtimeInput.packageName,
      packageVersion: '1.0.0',
      npmRegistry: 'https://registry.npmjs.org/',
      figmaAccessTokenConfigured: true,
      npmTokenConfigured: true,
      generationConfigured: true,
    });
    expect(JSON.stringify(view)).not.toContain(
      credentialsInput.figmaAccessToken,
    );
    expect(JSON.stringify(view)).not.toContain(credentialsInput.npmToken);
  });

  it('marks a token-shaped Figma file key as not ready for generation', async () => {
    send.mockResolvedValueOnce({
      SecretString: JSON.stringify({
        [designSystemId]: {
          figma: {
            fileKey: 'figd_this-is-a-token',
            accessToken: 'AbCdEf_123-xyz',
          },
          package: {
            ...packageConfiguration,
          },
        },
      }),
    });

    await expect(
      service.getRuntimeConfigurationView(owner, designSystemId),
    ).resolves.toMatchObject({
      figmaFileKey: 'figd_this-is-a-token',
      figmaAccessTokenConfigured: true,
      generationConfigured: false,
    });
  });

  it('retrieves one complete runtime configuration for generation', async () => {
    send.mockResolvedValueOnce({
      SecretString: JSON.stringify({
        [designSystemId]: {
          figma: {
            fileKey: runtimeInput.figmaFileKey,
            accessToken: credentialsInput.figmaAccessToken,
          },
          package: {
            ...packageConfiguration,
          },
          npm: { token: 'npm-token' },
        },
      }),
    });

    await expect(
      service.getRuntimeConfiguration(designSystemId),
    ).resolves.toEqual({
      figma: {
        fileKey: runtimeInput.figmaFileKey,
        accessToken: credentialsInput.figmaAccessToken,
      },
      package: {
        name: runtimeInput.packageName,
      },
      npm: { token: 'npm-token' },
    });
  });

  it('returns safe errors for unavailable or incomplete configuration', async () => {
    const leakedToken = 'npm_sensitive-token-value-123456';
    send.mockRejectedValueOnce(
      Object.assign(new Error(`AWS detail containing ${leakedToken}`), {
        name: 'CredentialsProviderError',
      }),
    );
    await expect(
      service.getRuntimeConfiguration(designSystemId),
    ).rejects.toEqual(
      expect.objectContaining({
        constructor: ServiceUnavailableException,
        message: 'Runtime configuration is unavailable for this design system',
      }),
    );
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'design_system_runtime_configuration_read_failed',
        secretName,
        designSystemId,
        errorName: 'CredentialsProviderError',
        errorMessage: 'AWS detail containing [REDACTED]',
        // Jest asymmetric matchers are intentionally assigned as expected values.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        errorStack: expect.stringContaining('[REDACTED]'),
      }),
    );
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain(leakedToken);

    send.mockResolvedValueOnce({ SecretString: '{}' });
    await expect(
      service.getRuntimeConfiguration(designSystemId),
    ).rejects.toEqual(
      expect.objectContaining({
        constructor: ServiceUnavailableException,
        message:
          'Runtime configuration is not configured for this design system',
      }),
    );
  });

  it('does not reveal another owner and never writes in that case', async () => {
    findOne.mockResolvedValue(null);
    await expect(
      service.setRuntimeConfiguration(owner, designSystemId, runtimeInput),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(send).not.toHaveBeenCalled();
  });

  it('removes only the deleted design-system key from the singleton', async () => {
    const otherId = '32026b57-f1d9-4bfd-a55a-e4dd98750f04';
    send.mockResolvedValueOnce({
      SecretString: JSON.stringify({
        [designSystemId]: { figma: { accessToken: 'remove-me' } },
        [otherId]: { figma: { accessToken: 'preserve-me' } },
      }),
    });

    await service.deleteDesignSystemConfiguration(designSystemId);

    const write = sentCommand(1) as PutSecretValueCommand;
    expect(JSON.parse(write.input.SecretString!)).toEqual({
      [otherId]: { figma: { accessToken: 'preserve-me' } },
    });
  });

  it('rejects empty credential updates and preserves an existing npm object', async () => {
    await expect(
      service.setRuntimeCredentials(owner, designSystemId, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    send.mockResolvedValueOnce({
      SecretString: JSON.stringify({
        [designSystemId]: { npm: { token: 'existing' } },
      }),
    });
    await service.setRuntimeCredentials(owner, designSystemId, {
      figmaAccessToken: ' new-figma ',
    });
    const write = sentCommand(1) as PutSecretValueCommand;
    expect(JSON.parse(write.input.SecretString!)).toMatchObject({
      [designSystemId]: {
        figma: { accessToken: 'new-figma' },
        npm: { token: 'existing' },
      },
    });
  });

  it('updates an existing package version and skips absent package configuration', async () => {
    send.mockResolvedValueOnce({
      SecretString: JSON.stringify({
        [designSystemId]: {
          package: { name: '@kolibri/ui', version: '1.0.0' },
        },
      }),
    });
    await service.updatePackageVersion(designSystemId, '1.0.1');
    expect(
      JSON.parse((sentCommand(1) as PutSecretValueCommand).input.SecretString!),
    ).toMatchObject({
      [designSystemId]: { package: { version: '1.0.1' } },
    });
    send.mockClear();
    send.mockResolvedValueOnce({ SecretString: '{}' });
    await service.updatePackageVersion(designSystemId, '1.0.2');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('returns an unconfigured view and runtime configuration without an npm token', async () => {
    send.mockResolvedValueOnce({
      SecretString: JSON.stringify({
        [designSystemId]: {
          figma: {
            fileKey: runtimeInput.figmaFileKey,
            accessToken: credentialsInput.figmaAccessToken,
          },
          package: { name: runtimeInput.packageName },
        },
      }),
    });
    await expect(
      service.getRuntimeConfiguration(designSystemId),
    ).resolves.toEqual({
      figma: {
        fileKey: runtimeInput.figmaFileKey,
        accessToken: credentialsInput.figmaAccessToken,
      },
      package: { name: runtimeInput.packageName },
    });
    send.mockResolvedValueOnce({ SecretString: '{}' });
    await expect(
      service.getRuntimeConfigurationView(owner, designSystemId),
    ).resolves.toMatchObject({
      figmaFileKey: null,
      packageName: null,
      packageVersion: null,
      figmaAccessTokenConfigured: false,
      npmTokenConfigured: false,
      generationConfigured: false,
    });
  });

  it('does not write when deleting an absent entry and maps malformed/write failures safely', async () => {
    send.mockResolvedValueOnce({ SecretString: '{}' });
    await service.deleteDesignSystemConfiguration(designSystemId);
    expect(send).toHaveBeenCalledTimes(1);

    send.mockRejectedValueOnce(new Error('write unavailable'));
    await expect(
      service.setRuntimeConfiguration(owner, designSystemId, runtimeInput),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    send.mockResolvedValueOnce({ SecretString: '[]' });
    await expect(
      service.getRuntimeConfiguration(designSystemId),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps runtime-view read failures without exposing provider details', async () => {
    send.mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(
      service.getRuntimeConfigurationView(owner, designSystemId),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'design_system_runtime_configuration_read_failed',
        designSystemId,
      }),
    );
  });
});
