import type { FigmaFile } from '../clients/figma/figma.types';
import { walkFigmaTree } from './figma-tree.utils';

export function extractImageReferences(figmaFile: FigmaFile): string[] {
  const references = new Set<string>();
  walkFigmaTree(figmaFile.document, (node) => {
    for (const paint of node.fills ?? [])
      if (paint.type === 'IMAGE' && paint.visible !== false && paint.imageRef)
        references.add(paint.imageRef);
  });
  return [...references];
}
