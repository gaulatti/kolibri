import type {
  ImportedComponentInstance,
  ImportedFontSource,
  ImportedVisualNode,
  KolibriToken,
  NormalizedStyle,
} from '../figma-importer/figma-importer.types';
import {
  compositionRules,
  findVisualStyle,
  mergeVisualTextStyle,
  rule,
  visualRules,
} from './style-rule';

const tokens: KolibriToken[] = [
  {
    name: 'white',
    cssName: '--white',
    kind: 'color',
    value: '#ffffff',
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
    name: 'radius',
    cssName: '--radius',
    kind: 'radius',
    value: 4,
    sourceNodeId: '3',
  },
  {
    name: 'width',
    cssName: '--size',
    kind: 'size',
    value: { width: 120, height: 40 },
    sourceNodeId: '4',
  },
  {
    name: 'shadow',
    cssName: '--shadow',
    kind: 'shadow',
    value: '0 1px 2px #000',
    sourceNodeId: '5',
  },
  {
    name: 'body',
    cssName: '--body',
    kind: 'typography',
    value: {
      fontFamily: 'Encode Sans',
      fontSize: 16,
      fontWeight: 500,
      lineHeight: 20,
    },
    sourceNodeId: '6',
  },
];
const fonts: ImportedFontSource[] = [
  {
    family: 'Encode Sans',
    provider: 'css',
    cssUrl: 'https://fonts.test/css',
    fallback: 'system-ui',
    sourceNodeId: '7',
  },
];

function visual(
  overrides: Partial<ImportedVisualNode> = {},
): ImportedVisualNode {
  return {
    id: 'node',
    key: '0',
    name: 'wrapper',
    type: 'FRAME',
    visible: true,
    semanticMetadata: {},
    style: {},
    vectors: [],
    children: [],
    ...overrides,
  };
}

describe('style-rule exhaustive behavior', () => {
  it('renders every supported style declaration and token resolution path', () => {
    const style: NormalizedStyle = {
      background: '#ffffff',
      backgroundImageRef: 'image',
      backgroundSize: 'contain',
      color: '#ffffff',
      borderColor: '#ffffff',
      borderIncludedInLayout: true,
      borderWidth: 2,
      borderTopWidth: 1,
      borderRightWidth: 2,
      borderBottomWidth: 3,
      borderLeftWidth: 4,
      opacity: 0.5,
      rotation: 1,
      boxShadow: '0 1px 2px #000',
      paddingTop: 8,
      paddingRight: 4,
      paddingBottom: 8,
      paddingLeft: 4,
      cornerRadius: 4,
      gap: 8,
      rowGap: 3,
      layout: 'vertical',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      flexGrow: 1,
      widthMode: 'fixed',
      width: 120,
      heightMode: 'fixed',
      height: 40,
      minWidth: 120,
      maxWidth: 121,
      minHeight: 40,
      maxHeight: 41,
      overflow: 'hidden',
      aspectRatio: 3 / 2,
      fontFamily: 'Encode Sans',
      fontSize: 16,
      fontWeight: 500,
      lineHeight: 20,
      letterSpacing: 0.5,
      textAlign: 'center',
      textDecoration: 'underline',
    };
    const css = rule('.all', style, tokens, fonts);
    expect(css).toContain('background-image');
    expect(css).toContain('border-width: 1px 2px 3px 4px');
    expect(css).toContain('var(--body-family)');
    expect(css).toContain('var(--size-width)');
    expect(css).toContain('box-shadow: var(--shadow)');
  });

  it.each([
    [
      { borderColor: '#000', borderWidth: 2, borderAlign: 'outside' },
      '0 0 0 2px',
    ],
    [
      { borderColor: '#000', borderWidth: 2, borderAlign: 'inside' },
      'inset 0 0 0 2px',
    ],
    [{ borderColor: '#000', borderTopWidth: 1 }, 'inset 0 1px'],
    [{ borderColor: '#000' }, 'box-sizing'],
    [
      { rotation: 720, widthMode: 'fill', heightMode: 'fill' },
      'rotate(720deg)',
    ],
    [{ widthMode: 'hug', heightMode: 'hug' }, 'fit-content'],
    [
      { cornerRadii: [1, 2, 3, 5], layout: 'horizontal', flexGrow: 0 },
      '1px 2px 3px 5px',
    ],
    [{ paddingTop: 1 }, 'padding: 1px 0px 0px 0px'],
    [
      { paddingTop: 1, paddingRight: 2, paddingBottom: 1, paddingLeft: 2 },
      'padding: 1px 2px',
    ],
    [
      {
        fontFamily: 'Unknown Font',
        fontSize: 11,
        fontWeight: 400,
        lineHeight: 13,
      },
      '"Unknown Font", sans-serif',
    ],
  ] as Array<[NormalizedStyle, string]>)(
    'renders alternate style branches %#',
    (style, expected) => {
      expect(rule('.alternate', style, tokens, fonts)).toContain(expected);
    },
  );

  it('walks visible visual and composition trees while omitting hidden nodes', () => {
    const text = visual({
      name: 'Text',
      type: 'TEXT',
      style: { color: '#fff' },
    });
    const nested = visual({ name: 'Target', children: [text] });
    expect(findVisualStyle([nested], 'text')).toEqual({ color: '#fff' });
    expect(findVisualStyle([nested], 'missing')).toBeUndefined();
    expect(mergeVisualTextStyle(nested)).toMatchObject({ color: '#fff' });
    expect(
      mergeVisualTextStyle(
        visual({ children: [visual({ children: [text] })] }),
      ),
    ).toMatchObject({ color: '#fff' });
    expect(
      mergeVisualTextStyle(visual({ style: { color: '#000' } })),
    ).toMatchObject({ color: '#000' });
    expect(
      visualRules('sample', [nested, visual({ visible: false })], [], []),
    ).toHaveLength(2);

    const child: ImportedComponentInstance = {
      id: 'child',
      name: 'Child',
      cssClass: 'child',
      componentId: 'c',
      visible: true,
      semanticMetadata: {},
      style: {},
      children: [],
    };
    const parent: ImportedComponentInstance = {
      ...child,
      id: 'parent',
      cssClass: 'parent',
      children: [child],
    };
    expect(
      compositionRules(
        'sample',
        [parent, { ...child, visible: false }],
        [],
        [],
      ),
    ).toHaveLength(2);
  });
});
