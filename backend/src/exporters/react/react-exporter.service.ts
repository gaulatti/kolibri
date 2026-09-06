import { Injectable } from '@nestjs/common';
import type {
  GeneratedArtifact,
  KolibriDesignSystem,
} from '../../figma-importer/figma-importer.types';
import { ReactComponentGenerator } from './react-component.generator';
import { pascal } from './react-renderer.utils';
import { ReactStoryGenerator } from './react-story.generator';
import { ComposableReactComponentGenerator } from './composable-react-component.generator';
import { generateReactBehaviorRuntime } from './react-behavior-runtime.generator';

export type ReactGenerationContract = 'legacy' | 'composable-v1';

@Injectable()
export class ReactExporterService {
  private readonly components = new ReactComponentGenerator();
  private readonly stories = new ReactStoryGenerator();
  private readonly composableComponents =
    new ComposableReactComponentGenerator();

  generateComponents(
    designSystem: KolibriDesignSystem,
    generationContract: ReactGenerationContract = 'legacy',
  ): GeneratedArtifact[] {
    if (generationContract === 'composable-v1') {
      return this.generateComposableComponents(designSystem);
    }
    const componentArtifacts = designSystem.components.map((component) => ({
      path: `components/${pascal(component.name)}.tsx`,
      content: this.components.generate(component),
    }));
    const storyArtifacts = designSystem.components.map((component) => ({
      path: `components/${pascal(component.name)}.stories.tsx`,
      content: this.stories.story(component),
    }));
    return [
      ...componentArtifacts,
      ...storyArtifacts,
      {
        path: 'foundation/DesignTokens.stories.tsx',
        content: this.stories.foundationStory(designSystem.tokens),
      },
      {
        path: 'components/index.ts',
        content:
          designSystem.components
            .map((component) => `export * from './${pascal(component.name)}';`)
            .join('\n') + '\n',
      },
    ];
  }

  private generateComposableComponents(
    designSystem: KolibriDesignSystem,
  ): GeneratedArtifact[] {
    const generated = designSystem.components.map((component) => ({
      component,
      name: pascal(component.name),
      artifacts: this.composableComponents.generate(component),
    }));
    const componentArtifacts = generated.flatMap(
      ({ component, name, artifacts }) => [
        {
          path: `components/${name}/${name}.view.tsx`,
          content: artifacts.view,
        },
        {
          path: `components/${name}/${name}.contract.ts`,
          content: artifacts.contract,
        },
        {
          path: `components/${name}/${name}.tsx`,
          content: artifacts.binding,
        },
        {
          path: `components/${name}/${name}.stories.tsx`,
          content: this.stories.composableStory(component),
        },
        {
          path: `components/${name}/index.ts`,
          content: `export * from './${name}';\nexport * from './${name}.contract';\nexport * from './${name}.view';\n`,
        },
      ],
    );
    const manifest = {
      contractVersion: 'composable-v1',
      components: Object.fromEntries(
        generated.map(({ component, name, artifacts }) => [
          name,
          {
            sourceNodeId: component.id,
            sourceName: component.name,
            kind: component.kind,
            behavior: component.behavior?.kind ?? 'none',
            adapterRequired: component.behavior?.adapterRequired ?? false,
            adapterAttached:
              Boolean(component.behavior?.adapterRequired) &&
              artifacts.complete,
            requiredParts: component.behavior?.requiredParts ?? [],
            availableParts: [
              'root',
              ...new Set((component.parts ?? []).map((part) => part.name)),
            ],
            states: component.behavior?.states ?? [],
          },
        ]),
      ),
    };
    return [
      ...componentArtifacts,
      {
        path: 'behaviors/index.tsx',
        content: generateReactBehaviorRuntime(),
      },
      {
        path: 'foundation/DesignTokens.stories.tsx',
        content: this.stories.foundationStory(designSystem.tokens),
      },
      {
        path: 'components/index.ts',
        content:
          generated.map(({ name }) => `export * from './${name}';`).join('\n') +
          '\n',
      },
      {
        path: 'kolibri.manifest.json',
        content: `${JSON.stringify(manifest, null, 2)}\n`,
      },
    ];
  }
}
