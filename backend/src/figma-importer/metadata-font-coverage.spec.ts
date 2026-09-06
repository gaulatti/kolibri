import type { FigmaFile, FigmaNode } from '../clients/figma/figma.types';
import { validateMetadata } from './component-metadata';
import { extractFontSources } from './extract-font-sources';
import type { Diagnostic } from './figma-importer.types';

const node = (overrides: Partial<FigmaNode> = {}) => ({
  id: 'node',
  name: 'component',
  type: 'COMPONENT',
  ...overrides,
});

describe('metadata and font source edge coverage', () => {
  it('reports missing fixed dimensions', () => {
    const diagnostics: Diagnostic[] = [];
    validateMetadata(
      node(),
      { 'layout.widthMode': 'fixed', 'layout.heightMode': 'fixed' },
      diagnostics,
    );
    expect(diagnostics.map((item) => item.code)).toEqual([
      'FIXED_WIDTH_REQUIRED',
      'FIXED_HEIGHT_REQUIRED',
    ]);
  });

  it('skips malformed font definitions and unsafe URLs while accepting HTTPS', () => {
    const definition = (values: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(values).map(([key, defaultValue]) => [
          `${key}#1:1`,
          { type: 'TEXT', defaultValue },
        ]),
      );
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
              node({
                id: 'wrong-name',
                name: 'other',
                componentPropertyDefinitions: definition({}),
              }),
              node({
                id: 'invalid',
                name: 'font-source.invalid',
                componentPropertyDefinitions: definition({
                  'font.family': 'Inter',
                  'font.provider': 'css',
                  'font.cssUrl': 'not a url',
                  'font.fallback': 'sans-serif',
                }),
              }),
              node({
                id: 'http',
                name: 'font-source.http',
                componentPropertyDefinitions: definition({
                  'font.family': 'Inter',
                  'font.provider': 'css',
                  'font.cssUrl': 'http://fonts.test',
                  'font.fallback': 'sans-serif',
                }),
              }),
              node({
                id: 'valid',
                name: 'font-source.valid',
                componentPropertyDefinitions: definition({
                  'font.family': ' Inter ',
                  'font.provider': 'css',
                  'font.cssUrl': 'https://fonts.test/css',
                  'font.fallback': ' system-ui ',
                }),
              }),
            ],
          },
        ],
      },
    };
    expect(extractFontSources(file)).toEqual([
      {
        family: 'Inter',
        provider: 'css',
        cssUrl: 'https://fonts.test/css',
        fallback: 'system-ui',
        sourceNodeId: 'valid',
      },
    ]);
    expect(
      extractFontSources({
        document: node({ type: 'DOCUMENT', children: [] }),
      }),
    ).toEqual([]);
  });
});
