import { access, readFile, stat } from 'node:fs/promises';
import type { SystemConfigurationService } from '../config/system-configuration.service';
import type { NpmProcessRunner } from './npm-process.runner';
import {
  NpmPublicationService,
  type PreparedNpmPackage,
} from './npm-publication.service';

const token = 'sensitive-npm-token';
const prepared: PreparedNpmPackage = {
  packageDirectoryName: 'kolibri-ui',
  artifacts: [
    {
      path: 'kolibri-ui/package.json',
      content: JSON.stringify({ name: '@kolibri/ui', version: '1.2.4' }),
    },
  ],
};

describe('NpmPublicationService', () => {
  const run: jest.MockedFunction<NpmProcessRunner['run']> = jest.fn();
  const registryFetch: jest.MockedFunction<typeof fetch> = jest.fn();
  const npmRegistry = jest
    .fn()
    .mockResolvedValue('https://registry.npmjs.org/');
  let service: NpmPublicationService;

  beforeEach(() => {
    jest.clearAllMocks();
    registryFetch.mockResolvedValue(
      new Response(JSON.stringify({ version: '1.2.3' }), { status: 200 }),
    );
    run.mockResolvedValue(undefined);
    service = new NpmPublicationService({ run }, registryFetch, {
      npmRegistry,
    } as unknown as SystemConfigurationService);
  });

  it('resolves the next patch from the system-configured registry', async () => {
    await expect(
      service.resolveNextVersion('@kolibri/ui', token),
    ).resolves.toEqual({
      registry: 'https://registry.npmjs.org/',
      version: '1.2.4',
    });

    const [requestedUrl, requestInit] = registryFetch.mock.calls[0];
    expect(requestedUrl).toBeInstanceOf(URL);
    if (!(requestedUrl instanceof URL)) throw new Error('Expected a URL');
    expect(requestedUrl.href).toBe(
      'https://registry.npmjs.org/@kolibri%2Fui/latest',
    );
    expect(new Headers(requestInit?.headers).get('Authorization')).toBe(
      `Bearer ${token}`,
    );
  });

  it('starts an unpublished package at 1.0.0 without transmitting a token', async () => {
    registryFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(service.resolveNextVersion('@kolibri/ui')).resolves.toEqual({
      registry: 'https://registry.npmjs.org/',
      version: '1.0.0',
    });
    expect(
      new Headers(registryFetch.mock.calls[0][1]?.headers).has('Authorization'),
    ).toBe(false);
  });

  it('preserves sanitized registry status and response details on lookup failure', async () => {
    registryFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'forbidden', token }), {
        status: 403,
      }),
    );

    let failure: unknown;
    try {
      await service.resolveNextVersion('@kolibri/ui', token);
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      name: 'NpmRegistryRequestError',
      statusCode: 403,
      command: 'GET https://registry.npmjs.org/@kolibri%2Fui/latest',
    });
    expect(JSON.stringify(failure)).toContain('forbidden');
    expect(JSON.stringify(failure)).not.toContain(token);
  });

  it('retains registry HTTP status when a denied lookup has no response body', async () => {
    registryFetch.mockResolvedValueOnce(new Response('', { status: 403 }));
    await expect(
      service.resolveNextVersion('@kolibri/ui'),
    ).rejects.toMatchObject({
      name: 'NpmRegistryRequestError',
      statusCode: 403,
      stderr: undefined,
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('increments the highest version already assigned by kolibri', async () => {
    await expect(
      service.resolveNextVersion('@kolibri/ui', undefined, '2.4.9'),
    ).resolves.toMatchObject({ version: '2.4.10' });
  });

  it('reserves a new major version for a breaking generation-contract change', async () => {
    await expect(
      service.resolveNextVersion('@kolibri/ui', undefined, '2.4.9', 'major'),
    ).resolves.toMatchObject({ version: '3.0.0' });
  });

  it('builds and publishes an assigned version securely', async () => {
    let npmrcPath = '';
    run.mockImplementation(async (_cwd: string, args: string[]) => {
      const userConfigIndex = args.indexOf('--userconfig');
      npmrcPath = args[userConfigIndex + 1];
      expect(args).not.toContain(token);
      expect((await stat(npmrcPath)).mode & 0o777).toBe(0o600);
      expect(await readFile(npmrcPath, 'utf8')).toContain(
        `:_authToken=${token}`,
      );
    });

    await expect(
      service.publishVersion({ version: '1.2.4', token }, prepared),
    ).resolves.toBe('1.2.4');
    expect(run.mock.calls.map((call) => call[1][0])).toEqual([
      'install',
      'run',
      'publish',
    ]);
    expect(run.mock.calls[0][1]).toEqual(
      expect.arrayContaining(['install', '--include=dev']),
    );
    expect(run.mock.calls[2][1]).toEqual(
      expect.arrayContaining(['--access', 'public']),
    );
    await expect(access(npmrcPath)).rejects.toBeDefined();
  });

  it('rejects artifacts that escape the generated package root', async () => {
    await expect(
      service.publishVersion(
        { version: '1.2.4', token },
        {
          packageDirectoryName: 'kolibri-ui',
          artifacts: [{ path: 'outside.txt', content: 'unsafe' }],
        },
      ),
    ).rejects.toThrow('outside its package root');
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects invalid registry versions and assigned package versions', async () => {
    registryFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ version: 'not-semver' })),
    );
    await expect(service.resolveNextVersion('@kolibri/ui')).rejects.toThrow(
      'invalid version',
    );
    await expect(
      service.publishVersion({ version: 'invalid', token }, prepared),
    ).rejects.toThrow('npm package version is invalid');
  });

  it.each([null, [], { version: 123 }])(
    'rejects malformed registry bodies %#',
    async (body) => {
      registryFetch.mockResolvedValueOnce(new Response(JSON.stringify(body)));
      await expect(service.resolveNextVersion('@kolibri/ui')).rejects.toThrow(
        'invalid version',
      );
    },
  );

  it('continues the serialized publication queue after a rejected publication', async () => {
    run.mockRejectedValueOnce(new Error('install failed'));
    await expect(
      service.publishVersion({ version: '1.2.4', token }, prepared),
    ).rejects.toThrow('install failed');
    run.mockResolvedValue(undefined);
    await expect(
      service.publishVersion({ version: '1.2.4', token }, prepared),
    ).resolves.toBe('1.2.4');
  });
});
