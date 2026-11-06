import type {
  ImportedComponent,
  ImportedComponentInstance,
  ImportedComponentVariant,
  ImportedVisualNode,
} from '../../figma-importer/figma-importer.types';
import { ComposableReactComponentGenerator } from './composable-react-component.generator';
import { ReactComponentGenerator } from './react-component.generator';
import { ReactExporterService } from './react-exporter.service';
import * as utils from './react-renderer.utils';
import { ReactStoryGenerator } from './react-story.generator';

function visual(
  name: string,
  overrides: Partial<ImportedVisualNode> = {},
): ImportedVisualNode {
  return {
    id: name,
    key: name,
    name,
    type: 'FRAME',
    visible: true,
    semanticMetadata: {},
    style: {},
    vectors: [],
    children: [],
    ...overrides,
  };
}

function text(content: string): ImportedVisualNode {
  return visual(content, { type: 'TEXT', text: content });
}

function instance(
  name: string,
  overrides: Partial<ImportedComponentInstance> = {},
): ImportedComponentInstance {
  return {
    id: name,
    name,
    cssClass: name,
    componentId: name,
    visible: true,
    semanticMetadata: {},
    style: {},
    children: [],
    ...overrides,
  };
}

function variant(
  name: string,
  axes: Record<string, string>,
  overrides: Partial<ImportedComponentVariant> = {},
): ImportedComponentVariant {
  return {
    id: name,
    name,
    axes,
    style: {},
    vectors: [],
    composition: [],
    visual: [],
    ...overrides,
  };
}

function component(
  name: string,
  overrides: Partial<ImportedComponent> = {},
): ImportedComponent {
  return {
    id: `component:${name}`,
    name,
    kind: 'atom',
    type: 'component',
    pageName: 'atoms',
    semanticMetadata: {},
    style: {},
    variants: [],
    composition: [],
    vectors: [],
    visual: [],
    ...overrides,
  };
}

describe('legacy generator input fallbacks', () => {
  const generator = new ReactComponentGenerator();

  it('names icons by variant name when the variant has no icon axis', () => {
    const output = generator.generate(
      component('icon', { variants: [variant('check', {})] }),
    );
    expect(output).toContain("'check':");
  });

  it('reads radio options from the default variant visual when variants exist', () => {
    const output = generator.generate(
      component('radio-group', {
        variants: [variant('v', {}, { visual: [text('From variant')] })],
        visual: [text('From component')],
      }),
    );
    expect(output).toContain('From variant');
    expect(output).not.toContain('From component');
  });

  it('points an avatar at its Figma image asset when one is referenced', () => {
    const output = generator.generate(
      component('avatar', { style: { backgroundImageRef: 'face' } }),
    );
    expect(output).toContain('../assets/figma-face.png');
  });

  it('reads page header content from the default variant visual', () => {
    const output = generator.generate(
      component('page-header', {
        variants: [
          variant(
            'v',
            {},
            {
              visual: [
                visual('Breadcrumbs', { children: [text('Variant crumb')] }),
              ],
            },
          ),
        ],
      }),
    );
    expect(output).toContain('Variant crumb');
  });

  it('fills missing navigation labels and links of a composed site header', () => {
    const output = generator.generate(
      component('site-header', {
        semanticMetadata: {
          'content.navigation': 'Only label',
          'navigation.hrefs': '/only',
        },
        composition: [
          instance('navigation-item one'),
          instance('navigation-item two'),
          instance('navigation-item three', { textOverride: 'Custom' }),
          instance('button', { textOverride: 'Join now' }),
        ],
      }),
    );
    expect(output).toContain("{ label: 'Only label', href: '/only' }");
    expect(output).toContain("{ label: 'Navigation item', href: '#' }");
    expect(output).toContain("{ label: 'Custom', href: '#' }");
    expect(output).toContain('Join now');
  });

  it('falls back to the default header action when its button carries no override', () => {
    const output = generator.generate(
      component('site-header', { composition: [instance('button')] }),
    );
    expect(output).toContain('Get Started');
  });

  it('fills missing links of a plain site header', () => {
    const output = generator.generate(
      component('site-header', {
        semanticMetadata: {
          'content.navigation': 'One|Two',
          'navigation.hrefs': '/one',
        },
      }),
    );
    expect(output).toContain("{ label: 'Two', href: '#' }");
  });

  it('builds the signup form from composed field and button instances', () => {
    const withOverrides = generator.generate(
      component('signup-form', {
        composition: [
          instance('form-field', {
            children: [
              instance('first', { componentName: 'text-input' }),
              instance('text-input two', {
                textOverride: 'name@example.com',
              }),
            ],
          }),
          instance('button', { textOverride: 'Send it' }),
        ],
      }),
    );
    expect(withOverrides).toContain('Send it');

    const placeholder = generator.generate(
      component('signup-form', {
        composition: [
          instance('form-field', {
            children: [
              instance('text-input', { textOverride: 'name@example.com' }),
            ],
          }),
          instance('button'),
        ],
      }),
    );
    expect(placeholder).toContain('name@example.com');
    expect(placeholder).toContain('Submit');
  });

  it('renders a void generic element without children', () => {
    const output = generator.generate(
      component('rule', { semanticMetadata: { 'semantic.element': 'hr' } }),
    );
    expect(output).toContain('<Element className=');
    expect(output).not.toContain('{children ??');
  });
});

describe('composable generator fallbacks', () => {
  const generator = new ComposableReactComponentGenerator();

  it('uses an empty alternative text for an image that declares none', () => {
    const { view } = generator.generate(
      component('image', { semanticMetadata: { 'semantic.element': 'img' } }),
    );
    expect(view).toContain('alt=""');
  });

  it('numbers table cells whose names produce no class segment', () => {
    const { view } = generator.generate(
      component('table', {
        semanticMetadata: { 'semantic.element': 'table' },
        visual: [
          visual('Header', {
            children: [visual('***'), visual('Named')],
          }),
        ],
      }),
    );
    expect(view).toContain('__cell-0');
    expect(view).toContain('__named');
  });
});

describe('renderer utilities', () => {
  it('camel-cases multi-part variant axes', () => {
    expect(utils.variantPropName('prop.icon-size')).toBe('iconSize');
    expect(utils.variantPropName('Size')).toBe('size');
    expect(utils.variantPropName('---')).toBe('variant');
  });

  it('matches only the axes a variant defines when building generic variant classes', () => {
    const source = component('sample', {
      variants: [
        variant('a', { size: 'sm' }),
        variant('b', { size: 'lg' }),
        variant('c', {}),
      ],
    });
    const css = utils.genericVariantClass(source, [
      { source: 'size', prop: 'size', values: ['sm', 'lg'] } as never,
    ]);
    expect(css).toContain("size === 'lg'");
    expect(css).toContain("size === ''");
  });

  it('uses the instance text fallback when the instance has no override', () => {
    const source = component('sample', { composition: [instance('heading')] });
    expect(utils.instanceText(source, 'heading', 'Fallback')).toBe('Fallback');
  });

  it('falls back when the named parent has no matching text child', () => {
    const source = component('sample', {
      visual: [visual('terms', { children: [] })],
    });
    expect(utils.visualText(source, 'terms', 'Default terms')).toBe(
      'Default terms',
    );
    const bare = component('sample', {
      visual: [visual('terms', { children: [visual('Default terms')] })],
    });
    expect(utils.visualText(bare, 'terms', 'Default terms')).toBe(
      'Default terms',
    );
  });
});

describe('exporter manifest and stories without behavior', () => {
  it('records the no-behavior defaults in the manifest', () => {
    const artifacts = new ReactExporterService().generateComponents(
      {
        tokens: [],
        fontSources: [],
        imageReferences: [],
        components: [component('plain-card')],
        diagnostics: [],
      },
      'composable-v1',
    );
    const manifest = JSON.parse(
      artifacts.find((artifact) => artifact.path === 'kolibri.manifest.json')!
        .content,
    ) as { components: Record<string, Record<string, unknown>> };
    expect(manifest.components.PlainCard).toMatchObject({
      behavior: 'none',
      adapterRequired: false,
      requiredParts: [],
      states: [],
    });
  });

  it('adds the behavior contract story only for components with a complete adapter', () => {
    const stories = new ReactStoryGenerator();
    const plain = stories.composableStory(component('plain-card'));
    expect(plain).not.toContain('BehaviorContract');
    const behavior = (kind: 'menu' | 'popover' | 'accordion' | 'dialog') =>
      component('widget', {
        behavior: {
          kind,
          adapterRequired: true,
          requiredParts: [],
          optionalParts: [],
          states: [],
        },
      });
    for (const kind of ['menu', 'popover', 'accordion', 'dialog'] as const) {
      expect(stories.composableStory(behavior(kind))).toContain(
        'BehaviorContract',
      );
    }
  });
});
