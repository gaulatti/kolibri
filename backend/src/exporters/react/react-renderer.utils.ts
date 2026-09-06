import type {
  ImportedComponent,
  ImportedComponentInstance,
  ImportedVisualNode,
} from '../../figma-importer/figma-importer.types';

export type GenericAxis = {
  source: string;
  prop: string;
  defaultValue: string;
  values: string[];
};

export function variantAxesForComponent(c: ImportedComponent): GenericAxis[] {
  const axes = new Map<string, string[]>();
  for (const variant of c.variants)
    for (const [axis, value] of Object.entries(variant.axes)) {
      const values = axes.get(axis) ?? [];
      if (!values.includes(value)) values.push(value);
      axes.set(axis, values);
    }
  return [...axes.entries()].map(([source, values]) => ({
    source,
    prop: variantPropName(source),
    defaultValue: c.variants[0]?.axes[source] ?? values[0],
    values,
  }));
}

export function variantPropName(axis: string): string {
  const source = axis.split('.').at(-1) ?? axis;
  const parts = source.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const result = parts
    .map((part, index) =>
      index === 0
        ? part[0].toLowerCase() + part.slice(1)
        : part[0].toUpperCase() + part.slice(1),
    )
    .join('');
  return result || 'variant';
}

export function storyVariantPropName(
  component: ImportedComponent,
  axis: string,
): string {
  if (component.name === 'icon' && axis === 'icon') return 'name';
  return variantPropName(axis);
}

export function genericVariantClass(
  c: ImportedComponent,
  axes: GenericAxis[],
): string {
  if (c.variants.length < 2 || !axes.length) return "const variantClass = '';";
  const entries = c.variants.slice(1).map((variant) => {
    const condition = axes
      .map(
        ({ source, prop }) =>
          `${prop} === '${esc(variant.axes[source] ?? '')}'`,
      )
      .join(' && ');
    const suffix = Object.entries(variant.axes)
      .map(([axis, value]) => `${slug(axis)}-${slug(value)}`)
      .join('--');
    return `    ${condition} ? ' kolibri-${slug(c.name)}--${suffix}' :`;
  });
  return `const variantClass =\n${entries.join('\n')}\n    '';`;
}

export function renderVisualNodes(
  nodes: ImportedVisualNode[],
  componentName: string,
  indent: string,
): string {
  return nodes
    .filter((node) => node.visible)
    .map((node) => renderVisualNode(node, componentName, indent))
    .join('\n');
}

export function renderVisualNode(
  node: ImportedVisualNode,
  componentName: string,
  indent: string,
): string {
  const className = `kolibri-${componentName}__node-${node.key}`;
  if (node.type === 'TEXT')
    return `${indent}<span className="${className}">${jsx(node.text ?? '')}</span>`;
  if (node.type === 'VECTOR' && node.vectors.length) {
    const vector = node.vectors[0];
    const paths = vector.paths
      .map(
        (path) =>
          `<path d="${attr(path.d)}"${path.fill ? ` fill="${attr(path.fill)}"` : ''}${path.stroke ? ` stroke="${attr(path.stroke)}"` : ''}${path.strokeWidth ? ` strokeWidth={${path.strokeWidth}}` : ''} />`,
      )
      .join('');
    return `${indent}<svg className="${className}" viewBox="0 0 ${vector.width} ${vector.height}" aria-hidden="true">${paths}</svg>`;
  }
  const children = renderVisualNodes(
    node.children,
    componentName,
    `${indent}  `,
  );
  return children
    ? `${indent}<div className="${className}">\n${children}\n${indent}</div>`
    : `${indent}<div className="${className}" />`;
}

export function str(
  c: ImportedComponent,
  key: string,
  fallback: string,
): string {
  const value = c.semanticMetadata[key];
  return typeof value === 'string' && value ? value : fallback;
}
export function bool(
  c: ImportedComponent,
  key: string,
  fallback: boolean,
): boolean {
  const value = c.semanticMetadata[key];
  return typeof value === 'boolean' ? value : fallback;
}
export function value(
  i: ImportedComponentInstance,
  key: string,
  fallback: string,
): string {
  const v = i.semanticMetadata[key];
  return typeof v === 'string' && v ? v : fallback;
}
export function findInstance(
  c: ImportedComponent,
  name: string,
): ImportedComponentInstance | undefined {
  return c.composition.find((i) =>
    `${i.componentName ?? ''} ${i.name}`.toLowerCase().includes(name),
  );
}
export function instanceText(
  c: ImportedComponent,
  name: string,
  fallback: string,
): string {
  const i = findInstance(c, name);
  return i ? value(i, 'content.text', i.textOverride ?? fallback) : fallback;
}
export function instanceValue(
  c: ImportedComponent,
  name: string,
  key: string,
  fallback: string,
): string {
  const i = findInstance(c, name);
  return i ? value(i, key, fallback) : fallback;
}
export function instanceClass(
  c: ImportedComponent,
  name: string,
  occurrence = 1,
): string {
  const source = c.variants[0]?.composition ?? c.composition;
  const matches = source.filter((instance) =>
    `${instance.componentName ?? ''} ${instance.name}`
      .toLowerCase()
      .includes(name.toLowerCase()),
  );
  const instance = matches[occurrence - 1];
  return `kolibri-${slug(c.name)}__${instance?.cssClass ?? (occurrence === 1 ? slug(name) : `${slug(name)}-${occurrence}`)}`;
}
export function findVisual(
  nodes: ImportedVisualNode[],
  name: string,
): ImportedVisualNode | undefined {
  for (const node of nodes) {
    if (node.name.toLowerCase() === name.toLowerCase()) return node;
    const nested = findVisual(node.children, name);
    if (nested) return nested;
  }
  return undefined;
}
export function visualClass(c: ImportedComponent, name: string): string {
  const node = findVisual(c.visual, name);
  return `kolibri-${slug(c.name)}__node-${node?.key ?? slug(name)}`;
}
export function visualGroupClass(
  c: ImportedComponent,
  descendantNames: string[],
  fallback: string,
): string {
  const group = findSmallestVisualGroup(c.visual, descendantNames);
  return `kolibri-${slug(c.name)}__node-${group?.key ?? slug(fallback)}`;
}
export function findSmallestVisualGroup(
  nodes: ImportedVisualNode[],
  descendantNames: string[],
): ImportedVisualNode | undefined {
  for (const node of nodes) {
    const nested = findSmallestVisualGroup(node.children, descendantNames);
    if (nested) return nested;
    if (
      descendantNames.every((name) =>
        visualTreeContainsName(node.children, name),
      )
    )
      return node;
  }
  return undefined;
}
export function visualTreeContainsName(
  nodes: ImportedVisualNode[],
  name: string,
): boolean {
  return nodes.some(
    (node) =>
      node.name.toLowerCase().includes(name.toLowerCase()) ||
      visualTreeContainsName(node.children, name),
  );
}
export function visualText(
  c: ImportedComponent,
  parentName: string,
  fallback: string,
): string {
  const parent = findVisual(c.visual, parentName);
  if (!parent) return fallback;
  const textNode = findVisual(parent.children, fallback);
  return textNode?.text ?? fallback;
}
export function firstVisualText(
  node: ImportedVisualNode | undefined,
): string | undefined {
  if (!node) return undefined;
  if (node.text) return node.text;
  for (const child of node.children) {
    const text = firstVisualText(child);
    if (text) return text;
  }
  return undefined;
}
export function variantDefault(
  c: ImportedComponent,
  axis: string,
  fallback: string,
): string {
  const value = c.semanticMetadata[axis];
  return typeof value === 'string'
    ? value
    : (c.variants[0]?.axes[axis] ?? fallback);
}
export function componentImageReference(
  c: ImportedComponent,
): string | undefined {
  return (
    c.variants.find((variant) => variant.style.backgroundImageRef)?.style
      .backgroundImageRef ?? c.style.backgroundImageRef
  );
}
export function variantUnion(c: ImportedComponent, axis: string): string {
  const values = [
    ...new Set(c.variants.map((v) => v.axes[axis]).filter(Boolean)),
  ];
  return values.length
    ? values.map((v) => `'${esc(v)}'`).join(' | ')
    : "'default'";
}
export function uniqueVisualTexts(nodes: ImportedVisualNode[]): string[] {
  const texts: string[] = [];
  const visit = (items: ImportedVisualNode[]) => {
    for (const node of items) {
      if (node.type === 'TEXT' && node.text && !texts.includes(node.text))
        texts.push(node.text);
      visit(node.children);
    }
  };
  visit(nodes);
  return texts;
}
export function lucideIconComponent(name: string): string {
  const icons: Record<string, string> = {
    'arrow-right': 'ArrowRight',
    check: 'Check',
    warning: 'TriangleAlert',
    close: 'X',
    menu: 'Menu',
  };
  return icons[name] ?? 'Circle';
}
export function isVoidElement(element: string): boolean {
  return [
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
  ].includes(element.toLowerCase());
}
export function pascal(v: string): string {
  return v
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((x) => x[0].toUpperCase() + x.slice(1))
    .join('');
}
export function slug(v: string): string {
  return v
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
export function storyVariantCaption(
  axes: Record<string, string>,
  fallback: string,
): string {
  const values = Object.values(axes);
  return (values.length ? values : [fallback])
    .map((value) =>
      value
        .split(/[-_]+/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(' '),
    )
    .join(' / ');
}
export function esc(v: string): string {
  return v
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\n', '\\n');
}
export function attr(v: string): string {
  return jsx(v).replaceAll('"', '&quot;');
}
export function jsx(v: string): string {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('{', '&#123;')
    .replaceAll('}', '&#125;');
}
