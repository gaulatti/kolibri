const loadKolibriSystemSecret = jest.fn<
  Promise<Record<string, unknown> | null>,
  [NodeJS.ProcessEnv?]
>();
jest.mock('./kolibri-system-secret', () => ({
  loadKolibriSystemSecret: (environment?: NodeJS.ProcessEnv) =>
    loadKolibriSystemSecret(environment),
}));

import { SystemConfigurationService } from './system-configuration.service';

describe('SystemConfigurationService production source', () => {
  const previousMode = process.env.KOLIBRI_RUNTIME_MODE;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.KOLIBRI_RUNTIME_MODE = 'production';
  });
  afterAll(() => {
    if (previousMode === undefined) delete process.env.KOLIBRI_RUNTIME_MODE;
    else process.env.KOLIBRI_RUNTIME_MODE = previousMode;
  });

  it('loads the npm registry from the singleton system secret', async () => {
    loadKolibriSystemSecret.mockResolvedValue({
      npm: { registry: 'https://packages.example.com' },
    });
    await expect(new SystemConfigurationService().npmRegistry()).resolves.toBe(
      'https://packages.example.com/',
    );
    expect(loadKolibriSystemSecret).toHaveBeenCalled();
  });

  it('falls back when the production secret has no npm configuration', async () => {
    loadKolibriSystemSecret.mockResolvedValue(null);
    await expect(new SystemConfigurationService().npmRegistry()).resolves.toBe(
      'https://registry.npmjs.org/',
    );
  });
});
