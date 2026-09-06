import type { FigmaFile } from '../clients/figma/figma.types';
import { FigmaImporterService } from './figma-importer.service';

describe('import diagnostics', () => {
  it('reports unknown metadata and inaccessible image definitions', () => {
    const file: FigmaFile = {
      document: {
        id: 'document',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          { id: 'foundation', name: '01-foundation', type: 'CANVAS' },
          {
            id: 'atoms',
            name: '02-atoms',
            type: 'CANVAS',
            children: [
              {
                id: 'image',
                name: 'image',
                type: 'COMPONENT',
                componentPropertyDefinitions: {
                  'semantic.element#1:1': {
                    type: 'TEXT',
                    defaultValue: 'img',
                  },
                  'mystery.value#1:2': {
                    type: 'TEXT',
                    defaultValue: 'unknown',
                  },
                },
              },
            ],
          },
        ],
      },
    };

    const result = new FigmaImporterService().importDesignSystem(file);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'UNKNOWN_METADATA',
      'IMAGE_ALT_REQUIRED',
      'MISSING_SIZING_INTENT',
    ]);
  });

  it('reports void root semantics that cannot represent the visual tree', () => {
    const file: FigmaFile = {
      document: {
        id: 'document',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          { id: 'foundation', name: '01-foundation', type: 'CANVAS' },
          {
            id: 'atoms',
            name: '02-atoms',
            type: 'CANVAS',
            children: [
              {
                id: 'avatar',
                name: 'avatar',
                type: 'COMPONENT',
                componentPropertyDefinitions: {
                  'semantic.element#1:1': {
                    type: 'TEXT',
                    defaultValue: 'img',
                  },
                  'accessibility.decorative#1:2': {
                    type: 'BOOLEAN',
                    defaultValue: true,
                  },
                  'layout.widthMode#1:3': {
                    type: 'TEXT',
                    defaultValue: 'fixed',
                  },
                  'layout.heightMode#1:4': {
                    type: 'TEXT',
                    defaultValue: 'fixed',
                  },
                  'layout.width#1:5': {
                    type: 'TEXT',
                    defaultValue: '48',
                  },
                  'layout.height#1:6': {
                    type: 'TEXT',
                    defaultValue: '48',
                  },
                },
              },
            ],
          },
        ],
      },
    };

    const result = new FigmaImporterService().importDesignSystem(file);

    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'SEMANTIC_ELEMENT_FALLBACK',
        component: 'avatar',
        nodeId: 'avatar',
      }),
    ]);
  });
});
