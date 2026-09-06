import { Injectable } from '@nestjs/common';
import type { KolibriDesignSystem } from '../figma-importer/figma-importer.types';
import { generateComponentRules } from './component-css-rules';
import { generateFontImports, generateRootCss } from './css-values';

export {
  generateRootCss,
  resolveColorValue,
  resolveSpaceValue,
} from './css-values';

@Injectable()
export class CssExporterService {
  generateCss(designSystem: KolibriDesignSystem): string {
    const sections = [
      generateFontImports(designSystem.fontSources),
      generateRootCss(designSystem.tokens, designSystem.fontSources),
      ...designSystem.components.flatMap((component) =>
        generateComponentRules(
          component,
          designSystem.tokens,
          designSystem.fontSources,
        ),
      ),
    ];
    return `${sections.filter(Boolean).join('\n\n')}\n`;
  }
}
