import { Injectable } from '@nestjs/common';
import type { FigmaFile } from '../clients/figma/figma.types';
import { extractComponents } from './extract-components';
import { extractFontSources } from './extract-font-sources';
import { extractFoundationTokens } from './extract-foundation-tokens';
import { extractImageReferences } from './extract-image-references';
import type { KolibriDesignSystem } from './figma-importer.types';
import { recordMissingFontSources } from './font-source-diagnostics';

@Injectable()
export class FigmaImporterService {
  importDesignSystem(
    figmaFile: FigmaFile,
    generationContract: 'legacy' | 'composable-v1' = 'legacy',
  ): KolibriDesignSystem {
    const diagnostics = [];
    const fontSources = extractFontSources(figmaFile);
    const tokens = extractFoundationTokens(figmaFile);
    const components = extractComponents(
      figmaFile,
      diagnostics,
      generationContract === 'composable-v1',
    );
    recordMissingFontSources(tokens, components, fontSources, diagnostics);
    return {
      tokens,
      fontSources,
      imageReferences: extractImageReferences(figmaFile),
      components,
      diagnostics,
    };
  }
}
