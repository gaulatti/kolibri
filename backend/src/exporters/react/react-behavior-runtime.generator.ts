export function generateReactBehaviorRuntime(): string {
  return `import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentType, KeyboardEvent, SyntheticEvent } from 'react';

type ViewProps = {
  viewState?: string;
  partProps?: Record<string, Record<string, unknown> | ((context: { name: string; index: number }) => Record<string, unknown>)>;
};
export type BehaviorProps = Record<string, unknown> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  openItems?: number[];
  defaultOpenItems?: number[];
  onOpenItemsChange?: (items: number[]) => void;
  multiple?: boolean;
};

type EventHandler = (event: SyntheticEvent) => void;

function mergeInjectedProps(existing: Record<string, unknown>, injected: Record<string, unknown>) {
  const merged = { ...existing, ...injected };
  for (const [key, injectedValue] of Object.entries(injected)) {
    const existingValue = existing[key];
    if (/^on[A-Z]/.test(key) && typeof existingValue === 'function' && typeof injectedValue === 'function') {
      merged[key] = (event: SyntheticEvent) => {
        (existingValue as EventHandler)(event);
        if (!event.defaultPrevented) (injectedValue as EventHandler)(event);
      };
    }
  }
  if (existing.className && injected.className) merged.className = String(existing.className) + ' ' + String(injected.className);
  if (existing.style && injected.style) merged.style = { ...(existing.style as object), ...(injected.style as object) };
  return merged;
}

function mergePartProps(current: ViewProps['partProps'], name: string, injected: Record<string, unknown> | ((context: { name: string; index: number }) => Record<string, unknown>)): ViewProps['partProps'] {
  return {
    ...current,
    [name]: (context: { name: string; index: number }) => {
      const source = current?.[name];
      const existing = typeof source === 'function' ? source(context) : source ?? {};
      const behaviorProps = typeof injected === 'function' ? injected(context) : injected;
      return mergeInjectedProps(existing, behaviorProps);
    },
  };
}

function useControllableOpen(props: BehaviorProps) {
  const [internal, setInternal] = useState(Boolean(props.defaultOpen));
  const open = props.open ?? internal;
  const setOpen = (next: boolean) => {
    if (props.open === undefined) setInternal(next);
    props.onOpenChange?.(next);
  };
  return [open, setOpen] as const;
}

function withoutBehaviorProps<T extends object>(props: T & BehaviorProps): T {
  const { open: _open, defaultOpen: _defaultOpen, onOpenChange: _onOpenChange, openItems: _openItems, defaultOpenItems: _defaultOpenItems, onOpenItemsChange: _onOpenItemsChange, multiple: _multiple, ...viewProps } = props;
  return viewProps as T;
}

export function withDialogBehavior<T extends object>(View: ComponentType<T>) {
  return function Dialog(props: T & BehaviorProps) {
    const viewProps = props as T & ViewProps;
    const [open, setOpen] = useControllableOpen(props);
    const titleId = useId();
    const contentRef = useRef<HTMLElement | null>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);
    useEffect(() => {
      if (!open) return;
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      const content = contentRef.current;
      content?.focus();
      const onKeyDown = (event: globalThis.KeyboardEvent) => {
        if (event.key === 'Escape') setOpen(false);
        if (event.key !== 'Tab' || !content) return;
        const focusable = Array.from(content.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
        if (!focusable.length) { event.preventDefault(); content.focus(); return; }
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      };
      document.addEventListener('keydown', onKeyDown);
      return () => { document.removeEventListener('keydown', onKeyDown); returnFocusRef.current?.focus(); };
    }, [open]);
    if (!open) return null;
    let partProps = viewProps.partProps;
    partProps = mergePartProps(partProps, 'content', { ref: contentRef, role: 'dialog', 'aria-modal': true, 'aria-labelledby': titleId, tabIndex: -1 });
    partProps = mergePartProps(partProps, 'title', { id: titleId });
    partProps = mergePartProps(partProps, 'close', { type: 'button', onClick: () => setOpen(false) });
    return <View {...({ ...withoutBehaviorProps(props), viewState: 'open', partProps } as T)} />;
  };
}

export function withDisclosureBehavior<T extends object>(View: ComponentType<T>) {
  return function Disclosure(props: T & BehaviorProps) {
    const viewProps = props as T & ViewProps;
    const [open, setOpen] = useControllableOpen(props);
    const panelId = useId();
    let partProps = viewProps.partProps;
    partProps = mergePartProps(partProps, 'trigger', { type: 'button', 'aria-expanded': open, 'aria-controls': panelId, onClick: () => setOpen(!open) });
    partProps = mergePartProps(partProps, 'panel', { id: panelId, hidden: !open });
    return <View {...({ ...withoutBehaviorProps(props), viewState: open ? 'open' : 'closed', partProps } as T)} />;
  };
}

export const withPopoverBehavior = withDisclosureBehavior;
export const withMenuBehavior = withDisclosureBehavior;

export function withAccordionBehavior<T extends object>(View: ComponentType<T>) {
  return function Accordion(props: T & BehaviorProps) {
    const viewProps = props as T & ViewProps;
    const [internalItems, setInternalItems] = useState<number[]>(props.defaultOpenItems ?? []);
    const openItems = props.openItems ?? internalItems;
    const setOpenItems = (next: number[]) => {
      if (props.openItems === undefined) setInternalItems(next);
      props.onOpenItemsChange?.(next);
    };
    const accordionId = useId();
    const toggle = (index: number) => {
      const isOpen = openItems.includes(index);
      setOpenItems(isOpen ? openItems.filter((item) => item !== index) : props.multiple ? [...openItems, index] : [index]);
    };
    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      const triggers = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-part="trigger"]:not([disabled])'));
      if (!triggers.length) return;
      const current = Math.max(0, triggers.indexOf(document.activeElement as HTMLElement));
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? triggers.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + triggers.length) % triggers.length;
      event.preventDefault(); triggers[next]?.focus();
    };
    let partProps = viewProps.partProps;
    partProps = mergePartProps(partProps, 'root', { onKeyDown });
    partProps = mergePartProps(partProps, 'trigger', (context) => ({ id: accordionId + '-trigger-' + context.index, type: 'button', 'aria-expanded': openItems.includes(context.index), 'aria-controls': accordionId + '-panel-' + context.index, onClick: () => toggle(context.index) }));
    partProps = mergePartProps(partProps, 'panel', (context) => ({ id: accordionId + '-panel-' + context.index, role: 'region', 'aria-labelledby': accordionId + '-trigger-' + context.index, hidden: !openItems.includes(context.index) }));
    return <View {...({ ...withoutBehaviorProps(props), viewState: openItems.length ? 'open' : 'closed', partProps } as T)} />;
  };
}

export function withTooltipBehavior<T extends object>(View: ComponentType<T>) {
  return function Tooltip(props: T) {
    const viewProps = props as T & ViewProps;
    const [open, setOpen] = useState(false);
    const contentId = useId();
    let partProps = viewProps.partProps;
    partProps = mergePartProps(partProps, 'trigger', { 'aria-describedby': open ? contentId : undefined, onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false), onFocus: () => setOpen(true), onBlur: () => setOpen(false) });
    partProps = mergePartProps(partProps, 'content', { id: contentId, role: 'tooltip', hidden: !open });
    return <View {...({ ...props, viewState: open ? 'open' : 'closed', partProps } as T)} />;
  };
}

export function withTabsBehavior<T extends object>(View: ComponentType<T>) {
  return function Tabs(props: T) {
    const viewProps = props as T & ViewProps;
    const [activeIndex, setActiveIndex] = useState(0);
    const tabsId = useId();
    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
      if (!tabs.length) return;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (activeIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      setActiveIndex(next); tabs[next]?.focus();
    };
    let partProps = viewProps.partProps;
    partProps = mergePartProps(partProps, 'list', { role: 'tablist', onKeyDown });
    partProps = mergePartProps(partProps, 'tab', (context) => ({ id: tabsId + '-tab-' + context.index, role: 'tab', tabIndex: context.index === activeIndex ? 0 : -1, 'aria-selected': context.index === activeIndex, 'aria-controls': tabsId + '-panel-' + context.index, onClick: () => setActiveIndex(context.index) }));
    partProps = mergePartProps(partProps, 'panel', (context) => ({ id: tabsId + '-panel-' + context.index, role: 'tabpanel', 'aria-labelledby': tabsId + '-tab-' + context.index, hidden: context.index !== activeIndex, tabIndex: 0 }));
    return <View {...({ ...props, viewState: 'active', partProps } as T)} />;
  };
}
`;
}
