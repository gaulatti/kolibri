import { applyComponentContract } from '../../component-contracts/component-contract.validator';
import { generateComponentRules } from '../../css-exporter/component-css-rules';
import type {
  Diagnostic,
  ImportedComponent,
  ImportedComponentInstance,
  ImportedVisualNode,
  KolibriDesignSystem,
} from '../../figma-importer/figma-importer.types';
import { ComposableReactComponentGenerator } from './composable-react-component.generator';
import { ReactComponentGenerator } from './react-component.generator';
import { ReactExporterService } from './react-exporter.service';
import * as utils from './react-renderer.utils';

const visual = (
  name: string,
  overrides: Partial<ImportedVisualNode> = {},
): ImportedVisualNode => ({
  id: name,
  key: name,
  name,
  type: 'FRAME',
  visible: true,
  semanticMetadata: {},
  style: {},
  vectors: [],
  children: [],
  ...overrides,
});
const instance = (
  name: string,
  overrides: Partial<ImportedComponentInstance> = {},
): ImportedComponentInstance => ({
  id: name,
  name,
  cssClass: name,
  componentId: name,
  visible: true,
  semanticMetadata: {},
  style: {},
  children: [],
  ...overrides,
});
const component = (
  name: string,
  overrides: Partial<ImportedComponent> = {},
): ImportedComponent => ({
  id: name,
  name,
  kind: 'atom',
  type: 'component',
  pageName: '02-atoms',
  semanticMetadata: {},
  style: {},
  variants: [],
  composition: [],
  vectors: [],
  visual: [],
  ...overrides,
});

describe('renderer optional source contracts', () => {
  it('deduplicates repeated variant values and preserves missing-axis defaults', () => {
    const c = component('sample', {
      variants: [
        {
          id: 'one',
          name: 'one',
          axes: { 'prop.button-size': 'small' },
          style: {},
          vectors: [],
          composition: [],
          visual: [],
        },
        {
          id: 'two',
          name: 'two',
          axes: { tone: 'dark' },
          style: {},
          vectors: [],
          composition: [],
          visual: [],
        },
        {
          id: 'three',
          name: 'three',
          axes: { 'prop.button-size': 'small' },
          style: {},
          vectors: [],
          composition: [],
          visual: [],
        },
      ],
    });
    const axes = utils.variantAxesForComponent(c);
    expect(axes).toEqual([
      {
        source: 'prop.button-size',
        prop: 'buttonSize',
        defaultValue: 'small',
        values: ['small'],
      },
      { source: 'tone', prop: 'tone', defaultValue: 'dark', values: ['dark'] },
    ]);
    expect(utils.genericVariantClass(c, axes)).toContain(
      "buttonSize === '' && tone === 'dark'",
    );
    expect(utils.variantPropName('')).toBe('variant');
    const unlabelled = component('content', {
      composition: [instance('button')],
      visual: [visual('terms', { children: [visual('Fallback')] })],
    });
    expect(utils.instanceText(unlabelled, 'button', 'Continue')).toBe(
      'Continue',
    );
    expect(utils.visualText(unlabelled, 'terms', 'Fallback')).toBe('Fallback');
  });

  it('publishes a view-only manifest when a source has no optional behavior definition', () => {
    const source: KolibriDesignSystem = {
      tokens: [],
      components: [component('plain')],
      fontSources: [],
      imageReferences: [],
      diagnostics: [],
    };
    const files = new ReactExporterService().generateComponents(
      source,
      'composable-v1',
    );
    const manifest = JSON.parse(
      files.find((file) => file.path === 'kolibri.manifest.json')!.content,
    );
    expect(manifest.components.Plain).toMatchObject({
      behavior: 'none',
      adapterRequired: false,
      adapterAttached: false,
      requiredParts: [],
      states: [],
      availableParts: ['root'],
    });
  });

  it('accepts aligned repeatable parts and retains intrinsic image/table fallbacks', () => {
    const diagnostics: Diagnostic[] = [];
    const tabs = applyComponentContract(
      component('tabs', {
        visual: [
          visual('list', { part: 'list' }),
          visual('tab', { part: 'tab' }),
          visual('panel', { part: 'panel' }),
        ],
      }),
      diagnostics,
    );
    expect(tabs.behavior?.adapterEligible).toBe(true);
    expect(diagnostics).toEqual([]);
    const generator = new ComposableReactComponentGenerator();
    expect(
      generator.generate(
        component('image', { semanticMetadata: { 'semantic.element': 'img' } }),
      ).view,
    ).toContain('alt=""');
    const table = generator.generate(
      component('table', {
        semanticMetadata: { 'semantic.element': 'table' },
        visual: [visual('row', { children: [visual('!!!')] })],
      }),
    );
    expect(table.view).toContain('kolibri-table__cell-0');
    expect(table.view).toContain('<th scope="col"');
  });

  it('retains source assets and valid void elements in the legacy contract', () => {
    const generator = new ReactComponentGenerator();
    expect(
      generator.generate(
        component('avatar', { style: { backgroundImageRef: 'fixture' } }),
      ),
    ).toContain("new URL('../assets/figma-fixture.png', import.meta.url).href");
    expect(
      generator.generate(
        component('icon', {
          variants: [
            {
              id: 'icon',
              name: 'arrow-right',
              axes: {},
              style: {},
              vectors: [],
              composition: [],
              visual: [],
            },
          ],
        }),
      ),
    ).toContain("'arrow-right': ArrowRight");
    const voidSource = generator.generate(
      component('embedded-input', {
        semanticMetadata: { 'semantic.element': 'input' },
      }),
    );
    expect(voidSource).toContain("const Element = 'input'");
    expect(voidSource).not.toContain('</Element>');
  });

  it.each([undefined, 'Begin'])(
    'uses navigation and action fallbacks without inventing links: %s',
    (textOverride) => {
      const source = new ReactComponentGenerator().generate(
        component('site-header', {
          semanticMetadata: {
            'content.navigation': 'Home',
            'navigation.hrefs': '/',
            'content.action': 'Join',
          },
          composition: [
            instance('navigation-item-one'),
            instance('navigation-item-two'),
            instance('button', { textOverride }),
          ],
        }),
      );
      expect(source).toContain("{ label: 'Home', href: '/' }");
      expect(source).toContain("{ label: 'Navigation item', href: '#' }");
      expect(source).toContain(`action = '${textOverride ?? 'Join'}'`);
      const labelsOnly = new ReactComponentGenerator().generate(
        component('site-header', {
          semanticMetadata: {
            'content.navigation': 'Home|Other',
            'navigation.hrefs': '/',
          },
        }),
      );
      expect(labelsOnly).toContain("{ label: 'Other', href: '#' }");
    },
  );

  it.each([undefined, 'Register'])(
    'preserves signup composition without optional names or input placeholders: %s',
    (textOverride) => {
      const source = new ReactComponentGenerator().generate(
        component('signup-form', {
          semanticMetadata: { 'content.submit': 'Submit fixture' },
          composition: [
            instance('form-field', { children: [instance('text-input')] }),
            instance('button', { textOverride }),
          ],
        }),
      );
      expect(source).toContain('placeholder=""');
      expect(source).toContain(`>${textOverride ?? 'Submit fixture'}</Button>`);
    },
  );

  it('inherits tooltip bubble colors when the nested text has no explicit color', () => {
    const rules = generateComponentRules(
      component('tooltip', {
        visual: [
          visual('bubble', {
            style: { color: '#123456' },
            children: [visual('text', { type: 'TEXT' })],
          }),
        ],
      }),
      [],
      [],
    );
    expect(rules.join('\n')).toContain('color: #123456;');
  });
});
