# Generated component contracts

> Do not author these contracts from memory. Run the canonical copy-ready
> [Universal Figma compatibility prompt](figma-compatibility-prompt.md) for every
> new Design System and after structural component or variant changes.

kolibri's `composable-v1` contract separates visual fidelity from application
behavior. Figma defines appearance, variants, layout, semantic parts, and
states. Generated React views reproduce that design. Behavior adapters add
state, keyboard interaction, focus management, and ARIA relationships. Product
engineers may use kolibri's default adapter or wrap the view with their own.

## Selecting a contract

Each Design System has one `generationContract`:

| Value | Purpose |
| --- | --- |
| `composable-v1` | Folder-based view, contract, behavior binding, stories, and machine-readable manifest. This is the default for new Design Systems. |
| `legacy` | Previous single-file generated components. Existing records remain on this value after migration. |

The setting is stored in PostgreSQL because it is non-sensitive application
configuration. Every Generation Run snapshots it so an old artifact remains
explainable after the Design System changes. Switching contracts is a breaking
public-API change; the first subsequent reservation advances the npm major
version. Ordinary runs continue to advance the patch version.

## Figma authoring contract

Set `semantic.component` on the component to select a behavior family. Stable
parts are declared on descendants by naming the layer exactly
`@part/<part-name>` or `@part:<part-name>`. An explicit string component
property named `part` is also accepted when the Figma node exposes component
properties through the REST API. Part names are normalized to lowercase
kebab-case.

Example dialog hierarchy:

```text
Modal                         semantic.component=dialog
├── @part/backdrop
└── @part/content
    ├── @part/title
    ├── @part/description
    ├── Body
    ├── @part/actions
    └── @part/close
```

Use `semantic.element` to request an intrinsic HTML element where semantic
HTML matters, such as `button`, `nav`, `input`, or `img`. kolibri emits
`SEMANTIC_ELEMENT_FALLBACK` and uses a safe container when a void element cannot
represent the component's visual tree. Root `img`, `hr`, and `input` output is
only emitted for component identities with a supported intrinsic mapping.
Visual layer names that are not parts remain internal rendering detail.

### Supported behavior families

| `semantic.component` or recognized name | Required parts | Optional parts | Default adapter |
| --- | --- | --- | --- |
| `dialog`, `modal` | `content`, `title` | `backdrop`, `description`, `body`, `close`, `actions` | Controlled/uncontrolled open state, Escape, focus entry/trap/restore, dialog ARIA. |
| `accordion` | `item`, `trigger`, `panel` | `indicator`, `title`, `description`, `separator` | Controlled/uncontrolled item state, single/multiple mode, arrow/Home/End focus, and trigger/panel ARIA. Each item must have a corresponding trigger and panel. |
| `tabs` | `list`, `tab`, `panel` | `indicator` | Roving tab focus, arrow/Home/End keys, panel selection, tab/panel ARIA. |
| `tooltip` | `trigger`, `content` | `arrow` | Hover/focus state and `aria-describedby`. |
| `popover` | `trigger`, `content` | `title`, `description`, `arrow`, `close` | Controlled/uncontrolled disclosure state. |
| `menu`, `dropdown-menu` | `trigger`, `content`, `item` | `separator`, `label`, `indicator` | Disclosure binding; product teams may replace it with a richer menu adapter. |
| Switch and radio group | `control` | `label`, `indicator`, `description`, `error` | The existing visible track or option wrapper is the behavior attachment point; engineering supplies state, ARIA, and handlers. |
| Other native controls, including toggle | none | `label`, `control`, `indicator`, `description`, `error` | Native browser behavior; no adapter is inserted. |
| Forms/navigation | none | Family-specific semantic parts, including form `title` | View-only; application code owns navigation, submission, and data. |

Unknown parts produce `UNKNOWN_COMPONENT_PART`. Missing required parts produce
`REQUIRED_COMPONENT_PART_MISSING`. A component with an incomplete behavioral
contract is still generated as a view, but kolibri does not pretend that it has
a safe default adapter. Every variant in a component set must expose the same
part names as the canonical first variant; drift produces
`VARIANT_PART_MISMATCH` because a stable wrapper cannot depend on a part that
exists only in some visual states.

For a visually composed switch, annotate the existing track as `@part/control`
with `semantic.element=button`. For a radio group, annotate every complete
option wrapper as repeated `@part/control` with `semantic.element=button`.
This preserves the thumb, ring, selected dot, labels, and other essential
children. Do not fabricate hidden native inputs. Product wrappers bind button
type, roles, ARIA state, roving focus, keyboard behavior, and handlers. The
canonical decision procedure is maintained in the
[Universal Figma compatibility prompt](figma-compatibility-prompt.md).

Repeated structural parts must also align. Tabs require one panel per tab, and
accordions require matching item, trigger, and panel counts. Misalignment
produces `COMPONENT_PART_CARDINALITY_MISMATCH`; the view remains available, but
the default behavior adapter is not considered safe to consume until the Figma
anatomy is corrected.

### Diagnosing a view-only composable export

A successful generation can still produce a view-only interactive component.
This is intentional: package creation succeeded, but kolibri could not prove
that it was safe to bind behavior. Check the run's Diagnostics tab and the
component entry in `kolibri.manifest.json`:

- `adapterRequired: true` and `adapterAttached: false` means required semantic
  anatomy is missing or inconsistent.
- `availableParts: ["root"]` means no descendant `@part/...` annotations reached
  the Figma REST payload.
- `REQUIRED_COMPONENT_PART_MISSING` identifies each absent required part.
- `COMPONENT_PART_CARDINALITY_MISMATCH` identifies repeated parts whose counts
  cannot be paired safely.

Annotations must be applied to the source component or every source variant,
not merely to an instance placed on a documentation page. Regenerate after the
Figma file has finished saving, then verify `adapterAttached: true` in the new
manifest.

## Generated files

For a complete `Modal`, composable output is:

```text
src/
├── behaviors/index.tsx
├── components/
│   ├── index.ts
│   └── Modal/
│       ├── Modal.view.tsx
│       ├── Modal.contract.ts
│       ├── Modal.tsx
│       ├── Modal.stories.tsx
│       └── index.ts
└── index.ts
kolibri.manifest.json
styles/kolibri.css
assets/figma-<reference>.png
```

- `ModalView` is stateless visual structure.
- `ModalContract` describes source identity, parts, states, and behavior.
- `Modal` is the default behavior-bound export when the contract is complete.
- `behaviors` exports the reusable higher-order adapters.
- `kolibri.manifest.json` gives tooling the same contract without parsing TSX.
- Adapter-backed Storybook modules include a `Behavior contract` play test for
  the behavior family's core ARIA/state interaction, in addition to visual
  variants.

An incomplete interactive component exports `ModalView` but not a misleading
`Modal` adapter binding.

## View API

Every view accepts ordinary root HTML attributes plus:

| Prop | Meaning |
| --- | --- |
| `children` | Replaces generated visual children when supplied. |
| `viewState` | Explicit visual state exposed as `data-state`. It does not create state. |
| `slots` | Replaces the element/component used for a named part. |
| `partProps` | Adds attributes, refs, or handlers to a named part; values may be objects or functions receiving `{ name, index }`. |

Stable integration selectors are `data-component`, `data-part`, and
`data-state`. Positional class names and DOM nesting exist to reproduce the
current Figma layout and are not a public API.

Intrinsic semantic elements are emitted when their markup can remain valid.
Image, divider, text-input, checkbox, slider, textarea, and select views use
self-closing or empty intrinsic roots rather than placing generated visual
children inside void elements. Image sources resolve to packaged Figma assets,
and meaningful images use the Figma `prop.alt` value. Table views translate the
first visual row to a `thead` row and subsequent visual rows to `tbody` rows so
generic Figma frames do not become invalid direct children of a `table`.

When a requested intrinsic element cannot safely contain the component's
visual hierarchy, kolibri retains a valid container instead of emitting invalid
HTML. This applies, for example, to a component with `semantic.element=img`
whose identity is not the Image component.

```tsx
import {
  ButtonView,
  ModalView,
  withDialogBehavior,
} from '@organization/design-system';

const ProductModal = withDialogBehavior(ModalView);

export function Checkout() {
  return (
    <ProductModal
      defaultOpen
      slots={{ close: ProductIconButton }}
      partProps={{
        content: { 'data-analytics-surface': 'checkout-confirmation' },
        close: { 'aria-label': 'Close confirmation' },
      }}
    />
  );
}
```

Injected adapter handlers compose after consumer handlers. Calling
`event.preventDefault()` in the consumer handler cancels the adapter action.
This gives application code an intentional escape hatch without editing
generated source.

## Manifest contract

The package-root manifest has this shape:

```json
{
  "contractVersion": "composable-v1",
  "components": {
    "Modal": {
      "sourceNodeId": "26:151",
      "sourceName": "modal",
      "kind": "molecule",
      "behavior": "dialog",
      "adapterRequired": true,
      "adapterAttached": true,
      "requiredParts": ["content", "title"],
      "availableParts": ["root", "backdrop", "content", "title", "close"],
      "states": ["open", "closed"]
    }
  }
}
```

Consumers and CI can use this file to inventory components, fail policy checks,
or generate wrapper code without scraping Storybook or React source.

## Ownership boundaries

kolibri owns generated views, CSS, default adapters, contracts, stories, and
the manifest. Product repositories own routing, analytics, data fetching,
authorization decisions, business state, mutations, and product-specific
wrappers. Regeneration may replace generated files, so product code must live
outside the generated package.

## Migration procedure

1. Leave an existing Design System on `legacy` while consumers establish a
   baseline.
2. Change its component contract to `composable-v1`.
3. Add the required Figma part annotations and resolve diagnostics.
4. Generate without npm publication and inspect Storybook, the manifest, and
   the downloadable archive.
5. Update product imports or wrappers to the new view/adapter API.
6. Publish. kolibri reserves the next major version for the first run across
   the contract boundary.
7. Keep prior package versions available for rollback. The Design System and
   Generation Run snapshots make both generations auditable.
