import type { KolibriToken } from '../figma-importer/figma-importer.types';
import { rule } from './style-rule';

const noTokens: KolibriToken[] = [];

describe('style-rule defaults and partial inputs', () => {
  it('defaults the background size to cover', () => {
    const css = rule('.bg', { backgroundImageRef: 'hero' }, noTokens, []);
    expect(css).toContain('background-size: cover;');
  });

  it('applies the uniform border width to each side that has no individual width', () => {
    const css = rule(
      '.border',
      { borderColor: '#000000', borderIncludedInLayout: true, borderWidth: 2 },
      noTokens,
      [],
    );
    expect(css).toContain('border-width: 2px 2px 2px 2px;');
  });

  it('uses zero width on each side when neither side nor uniform widths exist', () => {
    const css = rule(
      '.border',
      { borderColor: '#000000', borderIncludedInLayout: true },
      noTokens,
      [],
    );
    expect(css).toContain('border-width: 0px 0px 0px 0px;');
  });

  it('prefers a side width over the uniform width per side', () => {
    const css = rule(
      '.border',
      {
        borderColor: '#000000',
        borderIncludedInLayout: true,
        borderWidth: 2,
        borderBottomWidth: 5,
      },
      noTokens,
      [],
    );
    expect(css).toContain('border-width: 2px 2px 5px 2px;');
  });

  it('treats unset padding sides as zero', () => {
    const css = rule('.pad', { paddingRight: 4 }, noTokens, []);
    expect(css).toContain('padding: 0px 4px 0px 0px;');
  });

  it('emits no inset stroke for sides whose individual width is zero or unset', () => {
    const css = rule(
      '.stroke',
      { borderColor: '#000000', borderTopWidth: 1, borderRightWidth: 0 },
      noTokens,
      [],
    );
    expect(css).toContain('box-shadow: inset 0 1px 0 #000000;');
  });

  it('emits only the right and bottom inset strokes when they are the only positive widths', () => {
    const css = rule(
      '.stroke',
      { borderColor: '#000000', borderRightWidth: 2, borderBottomWidth: 3 },
      noTokens,
      [],
    );
    expect(css).toContain(
      'box-shadow: inset -2px 0 0 #000000, inset 0 -3px 0 #000000;',
    );
  });

  it('matches a typography token without a line height when the style has none', () => {
    const tokens: KolibriToken[] = [
      {
        name: 'label',
        cssName: '--label',
        kind: 'typography',
        value: { fontFamily: 'Sans', fontSize: 12, fontWeight: 400 },
        sourceNodeId: '1',
      },
    ];
    const css = rule(
      '.text',
      { fontFamily: 'Sans', fontSize: 12, fontWeight: 400 },
      tokens,
      [],
    );
    expect(css).toContain('font-size: var(--label-size);');
  });
});
