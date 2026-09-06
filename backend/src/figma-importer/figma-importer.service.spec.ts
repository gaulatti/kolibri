import type { FigmaFile, FigmaNode } from '../clients/figma/figma.types';
import { CssExporterService } from '../css-exporter/css-exporter.service';
import { ReactExporterService } from '../exporters/react/react-exporter.service';
import { FigmaImporterService } from './figma-importer.service';
import type {
  ImportedComponentInstance,
  ImportedVisualNode,
} from './figma-importer.types';

const solid = (r: number, g: number, b: number) => [
  { type: 'SOLID', color: { r, g, b, a: 1 } },
];

const tokenNode = (
  id: string,
  name: string,
  value: number | [number, number, number],
): FigmaNode =>
  Array.isArray(value)
    ? { id, name, type: 'RECTANGLE', fills: solid(...value) }
    : {
        id,
        name,
        type: 'RECTANGLE',
        absoluteBoundingBox: { width: value, height: value },
      };

const button = (
  id: string,
  name: string,
  background: [number, number, number],
  foreground: [number, number, number],
): FigmaNode => ({
  id,
  name,
  type: 'COMPONENT',
  fills: solid(...background),
  strokes: solid(0.13, 0.13, 0.13),
  paddingTop: 8,
  paddingRight: 16,
  paddingBottom: 8,
  paddingLeft: 16,
  cornerRadius: 6,
  children: [
    {
      id: `${id}:text`,
      name: 'Label',
      type: 'TEXT',
      fills: solid(...foreground),
    },
  ],
});

const fixture: FigmaFile = {
  document: {
    id: '0',
    name: 'Document',
    type: 'DOCUMENT',
    children: [
      {
        id: '1',
        name: '01-foundation',
        type: 'CANVAS',
        children: [
          tokenNode('1:1', 'color.primary', [0.13, 0.13, 0.13]),
          {
            id: '1:1:label',
            name: 'color.primary',
            type: 'TEXT',
            fills: solid(0, 0, 0),
          },
          tokenNode('1:2', 'color.secondary', [0.95, 0.95, 0.95]),
          tokenNode('1:3', 'space.100', 8),
          tokenNode('1:4', 'space.200', 16),
          tokenNode('1:5', 'space.300', 32),
          {
            id: '1:6',
            name: 'radius.200',
            type: 'FRAME',
            cornerRadius: 8,
          },
          {
            id: '1:7',
            name: 'font.body',
            type: 'TEXT',
            style: {
              fontFamily: 'Inter',
              fontSize: 16,
              fontWeight: 400,
              lineHeightPx: 24,
            },
          },
          {
            id: '1:8',
            name: 'size.icon.200',
            type: 'FRAME',
            absoluteBoundingBox: { width: 24, height: 24 },
          },
          {
            id: '1:9',
            name: 'font-source.inter',
            type: 'COMPONENT',
            componentPropertyDefinitions: {
              'font.family#1:0': { type: 'TEXT', defaultValue: 'Inter' },
              'font.provider#1:1': { type: 'TEXT', defaultValue: 'css' },
              'font.cssUrl#1:2': {
                type: 'TEXT',
                defaultValue:
                  'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
              },
              'font.fallback#1:3': {
                type: 'TEXT',
                defaultValue: 'sans-serif',
              },
            },
          },
        ],
      },
      {
        id: '2',
        name: '02-atoms',
        type: 'CANVAS',
        children: [
          {
            id: '2:1',
            name: 'button',
            type: 'COMPONENT_SET',
            children: [
              button(
                '2:2',
                'variant=primary',
                [0.13, 0.13, 0.13],
                [0.95, 0.95, 0.95],
              ),
              button(
                '2:3',
                'variant=secondary',
                [0.95, 0.95, 0.95],
                [0.13, 0.13, 0.13],
              ),
            ],
          },
          {
            id: '2:4',
            name: 'heading',
            type: 'COMPONENT',
            children: [
              {
                id: '2:4:1',
                name: 'Text',
                type: 'TEXT',
                characters: 'Heading',
                fills: solid(0.13, 0.13, 0.13),
                style: {
                  fontFamily: 'Inter',
                  fontSize: 32,
                  fontWeight: 700,
                  lineHeightPx: 38.727272,
                },
              },
            ],
          },
          {
            id: '2:5',
            name: 'paragraph',
            type: 'COMPONENT',
            children: [
              {
                id: '2:5:1',
                name: 'Text',
                type: 'TEXT',
                characters: 'Paragraph',
                fills: solid(0.13, 0.13, 0.13),
                style: {
                  fontFamily: 'Inter',
                  fontSize: 16,
                  fontWeight: 400,
                  lineHeightPx: 24,
                },
              },
            ],
          },
          {
            id: '2:6',
            name: 'image',
            type: 'COMPONENT',
            fills: [
              {
                type: 'IMAGE',
                imageRef: 'fixture-image-reference',
                scaleMode: 'FILL',
              },
            ],
            absoluteBoundingBox: { width: 400, height: 240 },
            cornerRadius: 8,
            componentPropertyDefinitions: {
              'semantic.element#7:22': {
                type: 'TEXT',
                defaultValue: 'img',
              },
              'prop.src#7:24': {
                type: 'TEXT',
                defaultValue: '/images/placeholder.jpg',
              },
              'prop.alt#7:25': {
                type: 'TEXT',
                defaultValue: 'Image description',
              },
              'prop.loading#7:26': { type: 'TEXT', defaultValue: 'lazy' },
              'prop.objectFit#7:27': { type: 'TEXT', defaultValue: 'cover' },
              'accessibility.decorative#7:28': {
                type: 'BOOLEAN',
                defaultValue: false,
              },
              'layout.widthMode#7:29': {
                type: 'TEXT',
                defaultValue: 'fixed',
              },
              'layout.width#7:30': { type: 'TEXT', defaultValue: '400' },
              'layout.maxWidth#7:31': { type: 'TEXT', defaultValue: '400' },
            },
          },
        ],
      },
      {
        id: '3',
        name: '03-molecules',
        type: 'CANVAS',
        children: [
          {
            id: '3:1',
            name: 'hero',
            type: 'COMPONENT',
            fills: solid(0.95, 0.95, 0.95),
            strokes: solid(0.1, 0.3, 0.8),
            strokeWeight: 3,
            individualStrokeWeights: {
              top: 0,
              right: 0,
              bottom: 0,
              left: 3,
            },
            paddingTop: 32,
            paddingRight: 32,
            paddingBottom: 32,
            paddingLeft: 32,
            itemSpacing: 16,
            layoutMode: 'VERTICAL',
            counterAxisAlignItems: 'CENTER',
            children: [
              {
                id: '3:2',
                name: 'image',
                type: 'INSTANCE',
                componentId: '2:6',
                absoluteBoundingBox: { width: 736, height: 240 },
                layoutSizingHorizontal: 'FILL',
                layoutSizingVertical: 'FIXED',
                componentProperties: {
                  'prop.src#7:24': {
                    type: 'TEXT',
                    value: '/images/hero.jpg',
                  },
                  'prop.alt#7:25': {
                    type: 'TEXT',
                    value: 'Kolibri hero image',
                  },
                },
              },
              {
                id: '3:3',
                name: 'heading',
                type: 'INSTANCE',
                componentId: '2:4',
                children: [
                  {
                    id: '3:3:1',
                    name: 'Text',
                    type: 'TEXT',
                    characters: 'Welcome to Kolibri',
                  },
                ],
              },
              {
                id: '3:4',
                name: 'paragraph',
                type: 'INSTANCE',
                componentId: '2:5',
                children: [
                  {
                    id: '3:4:1',
                    name: 'Text',
                    type: 'TEXT',
                    characters:
                      'A minimal, machine-readable design system built for validation and interoperability.',
                  },
                ],
              },
              {
                id: '3:5',
                name: 'button',
                type: 'INSTANCE',
                componentId: '2:2',
                children: [
                  {
                    id: '3:5:1',
                    name: 'Text',
                    type: 'TEXT',
                    characters: 'Get Started',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

describe('Kolibri import/export pipeline', () => {
  const importer = new FigmaImporterService();
  const exporter = new CssExporterService();
  const reactExporter = new ReactExporterService();
  const designSystem = importer.importDesignSystem(fixture);

  it('extracts named foundation nodes and components from their pages', () => {
    expect(designSystem.tokens).toHaveLength(8);
    expect(designSystem.tokens[0]).toMatchObject({
      name: 'color.primary',
      cssName: '--color-primary',
      value: '#212121',
      sourceNodeId: '1:1',
    });
    expect(designSystem.fontSources).toEqual([
      expect.objectContaining({
        family: 'Inter',
        provider: 'css',
        fallback: 'sans-serif',
      }),
    ]);
    expect(designSystem.imageReferences).toEqual(['fixture-image-reference']);
    expect(designSystem.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'button',
          kind: 'atom',
          type: 'componentSet',
          pageName: '02-atoms',
        }),
        expect.objectContaining({
          name: 'hero',
          kind: 'molecule',
          type: 'component',
          pageName: '03-molecules',
        }),
      ]),
    );
    const buttonComponent = designSystem.components.find(
      (component) => component.name === 'button',
    );
    expect(
      buttonComponent?.variants.map((variant) => variant.axes.variant),
    ).toEqual(['primary', 'secondary']);
    const heroComponent = designSystem.components.find(
      (component) => component.name === 'hero',
    );
    expect(
      heroComponent?.composition.map((instance) => instance.componentName),
    ).toEqual(expect.arrayContaining(['heading', 'paragraph', 'image']));
    expect(
      heroComponent?.composition.find(
        (instance) => instance.componentName === 'image',
      )?.style,
    ).toMatchObject({
      width: 736,
      widthMode: 'fill',
      maxWidth: 736,
      height: 240,
      heightMode: 'fixed',
    });
  });

  it('generates token-aware CSS for button variants and hero', () => {
    const css = exporter.generateCss(designSystem);
    expect(css).toContain('--space-300: 32px;');
    expect(css).toContain(
      '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap");',
    );
    expect(css).toContain('--radius-200: 8px;');
    expect(css).toContain('--font-body-size: 16px;');
    expect(css).toContain('--size-icon-200-width: 24px;');
    expect(css).toContain('background: var(--color-primary);');
    expect(css).toContain('color: var(--color-secondary);');
    expect(css).toContain('padding: var(--space-100) var(--space-200);');
    expect(css).toContain('.kolibri-button-secondary {');
    expect(css).toContain('.kolibri-hero {');
    expect(css).toContain('box-shadow: inset 3px 0 0');
    expect(css).toContain('padding: var(--space-300);');
    expect(css).toContain('gap: var(--space-200);');
    expect(css).toContain('.kolibri-heading {');
    expect(css).toContain('font-size: 32px;');
    expect(css).toContain('.kolibri-paragraph {');
    expect(css).toContain('.kolibri-image {');
    expect(css).toContain(
      'background-image: url("../assets/figma-fixture-image-reference.png");',
    );
    expect(css).toContain('border-radius: var(--radius-200);');
    expect(css).toContain('display: flex;');
    expect(css).toContain('align-items: center;');
    expect(css).toContain('.kolibri-hero .kolibri-hero__image {');
    expect(css).toContain('max-width: 736px;');
  });

  it('generates React components from atoms and hero composition', () => {
    const artifacts = reactExporter.generateComponents(designSystem);
    expect(artifacts.map((artifact) => artifact.path)).toEqual([
      'components/Button.tsx',
      'components/Heading.tsx',
      'components/Paragraph.tsx',
      'components/Image.tsx',
      'components/Hero.tsx',
      'components/Button.stories.tsx',
      'components/Heading.stories.tsx',
      'components/Paragraph.stories.tsx',
      'components/Image.stories.tsx',
      'components/Hero.stories.tsx',
      'foundation/DesignTokens.stories.tsx',
      'components/index.ts',
    ]);
    const hero = artifacts.find((artifact) =>
      artifact.path.endsWith('Hero.tsx'),
    )!;
    expect(hero.content).toContain(
      '<Image className="kolibri-hero__image" alt="Kolibri hero image" />',
    );
    expect(hero.content).not.toContain('/images/hero.jpg');
    expect(hero.content).toContain(
      '<Heading className="kolibri-hero__heading">Welcome to Kolibri</Heading>',
    );
    expect(hero.content).toContain(
      '<Button className="kolibri-hero__button">Get Started</Button>',
    );
    const buttonArtifact = artifacts.find((artifact) =>
      artifact.path.endsWith('Button.tsx'),
    )!;
    expect(buttonArtifact.content).toContain(
      "variant?: 'primary' | 'secondary'",
    );
    const imageArtifact = artifacts.find((artifact) =>
      artifact.path.endsWith('Image.tsx'),
    )!;
    expect(imageArtifact.content).toContain('<img');
    expect(imageArtifact.content).toContain(
      "new URL('../assets/figma-fixture-image-reference.png', import.meta.url).href",
    );
    expect(imageArtifact.content).toContain("alt={decorative ? '' : alt}");
    expect(imageArtifact.content).not.toContain('<div');
    const buttonStory = artifacts.find((artifact) =>
      artifact.path.endsWith('Button.stories.tsx'),
    )!;
    expect(buttonStory.content).toContain('export const Primary');
    expect(buttonStory.content).toContain('export const Secondary');
    expect(buttonStory.content).toContain('export const AllVariants');
    expect(buttonStory.content).toContain("name: 'All variants'");
    expect(buttonStory.content).toContain(
      "fontFamily: 'Encode Sans, sans-serif'",
    );
    expect(buttonStory.content).not.toContain('<strong>');
    expect(buttonStory.content).toContain(
      '"variant":{"control":{"type":"radio"},"options":["primary","secondary"]}',
    );
    expect(buttonStory.content).toContain(
      '<Button {...{"variant":"primary"}} />',
    );
    expect(buttonStory.content).toContain(
      '<Button {...{"variant":"secondary"}} />',
    );
    const iconArtifact = artifacts.find((artifact) =>
      artifact.path.endsWith('Icon.tsx'),
    );
    if (iconArtifact)
      expect(iconArtifact.content).not.toContain(
        "case 'arrow-right': return <></>",
      );
  });

  it('renders icon variant stories through the public name prop', () => {
    const icons = reactExporter.generateComponents({
      tokens: [],
      fontSources: [],
      imageReferences: [],
      diagnostics: [],
      components: [
        {
          id: 'icons',
          name: 'icon',
          kind: 'atom',
          type: 'componentSet',
          pageName: '02-atoms',
          semanticMetadata: { icon: 'arrow-right', 'prop.size': '24' },
          style: {},
          variants: [
            {
              id: 'arrow',
              name: 'icon=arrow-right',
              axes: { icon: 'arrow-right' },
              style: {},
              vectors: [],
              composition: [],
              visual: [],
            },
            {
              id: 'check',
              name: 'icon=check',
              axes: { icon: 'check' },
              style: {},
              vectors: [],
              composition: [],
              visual: [],
            },
          ],
          composition: [],
          vectors: [],
          visual: [],
        },
      ],
    });
    const story = icons.find((artifact) =>
      artifact.path.endsWith('Icon.stories.tsx'),
    )!;
    const component = icons.find((artifact) =>
      artifact.path.endsWith('Icon.tsx'),
    )!;

    expect(story.content).toContain('{ args: {"name":"check"} }');
    expect(story.content).toContain('<Icon {...{"name":"check"}} />');
    expect(component.content).toContain(
      "import { ArrowRight, Check, Circle, Menu, TriangleAlert, X } from 'lucide-react'",
    );
    expect(component.content).toContain("'arrow-right': ArrowRight");
    expect(component.content).toContain("'check': Check");
    expect(component.content).not.toContain('<path');
  });

  it('renders semantic input components without illegal children', () => {
    const artifacts = reactExporter.generateComponents({
      tokens: [],
      fontSources: [],
      imageReferences: [],
      diagnostics: [],
      components: [
        {
          id: 'range',
          name: 'slider',
          kind: 'atom',
          type: 'component',
          pageName: '02-atoms',
          semanticMetadata: {
            'semantic.element': 'input',
            'prop.min': '0',
            'prop.max': '100',
            'prop.step': '1',
            'prop.value': '50',
            'content.label': 'Volume',
          },
          style: {},
          variants: [],
          composition: [],
          vectors: [],
          visual: [],
        },
      ],
    });
    const slider = artifacts.find((artifact) =>
      artifact.path.endsWith('Slider.tsx'),
    )!;

    expect(slider.content).toContain('type="range"');
    expect(slider.content).toContain(
      '<input className="kolibri-slider__input"',
    );
    expect(slider.content).not.toContain(
      '<input className="kolibri-slider__input">',
    );
  });

  it('renders switches as accessible interactive controls', () => {
    const artifacts = reactExporter.generateComponents({
      tokens: [],
      fontSources: [],
      imageReferences: [],
      diagnostics: [],
      components: [
        {
          id: 'switch',
          name: 'switch',
          kind: 'atom',
          type: 'component-set',
          pageName: '02-atoms',
          semanticMetadata: {
            'semantic.element': 'label',
            'semantic.role': 'switch',
            'content.label': 'Label',
          },
          style: {},
          variants: [
            {
              id: 'off',
              name: 'state=off',
              axes: { state: 'off' },
              style: {},
              vectors: [],
              composition: [],
              visual: [],
            },
            {
              id: 'on',
              name: 'state=on',
              axes: { state: 'on' },
              style: {},
              vectors: [],
              composition: [],
              visual: [],
            },
          ],
          composition: [],
          vectors: [],
          visual: [],
        },
      ],
    });
    const switchComponent = artifacts.find((artifact) =>
      artifact.path.endsWith('Switch.tsx'),
    )!;

    expect(switchComponent.content).toContain('type="checkbox"');
    expect(switchComponent.content).toContain('role="switch"');
    expect(switchComponent.content).toContain('kolibri-switch__track');
    expect(switchComponent.content).toContain('kolibri-switch__thumb');
    expect(switchComponent.content).not.toContain(
      '<input className="kolibri-switch__input">',
    );
  });

  it('centers a 14px Lucide check inside checked checkboxes', () => {
    const checkbox = {
      id: 'checkbox',
      name: 'checkbox',
      kind: 'atom' as const,
      type: 'componentSet' as const,
      pageName: '02-atoms',
      semanticMetadata: {},
      style: {},
      variants: [
        {
          id: 'unchecked',
          name: 'state=unchecked',
          axes: { state: 'unchecked' },
          style: {},
          vectors: [],
          composition: [],
          visual: [],
        },
        {
          id: 'checked',
          name: 'state=checked',
          axes: { state: 'checked' },
          style: {},
          vectors: [],
          composition: [],
          visual: [],
        },
      ],
      composition: [],
      vectors: [],
      visual: [],
    };
    const system = {
      tokens: [],
      fontSources: [],
      imageReferences: [],
      diagnostics: [],
      components: [checkbox],
    };
    const component = reactExporter
      .generateComponents(system)
      .find((artifact) => artifact.path.endsWith('Checkbox.tsx'))!;
    const css = exporter.generateCss(system);

    expect(component.content).toContain("import { Check } from 'lucide-react'");
    expect(component.content).toContain(
      '<Check className="kolibri-checkbox__icon" size={14}',
    );
    expect(component.content).not.toContain("import { Icon } from './Icon'");
    expect(css).toContain('.kolibri-checkbox .kolibri-checkbox__icon {');
    expect(css).toContain('min-width: 14px;');
    expect(css).toContain('max-height: 14px;');
  });

  it('keeps the small spinner indicator visibly distinct from its track', () => {
    const css = exporter.generateCss({
      tokens: [],
      fontSources: [],
      imageReferences: [],
      diagnostics: [],
      components: [
        {
          id: 'loading-spinner',
          name: 'loading-spinner',
          kind: 'atom',
          type: 'componentSet',
          pageName: '02-atoms',
          semanticMetadata: {},
          style: {},
          variants: [],
          composition: [],
          vectors: [],
          visual: [],
        },
      ],
    });

    expect(css).toContain('stroke-dasharray: 25 75;');
    expect(css).toContain('animation: kolibri-spinner-rotate 800ms');
  });

  it('animates skeleton placeholders with a reduced-motion fallback', () => {
    const css = exporter.generateCss({
      tokens: [],
      fontSources: [],
      imageReferences: [],
      diagnostics: [],
      components: [
        {
          id: 'skeleton',
          name: 'skeleton',
          kind: 'atom',
          type: 'componentSet',
          pageName: '02-atoms',
          semanticMetadata: {},
          style: {},
          variants: [],
          composition: [],
          vectors: [],
          visual: [],
        },
      ],
    });

    expect(css).toContain(
      'animation: kolibri-skeleton-shimmer 1.5s ease-in-out infinite;',
    );
    expect(css).toContain('@keyframes kolibri-skeleton-shimmer');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation: none;');
  });

  it('preserves the profile summary content group inside its root layout', () => {
    const instance = (
      name: string,
      cssClass: string,
    ): ImportedComponentInstance => ({
      id: name,
      name,
      cssClass,
      componentId: name,
      componentName: name,
      visible: true,
      semanticMetadata: {},
      style: {},
      children: [],
    });
    const visual = (
      key: string,
      name: string,
      children: ImportedVisualNode[] = [],
    ): ImportedVisualNode => ({
      id: key,
      key,
      name,
      type: 'FRAME',
      visible: true,
      style: {},
      vectors: [],
      children,
    });
    const artifacts = reactExporter.generateComponents({
      tokens: [],
      fontSources: [],
      imageReferences: [],
      diagnostics: [],
      components: [
        {
          id: 'profile-summary',
          name: 'profile-summary',
          kind: 'molecule',
          type: 'component',
          pageName: '03-molecules',
          semanticMetadata: {
            'content.name': 'Kolibri Maintainer',
            'content.description': 'Design system publisher',
            'content.status': 'Active',
          },
          style: { maxWidth: 400 },
          variants: [],
          composition: [
            instance('avatar', 'avatar'),
            instance('heading', 'heading'),
            instance('paragraph', 'paragraph'),
            instance('badge', 'badge'),
          ],
          vectors: [],
          visual: [
            visual('0', 'avatar'),
            visual('1', 'content', [
              visual('1-0', 'heading'),
              visual('1-1', 'paragraph'),
            ]),
            visual('2', 'badge'),
          ],
        },
      ],
    });
    const profileSummary = artifacts.find((artifact) =>
      artifact.path.endsWith('ProfileSummary.tsx'),
    )!;

    expect(profileSummary.content).toContain(
      '<div className="kolibri-profile-summary__node-1"><Heading',
    );
    expect(profileSummary.content).toContain(
      '</Paragraph></div><Badge className="kolibri-profile-summary__badge">',
    );
  });

  it('renders tooltip placement with stable semantic parts', () => {
    const tooltip = {
      id: 'tooltip',
      name: 'tooltip',
      kind: 'molecule' as const,
      type: 'componentSet' as const,
      pageName: '03-molecules',
      semanticMetadata: {},
      style: { display: 'flex' as const, flexDirection: 'column' as const },
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
              id: 'bubble',
              key: '0',
              name: 'bubble',
              type: 'FRAME',
              visible: true,
              style: { background: '#d9c7a7' },
              vectors: [],
              children: [
                {
                  id: 'tooltip-text',
                  key: '0-0',
                  name: 'tooltip text',
                  type: 'TEXT',
                  text: 'Tooltip text',
                  visible: true,
                  style: { color: '#ffffff' },
                  vectors: [],
                  children: [],
                },
              ],
            },
            {
              id: 'trigger',
              key: '1',
              name: 'trigger',
              type: 'TEXT',
              text: 'Hover me',
              visible: true,
              style: { color: '#212121' },
              vectors: [],
              children: [],
            },
          ],
        },
        {
          id: 'bottom',
          name: 'prop.side=bottom',
          axes: { 'prop.side': 'bottom' },
          style: {},
          vectors: [],
          composition: [],
          visual: [],
        },
      ],
      composition: [],
      vectors: [],
      visual: [],
    };
    const system = {
      tokens: [],
      fontSources: [],
      imageReferences: [],
      diagnostics: [],
      components: [tooltip],
    };
    const component = reactExporter
      .generateComponents(system)
      .find((artifact) => artifact.path.endsWith('Tooltip.tsx'))!;
    const css = exporter.generateCss(system);

    expect(component.content).toContain('kolibri-tooltip__bubble');
    expect(component.content).toContain('kolibri-tooltip__trigger');
    expect(component.content).toContain("side?: 'top' | 'bottom'");
    expect(css).toContain(
      '.kolibri-tooltip--prop-side-bottom .kolibri-tooltip__trigger',
    );
    expect(css).toContain(
      '.kolibri-tooltip--prop-side-bottom .kolibri-tooltip__bubble',
    );
  });

  it('wires CardGrid instance styles without placeholder image paths', () => {
    const item = (
      name: string,
      cssClass: string,
      componentName = name,
      semanticMetadata: Record<string, unknown> = {},
    ): ImportedComponentInstance => ({
      id: cssClass,
      name,
      cssClass,
      componentId: name,
      componentName,
      visible: true,
      semanticMetadata,
      style: {},
      children: [],
    });
    const artifacts = reactExporter.generateComponents({
      tokens: [],
      fontSources: [],
      imageReferences: [],
      diagnostics: [],
      components: [
        {
          id: 'card-grid',
          name: 'card-grid',
          kind: 'organism',
          type: 'component',
          pageName: '04-organisms',
          semanticMetadata: {},
          style: {},
          variants: [],
          composition: [
            item('heading', 'heading'),
            item('paragraph', 'paragraph'),
            item('card', 'card', 'card', {
              'content.heading': 'Story',
              'content.paragraph': 'Summary',
              'content.link': 'Read',
              'link.href': '/story',
              'image.src': '/images/card-01.jpg',
            }),
            item('image', 'image'),
            item('heading', 'heading-2'),
            item('paragraph', 'paragraph-2'),
            item('link', 'link'),
          ],
          vectors: [],
          visual: [],
        },
      ],
    });
    const cardGrid = artifacts.find((artifact) =>
      artifact.path.endsWith('CardGrid.tsx'),
    )!;

    expect(cardGrid.content).not.toContain('/images/card-01.jpg');
    expect(cardGrid.content).toContain(
      '"imageClassName":"kolibri-card-grid__image"',
    );
    expect(cardGrid.content).toContain(
      '"headingClassName":"kolibri-card-grid__heading-2"',
    );
    expect(cardGrid.content).toContain('{...cardPartClasses[index]}');
  });

  it('renders PageHeader actions from content instead of parent fill height', () => {
    const text = (key: string, value: string): ImportedVisualNode => ({
      id: key,
      key,
      name: value,
      type: 'TEXT',
      text: value,
      visible: true,
      style: {},
      vectors: [],
      children: [],
    });
    const frame = (
      key: string,
      children: ImportedVisualNode[],
      style = {},
    ): ImportedVisualNode => ({
      id: key,
      key,
      name: key,
      type: 'FRAME',
      visible: true,
      style,
      vectors: [],
      children,
    });
    const pageHeader = {
      id: 'page-header',
      name: 'page-header',
      kind: 'organism' as const,
      type: 'component' as const,
      pageName: '04-organisms',
      semanticMetadata: {},
      style: {},
      variants: [],
      composition: [],
      vectors: [],
      visual: [
        frame('breadcrumbs', [
          text('dashboard', 'Dashboard'),
          text('separator', '/'),
          text('details', 'Details'),
        ]),
        frame('main', [
          frame('back', [text('back-text', '‹')]),
          frame('summary', [
            text('heading', 'User Details'),
            text('description', 'Manage user settings.'),
          ]),
          frame(
            'actions',
            [
              frame('edit', [text('edit-text', 'Edit')], { height: 100 }),
              frame('save', [text('save-text', 'Save Changes')], {
                height: 100,
              }),
            ],
            { height: 100 },
          ),
        ]),
      ],
    };
    const system = {
      tokens: [],
      fontSources: [],
      imageReferences: [],
      diagnostics: [],
      components: [pageHeader],
    };
    const component = reactExporter
      .generateComponents(system)
      .find((artifact) => artifact.path.endsWith('PageHeader.tsx'))!;
    const css = exporter.generateCss(system);

    expect(component.content).toContain('aria-label="Breadcrumb"');
    expect(component.content).toContain('aria-label="Back"');
    expect(component.content).toContain('<ChevronLeft');
    expect(component.content).toContain('Save Changes');
    expect(css).toContain('.kolibri-page-header__action {');
    expect(css).toContain('height: fit-content;');
    expect(css).toContain('max-height: none;');
  });

  it('renders textarea content through native properties', () => {
    const artifacts = reactExporter.generateComponents({
      tokens: [],
      fontSources: [],
      imageReferences: [],
      diagnostics: [],
      components: [
        {
          id: 'textarea',
          name: 'textarea',
          kind: 'atom',
          type: 'component-set',
          pageName: '02-atoms',
          semanticMetadata: {
            'semantic.element': 'textarea',
            'prop.placeholder': 'Enter your message...',
            'prop.rows': '4',
          },
          style: {},
          variants: [
            {
              id: 'default',
              name: 'state=default',
              axes: { state: 'default' },
              style: {},
              vectors: [],
              composition: [],
              visual: [],
            },
          ],
          composition: [],
          vectors: [],
          visual: [],
        },
      ],
    });
    const textarea = artifacts.find((artifact) =>
      artifact.path.endsWith('Textarea.tsx'),
    )!;

    expect(textarea.content).toContain('<textarea');
    expect(textarea.content).toContain('placeholder={placeholder}');
    expect(textarea.content).toContain('rows={rows}');
    expect(textarea.content).not.toContain('PropsWithChildren');
    expect(textarea.content).not.toContain('kolibri-textarea__node-0');
  });

  it('uses composed instance overrides in site headers', () => {
    const artifacts = reactExporter.generateComponents({
      tokens: [],
      fontSources: [],
      imageReferences: [],
      diagnostics: [],
      components: [
        {
          id: 'site-header',
          name: 'site-header',
          kind: 'organism',
          type: 'component',
          pageName: '04-organisms',
          semanticMetadata: {
            'content.brand': 'Kolibri',
            'content.navigation': 'Fallback',
            'navigation.hrefs': '/fallback',
          },
          style: {},
          variants: [],
          composition: [
            {
              id: 'heading',
              name: 'heading',
              cssClass: 'heading',
              componentName: 'heading',
              textOverride: 'Moritz',
              visible: true,
              semanticMetadata: {
                'content.text': 'Moritz',
                'accessibility.level': '1',
              },
              style: {},
              children: [],
            },
            {
              id: 'navigation',
              name: 'navigation-item',
              cssClass: 'navigation-item',
              componentName: 'state=default',
              textOverride: 'Home',
              visible: true,
              semanticMetadata: {
                'content.label': 'Home',
                'prop.href': '/',
                'icon.name': 'arrow-right',
              },
              style: {},
              children: [],
            },
          ],
          vectors: [],
          visual: [],
        },
      ],
    });
    const siteHeader = artifacts.find((artifact) =>
      artifact.path.endsWith('SiteHeader.tsx'),
    )!;

    expect(siteHeader.content).toContain("brand = 'Moritz'");
    expect(siteHeader.content).toContain("label: 'Home'");
    expect(siteHeader.content).toContain("href: '/'");
    expect(siteHeader.content).toContain(
      "import { ArrowRight, Menu } from 'lucide-react'",
    );
    expect(siteHeader.content).toContain('<ArrowRight');
    expect(siteHeader.content).toContain('<Menu');
    expect(siteHeader.content).not.toContain('<NavigationItem');
    expect(siteHeader.content).toContain('level={1}');
  });

  it('uses composed instance overrides in signup forms', () => {
    const artifacts = reactExporter.generateComponents({
      tokens: [],
      fontSources: [],
      imageReferences: [],
      diagnostics: [],
      components: [
        {
          id: 'signup-form',
          name: 'signup-form',
          kind: 'organism',
          type: 'component',
          pageName: '04-organisms',
          semanticMetadata: {
            'content.heading': 'Join Kolibri',
            'content.submit': 'Subscribe',
          },
          style: {},
          variants: [],
          composition: [
            {
              id: 'heading',
              name: 'heading',
              cssClass: 'heading',
              componentName: 'heading',
              textOverride: 'Join Moritz',
              visible: true,
              semanticMetadata: {
                'content.text': 'Join Moritz',
                'accessibility.level': '1',
              },
              style: {},
              children: [],
            },
            {
              id: 'field',
              name: 'form-field',
              cssClass: 'form-field',
              componentName: 'form-field',
              visible: true,
              semanticMetadata: {
                'content.label': 'Email address',
                'content.helper': 'We will never share your email.',
                'prop.name': 'email',
              },
              style: {},
              children: [
                {
                  id: 'input',
                  name: 'text-input',
                  cssClass: 'text-input',
                  componentName: 'state=default',
                  textOverride: 'name@example.com',
                  visible: true,
                  semanticMetadata: {
                    'prop.placeholder': 'name@example.com',
                  },
                  style: {},
                  children: [],
                },
              ],
            },
          ],
          vectors: [],
          visual: [],
        },
      ],
    });
    const signupForm = artifacts.find((artifact) =>
      artifact.path.endsWith('SignupForm.tsx'),
    )!;

    expect(signupForm.content).toContain('Join Moritz');
    expect(signupForm.content).toContain('placeholder="name@example.com"');
    expect(signupForm.content).toContain('event.preventDefault()');
    expect(signupForm.content).toContain('level={1}');
  });

  it('preserves documented foundation values and generic component visuals', () => {
    const documented: FigmaFile = {
      document: {
        id: 'document',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          {
            id: 'foundation',
            name: '01-foundation',
            type: 'CANVAS',
            children: [
              {
                id: 'colors',
                name: 'Colors',
                type: 'SECTION',
                children: [
                  {
                    id: 'swatch',
                    name: 'swatch',
                    type: 'FRAME',
                    children: [
                      {
                        id: 'swatch-visual',
                        name: 'Color',
                        type: 'RECTANGLE',
                        fills: solid(0.17, 0.34, 0.52),
                      },
                      {
                        id: 'swatch-name',
                        name: 'Name',
                        type: 'TEXT',
                        characters: 'sea',
                      },
                      {
                        id: 'swatch-value',
                        name: 'Value',
                        type: 'TEXT',
                        characters: '#2c5784',
                      },
                    ],
                  },
                ],
              },
              {
                id: 'spacing',
                name: 'Spacing',
                type: 'SECTION',
                children: [
                  {
                    id: 'bar',
                    name: 'bar-2',
                    type: 'FRAME',
                    children: [
                      {
                        id: 'bar-name',
                        name: 'Name',
                        type: 'TEXT',
                        characters: '2',
                      },
                      {
                        id: 'bar-value',
                        name: 'Value',
                        type: 'TEXT',
                        characters: '8px',
                      },
                    ],
                  },
                ],
              },
              {
                id: 'radius',
                name: 'Radius',
                type: 'SECTION',
                children: [
                  {
                    id: 'radius-sample',
                    name: 'sample',
                    type: 'FRAME',
                    children: [
                      {
                        id: 'radius-name',
                        name: 'Name',
                        type: 'TEXT',
                        characters: 'card',
                      },
                      {
                        id: 'radius-value',
                        name: 'Value',
                        type: 'TEXT',
                        characters: '20px',
                      },
                    ],
                  },
                ],
              },
              {
                id: 'typography',
                name: 'Typography',
                type: 'SECTION',
                children: [
                  {
                    id: 'type-row',
                    name: 'row',
                    type: 'FRAME',
                    children: [
                      {
                        id: 'type-sample',
                        name: 'Sample',
                        type: 'TEXT',
                        characters: 'xl / Medium',
                        style: {
                          fontFamily: 'Libre Franklin',
                          fontSize: 20,
                          fontWeight: 500,
                          lineHeightPx: 28,
                        },
                      },
                    ],
                  },
                ],
              },
              {
                id: 'shadows',
                name: 'Shadows',
                type: 'SECTION',
                children: [
                  {
                    id: 'shadow-sample',
                    name: 'sample',
                    type: 'FRAME',
                    children: [
                      {
                        id: 'shadow-name',
                        name: 'Name',
                        type: 'TEXT',
                        characters: 'card',
                      },
                      {
                        id: 'shadow-visual',
                        name: 'Visual',
                        type: 'RECTANGLE',
                        effects: [
                          {
                            type: 'DROP_SHADOW',
                            color: { r: 0, g: 0, b: 0, a: 0.1 },
                            offset: { x: 0, y: 2 },
                            radius: 10,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          { id: 'atoms', name: '02-atoms', type: 'CANVAS' },
          { id: 'molecules', name: '03-molecules', type: 'CANVAS' },
          {
            id: 'organisms',
            name: '04-organisms',
            type: 'CANVAS',
            children: [
              {
                id: 'shell',
                name: 'app-shell',
                type: 'COMPONENT',
                layoutMode: 'VERTICAL',
                fills: solid(1, 1, 1),
                children: [
                  {
                    id: 'header',
                    name: 'Header',
                    type: 'FRAME',
                    layoutMode: 'HORIZONTAL',
                    layoutSizingHorizontal: 'FILL',
                    children: [
                      {
                        id: 'brand',
                        name: 'Brand',
                        type: 'TEXT',
                        characters: 'Moritz',
                        fills: solid(0.05, 0.09, 0.13),
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    const imported = importer.importDesignSystem(documented);
    expect(imported.tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cssName: '--color-sea', value: '#2c5784' }),
        expect.objectContaining({ cssName: '--space-2', value: 8 }),
        expect.objectContaining({ cssName: '--radius-card', value: 20 }),
        expect.objectContaining({
          cssName: '--font-xl-medium',
          kind: 'typography',
        }),
        expect.objectContaining({ cssName: '--shadow-card', kind: 'shadow' }),
      ]),
    );
    const shell = imported.components[0];
    expect(shell.visual[0]).toMatchObject({
      name: 'Header',
      children: [expect.objectContaining({ text: 'Moritz' })],
    });
    const css = exporter.generateCss(imported);
    expect(css).toContain('--shadow-card: 0px 2px 10px 0px');
    expect(css).toContain('.kolibri-app-shell__node-0-0');
    expect(css).toContain(
      '.kolibri-app-shell {\n  width: 100%;\n  min-width: 0;\n  max-width: none;\n  height: 100vh;',
    );
    expect(css).toContain(
      '.kolibri-app-shell > [class^="kolibri-app-shell__node-"]',
    );
    expect(css).toContain(
      '.kolibri-app-shell > .kolibri-app-shell__node-1 {\n  max-height: none;',
    );
    expect(css).not.toContain(
      '.kolibri-app-shell__node-0-0 {\n  box-sizing: border-box;\n  margin: 0;\n  border: 0 solid transparent;\n  background:',
    );
    const shellArtifact = reactExporter
      .generateComponents(imported)
      .find((artifact) => artifact.path === 'components/AppShell.tsx')!;
    expect(shellArtifact.content).toContain('Moritz</span>');
    expect(shellArtifact.content).toContain('kolibri-app-shell__node-0-0');
    const shellStoryArtifact = reactExporter
      .generateComponents(imported)
      .find((artifact) => artifact.path === 'components/AppShell.stories.tsx')!;
    expect(shellStoryArtifact.content).toContain(
      "parameters: { layout: 'fullscreen' }",
    );
    expect(shellStoryArtifact.content).not.toContain('decorators: [(Story) =>');
  });
});
