import type {
  ImportedFontSource,
  KolibriToken,
  SizeValue,
  TypographyValue,
} from '../figma-importer/figma-importer.types';

export function resolveColorValue(hex: string, tokens: KolibriToken[]): string {
  const token = tokens.find(
    (item) =>
      item.kind === 'color' &&
      typeof item.value === 'string' &&
      item.value.toLowerCase() === hex.toLowerCase(),
  );
  return token ? `var(${token.cssName})` : hex;
}

export function resolveSpaceValue(px: number, tokens: KolibriToken[]): string {
  return resolveNumericValue(px, 'space', tokens);
}

export function resolveNumericValue(
  px: number,
  kind: KolibriToken['kind'],
  tokens: KolibriToken[],
): string {
  const token = tokens.find((item) => item.kind === kind && item.value === px);
  return token ? `var(${token.cssName})` : `${formatNumber(px)}px`;
}

export function generateRootCss(
  tokens: KolibriToken[],
  fontSources: ImportedFontSource[] = [],
): string {
  const declarations: string[] = [];
  for (const token of tokens) {
    if (typeof token.value === 'string')
      declarations.push(`  ${token.cssName}: ${token.value};`);
    else if (typeof token.value === 'number')
      declarations.push(`  ${token.cssName}: ${formatNumber(token.value)}px;`);
    else if (token.kind === 'typography') {
      const value = token.value as TypographyValue;
      if (value.fontFamily)
        declarations.push(
          `  ${token.cssName}-family: ${fontFamilyValue(value.fontFamily, fontSources)};`,
        );
      if (value.fontSize !== undefined)
        declarations.push(
          `  ${token.cssName}-size: ${formatNumber(value.fontSize)}px;`,
        );
      if (value.fontWeight !== undefined)
        declarations.push(`  ${token.cssName}-weight: ${value.fontWeight};`);
      if (value.lineHeight !== undefined)
        declarations.push(
          `  ${token.cssName}-line-height: ${formatNumber(value.lineHeight)}px;`,
        );
    } else {
      const value = token.value as SizeValue;
      if (value.width !== undefined)
        declarations.push(
          `  ${token.cssName}-width: ${formatNumber(value.width)}px;`,
        );
      if (value.height !== undefined)
        declarations.push(
          `  ${token.cssName}-height: ${formatNumber(value.height)}px;`,
        );
    }
  }
  return [':root {', ...declarations, '}'].join('\n');
}

export function generateFontImports(fontSources: ImportedFontSource[]): string {
  return [...new Set(fontSources.map((source) => source.cssUrl))]
    .map((url) => `@import url("${url.replaceAll('"', '%22')}");`)
    .join('\n');
}

export function fontFamilyValue(
  family: string,
  fontSources: ImportedFontSource[],
): string {
  const source = fontSources.find(
    (candidate) => candidate.family.toLowerCase() === family.toLowerCase(),
  );
  const quotedFamily = family.includes(' ') ? `"${family}"` : family;
  return source
    ? `${quotedFamily}, ${source.fallback}`
    : `${quotedFamily}, sans-serif`;
}

export function numberMetadata(
  metadata: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = metadata[key];
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;
  return Number.isFinite(number) ? number : undefined;
}

export function resolveSize(
  value: number,
  dimension: 'width' | 'height',
  tokens: KolibriToken[],
): string {
  const token = tokens.find(
    (item) =>
      item.kind === 'size' &&
      typeof item.value === 'object' &&
      (item.value as SizeValue)[dimension] === value,
  );
  return token
    ? `var(${token.cssName}-${dimension})`
    : `${formatNumber(value)}px`;
}

export function kebab(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function formatNumber(value: number): string {
  return String(Math.round(value * 1_000_000) / 1_000_000);
}
