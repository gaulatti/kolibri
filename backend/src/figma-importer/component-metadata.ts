import type { FigmaNode } from '../clients/figma/figma.types';
import type { Diagnostic } from './figma-importer.types';
import { numericMetadata, sizingMode } from './normalize-component-style';

const METADATA_PREFIXES = [
  'semantic.',
  'prop.',
  'content.',
  'accessibility.',
  'behavior.',
  'visibility.',
  'responsive.',
  'layout.',
  'image.',
  'link.',
  'navigation.',
  'icon.',
  'part.',
  'part',
  'icon',
  'label',
  'variant',
  'state',
  'tone',
  'content',
];

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

export const EMPTY_INTRINSIC_COMPONENT_ELEMENTS: Readonly<
  Record<string, string>
> = {
  image: 'img',
  divider: 'hr',
  'text-input': 'input',
  checkbox: 'input',
  slider: 'input',
  textarea: 'textarea',
  select: 'select',
};

function propertyName(value: string): string {
  return value.replace(/#\d+:\d+$/, '');
}
export function normalizeDefinitions(
  definitions: FigmaNode['componentPropertyDefinitions'],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(definitions ?? {}).map(([name, value]) => [
      propertyName(name),
      value.defaultValue,
    ]),
  );
}
export function normalizeProperties(
  properties: FigmaNode['componentProperties'],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(properties ?? {}).map(([name, value]) => [
      propertyName(name),
      value.value,
    ]),
  );
}
export function variantAxes(name: string): Record<string, string> {
  const axes: Record<string, string> = {};
  for (const part of name.split(',')) {
    const [axis, value] = part.trim().split('=', 2);
    if (axis && value) axes[axis] = value;
  }
  return axes;
}

export function validateMetadata(
  node: FigmaNode,
  metadata: Record<string, unknown>,
  diagnostics: Diagnostic[],
): void {
  for (const name of Object.keys(metadata)) {
    if (
      !METADATA_PREFIXES.some(
        (prefix) => name === prefix || name.startsWith(prefix),
      )
    )
      diagnostics.push({
        severity: 'warning',
        code: 'UNKNOWN_METADATA',
        message: `Unknown metadata property: ${name}`,
        component: node.name,
        nodeId: node.id,
      });
  }
  if (
    metadata['semantic.element'] === 'img' &&
    metadata['accessibility.decorative'] !== true &&
    !metadata['prop.alt']
  )
    diagnostics.push({
      severity: 'error',
      code: 'IMAGE_ALT_REQUIRED',
      message: 'Non-decorative image requires prop.alt',
      component: node.name,
      nodeId: node.id,
    });
  const requestedElement = metadata['semantic.element'];
  if (
    typeof requestedElement === 'string' &&
    VOID_ELEMENTS.has(requestedElement.toLowerCase()) &&
    EMPTY_INTRINSIC_COMPONENT_ELEMENTS[componentIdentity(node, metadata)] !==
      requestedElement.toLowerCase()
  )
    diagnostics.push({
      severity: 'warning',
      code: 'SEMANTIC_ELEMENT_FALLBACK',
      message: `${requestedElement.toLowerCase()} cannot contain the component's visual tree; the generated view will use a safe container instead`,
      component: node.name,
      nodeId: node.id,
    });
  const widthMode = sizingMode(metadata['layout.widthMode']);
  const heightMode = sizingMode(metadata['layout.heightMode']);
  if (!widthMode || !heightMode)
    diagnostics.push({
      severity: 'warning',
      code: 'MISSING_SIZING_INTENT',
      message: 'Component requires layout.widthMode and layout.heightMode',
      component: node.name,
      nodeId: node.id,
    });
  if (
    widthMode === 'fixed' &&
    numericMetadata(metadata, 'layout.width') === undefined
  )
    diagnostics.push({
      severity: 'error',
      code: 'FIXED_WIDTH_REQUIRED',
      message: 'Fixed width mode requires layout.width',
      component: node.name,
      nodeId: node.id,
    });
  if (
    heightMode === 'fixed' &&
    numericMetadata(metadata, 'layout.height') === undefined
  )
    diagnostics.push({
      severity: 'error',
      code: 'FIXED_HEIGHT_REQUIRED',
      message: 'Fixed height mode requires layout.height',
      component: node.name,
      nodeId: node.id,
    });
}

function componentIdentity(
  node: FigmaNode,
  metadata: Record<string, unknown>,
): string {
  const requested = metadata['semantic.component'];
  return (
    typeof requested === 'string' && requested.trim() ? requested : node.name
  )
    .trim()
    .toLowerCase();
}
