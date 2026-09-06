import type { FigmaNode } from '../clients/figma/figma.types';
import {
  firstSolid,
  normalizeStyle,
  numericMetadata,
  sizingMode,
} from './normalize-component-style';

function node(overrides: Partial<FigmaNode> = {}): FigmaNode {
  return {
    id: '1',
    name: 'Node',
    type: 'FRAME',
    visible: true,
    children: [],
    ...overrides,
  };
}

describe('component style normalization exhaustive behavior', () => {
  it('normalizes transparent colors, images, effects, geometry, layout, and inherited text', () => {
    const text = node({
      id: 'text',
      type: 'TEXT',
      characters: 'Hello',
      fills: [
        { type: 'SOLID', color: { r: 1, g: 0.5, b: 0, a: 0.5 }, opacity: 0.5 },
      ],
      style: {
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: 600,
        lineHeightPx: 20,
        letterSpacing: 1,
        textAlignHorizontal: 'JUSTIFIED',
        textDecoration: 'STRIKETHROUGH',
      },
    });
    const result = normalizeStyle(
      node({
        fills: [{ type: 'IMAGE', imageRef: 'asset', scaleMode: 'STRETCH' }],
        strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }],
        strokeWeight: 2,
        strokeAlign: 'OUTSIDE',
        strokesIncludedInLayout: true,
        individualStrokeWeights: { top: 1, right: 2, bottom: 3, left: 4 },
        opacity: 0.8,
        rotation: 10,
        effects: [
          {
            type: 'DROP_SHADOW',
            visible: true,
            color: { r: 0, g: 0, b: 0, a: 0.5 },
            offset: { x: 1, y: 2 },
            radius: 3,
            spread: 4,
          },
          { type: 'INNER_SHADOW', visible: true },
          { type: 'BLUR', visible: false },
        ],
        absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 40 },
        layoutSizingHorizontal: 'HUG',
        layoutSizingVertical: 'FILL',
        clipsContent: true,
        cornerRadius: 4,
        rectangleCornerRadii: [1, 2, 3, 4],
        paddingTop: 1,
        paddingRight: 2,
        paddingBottom: 3,
        paddingLeft: 4,
        itemSpacing: 8,
        counterAxisSpacing: 9,
        layoutMode: 'VERTICAL',
        layoutWrap: 'WRAP',
        counterAxisAlignItems: 'MAX',
        primaryAxisAlignItems: 'SPACE_BETWEEN',
        layoutGrow: 1,
        children: [text],
      }),
      { 'layout.aspectRatio': 3, 'layout.overflow': 'auto' },
      { useBounds: true, preferResolvedLayout: true },
    );
    expect(result).toMatchObject({
      backgroundImageRef: 'asset',
      backgroundSize: 'fill',
      widthMode: 'fixed',
      heightMode: 'fill',
      minHeight: 0,
      color: 'rgba(255, 128, 0, 0.25)',
      layout: 'vertical',
      textAlign: 'justify',
      textDecoration: 'line-through',
    });
    expect(result.boxShadow).toContain('inset');
  });

  it.each([
    ['FIT', 'contain'],
    ['FILL', 'cover'],
    [undefined, undefined],
  ])('maps image scale mode %s', (scaleMode, expected) => {
    expect(
      normalizeStyle(
        node({
          fills: scaleMode ? [{ type: 'IMAGE', imageRef: 'x', scaleMode }] : [],
        }),
        {},
      ).backgroundSize,
    ).toBe(expected);
  });

  it('covers metadata-first, bounds fallback, ellipse, and disabled text inheritance', () => {
    const ellipse = normalizeStyle(
      node({
        type: 'ELLIPSE',
        absoluteBoundingBox: { x: 0, y: 0, width: 20, height: 10 },
        layoutSizingHorizontal: 'FIXED',
        layoutSizingVertical: 'HUG',
      }),
      {
        'layout.width': '30',
        'layout.height': '15',
        'layout.widthMode': 'fill',
        'layout.heightMode': 'hug',
        'layout.minWidth': '1',
        'layout.maxWidth': 40,
        'layout.minHeight': 2,
        'layout.maxHeight': '50',
      },
      { useBounds: true },
    );
    expect(ellipse).toMatchObject({
      width: 30,
      height: 15,
      widthMode: 'fill',
      heightMode: 'hug',
      cornerRadius: 5,
    });
    expect(
      normalizeStyle(
        node({ children: [node({ type: 'TEXT', style: { fontSize: 12 } })] }),
        {},
        { inheritText: false },
      ).fontSize,
    ).toBeUndefined();
    expect(
      normalizeStyle(
        node({ absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 } }),
        {},
        { useBounds: true },
      ),
    ).toMatchObject({ widthMode: 'fixed', heightMode: 'fixed' });
  });

  it('handles invalid and edge metadata values', () => {
    expect(firstSolid()).toBeUndefined();
    expect(
      firstSolid([
        { type: 'SOLID', visible: false, color: { r: 0, g: 0, b: 0 } },
      ]),
    ).toBeUndefined();
    expect(
      numericMetadata(
        { empty: '', nil: null, invalid: 'x', valid: 0 },
        'empty',
      ),
    ).toBeUndefined();
    expect(numericMetadata({ nil: null }, 'nil')).toBeUndefined();
    expect(numericMetadata({ invalid: 'x' }, 'invalid')).toBeUndefined();
    expect(numericMetadata({ valid: 0 }, 'valid')).toBe(0);
    expect(sizingMode('other')).toBeUndefined();
    expect(sizingMode('fixed')).toBe('fixed');
  });
});
