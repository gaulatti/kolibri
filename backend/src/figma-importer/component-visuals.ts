import type { FigmaNode } from '../clients/figma/figma.types';
import type {
  ImportedVisualNode,
  NormalizedVector,
} from './figma-importer.types';
import { normalizeProperties } from './component-metadata';
import { firstSolid, normalizeStyle } from './normalize-component-style';
import { walkFigmaTree } from './figma-tree.utils';

export function visualChildren(root: FigmaNode): ImportedVisualNode[] {
  return (root.children ?? []).map((node, index) =>
    visualNode(node, String(index), root.layoutMode),
  );
}

function visualNode(
  node: FigmaNode,
  key: string,
  parentLayout?: FigmaNode['layoutMode'],
): ImportedVisualNode {
  const semanticMetadata = normalizeProperties(node.componentProperties);
  const style = normalizeStyle(node, semanticMetadata, {
    useBounds: true,
    inheritText: false,
    preferResolvedLayout: true,
  });
  if (parentLayout === 'HORIZONTAL' && style.widthMode === 'fill')
    style.widthMode = undefined;
  if (parentLayout === 'VERTICAL' && style.heightMode === 'fill')
    style.heightMode = undefined;
  return {
    id: node.id,
    key,
    name: node.name,
    type: node.type,
    text: node.type === 'TEXT' ? node.characters : undefined,
    visible: node.visible !== false,
    semanticMetadata,
    part: componentPart(node.name, semanticMetadata),
    style,
    vectors: node.type === 'VECTOR' ? extractVectors(node) : [],
    children: (node.children ?? []).map((child, index) =>
      visualNode(child, `${key}-${index}`, node.layoutMode),
    ),
  };
}

function componentPart(
  name: string,
  metadata: Record<string, unknown>,
): string | undefined {
  const explicit = metadata.part;
  if (typeof explicit === 'string' && explicit.trim()) {
    return normalizePart(explicit);
  }
  const match = name.trim().match(/^@part[/:]([a-zA-Z][a-zA-Z0-9_-]*)$/);
  return match ? normalizePart(match[1]) : undefined;
}

function normalizePart(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function extractVectors(root: FigmaNode): NormalizedVector[] {
  const vectors: NormalizedVector[] = [];
  walkFigmaTree(root, (node) => {
    if (node.type !== 'VECTOR') return;
    const paths = [
      ...(node.fillGeometry ?? []).map((path) => ({
        d: path.path,
        fill: firstSolid(node.fills) ?? 'currentColor',
      })),
      ...(node.strokeGeometry ?? []).map((path) => ({
        d: path.path,
        fill: 'none',
        stroke: firstSolid(node.strokes) ?? 'currentColor',
        strokeWidth: node.strokeWeight,
      })),
    ];
    if (paths.length)
      vectors.push({
        name: node.name,
        width: node.absoluteBoundingBox?.width ?? 24,
        height: node.absoluteBoundingBox?.height ?? 24,
        paths,
      });
  });
  return vectors;
}
