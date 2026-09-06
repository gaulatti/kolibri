import type {
  ImportedComponent,
  ImportedVisualNode,
} from '../../figma-importer/figma-importer.types';
import { EMPTY_INTRINSIC_COMPONENT_ELEMENTS } from '../../figma-importer/component-metadata';
import {
  attr,
  componentImageReference,
  esc,
  genericVariantClass,
  isVoidElement,
  jsx,
  pascal,
  slug,
  variantAxesForComponent,
} from './react-renderer.utils';

export type ComposableComponentArtifacts = {
  view: string;
  contract: string;
  binding: string;
  complete: boolean;
};

export class ComposableReactComponentGenerator {
  generate(component: ImportedComponent): ComposableComponentArtifacts {
    const name = pascal(component.name);
    const behavior = component.behavior ?? {
      kind: 'none' as const,
      adapterRequired: false,
      requiredParts: [],
      optionalParts: [],
      states: [],
    };
    const actualParts = [
      ...new Set((component.parts ?? []).map((part) => part.name)),
    ];
    const partNames = ['root', ...actualParts];
    const complete =
      behavior.requiredParts.every((part) => actualParts.includes(part)) &&
      behavior.adapterEligible !== false;
    return {
      view: this.view(component, name, partNames),
      contract: this.contract(component, name, partNames),
      binding: this.binding(component, name, complete),
      complete,
    };
  }

  private view(
    component: ImportedComponent,
    name: string,
    parts: string[],
  ): string {
    const axes = variantAxesForComponent(component);
    const axisTypes = axes
      .map(
        ({ prop, values }) =>
          `  ${prop}?: ${values.map((item) => `'${esc(item)}'`).join(' | ')};`,
      )
      .join('\n');
    const axesDestructure = axes
      .map(({ prop, defaultValue }) => `${prop} = '${esc(defaultValue)}'`)
      .join(', ');
    const variantClass = genericVariantClass(component, axes);
    const variantState = axes.find((axis) => axis.prop === 'state')?.prop;
    const behaviorStates = component.behavior?.states ?? [];
    const stateType = behaviorStates.length
      ? behaviorStates.map((state) => `'${esc(state)}'`).join(' | ')
      : 'string';
    const requestedRootElement = this.safeElement(
      component.semanticMetadata['semantic.element'],
      'div',
    );
    const usesEmptyIntrinsicRoot = this.usesEmptyIntrinsicRoot(
      component,
      requestedRootElement,
    );
    const rootElement =
      !usesEmptyIntrinsicRoot && isVoidElement(requestedRootElement)
        ? 'div'
        : requestedRootElement;
    if (usesEmptyIntrinsicRoot) {
      return this.emptyIntrinsicView(component, name, parts, rootElement);
    }
    const slotDeclarations = parts
      .map(
        (part) =>
          `  const ${this.partVariable(part)} = slots?.['${esc(part)}'] ?? '${this.defaultElement(component, part, rootElement)}';`,
      )
      .join('\n');
    const rootVariable = this.partVariable('root');
    const rootProps = `resolvePartProps(partProps?.root, { name: 'root', index: 0 })`;
    const visual =
      rootElement === 'table'
        ? this.renderTable(component.visual, component, '      ')
        : this.renderNodes(component.visual, component, '      ');
    const fallback = component.defaultText
      ? `${jsx(component.defaultText)}`
      : '';
    return `import type { ElementType, HTMLAttributes, PropsWithChildren } from 'react';

export type ${name}Part = ${parts.map((part) => `'${esc(part)}'`).join(' | ')};
export type ${name}PartContext = { name: ${name}Part; index: number };
export type ${name}PartProps = HTMLAttributes<HTMLElement> & Record<string, unknown>;
export type ${name}PartPropsValue = ${name}PartProps | ((context: ${name}PartContext) => ${name}PartProps);

export type ${name}ViewProps = PropsWithChildren<HTMLAttributes<HTMLElement>> & {
${axisTypes ? `${axisTypes}\n` : ''}  viewState?: ${stateType};
  slots?: Partial<Record<${name}Part, ElementType>>;
  partProps?: Partial<Record<${name}Part, ${name}PartPropsValue>>;
};

function resolvePartProps(value: ${name}PartPropsValue | undefined, context: ${name}PartContext): ${name}PartProps {
  return (typeof value === 'function' ? value(context) : value) ?? {};
}

export function ${name}View({ children, className, slots, partProps, viewState${axesDestructure ? `, ${axesDestructure}` : ''}, ...props }: ${name}ViewProps) {
${slotDeclarations}
  ${variantClass}
  const rootProps = ${rootProps};
  return (
    <${rootVariable}
      {...rootProps}
      {...props}
      data-component="${attr(slug(component.name))}"
      data-part="root"
      data-state={viewState ?? ${variantState ?? 'undefined'}}
      className={\`kolibri-${slug(component.name)}\${variantClass}\${rootProps.className ? ' ' + String(rootProps.className) : ''}\${className ? ' ' + className : ''}\`}
    >
      {children ?? <>
${visual || `      ${fallback}`}
      </>}
    </${rootVariable}>
  );
}
`;
  }

  private emptyIntrinsicView(
    component: ImportedComponent,
    name: string,
    parts: string[],
    rootElement: string,
  ): string {
    const axes = variantAxesForComponent(component);
    const axisTypes = axes
      .map(
        ({ prop, values }) =>
          `  ${prop}?: ${values.map((item) => `'${esc(item)}'`).join(' | ')};`,
      )
      .join('\n');
    const axesDestructure = axes
      .map(({ prop, defaultValue }) => `${prop} = '${esc(defaultValue)}'`)
      .join(', ');
    const variantClass = genericVariantClass(component, axes);
    const variantState = axes.find((axis) => axis.prop === 'state')?.prop;
    const behaviorStates = component.behavior?.states ?? [];
    const stateType = behaviorStates.length
      ? behaviorStates.map((state) => `'${esc(state)}'`).join(' | ')
      : 'string';
    const defaultAttributes = this.intrinsicDefaults(component, rootElement);
    return `import type { ComponentPropsWithoutRef, ElementType } from 'react';

export type ${name}Part = ${parts.map((part) => `'${esc(part)}'`).join(' | ')};
export type ${name}PartContext = { name: ${name}Part; index: number };
export type ${name}PartProps = ComponentPropsWithoutRef<'${rootElement}'> & Record<string, unknown>;
export type ${name}PartPropsValue = ${name}PartProps | ((context: ${name}PartContext) => ${name}PartProps);

export type ${name}ViewProps = ComponentPropsWithoutRef<'${rootElement}'> & {
${axisTypes ? `${axisTypes}\n` : ''}  viewState?: ${stateType};
  slots?: Partial<Record<${name}Part, ElementType>>;
  partProps?: Partial<Record<${name}Part, ${name}PartPropsValue>>;
};

function resolvePartProps(value: ${name}PartPropsValue | undefined, context: ${name}PartContext): ${name}PartProps {
  return (typeof value === 'function' ? value(context) : value) ?? {};
}

export function ${name}View({ className, slots, partProps, viewState${axesDestructure ? `, ${axesDestructure}` : ''}, ...props }: ${name}ViewProps) {
  const PartRoot = slots?.root ?? '${rootElement}';
  ${variantClass}
  const rootProps = resolvePartProps(partProps?.root, { name: 'root', index: 0 });
  return (
    <PartRoot
${defaultAttributes}      {...rootProps}
      {...props}
      data-component="${attr(slug(component.name))}"
      data-part="root"
      data-state={viewState ?? ${variantState ?? 'undefined'}}
      className={\`kolibri-${slug(component.name)}\${variantClass}\${rootProps.className ? ' ' + String(rootProps.className) : ''}\${className ? ' ' + className : ''}\`}
    />
  );
}
`;
  }

  private usesEmptyIntrinsicRoot(
    component: ImportedComponent,
    rootElement: string,
  ): boolean {
    return (
      EMPTY_INTRINSIC_COMPONENT_ELEMENTS[this.componentIdentity(component)] ===
      rootElement
    );
  }

  private componentIdentity(component: ImportedComponent): string {
    const requested = component.semanticMetadata['semantic.component'];
    return (
      typeof requested === 'string' && requested.trim()
        ? requested
        : component.name
    )
      .trim()
      .toLowerCase();
  }

  private intrinsicDefaults(
    component: ImportedComponent,
    rootElement: string,
  ): string {
    if (rootElement === 'img') {
      const imageReference = componentImageReference(component);
      const source = imageReference
        ? `new URL('../../assets/figma-${attr(imageReference)}.png', import.meta.url).href`
        : "''";
      const alt =
        component.semanticMetadata['accessibility.decorative'] === true
          ? ''
          : typeof component.semanticMetadata['prop.alt'] === 'string'
            ? component.semanticMetadata['prop.alt']
            : '';
      return `      src={${source}}\n      alt="${attr(alt)}"\n`;
    }
    if (rootElement === 'input') {
      const type =
        component.name === 'checkbox'
          ? 'checkbox'
          : component.name === 'slider'
            ? 'range'
            : 'text';
      const placeholder =
        type === 'text' && component.defaultText
          ? `      placeholder="${attr(component.defaultText)}"\n`
          : '';
      return `      type="${type}"\n${placeholder}`;
    }
    if (rootElement === 'textarea' && component.defaultText) {
      return `      placeholder="${attr(component.defaultText)}"\n`;
    }
    return '';
  }

  private renderTable(
    rows: ImportedVisualNode[],
    component: ImportedComponent,
    indent: string,
  ): string {
    if (!rows.length) return '';
    const renderRow = (
      row: ImportedVisualNode,
      rowIndex: number,
      cellElement: 'th' | 'td',
    ) => {
      const cells = row.children
        .filter((cell) => cell.visible)
        .map((cell, cellIndex) => {
          const content = this.renderNodes(
            cell.children,
            component,
            `${indent}      `,
          );
          const cellClass = `kolibri-${slug(component.name)}__${slug(cell.name) || `cell-${cellIndex}`} kolibri-${slug(component.name)}__node-${cell.key}`;
          const scope = cellElement === 'th' ? ' scope="col"' : '';
          return `${indent}    <${cellElement}${scope} className="${cellClass}">\n${content}\n${indent}    </${cellElement}>`;
        })
        .join('\n');
      return `${indent}  <tr className="kolibri-${slug(component.name)}__row-${rowIndex + 1} kolibri-${slug(component.name)}__node-${row.key}">\n${cells}\n${indent}  </tr>`;
    };
    const header = renderRow(rows[0], 0, 'th');
    const body = rows
      .slice(1)
      .filter((row) => row.visible)
      .map((row, index) => renderRow(row, index + 1, 'td'))
      .join('\n');
    return `${indent}<thead>\n${header}\n${indent}</thead>\n${indent}<tbody>\n${body}\n${indent}</tbody>`;
  }

  private contract(
    component: ImportedComponent,
    name: string,
    parts: string[],
  ): string {
    const behavior = component.behavior ?? {
      kind: 'none',
      adapterRequired: false,
      requiredParts: [],
      optionalParts: [],
      states: [],
    };
    return `import type { ${name}Part } from './${name}.view';

export const ${name}Contract = ${JSON.stringify(
      {
        version: 'composable-v1',
        sourceNodeId: component.id,
        component: component.name,
        kind: component.kind,
        behavior: behavior.kind,
        adapterRequired: behavior.adapterRequired,
        requiredParts: behavior.requiredParts,
        optionalParts: behavior.optionalParts,
        availableParts: parts,
        states: behavior.states,
      },
      null,
      2,
    )} as const satisfies {
  version: 'composable-v1';
  sourceNodeId: string;
  component: string;
  kind: 'atom' | 'molecule' | 'organism';
  behavior: string;
  adapterRequired: boolean;
  requiredParts: readonly string[];
  optionalParts: readonly string[];
  availableParts: readonly ${name}Part[];
  states: readonly string[];
};
`;
  }

  private binding(
    component: ImportedComponent,
    name: string,
    complete: boolean,
  ): string {
    const behavior = component.behavior;
    if (!behavior?.adapterRequired) {
      return `export { ${name}View as ${name} } from './${name}.view';\n`;
    }
    if (!complete) {
      return `export { ${name}View } from './${name}.view';\n`;
    }
    const factory = this.behaviorFactory(behavior.kind);
    return `import { ${factory} } from '../../behaviors';
import { ${name}View } from './${name}.view';

export { ${name}View } from './${name}.view';
export const ${name} = ${factory}(${name}View);
`;
  }

  private renderNodes(
    nodes: ImportedVisualNode[],
    component: ImportedComponent,
    indent: string,
  ): string {
    const occurrences = new Map<string, number>();
    const render = (node: ImportedVisualNode, depth: string): string => {
      if (!node.visible) return '';
      const semanticName = node.part ?? this.semanticNodeName(node);
      const current = occurrences.get(semanticName) ?? 0;
      occurrences.set(semanticName, current + 1);
      const className = `kolibri-${slug(component.name)}__${slug(semanticName)}${current ? `-${current + 1}` : ''} kolibri-${slug(component.name)}__node-${node.key}`;
      const part = node.part;
      const partProps = part
        ? ` {...resolvePartProps(partProps?.['${esc(part)}'], { name: '${esc(part)}', index: ${current} })} data-part="${attr(part)}"`
        : '';
      const defaultPartElement = part
        ? this.defaultElement(component, part, 'div')
        : undefined;
      const element = part
        ? this.partVariable(part)
        : node.type === 'TEXT'
          ? 'span'
          : 'div';
      if (node.type === 'VECTOR' && node.vectors.length) {
        const vector = node.vectors[0];
        const paths = vector.paths
          .map(
            (path) =>
              `<path d="${attr(path.d)}"${path.fill ? ` fill="${attr(path.fill)}"` : ''}${path.stroke ? ` stroke="${attr(path.stroke)}"` : ''}${path.strokeWidth ? ` strokeWidth={${path.strokeWidth}}` : ''} />`,
          )
          .join('');
        return `${depth}<svg className="${className}" viewBox="0 0 ${vector.width} ${vector.height}" aria-hidden="true">${paths}</svg>`;
      }
      if (defaultPartElement && isVoidElement(defaultPartElement)) {
        return `${depth}<${element}${partProps} className="${className}" />`;
      }
      const children = node.children
        .map((child) => render(child, `${depth}  `))
        .filter(Boolean)
        .join('\n');
      const content = node.type === 'TEXT' ? jsx(node.text ?? '') : children;
      return content
        ? `${depth}<${element}${partProps} className="${className}">\n${node.type === 'TEXT' ? `${depth}  ${content}` : content}\n${depth}</${element}>`
        : `${depth}<${element}${partProps} className="${className}" />`;
    };
    return nodes
      .map((node) => render(node, indent))
      .filter(Boolean)
      .join('\n');
  }

  private semanticNodeName(node: ImportedVisualNode): string {
    const normalized = slug(node.name);
    return normalized || `visual-${node.id.replace(/[^a-zA-Z0-9]+/g, '-')}`;
  }

  private partVariable(part: string): string {
    return `Part${pascal(part)}`;
  }

  private defaultElement(
    component: ImportedComponent,
    part: string,
    rootElement: string,
  ): string {
    if (part === 'root') return rootElement;
    const configured = component.parts?.find(
      (item) => item.name === part,
    )?.element;
    if (configured) {
      return this.safeElement(configured, 'div');
    }
    const defaults: Record<string, string> = {
      title: 'h2',
      description: 'p',
      close: 'button',
      trigger: 'button',
      actions: 'footer',
      list: 'div',
      item: 'div',
      panel: 'div',
      content: 'div',
    };
    return defaults[part] ?? 'div';
  }

  private safeElement(value: unknown, fallback: string): string {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9-]*$/.test(value)) {
      return fallback;
    }
    return value;
  }

  private behaviorFactory(kind: string): string {
    const factories: Record<string, string> = {
      dialog: 'withDialogBehavior',
      accordion: 'withAccordionBehavior',
      tabs: 'withTabsBehavior',
      tooltip: 'withTooltipBehavior',
      popover: 'withPopoverBehavior',
      menu: 'withMenuBehavior',
    };
    return factories[kind] ?? 'withDisclosureBehavior';
  }
}
