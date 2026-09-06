import type { ImportedComponent } from '../figma-importer/figma-importer.types';
import type { ComponentContractDefinition } from './component-contract.types';

const NONE: ComponentContractDefinition = {
  componentNames: [],
  kind: 'none',
  adapterRequired: false,
  requiredParts: [],
  optionalParts: [],
  states: [],
};

export const COMPONENT_CONTRACTS: ComponentContractDefinition[] = [
  {
    componentNames: ['switch', 'radio-group'],
    kind: 'native-control',
    adapterRequired: false,
    requiredParts: ['control'],
    optionalParts: ['label', 'indicator', 'description', 'error'],
    states: ['default', 'disabled', 'invalid', 'checked', 'unchecked'],
  },
  {
    componentNames: [
      'button',
      'link',
      'text-input',
      'textarea',
      'checkbox',
      'slider',
      'select',
      'toggle',
    ],
    kind: 'native-control',
    adapterRequired: false,
    requiredParts: [],
    optionalParts: ['label', 'control', 'indicator', 'description', 'error'],
    states: [
      'default',
      'disabled',
      'invalid',
      'checked',
      'unchecked',
      'indeterminate',
    ],
  },
  {
    componentNames: ['accordion'],
    kind: 'accordion',
    adapterRequired: true,
    requiredParts: ['item', 'trigger', 'panel'],
    optionalParts: ['indicator', 'title', 'description', 'separator'],
    alignedParts: [['item', 'trigger', 'panel']],
    states: ['open', 'closed', 'disabled'],
  },
  {
    componentNames: ['tabs'],
    kind: 'tabs',
    adapterRequired: true,
    requiredParts: ['list', 'tab', 'panel'],
    optionalParts: ['indicator'],
    alignedParts: [['tab', 'panel']],
    states: ['active', 'inactive', 'disabled'],
  },
  {
    componentNames: ['modal', 'dialog'],
    kind: 'dialog',
    adapterRequired: true,
    requiredParts: ['content', 'title'],
    optionalParts: ['backdrop', 'description', 'body', 'close', 'actions'],
    states: ['open', 'closed'],
    partElements: { title: 'h2', description: 'p', close: 'button' },
  },
  {
    componentNames: ['tooltip'],
    kind: 'tooltip',
    adapterRequired: true,
    requiredParts: ['trigger', 'content'],
    optionalParts: ['arrow'],
    states: ['open', 'closed'],
  },
  {
    componentNames: ['popover'],
    kind: 'popover',
    adapterRequired: true,
    requiredParts: ['trigger', 'content'],
    optionalParts: ['title', 'description', 'arrow', 'close'],
    states: ['open', 'closed'],
  },
  {
    componentNames: ['dropdown-menu', 'menu'],
    kind: 'menu',
    adapterRequired: true,
    requiredParts: ['trigger', 'content', 'item'],
    optionalParts: ['separator', 'label', 'indicator'],
    states: ['open', 'closed', 'active', 'disabled'],
  },
  {
    componentNames: ['form-field', 'signup-form'],
    kind: 'form',
    adapterRequired: false,
    requiredParts: [],
    optionalParts: [
      'title',
      'label',
      'control',
      'description',
      'error',
      'actions',
    ],
    states: ['default', 'invalid', 'disabled', 'submitting', 'succeeded'],
  },
  {
    componentNames: ['navigation-item', 'pagination', 'site-header', 'sidebar'],
    kind: 'navigation',
    adapterRequired: false,
    requiredParts: [],
    optionalParts: ['brand', 'list', 'item', 'trigger', 'actions'],
    states: ['default', 'active', 'disabled'],
  },
];

export function resolveComponentContract(
  component: Pick<ImportedComponent, 'name' | 'semanticMetadata'>,
): ComponentContractDefinition {
  const requested = component.semanticMetadata['semantic.component'];
  const identity =
    typeof requested === 'string' && requested.trim()
      ? requested.trim().toLowerCase()
      : component.name.trim().toLowerCase();
  return (
    COMPONENT_CONTRACTS.find((candidate) =>
      candidate.componentNames.includes(identity),
    ) ?? NONE
  );
}
