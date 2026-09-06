import type {
  ImportedComponent,
  ImportedComponentInstance,
  ImportedFontSource,
  ImportedVisualNode,
  KolibriDesignSystem,
  KolibriToken,
  NormalizedStyle,
  TypographyValue,
} from './figma-importer.types';

export function recordMissingFontSources(
  tokens: KolibriToken[],
  components: ImportedComponent[],
  sources: ImportedFontSource[],
  diagnostics: KolibriDesignSystem['diagnostics'],
): void {
  const families = new Set<string>();
  for (const token of tokens)
    if (token.kind === 'typography') {
      const family = (token.value as TypographyValue).fontFamily;
      if (family) families.add(family);
    }
  for (const component of components) {
    collectStyleFont(component.style, families);
    for (const variant of component.variants) {
      collectStyleFont(variant.style, families);
      collectVisualFonts(variant.visual, families);
      collectInstanceFonts(variant.composition, families);
    }
    collectVisualFonts(component.visual, families);
    collectInstanceFonts(component.composition, families);
  }
  for (const family of families)
    if (
      !sources.some(
        (source) => source.family.toLowerCase() === family.toLowerCase(),
      )
    )
      diagnostics.push({
        severity: 'warning',
        code: 'FONT_SOURCE_UNRESOLVED',
        message: `No font source is configured for ${family}`,
      });
}

function collectVisualFonts(
  nodes: ImportedVisualNode[],
  families: Set<string>,
): void {
  for (const node of nodes) {
    collectStyleFont(node.style, families);
    collectVisualFonts(node.children, families);
  }
}

function collectInstanceFonts(
  instances: ImportedComponentInstance[],
  families: Set<string>,
): void {
  for (const instance of instances) {
    collectStyleFont(instance.style, families);
    collectInstanceFonts(instance.children, families);
  }
}

function collectStyleFont(style: NormalizedStyle, families: Set<string>): void {
  if (style.fontFamily) families.add(style.fontFamily);
}
