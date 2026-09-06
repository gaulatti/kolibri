import type { FigmaColor, FigmaNode } from '../clients/figma/figma.types';

export function walkFigmaTree(
  node: FigmaNode,
  visitor: (node: FigmaNode) => void,
): void {
  visitor(node);
  for (const child of node.children ?? []) walkFigmaTree(child, visitor);
}

export function findPage(
  document: FigmaNode,
  pageName: string,
): FigmaNode | undefined {
  return document.children?.find(
    (node) => node.type === 'CANVAS' && node.name === pageName,
  );
}

export function figmaColorToHex(color: FigmaColor): string {
  const channel = (value: number) =>
    Math.round(Math.max(0, Math.min(1, value)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

export function tokenNameToCssVariable(name: string): string {
  return `--${name.replaceAll('.', '-')}`;
}
