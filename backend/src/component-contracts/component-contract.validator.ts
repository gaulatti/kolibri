import type {
  Diagnostic,
  ImportedComponent,
  ImportedComponentPart,
  ImportedVisualNode,
} from '../figma-importer/figma-importer.types';
import { resolveComponentContract } from './component-contract.registry';

export function applyComponentContract(
  component: ImportedComponent,
  diagnostics: Diagnostic[],
  validate = true,
): ImportedComponent {
  const definition = resolveComponentContract(component);
  const parts = collectParts(component.visual, definition.requiredParts);
  const allowed = new Set([
    ...definition.requiredParts,
    ...definition.optionalParts,
  ]);
  let adapterEligible = true;

  if (validate && component.variants.length > 1) {
    const canonical = new Set(parts.map((part) => part.name));
    for (const variant of component.variants.slice(1)) {
      const variantParts = new Set(
        collectParts(variant.visual, definition.requiredParts).map(
          (part) => part.name,
        ),
      );
      if (!sameSet(canonical, variantParts)) {
        adapterEligible = false;
        diagnostics.push({
          severity: 'warning',
          code: 'VARIANT_PART_MISMATCH',
          message: `Variant ${variant.name} must expose the same semantic parts as the canonical variant`,
          component: component.name,
          nodeId: variant.id,
        });
      }
    }
  }

  for (const part of validate ? parts : []) {
    if (allowed.size && !allowed.has(part.name)) {
      diagnostics.push({
        severity: 'warning',
        code: 'UNKNOWN_COMPONENT_PART',
        message: `Part ${part.name} is not defined by the ${definition.kind} contract`,
        component: component.name,
        nodeId: part.sourceNodeId,
      });
    }
  }

  for (const required of validate ? definition.requiredParts : []) {
    if (!parts.some((part) => part.name === required)) {
      adapterEligible = false;
      diagnostics.push({
        severity: 'warning',
        code: 'REQUIRED_COMPONENT_PART_MISSING',
        message: `${definition.kind} requires a ${required} part for behavior binding`,
        component: component.name,
        nodeId: component.id,
      });
    }
  }

  for (const aligned of validate ? (definition.alignedParts ?? []) : []) {
    const counts = aligned.map(
      (name) => parts.filter((part) => part.name === name).length,
    );
    if (new Set(counts).size > 1) {
      adapterEligible = false;
      diagnostics.push({
        severity: 'warning',
        code: 'COMPONENT_PART_CARDINALITY_MISMATCH',
        message: `${definition.kind} requires matching ${aligned.join(', ')} part counts; received ${aligned.map((name, index) => `${name}=${counts[index]}`).join(', ')}`,
        component: component.name,
        nodeId: component.id,
      });
    }
  }

  return {
    ...component,
    parts,
    behavior: {
      kind: definition.kind,
      adapterRequired: definition.adapterRequired,
      adapterEligible,
      requiredParts: [...definition.requiredParts],
      optionalParts: [...definition.optionalParts],
      states: [...definition.states],
    },
    contractVersion: 'composable-v1',
  };
}

function sameSet(left: Set<string>, right: Set<string>): boolean {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

function collectParts(
  roots: ImportedVisualNode[],
  requiredParts: string[],
): ImportedComponentPart[] {
  const occurrences = new Map<string, ImportedComponentPart[]>();
  const visit = (node: ImportedVisualNode) => {
    if (node.part) {
      const current = occurrences.get(node.part) ?? [];
      current.push({
        name: node.part,
        sourceNodeId: node.id,
        required: requiredParts.includes(node.part),
        repeatable: false,
        element:
          typeof node.semanticMetadata['semantic.element'] === 'string'
            ? node.semanticMetadata['semantic.element']
            : undefined,
      });
      occurrences.set(node.part, current);
    }
    node.children.forEach(visit);
  };
  roots.forEach(visit);
  return [...occurrences.values()].flatMap((items) =>
    items.map((item) => ({ ...item, repeatable: items.length > 1 })),
  );
}
