import type { DesignSystem } from '../persistence/entities';

export type DesignSystemView = {
  id: string;
  name: string;
  description: string | null;
  generationContract: 'legacy' | 'composable-v1';
  lastPublishedVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toDesignSystemView(
  designSystem: DesignSystem,
): DesignSystemView {
  return {
    id: designSystem.id,
    name: designSystem.name,
    description: designSystem.description,
    generationContract: designSystem.generationContract,
    lastPublishedVersion: designSystem.lastPublishedVersion,
    createdAt: designSystem.createdAt,
    updatedAt: designSystem.updatedAt,
  };
}
