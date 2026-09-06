import type { FigmaFile, FigmaNode } from '../clients/figma/figma.types';
import type {
  Diagnostic,
  ImportedComponent,
  ImportedComponentKind,
} from './figma-importer.types';
import { componentNames, directInstances } from './component-instances';
import {
  normalizeDefinitions,
  validateMetadata,
  variantAxes,
} from './component-metadata';
import { extractVectors, visualChildren } from './component-visuals';
import { firstText, normalizeStyle } from './normalize-component-style';
import { findPage } from './figma-tree.utils';
import { applyComponentContract } from '../component-contracts/component-contract.validator';

const PAGE_KINDS: Record<string, ImportedComponentKind> = {
  '02-atoms': 'atom',
  '03-molecules': 'molecule',
  '04-organisms': 'organism',
};

export function extractComponents(
  figmaJson: FigmaFile,
  diagnostics: Diagnostic[] = [],
  validateComponentContracts = false,
): ImportedComponent[] {
  const names = componentNames(figmaJson.document);
  const components: ImportedComponent[] = [];
  for (const [pageName, kind] of Object.entries(PAGE_KINDS)) {
    const page = findPage(figmaJson.document, pageName);
    if (!page) continue;
    visitTopLevel(page, undefined, (node, parent) => {
      if (!['COMPONENT', 'COMPONENT_SET'].includes(node.type)) return;
      if (node.type === 'COMPONENT' && parent?.type === 'COMPONENT_SET') return;
      const metadata = normalizeDefinitions(node.componentPropertyDefinitions);
      validateMetadata(node, metadata, diagnostics);
      const variants =
        node.type === 'COMPONENT_SET'
          ? (node.children ?? [])
              .filter((child) => child.type === 'COMPONENT')
              .map((child) => ({
                id: child.id,
                name: child.name,
                axes: variantAxes(child.name),
                style: normalizeStyle(child, metadata),
                text: firstText(child),
                vectors: extractVectors(child),
                composition: directInstances(child, names),
                visual: visualChildren(child),
              }))
          : [];
      components.push(
        applyComponentContract(
          {
            id: node.id,
            name: node.name,
            kind,
            type: node.type === 'COMPONENT_SET' ? 'componentSet' : 'component',
            pageName,
            sourceWidth: node.absoluteBoundingBox?.width,
            sourceHeight: node.absoluteBoundingBox?.height,
            semanticMetadata: metadata,
            style: normalizeStyle(node, metadata),
            defaultText: firstText(node),
            variants,
            composition: directInstances(node, names),
            vectors: extractVectors(node),
            visual: visualChildren(
              node.type === 'COMPONENT_SET'
                ? ((node.children ?? []).find(
                    (child) => child.type === 'COMPONENT',
                  ) ?? node)
                : node,
            ),
          },
          diagnostics,
          validateComponentContracts,
        ),
      );
    });
  }
  return components;
}

function visitTopLevel(
  node: FigmaNode,
  parent: FigmaNode | undefined,
  visitor: (node: FigmaNode, parent?: FigmaNode) => void,
): void {
  visitor(node, parent);
  for (const child of node.children ?? []) visitTopLevel(child, node, visitor);
}
