import type { FigmaFile, FigmaNode } from '../clients/figma/figma.types';
import { componentNames, directInstances } from './component-instances';
import { validateMetadata, variantAxes } from './component-metadata';
import { visualChildren } from './component-visuals';
import { extractComponents } from './extract-components';
import { extractFontSources } from './extract-font-sources';
import { extractFoundationTokens } from './extract-foundation-tokens';
import { recordMissingFontSources } from './font-source-diagnostics';
import { normalizeStyle } from './normalize-component-style';
import type { Diagnostic } from './figma-importer.types';

const node = (name: string, overrides: Partial<FigmaNode> = {}): FigmaNode => ({
  id: name,
  name,
  type: 'FRAME',
  ...overrides,
});
const file = (page: string, children: FigmaNode[]): FigmaFile => ({
  document: node('document', {
    type: 'DOCUMENT',
    children: [node(page, { type: 'CANVAS', children })],
  }),
});

describe('incomplete Figma source boundaries', () => {
  it('resolves component-set names, preserves orphan names and disambiguates repeated instances', () => {
    const document = node('document', {
      type: 'DOCUMENT',
      children: [
        node('Master', {
          id: 'set',
          type: 'COMPONENT_SET',
          children: [
            node('state=default', {
              id: 'variant',
              type: 'COMPONENT',
              componentSetId: 'set',
            }),
          ],
        }),
        node('Orphan', {
          id: 'orphan',
          type: 'COMPONENT',
          componentSetId: 'missing',
        }),
      ],
    });
    const names = componentNames(document);
    expect(names.get('variant')).toBe('Master');
    expect(names.get('orphan')).toBe('Orphan');
    const instances = directInstances(
      node('root', {
        children: [
          node('!', { type: 'INSTANCE', componentId: 'variant' }),
          node('!', { type: 'INSTANCE', componentId: 'variant' }),
        ],
      }),
      names,
    );
    expect(instances.map((item) => item.cssClass)).toEqual([
      'instance',
      'instance-2',
    ]);
    expect(instances.every((item) => item.componentName === 'Master')).toBe(
      true,
    );
  });

  it('accepts empty component sets without inventing variants or visual children', () => {
    const components = extractComponents(
      file('02-atoms', [node('Empty', { type: 'COMPONENT_SET' })]),
    );
    expect(components).toHaveLength(1);
    expect(components[0]).toMatchObject({
      type: 'componentSet',
      variants: [],
      visual: [],
    });
    const unrecognizedChildren = extractComponents(
      file('02-atoms', [
        node('Unfinished', {
          type: 'COMPONENT_SET',
          children: [node('Draft frame')],
        }),
      ]),
    );
    expect(unrecognizedChildren[0].variants).toEqual([]);
    expect(unrecognizedChildren[0].visual[0].name).toBe('Draft frame');
  });

  it('ignores malformed variant fragments and retains explicitly valid intrinsic identities', () => {
    expect(variantAxes('tone=dark, broken, =missing-axis, size=')).toEqual({
      tone: 'dark',
    });
    for (const identity of [' image ', '', 123]) {
      const diagnostics: Diagnostic[] = [];
      validateMetadata(
        node('image', { type: 'COMPONENT' }),
        {
          'semantic.element': 'img',
          'semantic.component': identity,
          'accessibility.decorative': true,
          'layout.widthMode': 'hug',
          'layout.heightMode': 'hug',
        },
        diagnostics,
      );
      expect(diagnostics).toEqual([]);
    }
  });

  it('retains current-color vector geometry when Figma omits stroke paint', () => {
    const visuals = visualChildren(
      node('root', {
        children: [
          node('@part:icon', {
            type: 'VECTOR',
            fillGeometry: [{ path: 'M0 0' }],
            strokeGeometry: [{ path: 'M1 1' }],
          }),
        ],
      }),
    );
    expect(visuals[0]).toMatchObject({
      part: 'icon',
      vectors: [
        {
          width: 24,
          height: 24,
          paths: [
            { d: 'M0 0', fill: 'currentColor' },
            { d: 'M1 1', fill: 'none', stroke: 'currentColor' },
          ],
        },
      ],
    });
  });

  it('rejects incomplete or blank font sources without creating unresolved-family claims', () => {
    const definitions = (family: unknown) => ({
      'font.family': { type: 'TEXT', defaultValue: family },
      'font.provider': { type: 'TEXT', defaultValue: 'css' },
      'font.cssUrl': {
        type: 'TEXT',
        defaultValue: 'https://fonts.example/font.css',
      },
      'font.fallback': { type: 'TEXT', defaultValue: 'sans-serif' },
    });
    expect(
      extractFontSources(
        file('01-foundation', [
          node('font-source.empty', { type: 'COMPONENT' }),
          node('font-source.blank', {
            type: 'COMPONENT',
            componentPropertyDefinitions: definitions(' '),
          }),
          node('font-source.number', {
            type: 'COMPONENT',
            componentPropertyDefinitions: definitions(123),
          }),
        ]),
      ),
    ).toEqual([]);
    const diagnostics: Diagnostic[] = [];
    recordMissingFontSources(
      [
        {
          name: 'font.empty',
          cssName: '--font-empty',
          kind: 'typography',
          value: {},
          sourceNodeId: 'fixture',
        },
      ],
      [],
      [],
      diagnostics,
    );
    expect(diagnostics).toEqual([]);
  });

  it('ignores incomplete foundation samples and keeps the first duplicate token', () => {
    const tokens = extractFoundationTokens(
      file('01-foundation', [
        node('color.missing'),
        node('space.missing'),
        node('radius.missing'),
        node('space.duplicate', {
          absoluteBoundingBox: { width: 8, height: 1 },
        }),
        node('space.duplicate', {
          absoluteBoundingBox: { width: 16, height: 1 },
        }),
        node('colors', {
          children: [
            node('swatch', {
              children: [
                node('label', { type: 'TEXT', characters: 'Unpainted' }),
              ],
            }),
          ],
        }),
        node('typography', { children: [node('row')] }),
        node('shadows', {
          children: [
            node('sample'),
            node('sample', {
              children: [
                node('label', { type: 'TEXT', characters: 'Hidden shadow' }),
                node('visual', {
                  effects: [{ type: 'DROP_SHADOW', visible: false }],
                }),
              ],
            }),
          ],
        }),
      ]),
    );
    expect(tokens).toEqual([
      expect.objectContaining({ name: 'space.duplicate', value: 8 }),
    ]);
  });

  it('uses opaque shadow colors when alpha is omitted', () => {
    const tokens = extractFoundationTokens(
      file('01-foundation', [
        node('shadows', {
          children: [
            node('sample', {
              children: [
                node('label', { type: 'TEXT', characters: 'Opaque' }),
                node('visual', {
                  effects: [
                    { type: 'DROP_SHADOW', color: { r: 1, g: 0, b: 0 } },
                  ],
                }),
              ],
            }),
          ],
        }),
      ]),
    );
    expect(tokens[0].value).toBe('0px 0px 0px 0px rgba(255, 0, 0, 1)');
  });

  it('preserves resolved hug dimensions, minimum heights and clipping at component boundaries', () => {
    expect(
      normalizeStyle(
        node('hug', {
          layoutSizingHorizontal: 'HUG',
          layoutSizingVertical: 'HUG',
          absoluteBoundingBox: { width: 80, height: 40 },
          clipsContent: true,
        }),
        {},
        { useBounds: true, preferResolvedLayout: true },
      ),
    ).toMatchObject({
      widthMode: 'fixed',
      heightMode: 'fixed',
      width: 80,
      height: 40,
      overflow: 'hidden',
    });
    expect(
      normalizeStyle(
        node('minimum', {
          layoutSizingVertical: 'FIXED',
          absoluteBoundingBox: { width: 80, height: 40 },
        }),
        {
          'layout.heightMode': 'hug',
        },
      ).minHeight,
    ).toBe(40);
  });
});
