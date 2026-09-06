import type { FigmaFile, FigmaNode } from '../clients/figma/figma.types';
import type { KolibriToken } from './figma-importer.types';
import {
  figmaColorToHex,
  findPage,
  tokenNameToCssVariable,
  walkFigmaTree,
} from './figma-tree.utils';

export function extractFoundationTokens(figmaJson: FigmaFile): KolibriToken[] {
  const page = findPage(figmaJson.document, '01-foundation');
  if (!page) return [];
  const tokens: KolibriToken[] = [];

  walkFigmaTree(page, (node) => {
    const base = {
      name: node.name,
      cssName: tokenNameToCssVariable(node.name),
      sourceNodeId: node.id,
    };
    if (node.name.startsWith('color.') && node.type !== 'TEXT') {
      const paint = node.fills?.find(
        (fill) => fill.type === 'SOLID' && fill.visible !== false && fill.color,
      );
      if (paint?.color)
        tokens.push({
          ...base,
          kind: 'color',
          value: figmaColorToHex(paint.color),
        });
    } else if (node.name.startsWith('space.') && node.type !== 'TEXT') {
      if (typeof node.absoluteBoundingBox?.width === 'number')
        tokens.push({
          ...base,
          kind: 'space',
          value: node.absoluteBoundingBox.width,
        });
    } else if (node.name.startsWith('radius.') && node.type !== 'TEXT') {
      if (typeof node.cornerRadius === 'number')
        tokens.push({ ...base, kind: 'radius', value: node.cornerRadius });
    } else if (node.name.startsWith('font.') && node.type === 'TEXT') {
      tokens.push({
        ...base,
        kind: 'typography',
        value: {
          fontFamily: node.style?.fontFamily,
          fontSize: node.style?.fontSize,
          fontWeight: node.style?.fontWeight,
          lineHeight: node.style?.lineHeightPx,
        },
      });
    } else if (node.name.startsWith('size.') && node.type !== 'TEXT') {
      const isIconSize = node.name.startsWith('size.icon.');
      tokens.push({
        ...base,
        kind: 'size',
        value: {
          width:
            isIconSize || node.name === 'size.content'
              ? node.absoluteBoundingBox?.width
              : undefined,
          height:
            isIconSize || node.name === 'size.control'
              ? node.absoluteBoundingBox?.height
              : undefined,
        },
      });
    }
  });
  extractDocumentedColors(page, tokens);
  extractDocumentedSpacing(page, tokens);
  extractDocumentedRadii(page, tokens);
  extractDocumentedTypography(page, tokens);
  extractDocumentedShadows(page, tokens);
  return uniqueTokens(tokens);
}

function extractDocumentedColors(page: FigmaNode, tokens: KolibriToken[]) {
  const section = findNamedNode(page, 'colors');
  if (!section) return;
  walkFigmaTree(section, (node) => {
    if (node.name !== 'swatch') return;
    const labels = descendantText(node);
    const label = labels.find((value) => !/^#[0-9a-f]{6}$/i.test(value));
    const displayedValue = labels.find((value) =>
      /^#[0-9a-f]{6}$/i.test(value),
    );
    const paint = firstDescendantSolid(node);
    const value =
      displayedValue?.toLowerCase() ??
      (paint?.color ? figmaColorToHex(paint.color) : undefined);
    if (label && value)
      tokens.push(
        token(`color.${tokenSegment(label)}`, 'color', value, node.id),
      );
  });
}

function extractDocumentedSpacing(page: FigmaNode, tokens: KolibriToken[]) {
  const section = findNamedNode(page, 'spacing');
  if (!section) return;
  walkFigmaTree(section, (node) => {
    if (!node.name.startsWith('bar-')) return;
    const labels = descendantText(node);
    const scale = labels.find((value) => /^\d+(?:\.\d+)?$/.test(value));
    const pixels = labels.find((value) => /^\d+(?:\.\d+)?px$/i.test(value));
    if (!scale || !pixels) return;
    tokens.push(
      token(
        `space.${tokenSegment(scale)}`,
        'space',
        Number.parseFloat(pixels),
        node.id,
      ),
    );
  });
}

function extractDocumentedRadii(page: FigmaNode, tokens: KolibriToken[]) {
  const section = findNamedNode(page, 'radius');
  if (!section) return;
  walkFigmaTree(section, (node) => {
    if (node.name !== 'sample') return;
    const labels = descendantText(node);
    const label = labels.find((value) => !/^\d+(?:\.\d+)?px$/i.test(value));
    const pixels = labels.find((value) => /^\d+(?:\.\d+)?px$/i.test(value));
    if (!label || !pixels) return;
    tokens.push(
      token(
        `radius.${tokenSegment(label)}`,
        'radius',
        Number.parseFloat(pixels),
        node.id,
      ),
    );
  });
}

function extractDocumentedTypography(page: FigmaNode, tokens: KolibriToken[]) {
  const section = findNamedNode(page, 'typography');
  if (!section) return;
  walkFigmaTree(section, (node) => {
    if (node.name !== 'row') return;
    const sample = (node.children ?? []).find(
      (child) => child.type === 'TEXT' && child.style?.fontSize,
    );
    if (!sample?.characters || !sample.style) return;
    const [sizeName, weightName] = sample.characters
      .split('/')
      .map((value) => tokenSegment(value));
    if (!sizeName || !weightName) return;
    tokens.push(
      token(
        `font.${sizeName}.${weightName}`,
        'typography',
        {
          fontFamily: sample.style.fontFamily,
          fontSize: sample.style.fontSize,
          fontWeight: sample.style.fontWeight,
          lineHeight: sample.style.lineHeightPx,
        },
        sample.id,
      ),
    );
  });
}

function extractDocumentedShadows(page: FigmaNode, tokens: KolibriToken[]) {
  const section = findNamedNode(page, 'shadows');
  if (!section) return;
  walkFigmaTree(section, (node) => {
    if (node.name !== 'sample') return;
    const label = descendantText(node)[0];
    const visual = (node.children ?? []).find((child) =>
      child.effects?.some((effect) => effect.type.includes('SHADOW')),
    );
    const value = visual ? shadowCss(visual) : undefined;
    if (label && value)
      tokens.push(
        token(`shadow.${tokenSegment(label)}`, 'shadow', value, visual!.id),
      );
  });
}

function token(
  name: string,
  kind: KolibriToken['kind'],
  value: KolibriToken['value'],
  sourceNodeId: string,
): KolibriToken {
  return {
    name,
    cssName: tokenNameToCssVariable(name),
    kind,
    value,
    sourceNodeId,
  };
}

function uniqueTokens(tokens: KolibriToken[]): KolibriToken[] {
  const unique = new Map<string, KolibriToken>();
  for (const item of tokens)
    if (!unique.has(item.cssName)) unique.set(item.cssName, item);
  return [...unique.values()];
}

function findNamedNode(root: FigmaNode, name: string): FigmaNode | undefined {
  let result: FigmaNode | undefined;
  walkFigmaTree(root, (node) => {
    if (!result && node.name.toLowerCase() === name.toLowerCase())
      result = node;
  });
  return result;
}

function descendantText(root: FigmaNode): string[] {
  const values: string[] = [];
  walkFigmaTree(root, (node) => {
    if (node.type === 'TEXT' && node.characters?.trim())
      values.push(node.characters.trim());
  });
  return values;
}

function firstDescendantSolid(root: FigmaNode) {
  let result: NonNullable<FigmaNode['fills']>[number] | undefined;
  walkFigmaTree(root, (node) => {
    if (result) return;
    result = node.fills?.find(
      (paint) =>
        paint.type === 'SOLID' && paint.visible !== false && paint.color,
    );
  });
  return result;
}

function shadowCss(node: FigmaNode): string | undefined {
  const effects = (node.effects ?? [])
    .filter(
      (effect) => effect.visible !== false && effect.type.includes('SHADOW'),
    )
    .map((effect) => {
      const color = effect.color;
      const rgba = color
        ? `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${round(color.a ?? 1)})`
        : 'rgba(0, 0, 0, 0.15)';
      return `${effect.type === 'INNER_SHADOW' ? 'inset ' : ''}${round(effect.offset?.x ?? 0)}px ${round(effect.offset?.y ?? 0)}px ${round(effect.radius ?? 0)}px ${round(effect.spread ?? 0)}px ${rgba}`;
    });
  return effects.length ? effects.join(', ') : undefined;
}

function tokenSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '');
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
