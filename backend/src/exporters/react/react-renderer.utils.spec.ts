import type {
  ImportedComponent,
  ImportedComponentInstance,
  ImportedVisualNode,
} from '../../figma-importer/figma-importer.types';
import * as utils from './react-renderer.utils';

function visual(
  name: string,
  overrides: Partial<ImportedVisualNode> = {},
): ImportedVisualNode {
  return {
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
  };
}
function instance(
  name: string,
  overrides: Partial<ImportedComponentInstance> = {},
): ImportedComponentInstance {
  return {
    id: name,
    name,
    cssClass: name,
    componentId: name,
    visible: true,
    semanticMetadata: {},
    style: {},
    children: [],
    ...overrides,
  };
}
function component(
  overrides: Partial<ImportedComponent> = {},
): ImportedComponent {
  return {
    id: 'c',
    name: 'sample',
    kind: 'atom',
    type: 'component',
    pageName: 'atoms',
    semanticMetadata: {},
    style: {},
    variants: [],
    composition: [],
    vectors: [],
    visual: [],
    ...overrides,
  };
}

describe('react renderer utilities', () => {
  it('derives axes, props, classes, unions, captions, and escaped values', () => {
    const c = component({
      variants: [
        {
          id: '1',
          name: 'one',
          axes: { 'prop.tone': 'light', empty: 'a' },
          style: {},
          vectors: [],
          composition: [],
          visual: [],
        },
        {
          id: '2',
          name: 'two',
          axes: { 'prop.tone': 'dark', empty: 'b' },
          style: {},
          vectors: [],
          composition: [],
          visual: [],
        },
      ],
    });
    const axes = utils.variantAxesForComponent(c);
    expect(axes[0]).toMatchObject({
      prop: 'tone',
      defaultValue: 'light',
      values: ['light', 'dark'],
    });
    expect(utils.genericVariantClass(c, axes)).toContain("tone === 'dark'");
    expect(utils.genericVariantClass(component(), [])).toContain(
      "variantClass = ''",
    );
    expect(utils.variantPropName('---')).toBe('variant');
    expect(
      utils.storyVariantPropName(component({ name: 'icon' }), 'icon'),
    ).toBe('name');
    expect(utils.storyVariantPropName(c, 'prop.tone')).toBe('tone');
    expect(utils.variantUnion(c, 'prop.tone')).toBe("'light' | 'dark'");
    expect(utils.variantUnion(component(), 'none')).toBe("'default'");
    expect(
      utils.storyVariantCaption({ tone: 'high_contrast' }, 'Fallback'),
    ).toBe('High Contrast');
    expect(utils.storyVariantCaption({}, 'fallback-value')).toBe(
      'Fallback Value',
    );
    expect(utils.esc("a\\b'c\nd")).toBe("a\\\\b\\'c\\nd");
    expect(utils.attr('"<&{}')).toContain('&quot;');
  });

  it('renders text, vector, nested, empty, and hidden visual nodes', () => {
    const vector = visual('vector', {
      type: 'VECTOR',
      vectors: [
        {
          name: 'v',
          width: 10,
          height: 20,
          paths: [
            { d: 'M"0', fill: '#fff', stroke: '#000', strokeWidth: 2 },
            { d: 'M1' },
          ],
        },
      ],
    });
    const nodes = [
      visual('hidden', { visible: false }),
      visual('text', { type: 'TEXT', text: '<Text>' }),
      vector,
      visual('nested', { children: [visual('child', { type: 'TEXT' })] }),
      visual('empty'),
    ];
    const rendered = utils.renderVisualNodes(nodes, 'sample', '  ');
    expect(rendered).toContain('&lt;Text&gt;');
    expect(rendered).toContain('<svg');
    expect(rendered).toContain('strokeWidth={2}');
    expect(rendered).toContain(
      '<div className="kolibri-sample__node-empty" />',
    );
    expect(rendered).not.toContain('node-hidden');
  });

  it('resolves metadata, instances, visual groups, text, image references, and defaults', () => {
    const first = instance('Primary', {
      componentName: 'Button',
      textOverride: 'Override',
      semanticMetadata: { 'content.text': 'Metadata', href: '/go' },
    });
    const second = instance('Primary', { cssClass: 'second' });
    const text = visual('Fallback', { type: 'TEXT', text: 'Found' });
    const group = visual('Group', {
      children: [visual('Title'), visual('Action'), text],
    });
    const c = component({
      semanticMetadata: { string: 'yes', bool: true, axis: 'meta' },
      composition: [first, second],
      visual: [group],
      variants: [
        {
          id: '1',
          name: 'default',
          axes: { axis: 'variant' },
          style: { backgroundImageRef: 'variant-image' },
          vectors: [],
          composition: [first, second],
          visual: [],
        },
      ],
    });
    expect(utils.str(c, 'string', 'no')).toBe('yes');
    expect(utils.str(c, 'missing', 'no')).toBe('no');
    expect(utils.bool(c, 'bool', false)).toBe(true);
    expect(utils.bool(c, 'missing', false)).toBe(false);
    expect(utils.value(first, 'href', '/')).toBe('/go');
    expect(utils.value(first, 'missing', '/')).toBe('/');
    expect(utils.findInstance(c, 'button')).toBe(first);
    expect(utils.instanceText(c, 'button', 'fallback')).toBe('Metadata');
    expect(utils.instanceText(c, 'missing', 'fallback')).toBe('fallback');
    expect(utils.instanceValue(c, 'button', 'href', '/')).toBe('/go');
    expect(utils.instanceValue(c, 'missing', 'href', '/')).toBe('/');
    expect(utils.instanceClass(c, 'primary')).toContain('__Primary');
    expect(utils.instanceClass(c, 'primary', 2)).toContain('__second');
    expect(utils.instanceClass(component(), 'missing', 2)).toContain(
      'missing-2',
    );
    expect(utils.findVisual(c.visual, 'fallback')).toBe(text);
    expect(utils.findVisual(c.visual, 'none')).toBeUndefined();
    expect(utils.visualClass(c, 'Title')).toContain('Title');
    expect(utils.visualClass(c, 'Missing')).toContain('missing');
    expect(
      utils.visualGroupClass(c, ['title', 'action'], 'fallback'),
    ).toContain('Group');
    expect(
      utils.visualGroupClass(
        component({ visual: [visual('Outer', { children: [group] })] }),
        ['title', 'action'],
        'fallback',
      ),
    ).toContain('Group');
    expect(utils.visualGroupClass(c, ['missing'], 'fallback')).toContain(
      'fallback',
    );
    expect(utils.visualTreeContainsName(c.visual, 'action')).toBe(true);
    expect(utils.visualTreeContainsName(c.visual, 'none')).toBe(false);
    expect(utils.visualText(c, 'Group', 'Fallback')).toBe('Found');
    expect(utils.visualText(c, 'Missing', 'Fallback')).toBe('Fallback');
    expect(utils.firstVisualText(group)).toBe('Found');
    expect(utils.firstVisualText(undefined)).toBeUndefined();
    expect(utils.variantDefault(c, 'axis', 'fallback')).toBe('meta');
    expect(
      utils.variantDefault(
        component({ variants: c.variants }),
        'axis',
        'fallback',
      ),
    ).toBe('variant');
    expect(utils.variantDefault(component(), 'axis', 'fallback')).toBe(
      'fallback',
    );
    expect(utils.componentImageReference(c)).toBe('variant-image');
    expect(
      utils.componentImageReference(
        component({ style: { backgroundImageRef: 'root-image' } }),
      ),
    ).toBe('root-image');
    expect(
      utils.uniqueVisualTexts([
        text,
        visual('copy', { type: 'TEXT', text: 'Found' }),
        group,
      ]),
    ).toEqual(['Found']);
  });

  it('maps icons, void elements, and identifiers', () => {
    expect(
      ['arrow-right', 'check', 'warning', 'close', 'menu', 'unknown'].map(
        utils.lucideIconComponent,
      ),
    ).toEqual(['ArrowRight', 'Check', 'TriangleAlert', 'X', 'Menu', 'Circle']);
    expect(utils.isVoidElement('INPUT')).toBe(true);
    expect(utils.isVoidElement('div')).toBe(false);
    expect(utils.pascal('hello-world')).toBe('HelloWorld');
    expect(utils.slug(' Hello World! ')).toBe('hello-world');
  });
});
