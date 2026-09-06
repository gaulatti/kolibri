import type {
  ImportedComponentInstance,
  ImportedFontSource,
  ImportedVisualNode,
  KolibriToken,
  NormalizedStyle,
  TypographyValue,
} from '../figma-importer/figma-importer.types';
import {
  fontFamilyValue,
  formatNumber,
  resolveColorValue,
  resolveNumericValue,
  resolveSize,
} from './css-values';

export function findVisualStyle(
  nodes: ImportedVisualNode[],
  name: string,
): NormalizedStyle | undefined {
  for (const node of nodes) {
    if (node.name.toLowerCase() === name.toLowerCase()) return node.style;
    const nested = findVisualStyle(node.children, name);
    if (nested) return nested;
  }
  return undefined;
}

export function mergeVisualTextStyle(
  node: ImportedVisualNode,
): NormalizedStyle {
  const text = findFirstVisualTextStyle(node.children);
  return {
    ...node.style,
    color: text?.color ?? node.style.color,
    fontFamily: text?.fontFamily ?? node.style.fontFamily,
    fontSize: text?.fontSize ?? node.style.fontSize,
    fontWeight: text?.fontWeight ?? node.style.fontWeight,
    lineHeight: text?.lineHeight ?? node.style.lineHeight,
    letterSpacing: text?.letterSpacing ?? node.style.letterSpacing,
    textAlign: text?.textAlign ?? node.style.textAlign,
    textDecoration: text?.textDecoration ?? node.style.textDecoration,
  };
}

function findFirstVisualTextStyle(
  nodes: ImportedVisualNode[],
): NormalizedStyle | undefined {
  for (const node of nodes) {
    if (node.type === 'TEXT') return node.style;
    const nested = findFirstVisualTextStyle(node.children);
    if (nested) return nested;
  }
  return undefined;
}

export function visualRules(
  componentName: string,
  nodes: ImportedVisualNode[],
  tokens: KolibriToken[],
  fontSources: ImportedFontSource[],
  parentSelector = `.kolibri-${componentName}`,
): string[] {
  return nodes.flatMap((node) => {
    if (!node.visible) return [];
    const selector = `${parentSelector} .kolibri-${componentName}__node-${node.key}`;
    return [
      rule(selector, node.style, tokens, fontSources),
      ...visualRules(
        componentName,
        node.children,
        tokens,
        fontSources,
        parentSelector,
      ),
    ];
  });
}

export function compositionRules(
  componentName: string,
  instances: ImportedComponentInstance[],
  tokens: KolibriToken[],
  fontSources: ImportedFontSource[],
  parentSelector = `.kolibri-${componentName}`,
): string[] {
  return instances.flatMap((instance) => {
    if (!instance.visible) return [];
    const selector = `${parentSelector} .kolibri-${componentName}__${instance.cssClass}`;
    return [
      rule(selector, instance.style, tokens, fontSources),
      ...compositionRules(
        componentName,
        instance.children,
        tokens,
        fontSources,
        parentSelector,
      ),
    ];
  });
}

export function rule(
  selector: string,
  style: NormalizedStyle,
  tokens: KolibriToken[],
  fontSources: ImportedFontSource[],
): string {
  const values: string[] = [];
  values.push('  box-sizing: border-box;');
  values.push('  margin: 0;');
  values.push('  border: 0 solid transparent;');
  if (style.background)
    values.push(
      `  background: ${resolveColorValue(style.background, tokens)};`,
    );
  if (style.backgroundImageRef) {
    values.push(
      `  background-image: url("../assets/figma-${style.backgroundImageRef}.png");`,
    );
    values.push(`  background-size: ${style.backgroundSize ?? 'cover'};`);
    values.push('  background-position: center;');
    values.push('  background-repeat: no-repeat;');
  }
  if (style.color)
    values.push(`  color: ${resolveColorValue(style.color, tokens)};`);
  const shadows: string[] = [];
  if (style.borderColor) {
    const color = resolveColorValue(style.borderColor, tokens);
    if (style.borderIncludedInLayout) {
      values.push(`  border-color: ${color};`);
      values.push('  border-style: solid;');
      values.push(
        `  border-width: ${[
          style.borderTopWidth ?? style.borderWidth ?? 0,
          style.borderRightWidth ?? style.borderWidth ?? 0,
          style.borderBottomWidth ?? style.borderWidth ?? 0,
          style.borderLeftWidth ?? style.borderWidth ?? 0,
        ]
          .map((value) => `${formatNumber(value)}px`)
          .join(' ')};`,
      );
    } else shadows.push(...strokeShadows(style, color));
  }
  if (style.opacity !== undefined)
    values.push(`  opacity: ${formatNumber(style.opacity)};`);
  if (style.rotation !== undefined && style.rotation !== 0) {
    const unit = Math.abs(style.rotation) <= Math.PI * 2 ? 'rad' : 'deg';
    values.push(`  transform: rotate(${formatNumber(style.rotation)}${unit});`);
  }
  if (style.boxShadow)
    shadows.push(resolveShadowValue(style.boxShadow, tokens));
  if (shadows.length) values.push(`  box-shadow: ${shadows.join(', ')};`);
  if (
    style.paddingTop !== undefined ||
    style.paddingRight !== undefined ||
    style.paddingBottom !== undefined ||
    style.paddingLeft !== undefined
  ) {
    const p = [
      style.paddingTop ?? 0,
      style.paddingRight ?? 0,
      style.paddingBottom ?? 0,
      style.paddingLeft ?? 0,
    ].map((value) => resolveNumericValue(value, 'space', tokens));
    values.push(
      `  padding: ${p[0] === p[2] && p[1] === p[3] ? (p[0] === p[1] ? p[0] : `${p[0]} ${p[1]}`) : p.join(' ')};`,
    );
  }
  if (style.cornerRadius !== undefined)
    values.push(
      `  border-radius: ${resolveNumericValue(style.cornerRadius, 'radius', tokens)};`,
    );
  else if (style.cornerRadii)
    values.push(
      `  border-radius: ${style.cornerRadii
        .map((value) => resolveNumericValue(value, 'radius', tokens))
        .join(' ')};`,
    );
  if (style.gap !== undefined)
    values.push(`  gap: ${resolveNumericValue(style.gap, 'space', tokens)};`);
  if (style.rowGap !== undefined)
    values.push(
      `  row-gap: ${resolveNumericValue(style.rowGap, 'space', tokens)};`,
    );
  if (style.layout) {
    values.push('  display: flex;');
    values.push(
      `  flex-direction: ${style.layout === 'vertical' ? 'column' : 'row'};`,
    );
  }
  if (style.alignItems) values.push(`  align-items: ${style.alignItems};`);
  if (style.justifyContent)
    values.push(`  justify-content: ${style.justifyContent};`);
  if (style.flexWrap) values.push(`  flex-wrap: ${style.flexWrap};`);
  if (style.flexGrow !== undefined) {
    values.push(`  flex-grow: ${formatNumber(style.flexGrow)};`);
    if (style.flexGrow > 0) values.push('  flex-basis: 0;');
  }
  if (style.widthMode === 'fill') values.push('  width: 100%;');
  else if (style.widthMode === 'fixed' && style.width !== undefined)
    values.push(`  width: ${resolveSize(style.width, 'width', tokens)};`);
  else if (style.widthMode === 'hug') values.push('  width: fit-content;');
  if (style.heightMode === 'fill') values.push('  height: 100%;');
  else if (style.heightMode === 'fixed' && style.height !== undefined)
    values.push(`  height: ${resolveSize(style.height, 'height', tokens)};`);
  else if (style.heightMode === 'hug') values.push('  height: fit-content;');
  if (style.minWidth !== undefined)
    values.push(
      `  min-width: ${resolveSize(style.minWidth, 'width', tokens)};`,
    );
  if (style.maxWidth !== undefined)
    values.push(
      `  max-width: ${resolveSize(style.maxWidth, 'width', tokens)};`,
    );
  if (style.minHeight !== undefined)
    values.push(
      `  min-height: ${resolveSize(style.minHeight, 'height', tokens)};`,
    );
  if (style.maxHeight !== undefined)
    values.push(
      `  max-height: ${resolveSize(style.maxHeight, 'height', tokens)};`,
    );
  if (style.overflow) values.push(`  overflow: ${style.overflow};`);
  if (style.aspectRatio !== undefined)
    values.push(`  aspect-ratio: ${formatNumber(style.aspectRatio)};`);
  const typography = tokens.find((token) => {
    if (token.kind !== 'typography' || typeof token.value !== 'object')
      return false;
    const value = token.value as TypographyValue;
    return (
      value.fontFamily === style.fontFamily &&
      value.fontSize === style.fontSize &&
      value.fontWeight === style.fontWeight &&
      close(value.lineHeight, style.lineHeight)
    );
  });
  if (style.fontFamily)
    values.push(
      `  font-family: ${typography ? `var(${typography.cssName}-family)` : fontFamilyValue(style.fontFamily, fontSources)};`,
    );
  if (style.fontSize !== undefined)
    values.push(
      `  font-size: ${typography ? `var(${typography.cssName}-size)` : `${formatNumber(style.fontSize)}px`};`,
    );
  if (style.fontWeight !== undefined)
    values.push(
      `  font-weight: ${typography ? `var(${typography.cssName}-weight)` : style.fontWeight};`,
    );
  if (style.lineHeight !== undefined)
    values.push(
      `  line-height: ${typography ? `var(${typography.cssName}-line-height)` : `${formatNumber(style.lineHeight)}px`};`,
    );
  if (style.letterSpacing !== undefined)
    values.push(`  letter-spacing: ${formatNumber(style.letterSpacing)}px;`);
  if (style.textAlign) values.push(`  text-align: ${style.textAlign};`);
  if (style.textDecoration)
    values.push(`  text-decoration: ${style.textDecoration};`);
  return [selector + ' {', ...values, '}'].join('\n');
}

function strokeShadows(style: NormalizedStyle, color: string): string[] {
  const individual = [
    style.borderTopWidth,
    style.borderRightWidth,
    style.borderBottomWidth,
    style.borderLeftWidth,
  ];
  if (individual.some((value) => value !== undefined)) {
    const [top = 0, right = 0, bottom = 0, left = 0] = individual;
    return [
      top > 0 ? `inset 0 ${formatNumber(top)}px 0 ${color}` : undefined,
      right > 0 ? `inset -${formatNumber(right)}px 0 0 ${color}` : undefined,
      bottom > 0 ? `inset 0 -${formatNumber(bottom)}px 0 ${color}` : undefined,
      left > 0 ? `inset ${formatNumber(left)}px 0 0 ${color}` : undefined,
    ].filter((value): value is string => Boolean(value));
  }
  if (style.borderWidth === undefined) return [];
  const inset = style.borderAlign === 'outside' ? '' : 'inset ';
  return [`${inset}0 0 0 ${formatNumber(style.borderWidth)}px ${color}`];
}

function resolveShadowValue(value: string, tokens: KolibriToken[]): string {
  const token = tokens.find(
    (item) => item.kind === 'shadow' && item.value === value,
  );
  return token ? `var(${token.cssName})` : value;
}

function close(left?: number, right?: number): boolean {
  return left === undefined || right === undefined
    ? left === right
    : Math.abs(left - right) < 0.0001;
}
