import type {
  ImportedComponent,
  ImportedFontSource,
  KolibriToken,
} from '../figma-importer/figma-importer.types';
import {
  fontFamilyValue,
  formatNumber,
  kebab,
  numberMetadata,
  resolveColorValue,
  resolveNumericValue,
} from './css-values';
import {
  compositionRules,
  findVisualStyle,
  mergeVisualTextStyle,
  rule,
  visualRules,
} from './style-rule';

export function generateComponentRules(
  component: ImportedComponent,
  tokens: KolibriToken[],
  fontSources: ImportedFontSource[],
): string[] {
  const name = kebab(component.name);
  const rules: string[] = [];
  const defaultVariant = component.variants[0];
  rules.push(
    rule(
      `.kolibri-${name}`,
      defaultVariant?.style ?? component.style,
      tokens,
      fontSources,
    ),
  );
  rules.push(
    ...visualRules(
      name,
      defaultVariant?.visual ?? component.visual,
      tokens,
      fontSources,
    ),
    ...compositionRules(
      name,
      defaultVariant?.composition ?? component.composition,
      tokens,
      fontSources,
    ),
  );
  for (const variant of component.variants.slice(1)) {
    const suffix = Object.entries(variant.axes)
      .map(([axis, value]) => `${kebab(axis)}-${kebab(value)}`)
      .join('--');
    const selectors = [`.kolibri-${name}--${suffix}`];
    if (name === 'button' && variant.axes.variant === 'secondary')
      selectors.push('.kolibri-button-secondary');
    rules.push(rule(selectors.join(',\n'), variant.style, tokens, fontSources));
    rules.push(
      ...visualRules(name, variant.visual, tokens, fontSources, selectors[0]),
      ...compositionRules(
        name,
        variant.composition,
        tokens,
        fontSources,
        selectors[0],
      ),
    );
  }
  const breakpoint =
    numberMetadata(component.semanticMetadata, 'responsive.stackAt') ??
    numberMetadata(component.semanticMetadata, 'responsive.collapseAt');
  if (breakpoint)
    rules.push(
      `@media (max-width: ${breakpoint}px) {\n  .kolibri-${name} {\n    flex-direction: column;\n  }\n}`,
    );
  if ('visibility.feedback' in component.semanticMetadata)
    rules.push(`.kolibri-${name}__feedback[hidden] {\n  display: none;\n}`);
  if (name === 'signup-form')
    rules.push(
      `.kolibri-signup-form__node-3 {\n  display: flex;\n  flex-direction: row;\n  align-items: center;\n}\n.kolibri-signup-form__node-3-1 {\n  margin: 0;\n  white-space: nowrap;\n}`,
    );
  if (name === 'app-shell' || name === 'admin-shell')
    rules.push(
      `.kolibri-${name} {\n  width: 100%;\n  min-width: 0;\n  max-width: none;\n  height: 100vh;\n  min-height: 100vh;\n  max-height: none;\n  border-radius: 0;\n}\n.kolibri-${name} > [class^="kolibri-${name}__node-"] {\n  width: 100%;\n  max-width: none;\n}\n.kolibri-${name} > .kolibri-${name}__node-0 > .kolibri-${name}__node-0-1 {\n  max-width: none;\n}\n.kolibri-${name} > .kolibri-${name}__node-1 {\n  max-height: none;\n}${
        name === 'admin-shell'
          ? `\n.kolibri-admin-shell > .kolibri-admin-shell__node-1 > .kolibri-admin-shell__node-1-0,\n.kolibri-admin-shell > .kolibri-admin-shell__node-1 > .kolibri-admin-shell__node-1-1 {\n  height: 100%;\n  max-height: none;\n}\n.kolibri-admin-shell > .kolibri-admin-shell__node-1 > .kolibri-admin-shell__node-1-1 {\n  max-width: none;\n}`
          : ''
      }`,
    );
  if (name === 'card-grid') {
    const columns =
      numberMetadata(component.semanticMetadata, 'layout.columns') ?? 3;
    const minimum =
      numberMetadata(component.semanticMetadata, 'layout.minimumItemWidth') ??
      280;
    const listStyle = findVisualStyle(component.visual, 'semantic.list');
    const columnGap = resolveNumericValue(
      listStyle?.gap ?? component.style.gap ?? 24,
      'space',
      tokens,
    );
    const rowGap = resolveNumericValue(
      listStyle?.rowGap ?? listStyle?.gap ?? component.style.gap ?? 24,
      'space',
      tokens,
    );
    rules.push(
      `.kolibri-card-grid__list {\n  display: grid;\n  grid-template-columns: repeat(${columns}, minmax(${minimum}px, 1fr));\n  column-gap: ${columnGap};\n  row-gap: ${rowGap};\n}`,
    );
    if (breakpoint)
      rules.push(
        `@media (max-width: ${breakpoint}px) {\n  .kolibri-card-grid__list {\n    grid-template-columns: 1fr;\n  }\n}`,
      );
  }
  if (name === 'site-header')
    rules.push(
      '.kolibri-site-header nav ul {\n  display: contents;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n.kolibri-site-header [class*="kolibri-site-header__navigation-item"],\n.kolibri-site-header [class*="kolibri-site-header__link"] {\n  text-decoration: none;\n}\n.kolibri-site-header [class*="kolibri-site-header__link"] {\n  color: inherit;\n}\n.kolibri-site-header svg[class*="kolibri-site-header__icon"] {\n  display: block;\n  flex: none;\n  overflow: visible;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n}',
    );
  if (name === 'page-header') {
    const visual = defaultVariant?.visual ?? component.visual;
    const breadcrumbs = visual[0];
    const main = visual[1];
    const back = main?.children[0];
    const summary = main?.children[1];
    const actions = main?.children[2];
    if (breadcrumbs)
      rules.push(
        rule(
          '.kolibri-page-header__breadcrumbs',
          breadcrumbs.style,
          tokens,
          fontSources,
        ),
      );
    if (main)
      rules.push(
        rule('.kolibri-page-header__main', main.style, tokens, fontSources),
      );
    if (back)
      rules.push(
        rule(
          '.kolibri-page-header .kolibri-page-header__back',
          mergeVisualTextStyle(back),
          tokens,
          fontSources,
        ),
      );
    if (summary) {
      rules.push(
        rule(
          '.kolibri-page-header__summary',
          summary.style,
          tokens,
          fontSources,
        ),
      );
      if (summary.children[0])
        rules.push(
          rule(
            '.kolibri-page-header__summary .kolibri-heading',
            summary.children[0].style,
            tokens,
            fontSources,
          ),
        );
      if (summary.children[1])
        rules.push(
          rule(
            '.kolibri-page-header__summary .kolibri-paragraph',
            summary.children[1].style,
            tokens,
            fontSources,
          ),
        );
    }
    if (actions) {
      rules.push(
        rule(
          '.kolibri-page-header__actions',
          actions.style,
          tokens,
          fontSources,
        ),
      );
      actions.children.forEach((action, index) =>
        rules.push(
          rule(
            `.kolibri-page-header .kolibri-page-header__action:nth-child(${index + 1})`,
            mergeVisualTextStyle(action),
            tokens,
            fontSources,
          ),
        ),
      );
    }
    rules.push(
      '.kolibri-page-header {\n  text-decoration: none;\n}\n.kolibri-page-header__breadcrumbs ol,\n.kolibri-page-header__breadcrumbs li {\n  display: flex;\n  align-items: center;\n  gap: var(--space-2, 8px);\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n.kolibri-page-header__breadcrumbs .kolibri-link {\n  color: inherit;\n  font: inherit;\n}\n.kolibri-page-header__breadcrumbs [aria-current="page"] {\n  color: #0d1821;\n}\n.kolibri-page-header__separator {\n  color: #a6a6a6;\n  text-decoration: none;\n}\n.kolibri-page-header__main,\n.kolibri-page-header__actions {\n  height: fit-content;\n  min-height: 0;\n  max-height: none;\n  overflow: visible;\n  text-decoration: none;\n}\n.kolibri-page-header .kolibri-page-header__back {\n  flex: none;\n  padding: 0;\n}\n.kolibri-page-header .kolibri-page-header__action {\n  width: fit-content;\n  height: fit-content;\n  min-width: 0;\n  max-width: none;\n  min-height: 0;\n  max-height: none;\n  align-items: center;\n  justify-content: center;\n  white-space: nowrap;\n  text-decoration: none;\n}',
    );
  }
  if (name === 'tooltip') {
    const topVariant =
      component.variants.find(
        (variant) => variant.axes['prop.side'] === 'top',
      ) ?? component.variants[0];
    const visual = topVariant?.visual ?? component.visual;
    const bubble = visual[0];
    const bubbleText = bubble?.children[0]?.style;
    const trigger = visual[1];
    if (bubble)
      rules.push(
        rule(
          '.kolibri-tooltip .kolibri-tooltip__bubble',
          {
            ...bubble.style,
            color: bubbleText?.color ?? bubble.style.color,
            fontFamily: bubbleText?.fontFamily ?? bubble.style.fontFamily,
            fontSize: bubbleText?.fontSize ?? bubble.style.fontSize,
            fontWeight: bubbleText?.fontWeight ?? bubble.style.fontWeight,
            lineHeight: bubbleText?.lineHeight ?? bubble.style.lineHeight,
          },
          tokens,
          fontSources,
        ),
      );
    if (trigger)
      rules.push(
        rule(
          '.kolibri-tooltip .kolibri-tooltip__trigger',
          trigger.style,
          tokens,
          fontSources,
        ),
      );
    rules.push(
      '.kolibri-tooltip__bubble {\n  order: 0;\n}\n.kolibri-tooltip__trigger {\n  order: 1;\n}\n.kolibri-tooltip--prop-side-bottom .kolibri-tooltip__trigger {\n  order: 0;\n}\n.kolibri-tooltip--prop-side-bottom .kolibri-tooltip__bubble {\n  order: 1;\n}',
    );
  }
  if (name === 'icon')
    rules.push(
      '.kolibri-icon {\n  display: inline-block;\n  flex: none;\n  color: inherit;\n}',
    );
  if (name === 'checkbox') {
    const white = resolveColorValue('#ffffff', tokens);
    rules.push(
      `.kolibri-checkbox {\n  position: relative;\n  display: inline-flex;\n  width: 20px;\n  height: 20px;\n  min-width: 20px;\n  min-height: 20px;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n}\n.kolibri-checkbox > input {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  margin: 0;\n  opacity: 0;\n  cursor: inherit;\n}\n.kolibri-checkbox .kolibri-checkbox__icon {\n  display: block;\n  flex: none;\n  width: 14px;\n  height: 14px;\n  min-width: 14px;\n  max-width: 14px;\n  min-height: 14px;\n  max-height: 14px;\n  color: ${white};\n  overflow: visible;\n  pointer-events: none;\n}\n.kolibri-checkbox__icon path {\n  stroke: ${white};\n}\n.kolibri-checkbox__indeterminate {\n  width: 8px;\n  height: 2px;\n  border-radius: 999px;\n  background: ${white};\n  pointer-events: none;\n}\n.kolibri-checkbox:has(input:focus-visible) {\n  outline: 2px solid currentColor;\n  outline-offset: 2px;\n}\n.kolibri-checkbox:has(input:disabled) {\n  cursor: not-allowed;\n}`,
    );
  }
  if (name === 'textarea') {
    rules.push(
      `.kolibri-textarea {\n  display: block;\n  resize: vertical;\n}\n.kolibri-textarea::placeholder {\n  color: inherit;\n  opacity: 1;\n}\n.kolibri-textarea:focus-visible {\n  outline: 2px solid currentColor;\n  outline-offset: 2px;\n}\n.kolibri-textarea:disabled {\n  cursor: not-allowed;\n}`,
    );
  }
  if (name === 'skeleton')
    rules.push(
      `.kolibri-skeleton:not(.kolibri-skeleton--variant-card),\n.kolibri-skeleton--variant-card .kolibri-skeleton__node-0-0,\n.kolibri-skeleton--variant-card .kolibri-skeleton__node-0-1-0,\n.kolibri-skeleton--variant-card .kolibri-skeleton__node-0-1-1,\n.kolibri-skeleton--variant-card .kolibri-skeleton__node-1,\n.kolibri-skeleton--variant-card .kolibri-skeleton__node-2,\n.kolibri-skeleton--variant-card .kolibri-skeleton__node-3 {\n  background-image: linear-gradient(\n    90deg,\n    transparent 0%,\n    rgba(255, 255, 255, 0.55) 50%,\n    transparent 100%\n  );\n  background-size: 200% 100%;\n  animation: kolibri-skeleton-shimmer 1.5s ease-in-out infinite;\n}\n@keyframes kolibri-skeleton-shimmer {\n  from { background-position: 200% 0; }\n  to { background-position: -200% 0; }\n}\n@media (prefers-reduced-motion: reduce) {\n  .kolibri-skeleton,\n  .kolibri-skeleton [class*="kolibri-skeleton__node-"] {\n    animation: none;\n  }\n}`,
    );
  if (name === 'loading-spinner') {
    const visual = defaultVariant?.visual ?? component.visual;
    const track = visual[0]?.style.borderColor ?? 'currentColor';
    const indicator = visual[1]?.style.borderColor ?? 'currentColor';
    rules.push(
      `.kolibri-loading-spinner {\n  display: inline-flex;\n  line-height: 0;\n}\n.kolibri-loading-spinner__svg {\n  display: block;\n  animation: kolibri-spinner-rotate 800ms linear infinite;\n}\n.kolibri-loading-spinner__track,\n.kolibri-loading-spinner__indicator {\n  fill: none;\n  stroke-width: 2;\n  vector-effect: non-scaling-stroke;\n}\n.kolibri-loading-spinner__track {\n  stroke: ${track.startsWith('#') || track.startsWith('rgba') ? resolveColorValue(track, tokens) : track};\n}\n.kolibri-loading-spinner__indicator {\n  stroke: ${indicator.startsWith('#') || indicator.startsWith('rgba') ? resolveColorValue(indicator, tokens) : indicator};\n  stroke-dasharray: 25 75;\n  stroke-linecap: round;\n}\n.kolibri-loading-spinner--prop-size-lg .kolibri-loading-spinner__track,\n.kolibri-loading-spinner--prop-size-lg .kolibri-loading-spinner__indicator {\n  stroke-width: 3;\n}\n@keyframes kolibri-spinner-rotate {\n  to { transform: rotate(360deg); }\n}\n@media (prefers-reduced-motion: reduce) {\n  .kolibri-loading-spinner__svg { animation-duration: 1600ms; }\n}`,
    );
  }
  if (name === 'radio-group') {
    const dotColor =
      findVisualStyle(defaultVariant?.visual ?? component.visual, 'dot')
        ?.background ?? 'currentColor';
    rules.push(
      `.kolibri-radio-group {\n  display: flex;\n}\n.kolibri-radio-group__option {\n  position: relative;\n  cursor: pointer;\n}\n.kolibri-radio-group__input {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  margin: -1px;\n  padding: 0;\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n  white-space: nowrap;\n  border: 0;\n}\n.kolibri-radio-group__control {\n  position: relative;\n  display: block;\n  flex: none;\n}\n.kolibri-radio-group__ring {\n  position: absolute;\n  inset: 0;\n  border-radius: 50%;\n}\n.kolibri-radio-group__dot {\n  position: absolute;\n  inset: 5px;\n  border-radius: 50%;\n  background: ${dotColor.startsWith('#') ? resolveColorValue(dotColor, tokens) : dotColor};\n  opacity: 0;\n}\n.kolibri-radio-group__input:checked + .kolibri-radio-group__control .kolibri-radio-group__dot {\n  opacity: 1;\n}\n.kolibri-radio-group__input:focus-visible + .kolibri-radio-group__control {\n  outline: 2px solid currentColor;\n  outline-offset: 2px;\n  border-radius: 50%;\n}\n.kolibri-radio-group__option:has(input:disabled) {\n  cursor: not-allowed;\n  opacity: 0.5;\n}`,
    );
  }
  if (name === 'slider') {
    const trackBackground =
      findVisualStyle(component.visual, 'track-bg')?.background ?? '#d4d4d4';
    const trackFill =
      findVisualStyle(component.visual, 'track-fill')?.background ??
      'currentColor';
    const thumb = findVisualStyle(component.visual, 'thumb');
    const thumbBackground = thumb?.background ?? '#ffffff';
    const thumbBorder = thumb?.borderColor ?? trackFill;
    const thumbShadow = thumb?.boxShadow ?? '0 1px 3px rgba(0, 0, 0, 0.1)';
    const color = (value: string) =>
      value.startsWith('#') ? resolveColorValue(value, tokens) : value;
    rules.push(
      `.kolibri-slider__input {\n  width: 100%;\n  height: 20px;\n  margin: 0;\n  padding: 0;\n  appearance: none;\n  background: linear-gradient(to right, ${color(trackFill)} 0 var(--kolibri-slider-progress), ${color(trackBackground)} var(--kolibri-slider-progress) 100%) center / 100% 8px no-repeat;\n  cursor: pointer;\n}\n.kolibri-slider__input::-webkit-slider-runnable-track {\n  height: 8px;\n  background: transparent;\n  border-radius: 4px;\n}\n.kolibri-slider__input::-webkit-slider-thumb {\n  width: 20px;\n  height: 20px;\n  margin-top: -6px;\n  appearance: none;\n  border: 2px solid ${color(thumbBorder)};\n  border-radius: 50%;\n  background: ${color(thumbBackground)};\n  box-shadow: ${thumbShadow};\n}\n.kolibri-slider__input::-moz-range-track {\n  height: 8px;\n  border: 0;\n  border-radius: 4px;\n  background: ${color(trackBackground)};\n}\n.kolibri-slider__input::-moz-range-progress {\n  height: 8px;\n  border-radius: 4px;\n  background: ${color(trackFill)};\n}\n.kolibri-slider__input::-moz-range-thumb {\n  width: 16px;\n  height: 16px;\n  border: 2px solid ${color(thumbBorder)};\n  border-radius: 50%;\n  background: ${color(thumbBackground)};\n  box-shadow: ${thumbShadow};\n}\n.kolibri-slider__input:focus-visible {\n  outline: 2px solid ${color(thumbBorder)};\n  outline-offset: 2px;\n}\n.kolibri-slider__input:disabled {\n  cursor: not-allowed;\n  opacity: 0.5;\n}`,
    );
  }
  if (name === 'switch') {
    const offVariant =
      component.variants.find((variant) => variant.axes.state === 'off') ??
      component.variants[0];
    const onVariant =
      component.variants.find((variant) => variant.axes.state === 'on') ??
      component.variants[1];
    const offTrack = findVisualStyle(
      offVariant?.visual ?? component.visual,
      'track',
    );
    const onTrack = findVisualStyle(
      onVariant?.visual ?? component.visual,
      'track',
    );
    const thumb = findVisualStyle(
      offVariant?.visual ?? component.visual,
      'thumb',
    );
    const label = findVisualStyle(
      offVariant?.visual ?? component.visual,
      'label',
    );
    const color = (value: string) =>
      value.startsWith('#') ? resolveColorValue(value, tokens) : value;
    const offBackground = color(
      offTrack?.background ?? 'rgba(230, 213, 184, 0.3)',
    );
    const onBackground = color(onTrack?.background ?? '#2c5784');
    const thumbBackground = color(thumb?.background ?? '#ffffff');
    const thumbShadow = thumb?.boxShadow ?? '0 1px 3px rgba(0, 0, 0, 0.1)';
    const labelColor = color(label?.color ?? '#2d2d2d');
    rules.push(
      `.kolibri-switch {\n  position: relative;\n  display: inline-flex;\n  flex-direction: row;\n  align-items: center;\n  width: fit-content;\n  height: 24px;\n  gap: 12px;\n  cursor: pointer;\n}\n.kolibri-switch__input {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  margin: -1px;\n  padding: 0;\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n  white-space: nowrap;\n  border: 0;\n}\n.kolibri-switch__track {\n  position: relative;\n  display: block;\n  flex: none;\n  width: 44px;\n  height: 24px;\n  overflow: hidden;\n  border-radius: 12px;\n  background: ${offBackground};\n  transition: background-color 160ms ease;\n}\n.kolibri-switch__thumb {\n  position: absolute;\n  top: 2px;\n  left: 2px;\n  display: block;\n  width: 20px;\n  height: 20px;\n  border-radius: 50%;\n  background: ${thumbBackground};\n  box-shadow: ${thumbShadow};\n  transition: transform 160ms ease;\n}\n.kolibri-switch__label {\n  color: ${labelColor};\n  font-family: ${fontFamilyValue(label?.fontFamily ?? 'Encode Sans', fontSources)};\n  font-size: ${formatNumber(label?.fontSize ?? 14)}px;\n  font-weight: ${label?.fontWeight ?? 500};\n  line-height: ${formatNumber(label?.lineHeight ?? 17.5)}px;\n}\n.kolibri-switch--state-on .kolibri-switch__track {\n  background: ${onBackground};\n}\n.kolibri-switch--state-on .kolibri-switch__thumb {\n  transform: translateX(20px);\n}\n.kolibri-switch:has(.kolibri-switch__input:focus-visible) .kolibri-switch__track {\n  outline: 2px solid ${onBackground};\n  outline-offset: 2px;\n}\n.kolibri-switch:has(.kolibri-switch__input:disabled) {\n  cursor: not-allowed;\n  opacity: 0.5;\n}`,
    );
  }
  return rules;
}
