import type { KolibriToken } from '../figma-importer/figma-importer.types';
import {
  CssExporterService,
  generateRootCss,
  resolveColorValue,
  resolveSpaceValue,
} from './css-exporter.service';
import {
  fontFamilyValue,
  generateFontImports,
  numberMetadata,
  resolveSize,
} from './css-values';

describe('CSS values and complete stylesheet assembly', () => {
  const tokens: KolibriToken[] = [
    {
      name: 'color',
      cssName: '--color',
      kind: 'color',
      value: '#ABCDEF',
      sourceNodeId: '1',
    },
    {
      name: 'space',
      cssName: '--space',
      kind: 'space',
      value: 8,
      sourceNodeId: '2',
    },
    {
      name: 'number',
      cssName: '--number',
      kind: 'radius',
      value: 4,
      sourceNodeId: '3',
    },
    {
      name: 'type',
      cssName: '--type',
      kind: 'typography',
      value: {
        fontFamily: 'Open Sans',
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 20,
      },
      sourceNodeId: '4',
    },
    {
      name: 'size',
      cssName: '--size',
      kind: 'size',
      value: { width: 100, height: 50 },
      sourceNodeId: '5',
    },
  ];
  const fonts = [
    {
      family: 'Open Sans',
      provider: 'css' as const,
      cssUrl: 'https://fonts.test/a"b',
      fallback: 'system-ui',
      sourceNodeId: 'font',
    },
  ];

  it('resolves every token kind and fallback', () => {
    expect(resolveColorValue('#abcdef', tokens)).toBe('var(--color)');
    expect(resolveColorValue('#000000', tokens)).toBe('#000000');
    expect(resolveSpaceValue(8, tokens)).toBe('var(--space)');
    expect(resolveSpaceValue(9, tokens)).toBe('9px');
    expect(resolveSize(100, 'width', tokens)).toBe('var(--size-width)');
    expect(resolveSize(10, 'width', tokens)).toBe('10px');
    expect(fontFamilyValue('Open Sans', fonts)).toBe('"Open Sans", system-ui');
    expect(fontFamilyValue('Inter', fonts)).toBe('Inter, sans-serif');
    expect(
      numberMetadata({ number: 2, string: '3', invalid: 'x' }, 'number'),
    ).toBe(2);
    expect(numberMetadata({ string: '3' }, 'string')).toBe(3);
    expect(numberMetadata({ invalid: 'x' }, 'invalid')).toBeUndefined();
  });

  it('emits root tokens, unique escaped imports, and a full stylesheet', () => {
    expect(generateRootCss(tokens, fonts)).toContain('--type-family');
    expect(generateFontImports([...fonts, ...fonts])).toBe(
      '@import url("https://fonts.test/a%22b");',
    );
    const css = new CssExporterService().generateCss({
      tokens,
      fontSources: fonts,
      imageReferences: [],
      components: [],
      diagnostics: [],
    });
    expect(css).toContain('@import');
    expect(css).toContain(':root');
  });

  it('omits absent optional typography and size declarations', () => {
    const sparse: KolibriToken[] = [
      {
        name: 'type',
        cssName: '--type-empty',
        kind: 'typography',
        value: {},
        sourceNodeId: '1',
      },
      {
        name: 'size',
        cssName: '--size-empty',
        kind: 'size',
        value: {},
        sourceNodeId: '2',
      },
    ];
    expect(generateRootCss(sparse)).toBe(':root {\n}');
  });
});
