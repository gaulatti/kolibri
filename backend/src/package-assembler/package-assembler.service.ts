import { Injectable } from '@nestjs/common';
import type { GeneratedArtifact } from '../figma-importer/figma-importer.types';

export type PackageAssemblyInput = {
  packageName: string;
  packageVersion: string;
  packageRegistry: string;
  packageDirectoryName: string;
  packageDescription?: string | null;
  cssArtifact: GeneratedArtifact;
  reactArtifacts: GeneratedArtifact[];
  assetArtifacts?: GeneratedArtifact[];
  generationContract?: 'legacy' | 'composable-v1';
};

@Injectable()
export class PackageAssemblerService {
  assemblePackage(input: PackageAssemblyInput): GeneratedArtifact[] {
    const root = input.packageDirectoryName;
    return [
      {
        path: `${root}/package.json`,
        content: this.packageJson(
          input.packageName,
          input.packageVersion,
          input.packageRegistry,
          input.packageDescription,
          input.generationContract ?? 'legacy',
        ),
      },
      {
        path: `${root}/README.md`,
        content: this.readme(
          input.packageName,
          input.generationContract ?? 'legacy',
        ),
      },
      {
        path: `${root}/tsconfig.json`,
        content: this.tsconfig(input.generationContract ?? 'legacy'),
      },
      { path: `${root}/.storybook/main.ts`, content: this.storybookMain() },
      {
        path: `${root}/.storybook/preview.ts`,
        content: this.storybookPreview(),
      },
      {
        path: `${root}/src/index.ts`,
        content:
          input.generationContract === 'composable-v1'
            ? "export * from './components';\nexport * from './behaviors';\n"
            : "export * from './components';\n",
      },
      {
        path: `${root}/src/styles/kolibri.css`,
        content: input.cssArtifact.content,
      },
      ...(input.generationContract === 'composable-v1'
        ? [
            {
              path: `${root}/styles/kolibri.css`,
              content: input.cssArtifact.content,
            },
            ...input.reactArtifacts
              .filter((artifact) => artifact.path === 'kolibri.manifest.json')
              .map((artifact) => ({
                path: `${root}/kolibri.manifest.json`,
                content: artifact.content,
              })),
            ...(input.assetArtifacts ?? []).map((artifact) => ({
              path: `${root}/${artifact.path}`,
              content: artifact.content,
              encoding: artifact.encoding,
            })),
          ]
        : []),
      ...input.reactArtifacts.map((artifact) => ({
        path: `${root}/src/${artifact.path}`,
        content: artifact.content,
        encoding: artifact.encoding,
      })),
      ...(input.assetArtifacts ?? []).map((artifact) => ({
        path: `${root}/src/${artifact.path}`,
        content: artifact.content,
        encoding: artifact.encoding,
      })),
    ];
  }

  private packageJson(
    packageName: string,
    packageVersion: string,
    packageRegistry: string,
    packageDescription: string | null | undefined,
    generationContract: 'legacy' | 'composable-v1',
  ): string {
    return `${JSON.stringify(
      {
        name: packageName,
        version: packageVersion,
        ...(packageDescription ? { description: packageDescription } : {}),
        publishConfig: { registry: packageRegistry, access: 'public' },
        type: 'module',
        main: './dist/index.js',
        types: './dist/index.d.ts',
        exports: {
          '.': {
            types: './dist/index.d.ts',
            import: './dist/index.js',
          },
          './styles/kolibri.css':
            generationContract === 'composable-v1'
              ? './styles/kolibri.css'
              : './src/styles/kolibri.css',
          ...(generationContract === 'composable-v1'
            ? { './manifest': './kolibri.manifest.json' }
            : {}),
        },
        files:
          generationContract === 'composable-v1'
            ? [
                'dist',
                'styles',
                'assets',
                'src',
                '.storybook',
                'README.md',
                'kolibri.manifest.json',
              ]
            : ['dist', 'src', '.storybook'],
        sideEffects: ['**/*.css'],
        scripts: {
          build: 'tsc -p tsconfig.json',
          storybook: 'storybook dev -p 6006',
          'build-storybook': 'storybook build',
        },
        peerDependencies: { react: '>=18' },
        dependencies: { 'lucide-react': '^0.563.0' },
        devDependencies: {
          '@types/react': '^18.0.0',
          '@types/react-dom': '^18.0.0',
          '@storybook/react-vite': '^10.4.0',
          react: '^18.3.1',
          'react-dom': '^18.3.1',
          storybook: '^10.4.0',
          typescript: '^5.0.0',
          vite: '^7.0.0',
        },
      },
      null,
      2,
    )}\n`;
  }

  private tsconfig(generationContract: 'legacy' | 'composable-v1'): string {
    return `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          declaration: true,
          declarationMap: generationContract === 'composable-v1',
          sourceMap: generationContract === 'composable-v1',
          outDir: 'dist',
          rootDir: 'src',
          strict: true,
          skipLibCheck: true,
        },
        include: ['src'],
        exclude: [
          'src/**/*.stories.ts',
          'src/**/*.stories.tsx',
          'src/**/*.test.ts',
          'src/**/*.test.tsx',
        ],
      },
      null,
      2,
    )}\n`;
  }

  private storybookMain(): string {
    return `import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;
`;
  }

  private storybookPreview(): string {
    return `import type { Preview } from '@storybook/react-vite';
import '../src/styles/kolibri.css';

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    layout: 'centered',
  },
};

export default preview;
`;
  }

  private readme(
    packageName: string,
    generationContract: 'legacy' | 'composable-v1',
  ): string {
    const composableDocumentation =
      generationContract === 'composable-v1'
        ? `## Generated views and behavior

Every component exposes a visual \`ComponentNameView\`. Interactive components
also expose a behavior-bound \`ComponentName\` when their required semantic
parts were present in Figma. Views contain structure and styling only; adapters
own state, keyboard interaction, focus management, and ARIA wiring.

\`\`\`tsx
import { ModalView, withDialogBehavior } from '${packageName}';

// Use the generated adapter or replace it with your application's adapter.
const ProductModal = withDialogBehavior(ModalView);
\`\`\`

Slots replace the generated element for a semantic part. \`partProps\` adds
attributes or event handlers without depending on generated DOM depth or class
names. Adapter handlers compose with consumer handlers and honor
\`event.preventDefault()\`.

\`\`\`tsx
<ButtonView
  slots={{ root: ProductButton }}
  partProps={{ root: { 'data-analytics': 'checkout' } }}
>
  Continue
</ButtonView>
\`\`\`

Inspect \`kolibri.manifest.json\` for each component's source node, available
and required parts, behavior kind, states, and whether kolibri attached an
adapter. Components missing required parts remain usable as views and are
identified in generation diagnostics.

### Stability contract

Treat exported component names, props, slots, \`data-component\`, \`data-part\`,
and manifest fields as the public integration surface. Generated DOM depth and
internal CSS selectors are implementation details.

`
        : '';
    return `# ${packageName}

Generated by kolibri from the configured Figma design system.

Generation contract: \`${generationContract}\`.

## Usage

\`\`\`tsx
import '${packageName}/styles/kolibri.css';
import { Button, Hero } from '${packageName}';

export function App() {
  return (
    <>
      <Hero />
      <Button>Click me</Button>
    </>
  );
}
\`\`\`

${composableDocumentation}
## Storybook

The package includes Storybook configuration, a foundation-token story, and a
story for every generated component. Composable adapter stories also contain a
behavior-contract play test. The \`.storybook\` directory is hidden by default
on macOS but is included in this package.

\`\`\`bash
npm install
npm run storybook
\`\`\`

Build a static Storybook site with:

\`\`\`bash
npm run build-storybook
\`\`\`
`;
  }
}
