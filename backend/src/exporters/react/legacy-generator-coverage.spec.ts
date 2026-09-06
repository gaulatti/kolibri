import { generateComponentRules } from '../../css-exporter/component-css-rules';
import { CssExporterService } from '../../css-exporter/css-exporter.service';
import type {
  ImportedComponent,
  ImportedVisualNode,
  KolibriDesignSystem,
} from '../../figma-importer/figma-importer.types';
import { ReactComponentGenerator } from './react-component.generator';

function visual(
  name: string,
  children: ImportedVisualNode[] = [],
): ImportedVisualNode {
  return {
    id: `node:${name}`,
    key: name.toLowerCase().replace(/\W+/g, '-'),
    name,
    type: name.toLowerCase().includes('text') ? 'TEXT' : 'FRAME',
    text: name.toLowerCase().includes('text') ? name : undefined,
    visible: true,
    semanticMetadata: {},
    style: {},
    vectors: [],
    children,
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
    pageName: '02-atoms',
    semanticMetadata: {},
    style: {},
    variants: [],
    composition: [],
    vectors: [],
    visual: [],
    ...overrides,
  };
}

const specializedComponents = [
  'button',
  'heading',
  'paragraph',
  'image',
  'link',
  'text-input',
  'textarea',
  'badge',
  'divider',
  'icon',
  'checkbox',
  'loading-spinner',
  'radio-group',
  'slider',
  'switch',
  'select',
  'avatar',
  'hero',
  'form-field',
  'alert',
  'card',
  'navigation-item',
  'page-header',
  'profile-summary',
  'tooltip',
  'site-header',
  'signup-form',
  'card-grid',
] as const;

describe('legacy generator component families', () => {
  const generator = new ReactComponentGenerator();

  it.each(specializedComponents)('generates the %s family', (name) => {
    const output = generator.generate(
      component(name, {
        defaultText: "It's generated",
        semanticMetadata: {
          label: 'Fixture',
          'content.text': 'Text',
          'content.heading': 'Heading',
          'content.paragraph': 'Paragraph',
          'content.link': 'Link',
          'content.name': 'Name',
          'content.description': 'Description',
          'content.status': 'Active',
          'prop.alt': 'Alternative',
          'prop.type': 'submit',
          'prop.loading': 'eager',
          'prop.objectFit': 'contain',
          'prop.options': 'One,Two',
          'accessibility.level': '2',
          'accessibility.decorative': true,
          'accessibility.label': 'Accessible fixture',
          'link.href': '/fixture',
          'navigation.items': 'Home,Docs',
          icon: 'check',
        },
        visual: [
          visual('Image'),
          visual('Heading text'),
          visual('Paragraph text'),
          visual('Link text'),
        ],
      }),
    );
    expect(output).toContain('export');
  });

  it.each(specializedComponents)('generates the minimal %s family', (name) => {
    expect(generator.generate(component(name))).toContain('export');
  });

  it('generates a metadata-rich generic component', () => {
    const output = generator.generate(
      component('unknown', {
        semanticMetadata: {
          'semantic.element': 'section',
          state: 'active',
        },
        variants: [
          {
            id: 'variant:1',
            name: 'state=active',
            axes: { state: 'active' },
            style: {},
            vectors: [],
            composition: [],
            visual: [],
          },
          {
            id: 'variant:2',
            name: 'state=inactive',
            axes: { state: 'inactive' },
            style: {},
            vectors: [],
            composition: [],
            visual: [],
          },
        ],
        visual: [visual('Body text')],
      }),
    );
    expect(output).toContain('Unknown');
  });

  it('generates component-specific CSS branches and complete CSS output', () => {
    const nested = visual('Main', [
      visual('Back'),
      visual('Summary'),
      visual('Actions'),
    ]);
    const components = [
      component('button', {
        variants: [
          {
            id: 'v:1',
            name: 'variant=primary',
            axes: { variant: 'primary' },
            style: {},
            vectors: [],
            composition: [],
            visual: [],
          },
          {
            id: 'v:2',
            name: 'variant=secondary',
            axes: { variant: 'secondary' },
            style: {},
            vectors: [],
            composition: [],
            visual: [],
          },
        ],
      }),
      component('signup-form'),
      component('app-shell'),
      component('admin-shell'),
      component('card-grid', {
        semanticMetadata: {
          'responsive.stackAt': 720,
          'layout.columns': 4,
          'layout.minimumItemWidth': 240,
        },
      }),
      component('site-header'),
      component('page-header', {
        visual: [visual('Breadcrumbs'), nested],
      }),
      component('icon', { semanticMetadata: { 'visibility.feedback': true } }),
      component('checkbox'),
      component('textarea'),
      component('skeleton'),
      component('loading-spinner', {
        visual: [
          { ...visual('Track'), style: { borderColor: '#111111' } },
          {
            ...visual('Indicator'),
            style: { borderColor: 'rgba(0, 0, 0, 0.5)' },
          },
        ],
      }),
      component('radio-group', {
        visual: [{ ...visual('Dot'), style: { background: '#222222' } }],
      }),
      component('slider', {
        visual: [
          {
            ...visual('Track Bg'),
            name: 'track-bg',
            style: { background: '#dddddd' },
          },
          {
            ...visual('Track Fill'),
            name: 'track-fill',
            style: { background: 'currentColor' },
          },
          {
            ...visual('Thumb'),
            style: {
              background: '#ffffff',
              borderColor: '#000000',
              boxShadow: 'none',
            },
          },
        ],
      }),
      component('switch', {
        variants: [
          {
            id: 'off',
            name: 'state=off',
            axes: { state: 'off' },
            style: {},
            vectors: [],
            composition: [],
            visual: [
              {
                ...visual('Track'),
                style: { background: 'rgba(1, 2, 3, 0.4)' },
              },
              {
                ...visual('Thumb'),
                style: { background: '#ffffff', boxShadow: 'none' },
              },
              {
                ...visual('Label'),
                style: {
                  color: '#111111',
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: 400,
                  lineHeight: 14,
                },
              },
            ],
          },
          {
            id: 'on',
            name: 'state=on',
            axes: { state: 'on' },
            style: {},
            vectors: [],
            composition: [],
            visual: [{ ...visual('Track'), style: { background: '#00ff00' } }],
          },
        ],
      }),
      component('tooltip', {
        variants: [
          {
            id: 'top',
            name: 'prop.side=top',
            axes: { 'prop.side': 'top' },
            style: {},
            vectors: [],
            composition: [],
            visual: [
              {
                ...visual('Bubble'),
                style: { background: '#000000' },
                children: [
                  {
                    ...visual('Bubble Text'),
                    style: {
                      color: '#ffffff',
                      fontFamily: 'Inter',
                      fontSize: 12,
                      fontWeight: 500,
                      lineHeight: 14,
                    },
                  },
                ],
              },
              visual('Trigger'),
            ],
          },
        ],
      }),
    ];
    const rules = components.flatMap((item) =>
      generateComponentRules(item, [], []),
    );
    expect(rules.join('\n')).toContain('kolibri-button-secondary');
    expect(rules.join('\n')).toContain('@media');
    expect(rules.join('\n')).toContain('grid-template-columns');

    const designSystem: KolibriDesignSystem = {
      tokens: [],
      fontSources: [],
      imageReferences: [],
      components,
      diagnostics: [],
    };
    expect(new CssExporterService().generateCss(designSystem)).toContain(
      '.kolibri-button',
    );
  });

  it('generates specialized CSS fallback branches from minimal metadata', () => {
    const components = [
      component('card-grid'),
      component('page-header'),
      component('tooltip'),
      component('loading-spinner'),
      component('radio-group'),
      component('slider'),
      component('switch'),
    ];
    const css = components
      .flatMap((item) => generateComponentRules(item, [], []))
      .join('\n');
    expect(css).toContain('repeat(3, minmax(280px, 1fr))');
    expect(css).toContain('currentColor');
    expect(css).toContain('#d4d4d4');
    expect(css).toContain('#2c5784');
  });
});
