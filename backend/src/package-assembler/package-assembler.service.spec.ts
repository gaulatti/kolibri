import {
  derivePackageDirectoryName,
  loadGeneratedPackageConfig,
} from './generated-package-config';
import { PackageAssemblerService } from './package-assembler.service';

describe('PackageAssemblerService', () => {
  const assembler = new PackageAssemblerService();

  it.each([
    ['@kolibri/design-system', 'kolibri-design-system'],
    ['@acme/news-kit', 'acme-news-kit'],
    ['my-design-system', 'my-design-system'],
  ])('derives a safe directory for %s', (packageName, expected) => {
    expect(derivePackageDirectoryName(packageName)).toBe(expected);
  });

  it('loads defaults and honors configured package metadata', () => {
    expect(loadGeneratedPackageConfig({})).toEqual({
      packageName: '@kolibri/design-system',
      packageVersion: '0.1.0',
      packageDirectoryName: 'kolibri-design-system',
    });
    expect(
      loadGeneratedPackageConfig({
        KOLIBRI_PACKAGE_NAME: '@acme/news-kit',
        KOLIBRI_PACKAGE_VERSION: '0.2.0',
      }),
    ).toEqual({
      packageName: '@acme/news-kit',
      packageVersion: '0.2.0',
      packageDirectoryName: 'acme-news-kit',
    });
  });

  it('rejects package names that cannot form a safe directory', () => {
    expect(() =>
      loadGeneratedPackageConfig({ KOLIBRI_PACKAGE_NAME: '.' }),
    ).toThrow('safe directory name');
    expect(() =>
      loadGeneratedPackageConfig({ KOLIBRI_PACKAGE_NAME: '..' }),
    ).toThrow('safe directory name');
  });

  it('assembles a configurable standalone package layout', () => {
    const generated = assembler.assemblePackage({
      packageName: '@acme/news-kit',
      packageVersion: '0.2.0',
      packageRegistry: 'https://registry.npmjs.org',
      packageDirectoryName: 'acme-news-kit',
      packageDescription: 'Shared application components',
      cssArtifact: { path: 'styles/kolibri.css', content: ':root {}\n' },
      reactArtifacts: [
        {
          path: 'components/Button.tsx',
          content: 'export function Button() {}\n',
        },
        { path: 'components/index.ts', content: "export * from './Button';\n" },
      ],
      assetArtifacts: [
        {
          path: 'assets/figma-fixture.png',
          content: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'),
          encoding: 'base64',
        },
      ],
    });
    const byPath = new Map(
      generated.map((artifact) => [artifact.path, artifact.content]),
    );

    expect([...byPath.keys()]).toEqual(
      expect.arrayContaining([
        'acme-news-kit/package.json',
        'acme-news-kit/README.md',
        'acme-news-kit/tsconfig.json',
        'acme-news-kit/.storybook/main.ts',
        'acme-news-kit/.storybook/preview.ts',
        'acme-news-kit/src/index.ts',
        'acme-news-kit/src/styles/kolibri.css',
        'acme-news-kit/src/components/Button.tsx',
        'acme-news-kit/src/components/index.ts',
        'acme-news-kit/src/assets/figma-fixture.png',
      ]),
    );
    expect(
      generated.find(
        (artifact) =>
          artifact.path === 'acme-news-kit/src/assets/figma-fixture.png',
      ),
    ).toMatchObject({ encoding: 'base64' });
    expect(JSON.parse(byPath.get('acme-news-kit/package.json')!)).toMatchObject(
      {
        name: '@acme/news-kit',
        version: '0.2.0',
        description: 'Shared application components',
        publishConfig: {
          registry: 'https://registry.npmjs.org',
          access: 'public',
        },
        scripts: {
          storybook: 'storybook dev -p 6006',
          'build-storybook': 'storybook build',
        },
        files: ['dist', 'src', '.storybook'],
        dependencies: { 'lucide-react': '^0.563.0' },
      },
    );
    expect(byPath.get('acme-news-kit/README.md')).toContain(
      "import { Button, Hero } from '@acme/news-kit';",
    );
    expect(byPath.get('acme-news-kit/README.md')).toContain(
      'npm run storybook',
    );
    expect(byPath.get('acme-news-kit/README.md')).toContain(
      'npm run build-storybook',
    );
    expect(byPath.get('acme-news-kit/src/styles/kolibri.css')).toBe(
      ':root {}\n',
    );
  });

  it('omits the package description when the design system has none', () => {
    const generated = assembler.assemblePackage({
      packageName: '@acme/news-kit',
      packageVersion: '0.2.0',
      packageRegistry: 'https://registry.npmjs.org',
      packageDirectoryName: 'acme-news-kit',
      packageDescription: null,
      cssArtifact: { path: 'styles/kolibri.css', content: ':root {}\n' },
      reactArtifacts: [],
    });
    const manifest = JSON.parse(generated[0].content) as Record<
      string,
      unknown
    >;

    expect(manifest).not.toHaveProperty('description');
  });

  it('assembles the composable contract, manifest, adapters, and root assets', () => {
    const generated = assembler.assemblePackage({
      packageName: '@acme/news-kit',
      packageVersion: '2.0.0',
      packageRegistry: 'https://registry.npmjs.org',
      packageDirectoryName: 'acme-news-kit',
      generationContract: 'composable-v1',
      cssArtifact: {
        path: 'styles/kolibri.css',
        content: '.card { background: url("../assets/figma-image.png") }',
      },
      reactArtifacts: [
        {
          path: 'behaviors/index.tsx',
          content: 'export const behavior = true;',
        },
        {
          path: 'kolibri.manifest.json',
          content: '{"contractVersion":"composable-v1"}\n',
        },
      ],
      assetArtifacts: [
        {
          path: 'assets/figma-image.png',
          content: 'aW1hZ2U=',
          encoding: 'base64',
        },
      ],
    });
    const byPath = new Map(
      generated.map((artifact) => [artifact.path, artifact.content]),
    );
    const packageJson = JSON.parse(
      byPath.get('acme-news-kit/package.json')!,
    ) as Record<string, unknown>;

    expect(byPath.get('acme-news-kit/src/index.ts')).toContain(
      "export * from './behaviors'",
    );
    expect(byPath.has('acme-news-kit/styles/kolibri.css')).toBe(true);
    expect(byPath.has('acme-news-kit/assets/figma-image.png')).toBe(true);
    expect(byPath.has('acme-news-kit/kolibri.manifest.json')).toBe(true);
    expect(packageJson.version).toBe('2.0.0');
    expect(packageJson.files).toEqual(
      expect.arrayContaining(['dist', 'styles', 'assets', 'src']),
    );
    expect(packageJson.exports).toEqual(
      expect.objectContaining({ './manifest': './kolibri.manifest.json' }),
    );
    expect(byPath.get('acme-news-kit/README.md')).toContain(
      'Generated views and behavior',
    );
  });
});
