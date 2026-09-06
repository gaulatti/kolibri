import type {
  ImportedComponent,
  KolibriToken,
  SizeValue,
  TypographyValue,
} from '../../figma-importer/figma-importer.types';
import {
  attr,
  jsx,
  pascal,
  slug,
  storyVariantCaption,
  storyVariantPropName,
  variantAxesForComponent,
} from './react-renderer.utils';

export class ReactStoryGenerator {
  composableStory(component: ImportedComponent): string {
    const name = pascal(component.name);
    const availableParts = new Set(
      (component.parts ?? []).map((part) => part.name),
    );
    const complete = (component.behavior?.requiredParts ?? []).every((part) =>
      availableParts.has(part),
    );
    const hasAdapter = Boolean(component.behavior?.adapterRequired) && complete;
    let story = this.story(component);
    if (!hasAdapter && component.behavior?.adapterRequired) {
      story = story.replace(
        `import { ${name} } from './${name}';`,
        `import { ${name}View as ${name} } from './${name}.view';`,
      );
    }
    if (hasAdapter) {
      const storybookAssertions =
        component.behavior?.kind === 'dialog' ? 'expect' : 'expect, userEvent';
      story = story.replace(
        "import type { Meta, StoryObj } from '@storybook/react-vite';",
        `import type { Meta, StoryObj } from '@storybook/react-vite';\nimport { ${storybookAssertions} } from 'storybook/test';`,
      );
    }
    if (hasAdapter && component.behavior?.kind === 'accordion') {
      story = story.replace(
        `component: ${name},`,
        `component: ${name},\n  args: { defaultOpenItems: [0] },`,
      );
      story = story.replaceAll(
        `<${name} {...`,
        `<${name} defaultOpenItems={[0]} {...`,
      );
    } else if (
      hasAdapter &&
      ['dialog', 'popover', 'menu'].includes(component.behavior?.kind ?? '')
    ) {
      story = story.replace(
        `component: ${name},`,
        `component: ${name},\n  args: { defaultOpen: true },`,
      );
      story = story.replaceAll(`<${name} {...`, `<${name} defaultOpen {...`);
    }
    return hasAdapter
      ? `${story}\n${this.behaviorContractStory(component.behavior?.kind ?? 'none')}\n`
      : story;
  }

  private behaviorContractStory(kind: string): string {
    if (kind === 'dialog') {
      return `export const BehaviorContract: Story = {
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const content = canvasElement.querySelector('[data-part="content"]');
    if (!content) throw new Error('Expected dialog content part');
    await expect(content).toHaveAttribute('role', 'dialog');
    await expect(content).toHaveAttribute('aria-modal', 'true');
  },
};`;
    }
    if (kind === 'tabs') {
      return `export const BehaviorContract: Story = {
  play: async ({ canvasElement }) => {
    const tabs = canvasElement.querySelectorAll<HTMLElement>('[data-part="tab"]');
    if (tabs.length < 2) throw new Error('Expected at least two tab parts');
    await userEvent.click(tabs[1]);
    await expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
  },
};`;
    }
    if (kind === 'accordion') {
      return `export const BehaviorContract: Story = {
  args: { defaultOpenItems: [0] },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLElement>('[data-part="trigger"]');
    if (!trigger) throw new Error('Expected accordion trigger part');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};`;
    }
    if (kind === 'tooltip') {
      return `export const BehaviorContract: Story = {
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLElement>('[data-part="trigger"]');
    const content = canvasElement.querySelector<HTMLElement>('[data-part="content"]');
    if (!trigger || !content) throw new Error('Expected tooltip parts');
    await userEvent.hover(trigger);
    await expect(content).toBeVisible();
    await expect(content).toHaveAttribute('role', 'tooltip');
  },
};`;
    }
    return `export const BehaviorContract: Story = {
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLElement>('[data-part="trigger"]');
    if (!trigger) throw new Error('Expected behavior trigger part');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};`;
  }

  foundationStory(tokens: KolibriToken[]): string {
    const groups = [
      'color',
      'space',
      'radius',
      'typography',
      'size',
      'shadow',
    ] as const;
    const sections = groups
      .map((kind) => {
        const samples = tokens
          .filter((token) => token.kind === kind)
          .map((token) => this.tokenSample(token))
          .join('\n');
        return `<section><h2 style={{ textTransform: 'capitalize' }}>${kind}</h2><div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>${samples}</div></section>`;
      })
      .join('\n');
    return `import type { Meta, StoryObj } from '@storybook/react-vite';

function DesignTokens() {
  return (
    <main style={{ display: 'grid', gap: 32, width: 'min(1100px, 90vw)' }}>
      <header><h1>Design Tokens</h1><p>Generated from the Figma 01-foundation page.</p></header>
      ${sections}
    </main>
  );
}

const meta = {
  title: 'Foundation/Design Tokens',
  component: DesignTokens,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DesignTokens>;

export default meta;
type Story = StoryObj<typeof meta>;
export const AllTokens: Story = {};
`;
  }

  private tokenSample(token: KolibriToken): string {
    const label = `<strong>${jsx(token.name)}</strong><code>${jsx(token.cssName)}</code>`;
    let preview: string;
    if (token.kind === 'color') {
      preview = `<div style={{ height: 72, borderRadius: 8, border: '1px solid #d4d4d4', background: 'var(${attr(token.cssName)})' }} />`;
    } else if (token.kind === 'space' && typeof token.value === 'number') {
      preview = `<div style={{ height: 16, width: 'var(${attr(token.cssName)})', minWidth: 2, background: '#2563eb' }} />`;
    } else if (token.kind === 'radius' && typeof token.value === 'number') {
      preview = `<div style={{ width: 72, height: 72, borderRadius: 'var(${attr(token.cssName)})', background: '#f2f2f2', border: '1px solid #d4d4d4' }} />`;
    } else if (token.kind === 'typography') {
      const value = token.value as TypographyValue;
      preview = `<div style={{ fontFamily: 'var(${attr(token.cssName)}-family)', fontSize: 'var(${attr(token.cssName)}-size)', fontWeight: 'var(${attr(token.cssName)}-weight)', lineHeight: 'var(${attr(token.cssName)}-line-height)' }}>The quick brown fox</div><small>${jsx(`${value.fontFamily ?? ''} ${value.fontSize ?? ''}px / ${value.fontWeight ?? ''}`)}</small>`;
    } else if (token.kind === 'shadow') {
      preview = `<div style={{ width: 96, height: 72, borderRadius: 8, background: '#ffffff', boxShadow: 'var(${attr(token.cssName)})' }} />`;
    } else {
      const value = token.value as SizeValue;
      const width = Math.min(value.width ?? 80, 180);
      const height = Math.min(value.height ?? 40, 100);
      preview = `<div style={{ width: ${width}, height: ${height}, background: '#f2f2f2', border: '1px solid #2563eb' }} /><small>${value.width ?? 'auto'} × ${value.height ?? 'auto'}</small>`;
    }
    return `<article style={{ display: 'grid', gap: 8, alignContent: 'start', padding: 16, border: '1px solid #d4d4d4', borderRadius: 8 }}>${preview}<div style={{ display: 'grid', gap: 4 }}>${label}</div></article>`;
  }

  story(component: ImportedComponent): string {
    const name = pascal(component.name);
    const isViewportShell = ['app-shell', 'admin-shell'].includes(
      slug(component.name),
    );
    const axes = variantAxesForComponent(component);
    const previewStyle = isViewportShell
      ? ''
      : [
          component.sourceWidth !== undefined
            ? `width: ${component.sourceWidth}`
            : undefined,
          component.sourceHeight !== undefined &&
          component.style.heightMode === 'fill'
            ? `height: ${component.sourceHeight}`
            : undefined,
        ]
          .filter(Boolean)
          .join(', ');
    const usedExportNames = new Map<string, number>();
    const variantStories = component.variants.length
      ? component.variants
          .map((variant) => {
            const entries = Object.entries(variant.axes);
            const baseExportName =
              pascal(entries.map(([, value]) => value).join(' ')) ||
              pascal(variant.name) ||
              'Default';
            const occurrence = (usedExportNames.get(baseExportName) ?? 0) + 1;
            usedExportNames.set(baseExportName, occurrence);
            const exportName =
              occurrence === 1
                ? baseExportName
                : `${baseExportName}${occurrence}`;
            const args = entries.length
              ? ` { args: ${JSON.stringify(
                  Object.fromEntries(
                    entries.map(([axis, value]) => [
                      storyVariantPropName(component, axis),
                      value,
                    ]),
                  ),
                )} }`
              : ' {}';
            return `export const ${exportName}: Story =${args};`;
          })
          .join('\n')
      : 'export const Default: Story = {};';
    const argTypes = axes.length
      ? `argTypes: ${JSON.stringify(
          Object.fromEntries(
            axes.map(({ source, values }) => [
              storyVariantPropName(component, source),
              {
                control: { type: values.length > 4 ? 'select' : 'radio' },
                options: values,
              },
            ]),
          ),
        )},`
      : '';
    const variantMatrix = component.variants.length
      ? `
export const AllVariants: Story = {
  name: 'All variants',
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gap: 24, alignItems: 'start' }}>
      ${component.variants
        .map((variant) => {
          const args = Object.fromEntries(
            Object.entries(variant.axes).map(([axis, value]) => [
              storyVariantPropName(component, axis),
              value,
            ]),
          );
          const caption = storyVariantCaption(variant.axes, variant.name);
          return `<section aria-label="${attr(caption)}" style={{ display: 'grid', gap: 8, justifyItems: 'start' }}><span style={{ color: 'var(--color-text-secondary, #595959)', fontFamily: 'Encode Sans, sans-serif', fontSize: 14, fontWeight: 600, lineHeight: '20px' }}>${jsx(caption)}</span><${name} {...${JSON.stringify(args)}} /></section>`;
        })
        .join('\n      ')}
    </div>
  ),
};`
      : '';
    return `import type { Meta, StoryObj } from '@storybook/react-vite';
import { ${name} } from './${name}';

const meta = {
  title: '${pascal(component.kind)}/${name}',
  component: ${name},
  tags: ['autodocs'],
  parameters: { layout: '${isViewportShell ? 'fullscreen' : 'centered'}' },
  ${argTypes}
  ${previewStyle ? `decorators: [(Story) => <div style={{ ${previewStyle} }}><Story /></div>],` : ''}
} satisfies Meta<typeof ${name}>;

export default meta;
type Story = StoryObj<typeof meta>;

${variantStories}
${variantMatrix}
`;
  }
}
