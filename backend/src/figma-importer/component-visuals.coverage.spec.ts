import type { FigmaNode } from '../clients/figma/figma.types';
import { extractVectors, visualChildren } from './component-visuals';

function node(overrides: Partial<FigmaNode> = {}): FigmaNode {
  return {
    id: 'node',
    name: 'Node',
    type: 'FRAME',
    visible: true,
    children: [],
    ...overrides,
  };
}

describe('component visual extraction', () => {
  it('normalizes explicit and convention-based semantic parts and parent fill sizing', () => {
    const result = visualChildren(
      node({
        layoutMode: 'HORIZONTAL',
        children: [
          node({
            id: 'explicit',
            name: 'Explicit',
            layoutSizingHorizontal: 'FILL',
            layoutMode: 'VERTICAL',
            componentProperties: {
              part: { type: 'TEXT', value: 'PrimaryAction' },
            },
            children: [
              node({
                id: 'nested',
                name: '@part/menu_item',
                layoutSizingVertical: 'FILL',
              }),
            ],
          }),
          node({ id: 'invalid', name: '@part/not valid!' }),
        ],
      }),
    );
    expect(result[0]).toMatchObject({
      part: 'primary-action',
      style: { widthMode: undefined },
    });
    expect(result[0].children[0]).toMatchObject({
      part: 'menu-item',
      style: { heightMode: undefined },
    });
    expect(result[1].part).toBeUndefined();
  });

  it('extracts fill and stroke vector paths with explicit and fallback geometry', () => {
    const vectors = extractVectors(
      node({
        children: [
          node({
            id: 'vector',
            name: 'Icon',
            type: 'VECTOR',
            absoluteBoundingBox: { x: 0, y: 0, width: 12, height: 14 },
            fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
            strokes: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0 } }],
            strokeWeight: 2,
            fillGeometry: [{ path: 'M0 0' }],
            strokeGeometry: [{ path: 'M1 1' }],
          }),
          node({
            id: 'fallback',
            name: 'Fallback',
            type: 'VECTOR',
            fillGeometry: [{ path: 'M2 2' }],
          }),
          node({ id: 'empty', name: 'Empty', type: 'VECTOR' }),
        ],
      }),
    );
    expect(vectors).toEqual([
      expect.objectContaining({
        name: 'Icon',
        width: 12,
        height: 14,
        paths: [
          expect.objectContaining({ fill: '#ff0000' }),
          expect.objectContaining({
            fill: 'none',
            stroke: '#00ff00',
            strokeWidth: 2,
          }),
        ],
      }),
      expect.objectContaining({
        name: 'Fallback',
        width: 24,
        height: 24,
        paths: [expect.objectContaining({ fill: 'currentColor' })],
      }),
    ]);
  });
});
