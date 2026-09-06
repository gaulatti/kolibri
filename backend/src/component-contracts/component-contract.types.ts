import type {
  ComponentBehaviorKind,
  ImportedBehaviorContract,
} from '../figma-importer/figma-importer.types';

export type ComponentContractDefinition = ImportedBehaviorContract & {
  componentNames: string[];
  partElements?: Record<string, string>;
  alignedParts?: string[][];
};

export type ResolvedComponentContract = ComponentContractDefinition & {
  kind: ComponentBehaviorKind;
};
