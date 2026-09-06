import { SystemConfigurationService } from './system-configuration.service';
import { LocalRuntimeConfigurationClient } from '../secrets/local-runtime-configuration.client';

describe('SystemConfigurationService', () => {
  const originalRuntimeMode = process.env.KOLIBRI_RUNTIME_MODE;
  const send = jest.spyOn(LocalRuntimeConfigurationClient.prototype, 'send');

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.KOLIBRI_RUNTIME_MODE = 'local';
  });

  afterAll(() => {
    if (originalRuntimeMode === undefined) {
      delete process.env.KOLIBRI_RUNTIME_MODE;
    } else {
      process.env.KOLIBRI_RUNTIME_MODE = originalRuntimeMode;
    }
  });

  it('loads and normalizes the npm registry from local system configuration', async () => {
    send.mockResolvedValue({
      SecretString: JSON.stringify({
        npm: { registry: 'https://registry.example.com/npm' },
      }),
    });
    const service = new SystemConfigurationService();

    await expect(service.npmRegistry()).resolves.toBe(
      'https://registry.example.com/npm/',
    );
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('rejects an insecure remote registry', async () => {
    send.mockResolvedValue({
      SecretString: JSON.stringify({
        npm: { registry: 'http://registry.example.com' },
      }),
    });
    const service = new SystemConfigurationService();

    await expect(service.npmRegistry()).rejects.toThrow(
      'npm registry must use HTTPS',
    );
  });

  it('uses the default when local system configuration is empty', async () => {
    send.mockResolvedValue({ SecretString: '{}' });
    const service = new SystemConfigurationService();

    await expect(service.npmRegistry()).resolves.toBe(
      'https://registry.npmjs.org/',
    );
  });

  it('uses the default when the local secret string is absent', async () => {
    send.mockResolvedValue({});
    await expect(new SystemConfigurationService().npmRegistry()).resolves.toBe(
      'https://registry.npmjs.org/',
    );
  });

  it('caches the registry and accepts loopback HTTP registries', async () => {
    send.mockResolvedValue({
      SecretString: JSON.stringify({
        npm: { registry: 'http://127.0.0.1:4873' },
      }),
    });
    const service = new SystemConfigurationService();
    await expect(service.npmRegistry()).resolves.toBe('http://127.0.0.1:4873/');
    await service.npmRegistry();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['not json', 'Local system configuration is invalid'],
    [
      JSON.stringify({
        npm: { registry: 'https://user:pass@registry.example.com' },
      }),
      'invalid',
    ],
    [
      JSON.stringify({
        npm: { registry: 'https://registry.example.com?token=value' },
      }),
      'invalid',
    ],
    [
      JSON.stringify({
        npm: { registry: 'https://registry.example.com#fragment' },
      }),
      'invalid',
    ],
  ])(
    'rejects malformed local system configuration %#',
    async (SecretString, message) => {
      send.mockResolvedValue({ SecretString });
      await expect(
        new SystemConfigurationService().npmRegistry(),
      ).rejects.toThrow(message);
    },
  );
});
