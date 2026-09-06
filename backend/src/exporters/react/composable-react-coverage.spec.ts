import { applyComponentContract } from '../../component-contracts/component-contract.validator';
import type {
  Diagnostic,
  ImportedBehaviorContract,
  ImportedComponent,
  ImportedVisualNode,
  KolibriToken,
} from '../../figma-importer/figma-importer.types';
import { ComposableReactComponentGenerator } from './composable-react-component.generator';
import { ReactExporterService } from './react-exporter.service';
import { ReactStoryGenerator } from './react-story.generator';

function node(
  name: string,
  options: Partial<ImportedVisualNode> = {},
): ImportedVisualNode {
  return {
    id: options.id ?? `node:${name}`,
    key: options.key ?? name.toLowerCase().replace(/\W+/g, '-'),
    name,
    type: options.type ?? 'FRAME',
    visible: options.visible ?? true,
    semanticMetadata: options.semanticMetadata ?? {},
    style: options.style ?? {},
    vectors: options.vectors ?? [],
    children: options.children ?? [],
    ...options,
  };
}

function component(
  name = 'custom-widget',
  overrides: Partial<ImportedComponent> = {},
): ImportedComponent {
  return {
    id: 'component:1',
    name,
    kind: 'molecule',
    type: 'component',
    pageName: '03-molecules',
    semanticMetadata: {},
    style: {},
    variants: [],
    composition: [],
    vectors: [],
    visual: [],
    ...overrides,
  };
}

function behavior(
  kind: ImportedBehaviorContract['kind'],
  requiredParts: string[] = [],
): ImportedBehaviorContract {
  return {
    kind,
    adapterRequired: kind !== 'none' && kind !== 'native-control',
    requiredParts,
    optionalParts: [],
    states: ['open', 'closed'],
  };
}

describe('composable React exporter edge coverage', () => {
  const generator = new ComposableReactComponentGenerator();

  it('renders variants, state, text, vectors, nested parts, and fallback content', () => {
    const source = component('status-card', {
      defaultText: 'Fallback',
      semanticMetadata: { 'semantic.element': 'section' },
      behavior: behavior('none'),
      parts: [
        {
          name: 'title',
          sourceNodeId: 'node:title',
          required: false,
          repeatable: false,
          element: 'h3',
        },
      ],
      variants: [
        {
          id: 'variant:1',
          name: 'state=open, tone=info',
          axes: { state: 'open', tone: 'info' },
          style: {},
          vectors: [],
          composition: [],
          visual: [],
        },
        {
          id: 'variant:2',
          name: 'state=closed, tone=warning',
          axes: { state: 'closed', tone: 'warning' },
          style: {},
          vectors: [],
          composition: [],
          visual: [],
        },
      ],
      visual: [
        node('Hidden', { visible: false }),
        node('Title', {
          type: 'TEXT',
          text: 'Hello',
          part: 'title',
        }),
        node('Icon', {
          type: 'VECTOR',
          vectors: [
            {
              name: 'check',
              width: 16,
              height: 16,
              paths: [
                {
                  d: 'M0 0L1 1',
                  fill: '#fff',
                  stroke: '#000',
                  strokeWidth: 2,
                },
                { d: 'M1 1L2 2' },
              ],
            },
          ],
        }),
        node('Container', {
          children: [
            node('Empty'),
            node('Duplicate'),
            node('Duplicate', { id: 'node:duplicate-two' }),
            node('Plain text', { type: 'TEXT', text: 'Plain' }),
            node('Missing text', { type: 'TEXT' }),
            node('---', { id: 'node:unnamed' }),
          ],
        }),
      ],
    });

    const result = generator.generate(source);

    expect(result.view).toContain(
      "const PartRoot = slots?.['root'] ?? 'section'",
    );
    expect(result.view).toContain("const PartTitle = slots?.['title'] ?? 'h3'");
    expect(result.view).toContain('data-state={viewState ?? state}');
    expect(result.view).toContain('state?:');
    expect(result.view).toContain('<svg');
    expect(result.view).toContain('strokeWidth={2}');
    expect(result.view).toContain('__duplicate-2');
    expect(result.view).not.toContain('Hidden');
    expect(result.binding).toContain('StatusCardView as StatusCard');

    const fallback = generator.generate(
      component('fallback', { defaultText: 'Fallback text' }),
    );
    expect(fallback.view).toContain('Fallback text');
  });

  it('sanitizes unsafe root elements and uses all default part elements', () => {
    const parts = [
      'description',
      'close',
      'trigger',
      'actions',
      'list',
      'item',
      'panel',
      'content',
      'other',
    ];
    const source = component('parts', {
      semanticMetadata: { 'semantic.element': 'img' },
      parts: parts.map((part) => ({
        name: part,
        sourceNodeId: `node:${part}`,
        required: false,
        repeatable: false,
      })),
      visual: parts.map((part) => node(part, { part })),
    });

    const result = generator.generate(source);

    expect(result.view).toContain("const PartRoot = slots?.['root'] ?? 'div'");
    expect(result.view).toContain("?? 'p'");
    expect(result.view).toContain("?? 'button'");
    expect(result.view).toContain("?? 'footer'");
    expect(result.view).toContain("?? 'div'");

    const invalid = generator.generate(
      component('invalid-root', {
        semanticMetadata: { 'semantic.element': 'Not Valid' },
      }),
    );
    expect(invalid.view).toContain("PartRoot = slots?.['root'] ?? 'div'");
  });

  it('renders supported empty intrinsic roots without invalid children', () => {
    const fixtures = [
      component('image', {
        semanticMetadata: {
          'semantic.element': 'img',
          'prop.alt': 'Ocean cliffs',
        },
        style: { backgroundImageRef: 'image-ref' },
      }),
      component('image', {
        semanticMetadata: {
          'semantic.element': 'img',
          'accessibility.decorative': true,
        },
      }),
      component('text-input', {
        semanticMetadata: { 'semantic.element': 'input' },
        defaultText: 'Email address',
      }),
      component('checkbox', {
        semanticMetadata: { 'semantic.element': 'input' },
        behavior: behavior('native-control'),
        variants: [
          {
            id: 'checkbox:unchecked',
            name: 'state=unchecked',
            axes: { state: 'unchecked' },
            style: {},
            vectors: [],
            composition: [],
            visual: [],
          },
          {
            id: 'checkbox:checked',
            name: 'state=checked',
            axes: { state: 'checked' },
            style: {},
            vectors: [],
            composition: [],
            visual: [],
          },
        ],
      }),
      component('slider', {
        semanticMetadata: { 'semantic.element': 'input' },
      }),
      component('textarea', {
        semanticMetadata: { 'semantic.element': 'textarea' },
        defaultText: 'Tell us more',
      }),
      component('select', {
        semanticMetadata: { 'semantic.element': 'select' },
      }),
      component('divider', {
        semanticMetadata: { 'semantic.element': 'hr' },
      }),
    ];

    const views = fixtures.map((fixture) => generator.generate(fixture).view);

    expect(views[0]).toContain("new URL('../../assets/figma-image-ref.png'");
    expect(views[0]).toContain('alt="Ocean cliffs"');
    expect(views[1]).toContain("src={''}");
    expect(views[1]).toContain('alt=""');
    expect(views[2]).toContain('type="text"');
    expect(views[2]).toContain('placeholder="Email address"');
    expect(views[3]).toContain('type="checkbox"');
    expect(views[4]).toContain('type="range"');
    expect(views[5]).toContain('placeholder="Tell us more"');
    expect(views[6]).toContain("slots?.root ?? 'select'");
    expect(views[7]).toContain("slots?.root ?? 'hr'");
    for (const view of views) expect(view).toContain('<PartRoot');
    for (const view of views) expect(view).toContain('/>');
  });

  it('renders table visual rows as valid table sections and cells', () => {
    const table = component('table', {
      semanticMetadata: { 'semantic.element': 'table' },
      visual: [
        node('Header row', {
          children: [
            node('Name heading', {
              children: [node('Name', { type: 'TEXT', text: 'Name' })],
            }),
            node('Hidden heading', { visible: false }),
          ],
        }),
        node('Data row', {
          children: [
            node('Name cell', {
              children: [node('Ada', { type: 'TEXT', text: 'Ada' })],
            }),
          ],
        }),
        node('Hidden row', { visible: false }),
      ],
    });

    const view = generator.generate(table).view;

    expect(view).toContain('<thead>');
    expect(view).toContain('<tbody>');
    expect(view).toContain('<th scope="col"');
    expect(view).toContain('<td');
    expect(view).toContain('Ada');
    expect(view).not.toContain('Hidden heading');
    expect(view).not.toContain('Hidden row');

    const empty = generator.generate(
      component('table', {
        semanticMetadata: { 'semantic.element': 'table' },
      }),
    );
    expect(empty.view).not.toContain('<thead>');
  });

  it('renders a native control part as a valid empty intrinsic element', () => {
    const source = component('switch', {
      semanticMetadata: {
        'semantic.component': 'switch',
        'semantic.element': 'label',
      },
      parts: [
        {
          name: 'control',
          sourceNodeId: 'node:control',
          required: true,
          repeatable: false,
          element: 'input',
        },
      ],
      visual: [
        node('Control', {
          part: 'control',
          semanticMetadata: { 'semantic.element': 'input' },
          children: [node('Decorative child')],
        }),
      ],
    });

    const view = generator.generate(source).view;

    expect(view).toContain("const PartControl = slots?.['control'] ?? 'input'");
    expect(view).toContain('<PartControl');
    expect(view).toContain('data-part="control"');
    expect(view).toContain('className="kolibri-switch__control');
    expect(view).not.toContain('</PartControl>');
    expect(view).not.toContain('Decorative child');
  });

  it.each([
    ['dialog', 'withDialogBehavior'],
    ['accordion', 'withAccordionBehavior'],
    ['tabs', 'withTabsBehavior'],
    ['tooltip', 'withTooltipBehavior'],
    ['popover', 'withPopoverBehavior'],
    ['menu', 'withMenuBehavior'],
  ] as const)('binds the %s behavior family', (kind, factory) => {
    const source = component(`${kind}-fixture`, {
      behavior: behavior(kind, ['content']),
      parts: [
        {
          name: 'content',
          sourceNodeId: 'node:content',
          required: true,
          repeatable: false,
        },
      ],
      visual: [node('Content', { part: 'content' })],
    });
    expect(generator.generate(source).binding).toContain(`${factory}(`);
  });

  it('uses the disclosure fallback and leaves incomplete behavior view-only', () => {
    const unknown = component('unknown-behavior', {
      behavior: behavior('form', ['content']),
      parts: [
        {
          name: 'content',
          sourceNodeId: 'node:content',
          required: true,
          repeatable: false,
        },
      ],
      visual: [node('Content', { part: 'content' })],
    });
    unknown.behavior!.adapterRequired = true;
    expect(generator.generate(unknown).binding).toContain(
      'withDisclosureBehavior',
    );

    unknown.parts = [];
    expect(generator.generate(unknown).binding).toBe(
      "export { UnknownBehaviorView } from './UnknownBehavior.view';\n",
    );
  });

  it('covers contract diagnostics, repeated parts, and matching variants', () => {
    const diagnostics: Diagnostic[] = [];
    const source = component('modal', {
      semanticMetadata: { 'semantic.component': 'dialog' },
      visual: [
        node('Content one', {
          part: 'content',
          semanticMetadata: { 'semantic.element': 'article' },
        }),
        node('Content two', { part: 'content' }),
        node('Title', { part: 'title' }),
        node('Mystery', { part: 'mystery' }),
      ],
    });
    source.variants = [
      {
        id: 'variant:1',
        name: 'open',
        axes: {},
        style: {},
        vectors: [],
        composition: [],
        visual: source.visual,
      },
      {
        id: 'variant:2',
        name: 'closed',
        axes: {},
        style: {},
        vectors: [],
        composition: [],
        visual: source.visual,
      },
    ];

    const normalized = applyComponentContract(source, diagnostics);

    expect(normalized.parts?.filter((part) => part.name === 'content')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ repeatable: true, element: 'article' }),
        expect.objectContaining({ repeatable: true }),
      ]),
    );
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'UNKNOWN_COMPONENT_PART' }),
      ]),
    );
  });

  it('generates behavior stories for every adapter family', () => {
    const stories = new ReactStoryGenerator();
    const cases = [
      ['dialog', 'dialog'],
      ['accordion', 'accordion'],
      ['tabs', 'tabs'],
      ['tooltip', 'tooltip'],
      ['popover', 'popover'],
      ['menu', 'menu'],
    ] as const;
    for (const [name, kind] of cases) {
      const source = component(name, {
        behavior: behavior(kind, ['content']),
        parts: [
          {
            name: 'content',
            sourceNodeId: 'node:content',
            required: true,
            repeatable: false,
          },
        ],
      });
      expect(stories.composableStory(source)).toContain('BehaviorContract');
    }
  });

  it('generates all foundation token previews', () => {
    const tokens: KolibriToken[] = [
      {
        kind: 'color',
        name: 'blue',
        cssName: '--blue',
        value: '#00f',
        sourceNodeId: 'token:1',
      },
      {
        kind: 'space',
        name: 'space',
        cssName: '--space',
        value: 8,
        sourceNodeId: 'token:2',
      },
      {
        kind: 'radius',
        name: 'radius',
        cssName: '--radius',
        value: 4,
        sourceNodeId: 'token:3',
      },
      {
        kind: 'typography',
        name: 'body',
        cssName: '--body',
        value: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400 },
        sourceNodeId: 'token:4',
      },
      {
        kind: 'typography',
        name: 'empty-type',
        cssName: '--empty-type',
        value: {},
        sourceNodeId: 'token:4b',
      },
      {
        kind: 'shadow',
        name: 'shadow',
        cssName: '--shadow',
        value: '0 1px 2px #000',
        sourceNodeId: 'token:5',
      },
      {
        kind: 'size',
        name: 'size',
        cssName: '--size',
        value: { width: 320, height: 120 },
        sourceNodeId: 'token:6',
      },
      {
        kind: 'size',
        name: 'default-size',
        cssName: '--default-size',
        value: {},
        sourceNodeId: 'token:6b',
      },
    ];
    const story = new ReactStoryGenerator().foundationStory(tokens);
    expect(story).toContain('The quick brown fox');
    expect(story).toContain('minWidth: 2');
    expect(story).toContain('boxShadow');
  });

  it('covers shell and complex variant story generation', () => {
    const source = component('app-shell', {
      sourceWidth: 1200,
      sourceHeight: 800,
      style: { heightMode: 'fill' },
      variants: [
        {
          id: 'v:1',
          name: '',
          axes: {},
          style: {},
          vectors: [],
          composition: [],
          visual: [],
        },
        {
          id: 'v:2',
          name: '',
          axes: {},
          style: {},
          vectors: [],
          composition: [],
          visual: [],
        },
        ...['one', 'two', 'three', 'four', 'five'].map((value, index) => ({
          id: `v:${index + 3}`,
          name: `density=${value}`,
          axes: { density: value },
          style: {},
          vectors: [],
          composition: [],
          visual: [],
        })),
      ],
    });

    const story = new ReactStoryGenerator().story(source);

    expect(story).toContain("layout: 'fullscreen'");
    expect(story).not.toContain('decorators:');
    expect(story).toContain('export const Default2');
    expect(story).toContain('"type":"select"');

    const sized = new ReactStoryGenerator().story(
      component('panel', {
        sourceWidth: 300,
        sourceHeight: 200,
        style: { heightMode: 'fill' },
      }),
    );
    expect(sized).toContain('width: 300, height: 200');
  });

  it('covers manifest defaults and incomplete adapter metadata', () => {
    const source = component('modal', {
      behavior: behavior('dialog', ['content']),
    });
    const artifacts = new ReactExporterService().generateComponents(
      {
        tokens: [],
        fontSources: [],
        imageReferences: [],
        components: [source],
        diagnostics: [],
      },
      'composable-v1',
    );
    const manifest = JSON.parse(
      artifacts.find((artifact) => artifact.path === 'kolibri.manifest.json')!
        .content,
    ) as { components: { Modal: { adapterAttached: boolean } } };
    expect(manifest.components.Modal.adapterAttached).toBe(false);
  });
});
