import type { FigmaFile, FigmaNode } from '../clients/figma/figma.types';
import { componentNames, directInstances } from './component-instances';
import { validateMetadata } from './component-metadata';
import { extractVectors, visualChildren } from './component-visuals';
import { extractComponents } from './extract-components';
import { extractFontSources } from './extract-font-sources';
import { extractFoundationTokens } from './extract-foundation-tokens';
import type { Diagnostic } from './figma-importer.types';
import { normalizeStyle } from './normalize-component-style';

const node = (overrides: Partial<FigmaNode> = {}): FigmaNode => ({
  id: 'n',
  name: 'node',
  type: 'FRAME',
  ...overrides,
});

const document = (...pages: FigmaNode[]): FigmaFile => ({
  document: node({
    id: 'doc',
    name: 'Document',
    type: 'DOCUMENT',
    children: pages,
  }),
});

const page = (name: string, ...children: FigmaNode[]): FigmaNode =>
  node({ id: `page-${name}`, name, type: 'CANVAS', children });

const label = (characters: string, extra: Partial<FigmaNode> = {}) =>
  node({
    id: `t-${characters}`,
    name: 'label',
    type: 'TEXT',
    characters,
    ...extra,
  });

describe('component names and instances', () => {
  it('falls back to the component name when its set is not in the document', () => {
    const names = componentNames(
      node({
        type: 'DOCUMENT',
        children: [
          node({ id: 'set', name: 'Set', type: 'COMPONENT_SET' }),
          node({
            id: 'a',
            name: 'In set',
            type: 'COMPONENT',
            componentSetId: 'set',
          }),
          node({
            id: 'b',
            name: 'Orphan',
            type: 'COMPONENT',
            componentSetId: 'missing',
          }),
          node({ id: 'c', name: 'Plain', type: 'COMPONENT' }),
        ],
      }),
    );
    expect(names.get('a')).toBe('Set');
    expect(names.get('b')).toBe('Orphan');
    expect(names.get('c')).toBe('Plain');
  });

  it('numbers repeated instance classes and names unnamed ones "instance"', () => {
    const instance = (id: string, name: string) =>
      node({ id, name, type: 'INSTANCE', componentId: 'c' });
    const result = directInstances(
      node({
        children: [
          instance('1', 'Card'),
          instance('2', 'Card'),
          instance('3', '***'),
          node({ id: 'wrapper', children: [instance('4', 'Card')] }),
        ],
      }),
      new Map(),
    );
    expect(result.map((item) => item.cssClass)).toEqual([
      'card',
      'card-2',
      'instance',
      'card-3',
    ]);
    expect(result[0].componentName).toBeUndefined();
  });
});

describe('component metadata and visuals', () => {
  it('treats a blank semantic.component as the node name when checking void elements', () => {
    const diagnostics: Diagnostic[] = [];
    validateMetadata(
      node({ name: 'Image' }),
      { 'semantic.component': '   ', 'semantic.element': 'img' },
      diagnostics,
    );
    validateMetadata(
      node({ name: 'Other' }),
      { 'semantic.component': 'image', 'semantic.element': 'img' },
      diagnostics,
    );
    expect(
      diagnostics.filter((item) => item.code === 'SEMANTIC_ELEMENT_FALLBACK'),
    ).toEqual([]);
    validateMetadata(
      node({ name: 'Other' }),
      { 'semantic.component': 7, 'semantic.element': 'img' },
      diagnostics,
    );
    expect(
      diagnostics.filter((item) => item.code === 'SEMANTIC_ELEMENT_FALLBACK'),
    ).toHaveLength(1);
  });

  it('builds visuals for leaf nodes and vectors without bounds or strokes', () => {
    const [leaf, vector] = visualChildren(
      node({
        children: [
          node({ id: 'leaf', name: 'leaf' }),
          node({
            id: 'vec',
            name: 'vec',
            type: 'VECTOR',
            fillGeometry: [{ path: 'M0 0' }],
          }),
        ],
      }),
    );
    expect(leaf.children).toEqual([]);
    expect(leaf.vectors).toEqual([]);
    expect(vector.vectors[0]).toMatchObject({ width: 24, height: 24 });
  });

  it('draws stroke geometry in the currentColor default when no solid stroke exists', () => {
    const vectors = extractVectors(
      node({
        type: 'VECTOR',
        strokeGeometry: [{ path: 'M0 0 L1 1' }],
        absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 12 },
      }),
    );
    expect(vectors[0].paths[0]).toMatchObject({
      fill: 'none',
      stroke: 'currentColor',
    });
  });
});

describe('component extraction', () => {
  it('imports a component set without component children and a childless set', () => {
    const file = document(
      page(
        '02-atoms',
        node({ id: 'set', name: 'Empty set', type: 'COMPONENT_SET' }),
        node({
          id: 'set2',
          name: 'Set of frames',
          type: 'COMPONENT_SET',
          children: [node({ id: 'f', name: 'frame', type: 'FRAME' })],
        }),
        node({ id: 'plain', name: 'Plain', type: 'COMPONENT' }),
      ),
    );
    const components = extractComponents(file);
    expect(components.map((item) => item.name)).toEqual([
      'Empty set',
      'Set of frames',
      'Plain',
    ]);
    expect(components[0].variants).toEqual([]);
    expect(components[0].visual).toEqual([]);
  });
});

describe('font sources', () => {
  const definitions = (values: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(values).map(([key, defaultValue]) => [
        `${key}#1:1`,
        { type: 'TEXT', defaultValue },
      ]),
    );
  const source = (values?: Record<string, unknown>) =>
    node({
      id: 'font',
      name: 'font-source.x',
      type: 'COMPONENT',
      componentPropertyDefinitions: values ? definitions(values) : undefined,
    });

  it('ignores a font source without property definitions and trims string values', () => {
    const file = document(
      page(
        '01-foundation',
        source(),
        source({
          'font.family': '  Inter ',
          'font.provider': 'css',
          'font.cssUrl': 'https://fonts.example/css',
          'font.fallback': ' sans-serif ',
        }),
        source({
          'font.family': '   ',
          'font.provider': 'css',
          'font.cssUrl': 'https://fonts.example/css',
          'font.fallback': 'sans-serif',
        }),
      ),
    );
    expect(extractFontSources(file)).toEqual([
      expect.objectContaining({ family: 'Inter', fallback: 'sans-serif' }),
    ]);
  });
});

describe('foundation tokens', () => {
  const section = (name: string, ...children: FigmaNode[]) =>
    node({ id: name, name, type: 'FRAME', children });

  it('takes a swatch color from its paint and skips swatches with neither a hex label nor a paint color', () => {
    const swatch = (id: string, fills?: FigmaNode['fills']) =>
      node({
        id,
        name: 'swatch',
        children: [label(`Name ${id}`), node({ id: `${id}-fill`, fills })],
      });
    const tokens = extractFoundationTokens(
      document(
        page(
          '01-foundation',
          section(
            'colors',
            swatch('with-color', [
              { type: 'SOLID', color: { r: 1, g: 0, b: 0 } },
            ]),
            swatch('without-color', [{ type: 'SOLID' }]),
          ),
        ),
      ),
    );
    expect(tokens.map((item) => item.name)).toEqual(['color.name-with-color']);
  });

  it('skips typography rows without children and renders shadow edge cases', () => {
    const shadowSample = (id: string, children?: FigmaNode[]) =>
      node({ id, name: 'sample', children });
    const tokens = extractFoundationTokens(
      document(
        page(
          '01-foundation',
          section('typography', node({ id: 'row', name: 'row' })),
          section(
            'shadows',
            shadowSample('none'),
            shadowSample('hidden', [
              label('Hidden'),
              node({
                id: 'hidden-visual',
                effects: [{ type: 'DROP_SHADOW', visible: false }],
              }),
            ]),
            shadowSample('plain', [
              label('Plain'),
              node({
                id: 'plain-visual',
                effects: [
                  {
                    type: 'DROP_SHADOW',
                    color: { r: 0, g: 0, b: 0 },
                    offset: { x: 1, y: 2 },
                    radius: 3,
                  },
                ],
              }),
            ]),
          ),
        ),
      ),
    );
    expect(tokens).toEqual([
      expect.objectContaining({
        name: 'shadow.plain',
        value: '1px 2px 3px 0px rgba(0, 0, 0, 1)',
      }),
    ]);
  });
});

describe('style normalization sizing', () => {
  it('resolves hugging height to a fixed height when bounds are preferred', () => {
    const style = normalizeStyle(
      node({
        layoutSizingVertical: 'HUG',
        absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 30 },
      }),
      {},
      { useBounds: true, preferResolvedLayout: true },
    );
    expect(style.heightMode).toBe('fixed');
    expect(style.height).toBe(30);
  });

  it('keeps the measured height as the minimum for a fixed node that metadata says hugs', () => {
    const style = normalizeStyle(
      node({
        layoutSizingVertical: 'FIXED',
        absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 77 },
      }),
      { 'layout.heightMode': 'hug' },
    );
    expect(style.minHeight).toBe(77);
  });

  it('clips overflow when the node clips content and metadata is silent', () => {
    expect(normalizeStyle(node({ clipsContent: true }), {}).overflow).toBe(
      'hidden',
    );
  });
});
