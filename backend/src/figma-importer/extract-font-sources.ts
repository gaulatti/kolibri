import type { FigmaFile, FigmaNode } from '../clients/figma/figma.types';
import type { ImportedFontSource } from './figma-importer.types';
import { findPage, walkFigmaTree } from './figma-tree.utils';

export function extractFontSources(figmaFile: FigmaFile): ImportedFontSource[] {
  const page = findPage(figmaFile.document, '01-foundation');
  if (!page) return [];
  const sources: ImportedFontSource[] = [];
  walkFigmaTree(page, (node) => {
    if (!node.name.startsWith('font-source.') || node.type !== 'COMPONENT')
      return;
    const properties = propertyDefaults(node);
    const family = stringProperty(properties, 'font.family');
    const provider = stringProperty(properties, 'font.provider');
    const cssUrl = stringProperty(properties, 'font.cssUrl');
    const fallback = stringProperty(properties, 'font.fallback');
    if (
      !family ||
      provider !== 'css' ||
      !cssUrl ||
      !isSafeStylesheetUrl(cssUrl) ||
      !fallback
    )
      return;
    sources.push({
      family,
      provider,
      cssUrl,
      fallback,
      sourceNodeId: node.id,
    });
  });
  return sources;
}

function propertyDefaults(node: FigmaNode): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(node.componentPropertyDefinitions ?? {}).map(
      ([name, definition]) => [
        name.replace(/#\d+:\d+$/, ''),
        definition.defaultValue,
      ],
    ),
  );
}

function stringProperty(
  properties: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = properties[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isSafeStylesheetUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
