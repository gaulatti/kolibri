import type { ImportedComponent } from '../../figma-importer/figma-importer.types';
import {
  attr,
  bool,
  componentImageReference,
  esc,
  findInstance,
  firstVisualText,
  genericVariantClass,
  instanceClass,
  instanceText,
  instanceValue,
  isVoidElement,
  jsx,
  lucideIconComponent,
  pascal,
  renderVisualNodes,
  slug,
  str,
  uniqueVisualTexts,
  value,
  variantAxesForComponent,
  variantDefault,
  variantUnion,
  visualClass,
  visualGroupClass,
  visualText,
} from './react-renderer.utils';

export class ReactComponentGenerator {
  generate(component: ImportedComponent): string {
    const handlers: Record<string, () => string> = {
      button: () => this.button(component),
      heading: () => this.heading(component),
      paragraph: () => this.paragraph(component),
      image: () => this.image(component),
      link: () => this.link(component),
      'text-input': () => this.textInput(component),
      textarea: () => this.textarea(component),
      badge: () => this.badge(component),
      divider: () => this.divider(component),
      icon: () => this.icon(component),
      checkbox: () => this.checkbox(component),
      'loading-spinner': () => this.loadingSpinner(component),
      'radio-group': () => this.radioGroup(component),
      slider: () => this.slider(component),
      switch: () => this.switchControl(component),
      select: () => this.select(component),
      avatar: () => this.avatar(component),
      hero: () => this.hero(component),
      'form-field': () => this.formField(component),
      alert: () => this.alert(component),
      card: () => this.card(component),
      'navigation-item': () => this.navigationItem(component),
      'page-header': () => this.pageHeader(component),
      'profile-summary': () => this.profileSummary(component),
      tooltip: () => this.tooltip(component),
      'site-header': () => this.siteHeader(component),
      'signup-form': () => this.signupForm(component),
      'card-grid': () => this.cardGrid(component),
    };
    return handlers[component.name]?.() ?? this.generic(component);
  }

  private button(c: ImportedComponent): string {
    const text = str(
      c,
      'label',
      str(c, 'content.text', c.defaultText ?? 'Button'),
    );
    return `import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export type ButtonProps = PropsWithChildren<Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>> & {
  variant?: ${variantUnion(c, 'variant')};
  type?: 'button' | 'submit' | 'reset';
};

export function Button({ variant = '${variantDefault(c, 'variant', 'primary')}', type = '${str(c, 'prop.type', 'button')}', children = '${esc(text)}', className, ...props }: ButtonProps) {
  const variantClass = variant === 'primary' ? '' : \` kolibri-button--variant-\${variant}\`;
  return <button type={type} className={\`kolibri-button\${variantClass}\${className ? ' ' + className : ''}\`} {...props}>{children}</button>;
}
`;
  }

  private heading(c: ImportedComponent): string {
    return `import type { HTMLAttributes, PropsWithChildren } from 'react';

export type HeadingProps = PropsWithChildren<HTMLAttributes<HTMLHeadingElement>> & { level?: 1 | 2 | 3 | 4 | 5 | 6 };

export function Heading({ level = ${Number(str(c, 'accessibility.level', '1'))}, children = '${esc(str(c, 'content.text', c.defaultText ?? 'Heading'))}', className, ...props }: HeadingProps) {
  const Tag = \`h\${level}\` as 'h1';
  return <Tag className={\`kolibri-heading\${className ? ' ' + className : ''}\`} {...props}>{children}</Tag>;
}
`;
  }

  private paragraph(c: ImportedComponent): string {
    return `import type { HTMLAttributes, PropsWithChildren } from 'react';

export type ParagraphProps = PropsWithChildren<HTMLAttributes<HTMLParagraphElement>>;
export function Paragraph({ children = '${esc(str(c, 'content.text', c.defaultText ?? 'Paragraph'))}', className, ...props }: ParagraphProps) {
  return <p className={\`kolibri-paragraph\${className ? ' ' + className : ''}\`} {...props}>{children}</p>;
}
`;
  }

  private image(c: ImportedComponent): string {
    const imageReference = componentImageReference(c);
    const defaultSource = imageReference
      ? `new URL('../assets/figma-${imageReference}.png', import.meta.url).href`
      : `'${esc(str(c, 'prop.src', ''))}'`;
    return `import type { ImgHTMLAttributes } from 'react';
export type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt'> & { alt?: string; decorative?: boolean; objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down' };
const defaultSource = ${defaultSource};
export function Image({ src = defaultSource, alt = '${esc(str(c, 'prop.alt', 'Image description'))}', loading = '${esc(str(c, 'prop.loading', 'lazy'))}' as 'lazy', objectFit = '${esc(str(c, 'prop.objectFit', 'cover'))}', decorative = ${bool(c, 'accessibility.decorative', false)}, className, style, ...props }: ImageProps) {
  return <img className={\`kolibri-image\${className ? ' ' + className : ''}\`} src={src} alt={decorative ? '' : alt} loading={loading} aria-hidden={decorative || undefined} style={{ ...style, objectFit }} {...props} />;
}
`;
  }

  private link(c: ImportedComponent): string {
    return `import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';
export type LinkProps = PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>> & { variant?: ${variantUnion(c, 'variant')}; external?: boolean; current?: boolean };
export function Link({ variant = '${variantDefault(c, 'variant', 'default')}', href = '${esc(str(c, 'prop.href', '/'))}', target = '${esc(str(c, 'prop.target', '_self'))}', rel, external = ${bool(c, 'accessibility.external', false)}, current = ${bool(c, 'accessibility.current', false)}, children = '${esc(str(c, 'content.text', 'Learn more'))}', className, ...props }: LinkProps) {
  const safeRel = rel ?? (external || target === '_blank' ? 'noopener noreferrer' : undefined);
  return <a className={\`kolibri-link kolibri-link--variant-\${variant}\${className ? ' ' + className : ''}\`} href={href} target={target} rel={safeRel} aria-current={current ? 'page' : undefined} {...props}>{children}</a>;
}
`;
  }

  private textInput(c: ImportedComponent): string {
    return `import type { InputHTMLAttributes } from 'react';
export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { state?: ${variantUnion(c, 'state')}; type?: string; invalid?: boolean; descriptionId?: string };
export function TextInput({ state = '${variantDefault(c, 'state', 'default')}', type = '${esc(str(c, 'prop.type', 'text'))}', name = '${esc(str(c, 'prop.name', 'field'))}', placeholder = '${esc(str(c, 'prop.placeholder', 'Enter a value'))}', required = ${bool(c, 'prop.required', false)}, disabled = ${bool(c, 'prop.disabled', false)}, invalid = ${bool(c, 'accessibility.invalid', false)}, descriptionId, className, ...props }: TextInputProps) {
  return <input className={\`kolibri-text-input kolibri-text-input--state-\${state}\${className ? ' ' + className : ''}\`} type={type} name={name} placeholder={placeholder} required={required} disabled={disabled || state === 'disabled'} aria-invalid={invalid || state === 'error' || undefined} aria-describedby={descriptionId} {...props} />;
}
`;
  }

  private textarea(c: ImportedComponent): string {
    return `import type { TextareaHTMLAttributes } from 'react';
export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { state?: ${variantUnion(c, 'state')}; invalid?: boolean; descriptionId?: string };
export function Textarea({ state = '${variantDefault(c, 'state', 'default')}', name = '${esc(str(c, 'prop.name', ''))}', placeholder = '${esc(str(c, 'prop.placeholder', c.defaultText ?? 'Enter your message...'))}', rows = ${Number(str(c, 'prop.rows', '4'))}, required = ${bool(c, 'prop.required', false)}, disabled = ${bool(c, 'prop.disabled', false)}, invalid = ${bool(c, 'accessibility.invalid', false)}, descriptionId, className, ...props }: TextareaProps) {
  return <textarea className={\`kolibri-textarea kolibri-textarea--state-\${state}\${className ? ' ' + className : ''}\`} name={name || undefined} placeholder={placeholder} rows={rows} required={required} disabled={disabled || state === 'disabled'} aria-invalid={invalid || state === 'error' || undefined} aria-describedby={descriptionId} {...props} />;
}
`;
  }

  private badge(c: ImportedComponent): string {
    return `import type { HTMLAttributes, PropsWithChildren } from 'react';
export type BadgeProps = PropsWithChildren<HTMLAttributes<HTMLSpanElement>> & { tone?: ${variantUnion(c, 'tone')} };
export function Badge({ tone = '${variantDefault(c, 'tone', 'neutral')}', children = '${esc(str(c, 'content.text', 'Badge'))}', className, ...props }: BadgeProps) {
  return <span role="status" className={\`kolibri-badge kolibri-badge--tone-\${tone}\${className ? ' ' + className : ''}\`} {...props}>{children}</span>;
}
`;
  }

  private divider(c: ImportedComponent): string {
    return `import type { HTMLAttributes } from 'react';
export type DividerProps = HTMLAttributes<HTMLHRElement> & { orientation?: 'horizontal' | 'vertical'; decorative?: boolean };
export function Divider({ orientation = '${esc(str(c, 'accessibility.orientation', 'horizontal'))}', decorative = ${bool(c, 'accessibility.decorative', false)}, className, ...props }: DividerProps) {
  return <hr className={\`kolibri-divider\${className ? ' ' + className : ''}\`} role={decorative ? 'presentation' : 'separator'} aria-orientation={decorative ? undefined : orientation} {...props} />;
}
`;
  }

  private icon(c: ImportedComponent): string {
    const iconMap = c.variants
      .map((variant) => {
        const name = variant.axes.icon ?? variant.name;
        return `  '${esc(name)}': ${lucideIconComponent(name)},`;
      })
      .join('\n');
    return `import { ArrowRight, Check, Circle, Menu, TriangleAlert, X } from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';
export type IconName = ${variantUnion(c, 'icon')};
export type IconProps = Omit<LucideProps, 'size'> & { name?: IconName; size?: number; title?: string; decorative?: boolean };
const icons = {
${iconMap}
} satisfies Record<IconName, LucideIcon>;
export function Icon({ name = '${variantDefault(c, 'icon', 'arrow-right')}', size = ${Number(str(c, 'prop.size', '24'))}, title = '${esc(str(c, 'prop.title', ''))}', decorative = ${bool(c, 'accessibility.decorative', true)}, className, ...props }: IconProps) {
  const Glyph = icons[name] ?? Circle;
  return <Glyph {...props} className={\`kolibri-icon kolibri-icon--icon-\${name}\${className ? ' ' + className : ''}\`} size={size} role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : props['aria-label'] ?? title ?? name} />;
}
`;
  }

  private checkbox(c: ImportedComponent): string {
    return `import { useEffect, useRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { state?: ${variantUnion(c, 'state')}; indeterminate?: boolean; label?: string };
export function Checkbox({ state = '${variantDefault(c, 'state', 'unchecked')}', indeterminate = ${bool(c, 'prop.indeterminate', false)}, checked, disabled, label = '${esc(str(c, 'accessibility.label', 'Checkbox'))}', className, ...props }: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mixed = indeterminate || state === 'indeterminate';
  useEffect(() => { if (inputRef.current) inputRef.current.indeterminate = mixed; }, [mixed]);
  return <label className={\`kolibri-checkbox kolibri-checkbox--state-\${state}\${className ? ' ' + className : ''}\`}><input ref={inputRef} type="checkbox" checked={checked ?? state === 'checked'} disabled={disabled || state === 'disabled'} aria-checked={mixed ? 'mixed' : undefined} aria-label={label} {...props} />{state === 'checked' ? <Check className="kolibri-checkbox__icon" size={14} aria-hidden="true" /> : null}{mixed ? <span className="kolibri-checkbox__indeterminate" aria-hidden="true" /> : null}</label>;
}
`;
  }

  private loadingSpinner(c: ImportedComponent): string {
    return `import type { HTMLAttributes } from 'react';
export type LoadingSpinnerProps = HTMLAttributes<HTMLSpanElement> & { size?: ${variantUnion(c, 'prop.size')} ; label?: string };
const sizes = { sm: 16, md: 32, lg: 48 } as const;
export function LoadingSpinner({ size = '${variantDefault(c, 'prop.size', 'sm')}', label = 'Loading', className, ...props }: LoadingSpinnerProps) {
  const pixels = sizes[size];
  return <span className={\`kolibri-loading-spinner kolibri-loading-spinner--prop-size-\${size}\${className ? ' ' + className : ''}\`} role="status" aria-label={label} {...props}><svg className="kolibri-loading-spinner__svg" width={pixels} height={pixels} viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="kolibri-loading-spinner__track" cx="12" cy="12" r="10" /><circle className="kolibri-loading-spinner__indicator" cx="12" cy="12" r="10" pathLength="100" /></svg></span>;
}
`;
  }

  private radioGroup(c: ImportedComponent): string {
    const labels = uniqueVisualTexts(c.variants[0]?.visual ?? c.visual);
    const options = (labels.length ? labels : ['Option A', 'Option B']).map(
      (label) => ({ value: slug(label), label }),
    );
    return `import { useId } from 'react';
import type { HTMLAttributes } from 'react';
export type RadioOption = { value: string; label: string };
export type RadioGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & { orientation?: ${variantUnion(c, 'prop.orientation')}; name?: string; value?: string; defaultValue?: string; options?: RadioOption[]; disabled?: boolean; onChange?: (value: string) => void };
const defaultOptions: RadioOption[] = ${JSON.stringify(options)};
export function RadioGroup({ orientation = '${variantDefault(c, 'prop.orientation', 'vertical')}', name, value, defaultValue = defaultOptions[0]?.value, options = defaultOptions, disabled = ${bool(c, 'prop.disabled', false)}, onChange, className, ...props }: RadioGroupProps) {
  const generatedName = useId();
  const groupName = name ?? generatedName;
  return <div className={\`kolibri-radio-group kolibri-radio-group--prop-orientation-\${orientation}\${className ? ' ' + className : ''}\`} role="radiogroup" aria-label={props['aria-label']} {...props}>{options.map((option, index) => <label className={\`kolibri-radio-group__option kolibri-radio-group__node-\${index}\`} key={option.value}><input className="kolibri-radio-group__input" type="radio" name={groupName} value={option.value} checked={value === undefined ? undefined : value === option.value} defaultChecked={value === undefined ? defaultValue === option.value : undefined} disabled={disabled} onChange={() => onChange?.(option.value)} /><span className={\`kolibri-radio-group__control kolibri-radio-group__node-\${index}-0\`} aria-hidden="true"><span className={\`kolibri-radio-group__ring kolibri-radio-group__node-\${index}-0-0\`} /><span className="kolibri-radio-group__dot" /></span><span className={\`kolibri-radio-group__node-\${index}-1\`}>{option.label}</span></label>)}</div>;
}
`;
  }

  private slider(c: ImportedComponent): string {
    const minimum = Number(str(c, 'prop.min', '0'));
    const maximum = Number(str(c, 'prop.max', '100'));
    const defaultValue = Number(str(c, 'prop.value', '50'));
    return `import { useState } from 'react';
import type { ChangeEvent, CSSProperties, InputHTMLAttributes } from 'react';
export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'> & { label?: string; value?: number; defaultValue?: number; showValue?: boolean; onChange?: (value: number) => void };
export function Slider({ label = '${esc(str(c, 'content.label', 'Value'))}', min = ${minimum}, max = ${maximum}, step = ${Number(str(c, 'prop.step', '1'))}, value, defaultValue = ${defaultValue}, showValue = true, disabled = ${bool(c, 'prop.disabled', false)}, onChange, className, style, ...props }: SliderProps) {
  const [internalValue, setInternalValue] = useState(Number(defaultValue));
  const currentValue = value ?? internalValue;
  const percentage = Number(max) === Number(min) ? 0 : ((currentValue - Number(min)) / (Number(max) - Number(min))) * 100;
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => { const next = Number(event.target.value); if (value === undefined) setInternalValue(next); onChange?.(next); };
  return <label className={\`kolibri-slider\${className ? ' ' + className : ''}\`}><span className="kolibri-slider__node-0"><span className="kolibri-slider__node-0-0">{label}</span>{showValue ? <output className="kolibri-slider__node-0-1">{currentValue}</output> : null}</span><input className="kolibri-slider__input" type="range" min={min} max={max} step={step} value={currentValue} disabled={disabled} aria-label={props['aria-label'] ?? label} onChange={handleChange} style={{ ...style, '--kolibri-slider-progress': \`\${Math.max(0, Math.min(100, percentage))}%\` } as CSSProperties} {...props} /></label>;
}
`;
  }

  private switchControl(c: ImportedComponent): string {
    return `import { useEffect, useState } from 'react';
import type { ChangeEvent, InputHTMLAttributes } from 'react';
export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { state?: ${variantUnion(c, 'state')}; label?: string };
export function Switch({ state = '${variantDefault(c, 'state', 'off')}', label = '${esc(str(c, 'content.label', 'Label'))}', checked, defaultChecked = state === 'on', disabled = ${bool(c, 'prop.disabled', false)}, onChange, className, ...props }: SwitchProps) {
  const [internalChecked, setInternalChecked] = useState(Boolean(defaultChecked));
  useEffect(() => { if (checked === undefined) setInternalChecked(state === 'on'); }, [state, checked]);
  const currentChecked = checked ?? internalChecked;
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => { if (checked === undefined) setInternalChecked(event.target.checked); onChange?.(event); };
  return <label className={\`kolibri-switch kolibri-switch--state-\${currentChecked ? 'on' : 'off'}\${className ? ' ' + className : ''}\`}><input className="kolibri-switch__input" type="checkbox" role="switch" checked={currentChecked} disabled={disabled} aria-label={props['aria-label'] ?? label} onChange={handleChange} {...props} /><span className="kolibri-switch__track" aria-hidden="true"><span className="kolibri-switch__thumb" /></span><span className="kolibri-switch__label">{label}</span></label>;
}
`;
  }

  private select(c: ImportedComponent): string {
    const options = str(
      c,
      'content.options',
      'First option|Second option|Third option',
    ).split('|');
    return `import type { SelectHTMLAttributes } from 'react';
export type SelectOption = { value: string; label: string };
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { state?: ${variantUnion(c, 'state')}; invalid?: boolean; options?: SelectOption[] };
const defaultOptions: SelectOption[] = ${JSON.stringify(options.map((label) => ({ value: slug(label), label })))};
export function Select({ state = '${variantDefault(c, 'state', 'default')}', name = '${esc(str(c, 'prop.name', 'selection'))}', required = ${bool(c, 'prop.required', false)}, disabled = ${bool(c, 'prop.disabled', false)}, invalid = ${bool(c, 'accessibility.invalid', false)}, options = defaultOptions, className, ...props }: SelectProps) {
  return <select className={\`kolibri-select kolibri-select--state-\${state}\${className ? ' ' + className : ''}\`} name={name} required={required} disabled={disabled || state === 'disabled'} aria-invalid={invalid || state === 'error' || undefined} {...props}><option value="">${jsx(str(c, 'content.placeholder', 'Choose an option'))}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}
`;
  }

  private avatar(c: ImportedComponent): string {
    const imageReference = componentImageReference(c);
    const defaultSource = imageReference
      ? `new URL('../assets/figma-${imageReference}.png', import.meta.url).href`
      : `''`;
    return `export type AvatarProps = { content?: ${variantUnion(c, 'content')}; src?: string; alt?: string; initials?: string; decorative?: boolean; className?: string };
const defaultSource = ${defaultSource};
export function Avatar({ content = '${variantDefault(c, 'content', 'image')}', src = defaultSource, alt = '${esc(str(c, 'prop.alt', 'User profile photo'))}', initials = '${esc(str(c, 'content.initials', 'KM'))}', decorative = ${bool(c, 'accessibility.decorative', false)}, className }: AvatarProps) {
  const classes = \`kolibri-avatar kolibri-avatar--content-\${content}\${className ? ' ' + className : ''}\`;
  return content === 'image' ? <img className={classes} src={src} alt={decorative ? '' : alt} aria-hidden={decorative || undefined} /> : <span className={classes} aria-label={decorative ? undefined : alt}>{initials}</span>;
}
`;
  }

  private hero(c: ImportedComponent): string {
    return this.composedSection(
      c,
      'Hero',
      [
        `      <Image className="${instanceClass(c, 'image')}" alt="${attr(instanceValue(c, 'image', 'prop.alt', str(c, 'image.alt', 'Hero image')))}" />`,
        `      <Heading className="${instanceClass(c, 'heading')}">${jsx(instanceText(c, 'heading', str(c, 'content.heading', 'Welcome to Kolibri')))}</Heading>`,
        `      <Paragraph className="${instanceClass(c, 'paragraph')}">${jsx(instanceText(c, 'paragraph', str(c, 'content.paragraph', 'Paragraph')))}</Paragraph>`,
        `      <Button className="${instanceClass(c, 'button')}">${jsx(instanceText(c, 'button', str(c, 'content.button', 'Get Started')))}</Button>`,
      ],
      [
        "import { Button } from './Button';",
        "import { Heading } from './Heading';",
        "import { Image } from './Image';",
        "import { Paragraph } from './Paragraph';",
      ],
    );
  }

  private formField(c: ImportedComponent): string {
    return `import { useId } from 'react';
import { Paragraph } from './Paragraph';
import { TextInput } from './TextInput';
export type FormFieldProps = { label?: string; helper?: string; error?: string; name?: string; required?: boolean; disabled?: boolean; invalid?: boolean; placeholder?: string; className?: string };
export function FormField({ label = '${esc(str(c, 'content.label', 'Field'))}', helper = '${esc(str(c, 'content.helper', ''))}', error = '${esc(str(c, 'content.error', ''))}', name = '${esc(str(c, 'prop.name', 'field'))}', required = ${bool(c, 'prop.required', false)}, disabled = ${bool(c, 'prop.disabled', false)}, invalid = ${bool(c, 'accessibility.invalid', false)}, placeholder, className }: FormFieldProps) {
  const id = useId(); const descriptionId = \`\${id}-description\`;
  return <div className={\`kolibri-form-field\${className ? ' ' + className : ''}\`}><label className="${instanceClass(c, 'paragraph')}" htmlFor={id}>{label}</label><TextInput className="${instanceClass(c, 'text-input')}" id={id} name={name} required={required} disabled={disabled} invalid={invalid} state={invalid ? 'error' : 'default'} placeholder={placeholder} descriptionId={descriptionId} /><Paragraph className="${instanceClass(c, 'paragraph', 2)}" id={descriptionId}>{invalid ? error : helper}</Paragraph></div>;
}
`;
  }

  private alert(c: ImportedComponent): string {
    return `import type { PropsWithChildren } from 'react';
import { Button } from './Button'; import { Heading } from './Heading'; import { Paragraph } from './Paragraph';
export type AlertProps = PropsWithChildren<{ tone?: ${variantUnion(c, 'tone')}; heading?: string; action?: string; live?: 'off' | 'polite' | 'assertive'; dismissible?: boolean; onDismiss?: () => void; className?: string }>;
export function Alert({ tone = '${variantDefault(c, 'tone', 'info')}', heading = '${esc(str(c, 'content.heading', 'Important update'))}', children = '${esc(str(c, 'content.message', 'Something requires your attention.'))}', action = '${esc(str(c, 'content.action', 'Review'))}', live = '${esc(str(c, 'accessibility.live', 'polite'))}', dismissible = ${bool(c, 'accessibility.dismissible', false)}, onDismiss, className }: AlertProps) {
  return <aside className={\`kolibri-alert kolibri-alert--tone-\${tone}\${className ? ' ' + className : ''}\`} role="alert" aria-live={live}><Heading className="${instanceClass(c, 'heading')}" level={2}>{heading}</Heading><Paragraph className="${instanceClass(c, 'paragraph')}">{children}</Paragraph>{action ? <Button className="${instanceClass(c, 'button')}" variant="secondary">{action}</Button> : null}{dismissible ? <Button className="kolibri-alert__dismiss" aria-label="Dismiss alert" onClick={onDismiss}>×</Button> : null}</aside>;
}
`;
  }

  private card(c: ImportedComponent): string {
    return `import { Heading } from './Heading'; import { Image } from './Image'; import { Link } from './Link'; import { Paragraph } from './Paragraph';
export type CardProps = { heading?: string; paragraph?: string; linkText?: string; href?: string; imageSrc?: string; imageAlt?: string; className?: string; imageClassName?: string; headingClassName?: string; paragraphClassName?: string; linkClassName?: string };
export function Card({ heading = '${esc(str(c, 'content.heading', 'Card'))}', paragraph = '${esc(str(c, 'content.paragraph', ''))}', linkText = '${esc(str(c, 'content.link', 'Learn more'))}', href = '${esc(str(c, 'link.href', '/'))}', imageSrc, imageAlt = '${esc(str(c, 'image.alt', 'Card image'))}', className, imageClassName, headingClassName, paragraphClassName, linkClassName }: CardProps) {
  return <article className={\`kolibri-card\${className ? ' ' + className : ''}\`}><Image className={\`${instanceClass(c, 'image')}\${imageClassName ? ' ' + imageClassName : ''}\`} src={imageSrc} alt={imageAlt} /><Heading className={\`${instanceClass(c, 'heading')}\${headingClassName ? ' ' + headingClassName : ''}\`} level={2}>{heading}</Heading><Paragraph className={\`${instanceClass(c, 'paragraph')}\${paragraphClassName ? ' ' + paragraphClassName : ''}\`}>{paragraph}</Paragraph><Link className={\`${instanceClass(c, 'link')}\${linkClassName ? ' ' + linkClassName : ''}\`} href={href}>{linkText}</Link></article>;
}
`;
  }

  private navigationItem(c: ImportedComponent): string {
    return `import { Icon } from './Icon'; import type { IconName } from './Icon'; import { Link } from './Link';
export type NavigationItemProps = { state?: ${variantUnion(c, 'state')}; label?: string; href?: string; icon?: IconName; disabled?: boolean; current?: boolean; className?: string };
export function NavigationItem({ state = '${variantDefault(c, 'state', 'default')}', label = '${esc(str(c, 'content.label', 'Navigation item'))}', href = '${esc(str(c, 'prop.href', '/'))}', icon = '${esc(str(c, 'icon.name', 'arrow-right'))}' as IconName, disabled = ${bool(c, 'prop.disabled', false)}, current = ${bool(c, 'accessibility.current', false)}, className }: NavigationItemProps) {
  return <li className={\`kolibri-navigation-item kolibri-navigation-item--state-\${state}\${className ? ' ' + className : ''}\`} aria-disabled={disabled || state === 'disabled' || undefined}><Icon className="${instanceClass(c, 'icon')}" name={icon} decorative /><Link className="${instanceClass(c, 'link')}" href={disabled ? undefined : href} current={current || state === 'active'}>{label}</Link></li>;
}
`;
  }

  private profileSummary(c: ImportedComponent): string {
    const contentClass = visualGroupClass(
      c,
      ['heading', 'paragraph'],
      'content',
    );
    return `import { Avatar } from './Avatar'; import { Badge } from './Badge'; import { Heading } from './Heading'; import { Paragraph } from './Paragraph';
export function ProfileSummary() { return <section className="kolibri-profile-summary" aria-label="${attr(str(c, 'accessibility.label', 'User profile summary'))}"><Avatar className="${instanceClass(c, 'avatar')}" alt="${attr(str(c, 'image.alt', 'Profile photo'))}" /><div className="${contentClass}"><Heading className="${instanceClass(c, 'heading')}" level={2}>${jsx(str(c, 'content.name', 'Name'))}</Heading><Paragraph className="${instanceClass(c, 'paragraph')}">${jsx(str(c, 'content.description', ''))}</Paragraph></div><Badge className="${instanceClass(c, 'badge')}">${jsx(str(c, 'content.status', 'Active'))}</Badge></section>; }
`;
  }

  private pageHeader(c: ImportedComponent): string {
    const visual = c.variants[0]?.visual ?? c.visual;
    const breadcrumbNodes = visual[0]?.children ?? [];
    const breadcrumbs = breadcrumbNodes
      .map((node) => firstVisualText(node))
      .filter((text): text is string => Boolean(text && text !== '/'));
    const main = visual[1];
    const summary = main?.children[1];
    const actions = main?.children[2]?.children ?? [];
    const heading = str(
      c,
      'content.heading',
      firstVisualText(summary?.children[0]) ?? 'Page title',
    );
    const description = str(
      c,
      'content.description',
      firstVisualText(summary?.children[1]) ?? '',
    );
    const secondaryAction = str(
      c,
      'content.secondaryAction',
      firstVisualText(actions[0]) ?? 'Edit',
    );
    const primaryAction = str(
      c,
      'content.primaryAction',
      firstVisualText(actions[1]) ?? 'Save Changes',
    );
    const breadcrumbData = breadcrumbs.map((label, index) => ({
      label,
      href: index === breadcrumbs.length - 1 ? undefined : '#',
    }));
    return `import { ChevronLeft } from 'lucide-react'; import { Button } from './Button'; import { Heading } from './Heading'; import { Link } from './Link'; import { Paragraph } from './Paragraph';
const breadcrumbs = ${JSON.stringify(breadcrumbData)};
export type PageHeaderProps = { onBack?: () => void; onSecondaryAction?: () => void; onPrimaryAction?: () => void; className?: string };
export function PageHeader({ onBack, onSecondaryAction, onPrimaryAction, className }: PageHeaderProps) { return <header className={\`kolibri-page-header\${className ? ' ' + className : ''}\`}><nav className="kolibri-page-header__breadcrumbs" aria-label="Breadcrumb"><ol>{breadcrumbs.map((item, index) => <li key={item.label}>{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}{index < breadcrumbs.length - 1 ? <span className="kolibri-page-header__separator" aria-hidden="true">/</span> : null}</li>)}</ol></nav><div className="kolibri-page-header__main"><Button className="kolibri-page-header__back" variant="secondary" aria-label="Back" onClick={onBack}><ChevronLeft aria-hidden="true" size={18} /></Button><div className="kolibri-page-header__summary"><Heading level={1}>${jsx(heading)}</Heading><Paragraph>${jsx(description)}</Paragraph></div><div className="kolibri-page-header__actions"><Button className="kolibri-page-header__action" variant="secondary" onClick={onSecondaryAction}>${jsx(secondaryAction)}</Button><Button className="kolibri-page-header__action" onClick={onPrimaryAction}>${jsx(primaryAction)}</Button></div></div></header>; }
`;
  }

  private tooltip(c: ImportedComponent): string {
    const visual = c.variants[0]?.visual ?? c.visual;
    const text = str(
      c,
      'content.tooltip',
      firstVisualText(visual[0]) ?? 'Tooltip text',
    );
    const trigger = str(
      c,
      'content.trigger',
      firstVisualText(visual[1]) ?? 'Hover me',
    );
    return `import { useId } from 'react'; import type { HTMLAttributes, PropsWithChildren } from 'react';
export type TooltipProps = PropsWithChildren<Omit<HTMLAttributes<HTMLSpanElement>, 'content'>> & { side?: ${variantUnion(c, 'prop.side')}; text?: string };
export function Tooltip({ children = '${esc(trigger)}', text = '${esc(text)}', side = '${variantDefault(c, 'prop.side', 'top')}', className, ...props }: TooltipProps) { const tooltipId = useId(); return <span className={\`kolibri-tooltip kolibri-tooltip--prop-side-\${side}\${className ? ' ' + className : ''}\`} {...props}><span className="kolibri-tooltip__bubble" id={tooltipId} role="tooltip">{text}</span><span className="kolibri-tooltip__trigger" aria-describedby={tooltipId}>{children}</span></span>; }
`;
  }

  private siteHeader(c: ImportedComponent): string {
    const composedNavigation = c.composition.filter((instance) =>
      instance.name.toLowerCase().includes('navigation-item'),
    );
    const labels = str(c, 'content.navigation', 'Home').split('|');
    const hrefs = str(c, 'navigation.hrefs', '/').split('|');
    const items = composedNavigation.length
      ? composedNavigation.map((instance, index) => {
          const label = value(
            instance,
            'content.label',
            instance.textOverride ?? labels[index] ?? 'Navigation item',
          );
          const href = value(instance, 'prop.href', hrefs[index] ?? '#');
          return `{ label: '${esc(label)}', href: '${esc(href)}' }`;
        })
      : labels.map(
          (label, index) =>
            `{ label: '${esc(label)}', href: '${esc(hrefs[index] ?? '#')}' }`,
        );
    const brand = instanceText(
      c,
      'heading',
      str(c, 'content.brand', 'Kolibri'),
    );
    const actionInstance = findInstance(c, 'button');
    const action = actionInstance
      ? value(
          actionInstance,
          'label',
          actionInstance.textOverride ??
            str(c, 'content.action', 'Get Started'),
        )
      : str(c, 'content.action', 'Get Started');
    const headingLevel = Number(
      instanceValue(c, 'heading', 'accessibility.level', '1'),
    );
    const navigationCount = composedNavigation.length || labels.length;
    const itemClasses = Array.from({ length: navigationCount }, (_, index) =>
      instanceClass(c, 'navigation-item', index + 1),
    );
    const iconClasses = Array.from({ length: navigationCount }, (_, index) =>
      instanceClass(c, 'icon', index + 1),
    );
    const linkClasses = Array.from({ length: navigationCount }, (_, index) =>
      instanceClass(c, 'link', index + 1),
    );
    return `import { ArrowRight, Menu } from 'lucide-react'; import { Button } from './Button'; import { Heading } from './Heading'; import { Link } from './Link';
export type SiteHeaderNavigationItem = { label: string; href: string };
export type SiteHeaderProps = { brand?: string; navigation?: SiteHeaderNavigationItem[]; action?: string; className?: string };
const defaultNavigation: SiteHeaderNavigationItem[] = [${items.join(', ')}];
const itemClasses = ${JSON.stringify(itemClasses)};
const iconClasses = ${JSON.stringify(iconClasses)};
const linkClasses = ${JSON.stringify(linkClasses)};
export function SiteHeader({ brand = '${esc(brand)}', navigation = defaultNavigation, action = '${esc(action)}', className }: SiteHeaderProps) { return <header className={\`kolibri-site-header\${className ? ' ' + className : ''}\`}><Heading className="${instanceClass(c, 'heading')}" level={${headingLevel}}>{brand}</Heading><nav className="${visualClass(c, 'semantic.nav')}" aria-label="${attr(str(c, 'accessibility.navigationLabel', 'Primary navigation'))}"><ul>{navigation.map((item, index) => <li className={itemClasses[index]} key={item.href ?? item.label}><ArrowRight className={iconClasses[index]} aria-hidden="true" size={16} /><Link className={linkClasses[index]} href={item.href}>{item.label}</Link></li>)}</ul></nav>{action ? <Button className="${instanceClass(c, 'button')}">{action}</Button> : null}<Menu className="${instanceClass(c, 'icon', navigationCount + 1)}" aria-hidden="true" size={24} /></header>; }
`;
  }

  private signupForm(c: ImportedComponent): string {
    const heading = instanceText(
      c,
      'heading',
      str(c, 'content.heading', 'Join'),
    );
    const description = instanceText(
      c,
      'paragraph',
      str(c, 'content.description', ''),
    );
    const field = findInstance(c, 'form-field');
    const fieldInput = field?.children.find((instance) =>
      `${instance.componentName ?? ''} ${instance.name}`
        .toLowerCase()
        .includes('text-input'),
    );
    const fieldLabel = field
      ? value(field, 'content.label', field.textOverride ?? 'Email address')
      : 'Email address';
    const fieldHelper = field ? value(field, 'content.helper', '') : '';
    const fieldError = field ? value(field, 'content.error', '') : '';
    const fieldName = field ? value(field, 'prop.name', 'email') : 'email';
    const fieldPlaceholder = fieldInput
      ? value(fieldInput, 'prop.placeholder', fieldInput.textOverride ?? '')
      : '';
    const terms = visualText(c, 'terms', 'I accept the terms and conditions');
    const submitInstance = findInstance(c, 'button');
    const submit = submitInstance
      ? value(
          submitInstance,
          'label',
          submitInstance.textOverride ?? str(c, 'content.submit', 'Submit'),
        )
      : str(c, 'content.submit', 'Submit');
    return `import { useState } from 'react'; import type { FormEvent } from 'react'; import { Alert } from './Alert'; import { Button } from './Button'; import { Checkbox } from './Checkbox'; import { FormField } from './FormField'; import { Heading } from './Heading'; import { Paragraph } from './Paragraph';
export function SignupForm() { const [feedback, setFeedback] = useState(${bool(c, 'visibility.feedback', false)}); const handleSubmit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setFeedback(true); }; return <form className="kolibri-signup-form" action="${attr(str(c, 'prop.action', '/subscribe'))}" method="${attr(str(c, 'prop.method', 'post'))}" noValidate={${bool(c, 'prop.noValidate', false)}} aria-label="${attr(str(c, 'accessibility.label', 'Signup form'))}" aria-busy={${bool(c, 'accessibility.busy', false)}} onSubmit={handleSubmit}><Heading className="${instanceClass(c, 'heading')}" level={${Number(instanceValue(c, 'heading', 'accessibility.level', '1'))}}>${jsx(heading)}</Heading><Paragraph className="${instanceClass(c, 'paragraph')}">${jsx(description)}</Paragraph><FormField className="${instanceClass(c, 'form-field')}" label="${attr(fieldLabel)}" helper="${attr(fieldHelper)}" error="${attr(fieldError)}" name="${attr(fieldName)}" placeholder="${attr(fieldPlaceholder)}" required /><div className="${visualClass(c, 'terms')}"><Checkbox className="${instanceClass(c, 'checkbox')}" name="terms" label="${attr(terms)}" required /><span className="${visualClass(c, 'I accept the terms and conditions')}">${jsx(terms)}</span></div><Button className="${instanceClass(c, 'button')}" type="submit">${jsx(submit)}</Button><div className="kolibri-signup-form__feedback" hidden={!feedback}><Alert className="${instanceClass(c, 'feedback')}">${jsx(str(c, 'behavior.successMessage', 'Success'))}</Alert></div></form>; }
`;
  }

  private cardGrid(c: ImportedComponent): string {
    const cards = c.composition
      .filter((instance) => instance.componentName === 'card')
      .map((instance) => ({
        heading: value(
          instance,
          'content.heading',
          instance.textOverride ?? 'Card',
        ),
        paragraph: value(instance, 'content.paragraph', ''),
        linkText: value(instance, 'content.link', 'Learn more'),
        href: value(instance, 'link.href', '/'),
        imageAlt: value(instance, 'image.alt', 'Card image'),
      }));
    const cardClasses = cards.map((_, index) =>
      instanceClass(c, 'card', index + 1),
    );
    const cardPartClasses = cards.map((_, index) => ({
      imageClassName: instanceClass(c, 'image', index + 1),
      headingClassName: instanceClass(c, 'heading', index + 2),
      paragraphClassName: instanceClass(c, 'paragraph', index + 2),
      linkClassName: instanceClass(c, 'link', index + 1),
    }));
    return `import { Card } from './Card'; import { Heading } from './Heading'; import { Paragraph } from './Paragraph';
const cards = ${JSON.stringify(cards, null, 2)};
const cardClasses = ${JSON.stringify(cardClasses)};
const cardPartClasses = ${JSON.stringify(cardPartClasses)};
export function CardGrid() { return <section className="kolibri-card-grid" aria-label="${attr(str(c, 'accessibility.label', 'Card grid'))}"><Heading className="${instanceClass(c, 'heading')}" level={2}>${jsx(str(c, 'content.heading', 'Featured stories'))}</Heading><Paragraph className="${instanceClass(c, 'paragraph')}">${jsx(str(c, 'content.description', ''))}</Paragraph><div className="kolibri-card-grid__list ${visualClass(c, 'semantic.list')}">{cards.map((card, index) => <Card className={cardClasses[index]} key={card.href} {...card} {...cardPartClasses[index]} />)}</div></section>; }
`;
  }

  private composedSection(
    c: ImportedComponent,
    name: string,
    children: string[],
    imports: string[],
  ): string {
    return `${imports.join('\n')}\nexport function ${name}() { return <section className="kolibri-${slug(c.name)}">\n${children.join('\n')}\n    </section>; }\n`;
  }
  private generic(c: ImportedComponent): string {
    const name = pascal(c.name);
    const element = str(c, 'semantic.element', 'div');
    const axes = variantAxesForComponent(c);
    const axisTypes = axes
      .map(
        ({ prop, values }) =>
          `  ${prop}?: ${values.map((value) => `'${esc(value)}'`).join(' | ')};`,
      )
      .join('\n');
    const destructuredAxes = axes
      .map(({ prop, defaultValue }) => `${prop} = '${esc(defaultValue)}'`)
      .join(', ');
    const variantClass = genericVariantClass(c, axes);
    const visual = renderVisualNodes(c.visual, slug(c.name), '      ');
    const voidElement = isVoidElement(element);
    return `import type { HTMLAttributes, PropsWithChildren } from 'react';

export type ${name}Props = PropsWithChildren<HTMLAttributes<HTMLElement>>${axisTypes ? ` & {\n${axisTypes}\n}` : ''};

export function ${name}({ children, className${destructuredAxes ? `, ${destructuredAxes}` : ''}, ...props }: ${name}Props) {
  const Element = '${esc(element)}' as 'div';
  ${variantClass}
  return ${
    voidElement
      ? `<Element className={\`kolibri-${slug(c.name)}\${variantClass}\${className ? ' ' + className : ''}\`} {...props} />;`
      : `(
    <Element className={\`kolibri-${slug(c.name)}\${variantClass}\${className ? ' ' + className : ''}\`} {...props}>
      {children ?? <>
${visual}
      </>}
    </Element>
  );`
  }
}
`;
  }
}
