import type { FigmaFile, FigmaNode } from '../clients/figma/figma.types';
import { extractFoundationTokens } from './extract-foundation-tokens';

let id = 0;
const text = (characters?: string, style?: FigmaNode['style']): FigmaNode => ({
  id: `text-${++id}`,
  name: 'label',
  type: 'TEXT',
  characters,
  style,
});

describe('foundation token edge cases', () => {
  it('returns empty without a foundation page', () => {
    expect(
      extractFoundationTokens({
        document: { id: 'd', name: 'Document', type: 'DOCUMENT', children: [] },
      }),
    ).toEqual([]);
  });

  it('skips incomplete documented token rows', () => {
    const section = (name: string, children: FigmaNode[]): FigmaNode => ({
      id: name,
      name,
      type: 'FRAME',
      children,
    });
    const file: FigmaFile = {
      document: {
        id: 'd',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          {
            id: 'p',
            name: '01-foundation',
            type: 'CANVAS',
            children: [
              section('spacing', [
                {
                  id: 'bar',
                  name: 'bar-invalid',
                  type: 'FRAME',
                  children: [text('scale')],
                },
              ]),
              section('radius', [
                {
                  id: 'sample',
                  name: 'sample',
                  type: 'FRAME',
                  children: [text('12px')],
                },
              ]),
              section('typography', [
                {
                  id: 'row1',
                  name: 'row',
                  type: 'FRAME',
                  children: [text(undefined, { fontSize: 12 })],
                },
                {
                  id: 'row2',
                  name: 'row',
                  type: 'FRAME',
                  children: [text('body', { fontSize: 12 })],
                },
              ]),
            ],
          },
        ],
      },
    };
    expect(extractFoundationTokens(file)).toEqual([]);
  });

  it('extracts complete documented scales and shadow fallbacks', () => {
    const section = (name: string, children: FigmaNode[]): FigmaNode => ({
      id: name,
      name,
      type: 'FRAME',
      children,
    });
    const file: FigmaFile = {
      document: {
        id: 'd',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          {
            id: 'p',
            name: '01-foundation',
            type: 'CANVAS',
            children: [
              {
                id: 'content',
                name: 'size.content',
                type: 'FRAME',
                absoluteBoundingBox: { width: 100, height: 200 },
              },
              {
                id: 'control',
                name: 'size.control',
                type: 'FRAME',
                absoluteBoundingBox: { width: 100, height: 40 },
              },
              section('colors', [
                {
                  id: 'swatch1',
                  name: 'swatch',
                  type: 'FRAME',
                  children: [text('Primary'), text('#AABBCC')],
                },
                {
                  id: 'swatch2',
                  name: 'swatch',
                  type: 'FRAME',
                  children: [
                    text('Secondary'),
                    {
                      id: 'paint',
                      name: 'paint',
                      type: 'RECTANGLE',
                      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
                    },
                  ],
                },
              ]),
              section('spacing', [
                {
                  id: 'bar',
                  name: 'bar-1',
                  type: 'FRAME',
                  children: [text('100'), text('8px')],
                },
              ]),
              section('radius', [
                {
                  id: 'sample',
                  name: 'sample',
                  type: 'FRAME',
                  children: [text('Medium'), text('6px')],
                },
              ]),
              section('typography', [
                {
                  id: 'row',
                  name: 'row',
                  type: 'FRAME',
                  children: [
                    text('Body/Regular', {
                      fontFamily: 'Inter',
                      fontSize: 16,
                      fontWeight: 400,
                      lineHeightPx: 24,
                    }),
                  ],
                },
              ]),
              section('shadows', [
                {
                  id: 'shadow-sample',
                  name: 'sample',
                  type: 'FRAME',
                  children: [
                    text('Raised'),
                    {
                      id: 'visual',
                      name: 'visual',
                      type: 'FRAME',
                      effects: [
                        {
                          type: 'DROP_SHADOW',
                          offset: { x: 1, y: 2 },
                          radius: 3,
                          spread: 4,
                        },
                        {
                          type: 'INNER_SHADOW',
                          color: { r: 0, g: 0, b: 0, a: 0.5 },
                        },
                      ],
                    },
                  ],
                },
              ]),
            ],
          },
        ],
      },
    };
    const tokens = extractFoundationTokens(file);
    expect(tokens.map((token) => token.name)).toEqual(
      expect.arrayContaining([
        'color.primary',
        'color.secondary',
        'space.100',
        'radius.medium',
        'font.body.regular',
        'shadow.raised',
      ]),
    );
    expect(
      tokens.find((token) => token.name === 'shadow.raised')?.value,
    ).toContain('inset');
  });
});
