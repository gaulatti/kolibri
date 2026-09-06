import type { FigmaNode, FigmaPaint } from '../clients/figma/figma.types';
import type { NormalizedStyle } from './figma-importer.types';
import { figmaColorToHex, walkFigmaTree } from './figma-tree.utils';

export function firstSolid(paints?: FigmaPaint[]): string | undefined {
  const paint = paints?.find(
    (value) => value.type === 'SOLID' && value.visible !== false && value.color,
  );
  if (!paint?.color) return undefined;
  const alpha = (paint.opacity ?? 1) * (paint.color.a ?? 1);
  if (alpha >= 0.999) return figmaColorToHex(paint.color);
  const { r, g, b } = paint.color;
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${formatNumber(alpha)})`;
}
export function firstText(node: FigmaNode): string | undefined {
  let result: string | undefined;
  walkFigmaTree(node, (child) => {
    if (!result && child.type === 'TEXT' && child.characters)
      result = child.characters;
  });
  return result;
}
export function normalizeStyle(
  node: FigmaNode,
  metadata: Record<string, unknown>,
  options: {
    useBounds?: boolean;
    inheritText?: boolean;
    preferResolvedLayout?: boolean;
  } = {},
): NormalizedStyle {
  let text: FigmaNode | undefined = node.type === 'TEXT' ? node : undefined;
  if (options.inheritText !== false && !text)
    walkFigmaTree(node, (child) => {
      if (!text && child.type === 'TEXT') text = child;
    });
  const alignment = {
    MIN: 'flex-start',
    CENTER: 'center',
    MAX: 'flex-end',
  } as const;
  const primaryAlignment = {
    MIN: 'flex-start',
    CENTER: 'center',
    MAX: 'flex-end',
    SPACE_BETWEEN: 'space-between',
  } as const;
  const horizontalTextAlignment = {
    LEFT: 'left',
    CENTER: 'center',
    RIGHT: 'right',
    JUSTIFIED: 'justify',
  } as const;
  const textDecoration = {
    NONE: 'none',
    UNDERLINE: 'underline',
    STRIKETHROUGH: 'line-through',
  } as const;
  const resolvedWidth = options.useBounds
    ? node.absoluteBoundingBox?.width
    : undefined;
  const resolvedHeight = options.useBounds
    ? node.absoluteBoundingBox?.height
    : undefined;
  const width = options.preferResolvedLayout
    ? (resolvedWidth ?? numericMetadata(metadata, 'layout.width'))
    : (numericMetadata(metadata, 'layout.width') ?? resolvedWidth);
  const height = options.preferResolvedLayout
    ? (resolvedHeight ?? numericMetadata(metadata, 'layout.height'))
    : (numericMetadata(metadata, 'layout.height') ?? resolvedHeight);
  const figmaWidthMode = figmaSizingMode(node.layoutSizingHorizontal);
  const figmaHeightMode = figmaSizingMode(node.layoutSizingVertical);
  const metadataWidthMode = sizingMode(metadata['layout.widthMode']);
  const metadataHeightMode = sizingMode(metadata['layout.heightMode']);
  const resolvedWidthMode =
    options.preferResolvedLayout &&
    options.useBounds &&
    figmaWidthMode === 'hug'
      ? 'fixed'
      : figmaWidthMode;
  const resolvedHeightMode =
    options.preferResolvedLayout &&
    options.useBounds &&
    figmaHeightMode === 'hug'
      ? 'fixed'
      : figmaHeightMode;
  return {
    background:
      node.type === 'TEXT' || node.type === 'VECTOR'
        ? undefined
        : (firstSolid(node.fills) ?? firstSolid(node.background)),
    backgroundImageRef: firstImage(node.fills)?.imageRef,
    backgroundSize: imageScaleMode(firstImage(node.fills)?.scaleMode),
    color: text ? firstSolid(text.fills) : undefined,
    borderColor: firstSolid(node.strokes),
    borderWidth: node.strokes?.length ? (node.strokeWeight ?? 1) : undefined,
    borderTopWidth: node.individualStrokeWeights?.top,
    borderRightWidth: node.individualStrokeWeights?.right,
    borderBottomWidth: node.individualStrokeWeights?.bottom,
    borderLeftWidth: node.individualStrokeWeights?.left,
    borderAlign: node.strokeAlign?.toLowerCase() as
      'inside' | 'outside' | 'center' | undefined,
    borderIncludedInLayout: node.strokesIncludedInLayout,
    opacity: node.opacity,
    rotation: node.rotation,
    boxShadow: boxShadow(node),
    width,
    height,
    widthMode:
      (options.preferResolvedLayout
        ? (resolvedWidthMode ?? metadataWidthMode)
        : (metadataWidthMode ?? figmaWidthMode)) ??
      (options.useBounds && width !== undefined ? 'fixed' : undefined),
    heightMode:
      (options.preferResolvedLayout
        ? (resolvedHeightMode ?? metadataHeightMode)
        : (metadataHeightMode ?? figmaHeightMode)) ??
      (options.useBounds && height !== undefined ? 'fixed' : undefined),
    minWidth: options.preferResolvedLayout
      ? figmaWidthMode === 'fill'
        ? 0
        : resolvedWidth
      : numericMetadata(metadata, 'layout.minWidth'),
    maxWidth: options.preferResolvedLayout
      ? resolvedWidth
      : numericMetadata(metadata, 'layout.maxWidth'),
    minHeight:
      (options.preferResolvedLayout
        ? figmaHeightMode === 'fill'
          ? 0
          : resolvedHeight
        : numericMetadata(metadata, 'layout.minHeight')) ??
      (sizingMode(metadata['layout.heightMode']) === 'hug' &&
      figmaSizingMode(node.layoutSizingVertical) === 'fixed'
        ? node.absoluteBoundingBox?.height
        : undefined),
    maxHeight: options.preferResolvedLayout
      ? resolvedHeight
      : numericMetadata(metadata, 'layout.maxHeight'),
    overflow:
      overflowMode(metadata['layout.overflow']) ??
      (node.clipsContent ? 'hidden' : undefined),
    aspectRatio: numericMetadata(metadata, 'layout.aspectRatio'),
    cornerRadius:
      node.type === 'ELLIPSE' &&
      resolvedWidth !== undefined &&
      resolvedHeight !== undefined
        ? Math.min(resolvedWidth, resolvedHeight) / 2
        : node.cornerRadius,
    cornerRadii: node.rectangleCornerRadii,
    paddingTop: node.paddingTop,
    paddingRight: node.paddingRight,
    paddingBottom: node.paddingBottom,
    paddingLeft: node.paddingLeft,
    gap: node.itemSpacing,
    rowGap: node.counterAxisSpacing,
    layout:
      node.layoutMode === 'HORIZONTAL'
        ? 'horizontal'
        : node.layoutMode === 'VERTICAL'
          ? 'vertical'
          : undefined,
    flexWrap: node.layoutWrap === 'WRAP' ? 'wrap' : undefined,
    alignItems: node.counterAxisAlignItems
      ? alignment[node.counterAxisAlignItems as keyof typeof alignment]
      : undefined,
    justifyContent: node.primaryAxisAlignItems
      ? primaryAlignment[
          node.primaryAxisAlignItems as keyof typeof primaryAlignment
        ]
      : undefined,
    flexGrow: node.layoutGrow,
    fontFamily: text?.style?.fontFamily,
    fontSize: text?.style?.fontSize,
    fontWeight: text?.style?.fontWeight,
    lineHeight: text?.style?.lineHeightPx,
    letterSpacing: text?.style?.letterSpacing,
    textAlign: text?.style?.textAlignHorizontal
      ? horizontalTextAlignment[
          text.style.textAlignHorizontal as keyof typeof horizontalTextAlignment
        ]
      : undefined,
    textDecoration: text?.style?.textDecoration
      ? textDecoration[text.style.textDecoration as keyof typeof textDecoration]
      : undefined,
  };
}

function firstImage(paints?: FigmaPaint[]): FigmaPaint | undefined {
  return paints?.find(
    (paint) =>
      paint.type === 'IMAGE' && paint.visible !== false && paint.imageRef,
  );
}

function imageScaleMode(
  value: string | undefined,
): NormalizedStyle['backgroundSize'] {
  if (value === 'FIT') return 'contain';
  if (value === 'STRETCH') return 'fill';
  return value ? 'cover' : undefined;
}

function boxShadow(node: FigmaNode): string | undefined {
  const shadows = (node.effects ?? [])
    .filter(
      (effect) =>
        effect.visible !== false &&
        (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'),
    )
    .map((effect) => {
      const color = effect.color
        ? firstSolid([{ type: 'SOLID', color: effect.color }])
        : 'rgba(0, 0, 0, 0.15)';
      return `${effect.type === 'INNER_SHADOW' ? 'inset ' : ''}${formatNumber(effect.offset?.x ?? 0)}px ${formatNumber(effect.offset?.y ?? 0)}px ${formatNumber(effect.radius ?? 0)}px ${formatNumber(effect.spread ?? 0)}px ${color}`;
    });
  return shadows.length ? shadows.join(', ') : undefined;
}

export function numericMetadata(
  metadata: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = metadata[key];
  if (value === '' || value === undefined || value === null) return undefined;
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : undefined;
}

export function sizingMode(value: unknown): NormalizedStyle['widthMode'] {
  return value === 'hug' || value === 'fill' || value === 'fixed'
    ? value
    : undefined;
}

function figmaSizingMode(value: unknown): NormalizedStyle['widthMode'] {
  if (value === 'HUG') return 'hug';
  if (value === 'FILL') return 'fill';
  if (value === 'FIXED') return 'fixed';
  return undefined;
}

function overflowMode(value: unknown): NormalizedStyle['overflow'] {
  return value === 'visible' || value === 'hidden' || value === 'auto'
    ? value
    : undefined;
}

function formatNumber(value: number): string {
  return String(Math.round(value * 1_000_000) / 1_000_000);
}
