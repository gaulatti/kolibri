import type { FigmaNode } from '../clients/figma/figma.types';
import type { ImportedComponentInstance } from './figma-importer.types';
import { normalizeProperties } from './component-metadata';
import { firstText, normalizeStyle } from './normalize-component-style';
import { walkFigmaTree } from './figma-tree.utils';

export function componentNames(document: FigmaNode): Map<string, string> {
  const names = new Map<string, string>();
  const sets = new Map<string, string>();
  walkFigmaTree(document, (node) => {
    if (node.type === 'COMPONENT_SET') sets.set(node.id, node.name);
  });
  walkFigmaTree(document, (node) => {
    if (node.type === 'COMPONENT')
      names.set(
        node.id,
        node.componentSetId
          ? (sets.get(node.componentSetId) ?? node.name)
          : node.name,
      );
  });
  return names;
}

export function directInstances(
  root: FigmaNode,
  names: Map<string, string>,
): ImportedComponentInstance[] {
  const occurrences = new Map<string, number>();
  return (root.children ?? []).flatMap((node) =>
    instanceFromNode(node, names, occurrences),
  );
}

function instanceFromNode(
  node: FigmaNode,
  names: Map<string, string>,
  occurrences: Map<string, number>,
): ImportedComponentInstance[] {
  if (node.type === 'INSTANCE' && node.componentId) {
    const baseClass = slug(node.name);
    const occurrence = (occurrences.get(baseClass) ?? 0) + 1;
    occurrences.set(baseClass, occurrence);
    return [
      {
        id: node.id,
        name: node.name,
        cssClass: occurrence === 1 ? baseClass : `${baseClass}-${occurrence}`,
        componentId: node.componentId,
        componentName: names.get(node.componentId),
        textOverride: firstText(node),
        visible: node.visible !== false,
        semanticMetadata: normalizeProperties(node.componentProperties),
        style: normalizeStyle(
          node,
          normalizeProperties(node.componentProperties),
          { useBounds: true, preferResolvedLayout: true },
        ),
        children: (node.children ?? []).flatMap((child) =>
          instanceFromNode(child, names, occurrences),
        ),
      },
    ];
  }
  return (node.children ?? []).flatMap((child) =>
    instanceFromNode(child, names, occurrences),
  );
}

function slug(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'instance'
  );
}
