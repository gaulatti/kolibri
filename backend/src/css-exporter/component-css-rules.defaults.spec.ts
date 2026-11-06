import type {
  ImportedComponent,
  ImportedVisualNode,
} from '../figma-importer/figma-importer.types';
import { generateComponentRules } from './component-css-rules';

function node(
  name: string,
  overrides: Partial<ImportedVisualNode> = {},
): ImportedVisualNode {
  return {
    id: `node:${name}`,
    key: name,
    name,
    type: 'FRAME',
    visible: true,
    semanticMetadata: {},
    style: {},
    vectors: [],
    children: [],
    ...overrides,
  };
}

function component(
  name: string,
  overrides: Partial<ImportedComponent> = {},
): ImportedComponent {
  return {
    id: `component:${name}`,
    name,
    kind: 'atom',
    type: 'component',
    pageName: 'page',
    semanticMetadata: {},
    style: {},
    variants: [],
    composition: [],
    vectors: [],
    visual: [],
    ...overrides,
  };
}

const css = (item: ImportedComponent) =>
  generateComponentRules(item, [], []).join('\n');

describe('component CSS rule fallbacks', () => {
  describe('card grid gaps', () => {
    it('defaults both gaps to 24px', () => {
      const output = css(component('card-grid'));
      expect(output).toContain('column-gap: 24px;');
      expect(output).toContain('row-gap: 24px;');
    });

    it('uses the component gap when the list has none', () => {
      const output = css(component('card-grid', { style: { gap: 12 } }));
      expect(output).toContain('column-gap: 12px;');
      expect(output).toContain('row-gap: 12px;');
    });

    it('uses the list gap for both axes when no row gap is given', () => {
      const output = css(
        component('card-grid', {
          style: { gap: 12 },
          visual: [node('semantic.list', { style: { gap: 6 } })],
        }),
      );
      expect(output).toContain('column-gap: 6px;');
      expect(output).toContain('row-gap: 6px;');
    });

    it('uses a dedicated list row gap when present', () => {
      const output = css(
        component('card-grid', {
          visual: [node('semantic.list', { style: { gap: 6, rowGap: 4 } })],
        }),
      );
      expect(output).toContain('column-gap: 6px;');
      expect(output).toContain('row-gap: 4px;');
    });

    it('falls to the component gap when the list defines only a row gap', () => {
      const output = css(
        component('card-grid', {
          style: { gap: 10 },
          visual: [node('semantic.list', { style: { rowGap: 3 } })],
        }),
      );
      expect(output).toContain('column-gap: 10px;');
      expect(output).toContain('row-gap: 3px;');
    });

    it('falls to the default when the list has an empty style and no component gap', () => {
      const output = css(
        component('card-grid', { visual: [node('semantic.list')] }),
      );
      expect(output).toContain('column-gap: 24px;');
      expect(output).toContain('row-gap: 24px;');
    });
  });

  it('renders the page header without variants from the component visual', () => {
    const output = css(
      component('page-header', {
        visual: [
          node('breadcrumbs', { style: { gap: 2 } }),
          node('main', { style: { gap: 3 } }),
        ],
      }),
    );
    expect(output).toContain('.kolibri-page-header__breadcrumbs');
    expect(output).toContain('.kolibri-page-header__main');
  });

  it('inherits the bubble color for a tooltip whose text node has none', () => {
    const output = css(
      component('tooltip', {
        visual: [
          node('bubble', {
            style: { color: '#111111' },
            children: [node('label', { type: 'TEXT', style: {} })],
          }),
          node('trigger'),
        ],
      }),
    );
    expect(output).toContain('color: #111111;');
  });

  it('prefers the bubble text color when present', () => {
    const output = css(
      component('tooltip', {
        visual: [
          node('bubble', {
            style: { color: '#111111' },
            children: [
              node('label', { type: 'TEXT', style: { color: '#222222' } }),
            ],
          }),
        ],
      }),
    );
    expect(output).toContain('color: #222222;');
  });

  it('renders the loading spinner and radio group from the component visual when no variants exist', () => {
    const spinner = css(
      component('loading-spinner', {
        visual: [
          node('track', { style: { borderColor: '#aaaaaa' } }),
          node('indicator', { style: { borderColor: '#bbbbbb' } }),
        ],
      }),
    );
    expect(spinner).toContain('stroke: #aaaaaa;');
    expect(spinner).toContain('stroke: #bbbbbb;');
    const radio = css(
      component('radio-group', {
        visual: [node('dot', { style: { background: '#cccccc' } })],
      }),
    );
    expect(radio).toContain('background: #cccccc;');
  });

  it('prefers the default variant visual over the component visual for page header, spinner and radio group', () => {
    const variant = (visual: ImportedVisualNode[]) => ({
      id: 'v',
      name: 'default',
      axes: {},
      style: {},
      vectors: [],
      composition: [],
      visual,
    });
    const header = css(
      component('page-header', {
        visual: [node('breadcrumbs', { style: { gap: 99 } })],
        variants: [
          variant([
            node('breadcrumbs', { style: { gap: 2 } }),
            node('main', { style: { gap: 3 } }),
          ]),
        ],
      }),
    );
    expect(header).not.toContain('gap: 99px');
    expect(header).toContain('.kolibri-page-header__main');
    const spinner = css(
      component('loading-spinner', {
        variants: [
          variant([
            node('track', { style: { borderColor: '#aaaaaa' } }),
            node('indicator', { style: { borderColor: '#bbbbbb' } }),
          ]),
        ],
      }),
    );
    expect(spinner).toContain('stroke: #aaaaaa;');
    const radio = css(
      component('radio-group', {
        variants: [
          variant([node('dot', { style: { background: '#cccccc' } })]),
        ],
      }),
    );
    expect(radio).toContain('background: #cccccc;');
  });
});
