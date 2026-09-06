# Universal Figma compatibility prompt

This is the canonical Figma authoring gate for kolibri. Run it for every new
Design System before its first generation and after structural component,
variant, typography, foundation, or asset changes.

Copy the complete prompt below without shortening it. It is self-contained so
the Figma-side agent requires no prior knowledge of kolibri. Its predetermined
decisions are intentional and prevent recurring blockers or improvised anatomy.

---

## Copy-ready prompt

You are preparing this Figma design-system file for compilation by kolibri.

kolibri reads source definitions through the Figma REST API and generates typed
React components, stateless composable views, semantic part contracts, optional
behavior adapters, CSS, tokens, packaged assets, font imports, Storybook
stories, and a machine-readable manifest.

Perform the complete inventory, repair, save, reread, and validation process in
one pass. Do not assume prior knowledge of kolibri. Do not stop to ask semantic
or structural questions resolved by this prompt.

### Ownership model

Figma owns appearance, source structure, variants, layout, sizing intent,
semantic HTML intent, stable public parts, state appearance, content hierarchy,
images, vectors, typography, and tokens.

Generated views own visual output, typed variant properties, stable slots and
part properties, `data-component`, `data-part`, `data-state`, and valid default
HTML.

Product engineering owns business logic, routing, requests, forms,
authorization, analytics, domain state, mutations, and product wrappers.
Behavior adapters or engineering wrappers own handlers, keyboard behavior,
focus, ARIA relationships, disclosure, selection, dialog, switch, and radio
behavior. Do not encode product behavior in Figma.

### Mandatory preservation rules

- Modify source definitions, not documentation instances.
- Do not detach or flatten components.
- Do not rasterize vectors or replace them with text glyphs.
- Preserve image fills and references.
- Preserve fills, strokes, effects, typography, spacing, radii, auto layout,
  constraints, visibility, images, vectors, identity, and variants.
- Do not invent credentials, tokens, package data, or application URLs.
- Do not add hidden, zero-size, transparent, off-canvas, or placeholder layers
  merely to satisfy validation.
- Do not fabricate native HTML controls in Figma.
- Do not duplicate properties or parts.
- Keep the operation idempotent.
- Save and reread every modified source definition before reporting.

### Predetermined decisions

When intent is not explicit, decide in this order:

1. Preserve visual fidelity.
2. Preserve valid HTML.
3. Preserve stable public anatomy.
4. Expose a behavior attachment point.
5. Prefer native elements only when they do not discard essential children.
6. Prefer a non-void `button` for a composite visual control.
7. Use `div` for an ambiguous block and `span` for an ambiguous inline element.
8. Leave application behavior to engineering wrappers.
9. Never fabricate invisible native controls.
10. Never block on a choice covered below.

Apply these decisions without asking:

- Generic reusable heading: `semantic.element=h2`. Use `h1` only when it is
  intrinsically the page's single primary heading.
- Avatar with image and initials variants: `semantic.element=div`, never a
  shared `img` root.
- Generic reusable image without fixed intrinsic meaning:
  `semantic.element=img` and `accessibility.decorative=true`; consumers provide
  contextual alt text.
- Fixed meaningful image: `semantic.element=img` with non-empty `prop.alt`
  derived from documented purpose.
- Composite visual control with essential children: use the existing visible
  interactive wrapper as `@part/control`, set `semantic.element=button`, retain
  its children, and leave role/state/handlers to engineering. Never add a fake
  input.
- Unknown interactive family: preserve a composable view, expose a genuine
  `control` or `trigger`, use `button` for action and `a` for navigation, and do
  not invent a behavior adapter.
- Optional region present in only some variants: expose only the stable
  intersection of meaningful optional public parts.
- Required region hidden in a real visual state: retain and annotate the real
  layer with its intended visibility. A real hidden state is allowed; a
  fabricated validation layer is not.
- Required region genuinely absent: map the closest genuine layer when clear;
  otherwise remove the incorrect behavior-family declaration and retain a
  view-only compatible component.
- Incompatible variants: remove unstable optional annotations first; split
  clearly distinct components only when the division is evident; otherwise
  retain a view-only component.
- Unknown metadata: rename it into a recognized namespace when clear, preserve
  a real variant axis, or remove a documentation-only property.

### Recognized pages

- `01-foundation`: colors, spacing, radii, typography, sizes, shadows, fonts.
- `02-atoms`: atomic source components and sets.
- `03-molecules`: composed controls and content groups.
- `04-organisms`: page regions, forms, tables, and shells.

Only source components on the last three pages are emitted. Nested components
inside a component set are variants. Create a missing page and move only
clearly identified source definitions; never move documentation instances.

### Foundations

Direct token nodes use these lowercase prefixes:

- `color.`: non-text node with visible solid fill.
- `space.`: non-text node whose width is the pixel value.
- `radius.`: non-text node with numeric corner radius.
- `font.`: text node retaining family, size, weight, and line height.
- `size.`: node retaining meaningful bounds. `size.icon.*` yields width and
  height, `size.content` width, and `size.control` height.

kolibri also recognizes documented specimens:

- `colors` containing `swatch` nodes with descriptive and hexadecimal text;
- `spacing` containing `bar-*` nodes with scale and pixel labels;
- `radius` containing `sample` nodes with labels and pixel values;
- `typography` containing `row` nodes with styled `<size>/<weight>` samples;
- `shadows` containing `sample` nodes with actual Figma shadow effects.

Preserve valid specimens. Duplicate normalized names keep the first value;
remove accidental duplicates when they mean the same thing.

### Font sources

Every used family requires `font-source.<identifier>` on `01-foundation` with:

- `font.family`: exact Figma/CSS family.
- `font.provider`: `css`.
- `font.cssUrl`: verified public HTTPS stylesheet URL.
- `font.fallback`: safe CSS fallback stack.

Prefer official sources. Google Fonts URLs use `fonts.googleapis.com/css2` and
include all used weights. Never use local paths or credentials. Font-source
components are `NOT_APPLICABLE` to React semantic and sizing checks. Put
historical notes in layer names, not unsupported component properties.

### Metadata

Recognized namespaces are `semantic.*`, `prop.*`, `content.*`,
`accessibility.*`, `behavior.*`, `visibility.*`, `responsive.*`, `layout.*`,
`image.*`, `link.*`, `navigation.*`, `icon.*`, and `part.*`.

Accepted un-namespaced properties are `variant`, `state`, `tone`, `content`,
`icon`, `label`, and `part`. Figma's `#<node-id>` suffix is acceptable. Do not
introduce other un-namespaced properties.

### Sizing

Every source component and set requires `layout.widthMode` and
`layout.heightMode`, each exactly `hug`, `fill`, or `fixed`.

Fixed width requires numeric `layout.width`; fixed height requires numeric
`layout.height`. Optional constraints are `layout.minWidth`, `layout.maxWidth`,
`layout.minHeight`, `layout.maxHeight`, `layout.overflow`, and
`layout.aspectRatio`. Overflow is `visible`, `hidden`, or `auto`.

Choose source intent, not a documentation instance's size. App/admin shells
normally use fill/fill.

### Root semantics

Use lowercase intrinsic elements. Defaults:

- heading `h2`; paragraph `p`; button `button`; link `a`;
- text-input `input`; slider `input`; select `select`; textarea `textarea`;
- checkbox `input` only when the root genuinely is the complete control;
- toggle `button`; label `label`; badge `span`; icon `svg`; image `img`;
- divider `hr`; mixed avatar `div`; switch wrapper `label`;
- radio-group wrapper `div`; alert `aside`; card `article`; hero `section`;
- profile summary `section`; tabs `nav`; tooltip `span`; accordion `div`;
- modal/dialog `dialog`; dropdown menu `div`; popover `div`;
- navigation item `li`; pagination `nav`; site header `header`;
- sidebar `nav`; form `form`; card grid `section`; table `table`;
- page header `header`; app shell `div`; admin shell `div`.

Void elements (`area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`,
`link`, `meta`, `param`, `source`, `track`, `wbr`) cannot contain children.
kolibri directly supports empty roots for image, divider, text-input, checkbox,
slider, textarea, and select. Never use a void root when essential visuals are
descendants; use the composite-control decision.

### Assets and accessibility

- Meaningful fixed image: non-empty `prop.alt`.
- Generic reusable or decorative image: `accessibility.decorative=true`.
- Preserve image references, image scaling, vector paths, fills, strokes,
  stroke widths, and bounds.
- Never derive alt text from an opaque filename.
- Never replace vectors with Unicode or ASCII.

### Semantic parts

Name stable public descendants `@part/<name>` or `@part:<name>`. Names begin
with a letter and contain letters, digits, underscores, or hyphens. Prefer
`control`, `trigger`, `content`, `title`, `description`, `actions`, `item`,
`panel`, `indicator`, `label`, `list`, `brand`, `media`, `status`, `close`, and
`separator`. Public parts are integration points for generated slots and part
properties; do not expose every internal frame.

### Variants

Inspect every source variant. Normalize names to comma-separated `axis=value`,
preserve meaningful axes, keep spelling consistent, expose the same semantic
part-name set across compatible variants, and preserve repeated-part counts and
ordering. Annotate every source variant, never only an example. Never create
placeholder layers to equalize variants.

### Behavior contracts

Set `semantic.component` when a family must be explicit.

- Dialog/modal: required `content`, `title`; optional `backdrop`,
  `description`, `body`, `close`, `actions`.
- Accordion: required `item`, `trigger`, `panel`; optional `indicator`, `title`,
  `description`, `separator`; counts satisfy `item = trigger = panel`.
- Tabs: required `list`, `tab`, `panel`; optional `indicator`; counts satisfy
  `tab = panel`.
- Tooltip: required `trigger`, `content`; optional `arrow`; variants retain the
  same anatomy.
- Popover: required `trigger`, `content`; optional `title`, `description`,
  `arrow`, `close`.
- Dropdown menu/menu: required `trigger`, `content`, repeated `item`; optional
  `separator`, `label`, `indicator`; separators are not items.

#### Switch — predetermined visual-control policy

- `semantic.component=switch`; root `semantic.element=label`.
- Required `control`; optional `label`, `indicator`, `description`, `error`.
- Existing visible track frame becomes `@part/control` with
  `semantic.element=button`.
- Preserve thumb and decorative children.
- Exactly one control appears in every variant at the same structural position.
- Never add an input or hidden layer.
- Engineering binds button type, `role=switch`, `aria-checked`, state, keyboard
  behavior, and handlers.

#### Radio group — predetermined visual-control policy

- `semantic.component=radio-group`; root `semantic.element=div`.
- Required repeated `control`; optional `label`, `indicator`, `description`,
  `error`.
- Every complete existing option wrapper becomes `@part/control` with
  `semantic.element=button`.
- Preserve ring, selected dot, label, and children.
- Keep option count and order consistent across orientation variants.
- Never annotate only the circle or add inputs/hidden layers.
- Engineering binds button type, `role=radio`, `aria-checked`, roving focus,
  selection, keyboard behavior, and handlers.

Other native families are button, link, text-input, textarea, checkbox, slider,
select, and toggle. Their optional parts are `label`, `control`, `indicator`,
`description`, and `error`. Use native roots only when they preserve the design.

Form families `form-field` and `signup-form` allow `title`, `label`, `control`,
`description`, `error`, and `actions`. Product code owns submission.

Navigation families `navigation-item`, `pagination`, `site-header`, and
`sidebar` allow `brand`, `list`, `item`, `trigger`, and `actions`. Product code
owns routing.

### Presentational anatomy

Use stable meaningful parts where present:

- Hero/card: `media`, `title`, `description`, `actions`.
- Alert: `title`, `description`, `actions`.
- Profile summary: `avatar`, `title`, `description`, `status`, `actions`.
- Card grid: `title`, `description`, `list`.
- Page header: `breadcrumb`, `title`, `description`, `actions`.
- Site header/sidebar: `brand`, `list`, `item`, `trigger`, `actions`.

### Table contract

For `semantic.element=table`, the first visible direct child is the header row,
later visible direct children are body rows, and visible direct row children are
cells. Rows are direct table children; cells are direct row children; column
counts are compatible. If the source is only visually table-like, use `div`.

### Responsive metadata

Supported numeric breakpoints are `responsive.stackAt` and
`responsive.collapseAt`. Card grids also support numeric `layout.columns` and
`layout.minimumItemWidth`. Do not invent breakpoints.

### Diagnostic gate

Resolve conditions for `UNKNOWN_METADATA`, `MISSING_SIZING_INTENT`,
`FIXED_WIDTH_REQUIRED`, `FIXED_HEIGHT_REQUIRED`, `IMAGE_ALT_REQUIRED`,
`SEMANTIC_ELEMENT_FALLBACK`, `FONT_SOURCE_UNRESOLVED`,
`UNKNOWN_COMPONENT_PART`, `REQUIRED_COMPONENT_PART_MISSING`,
`VARIANT_PART_MISMATCH`, and `COMPONENT_PART_CARDINALITY_MISMATCH`.

Never suppress a diagnostic by deleting meaningful anatomy or adding fake
layers. If an adapter cannot be completed honestly, use view-only compatibility
instead of blocking.

### Execution order

1. Inventory pages, source definitions, sets, variants, IDs, metadata, sizing,
   fonts, assets, instances, and candidate parts.
2. Validate foundation tokens, specimens, duplicates, and font sources.
3. Repair sizing, root semantics, behavior family, accessibility, and metadata.
4. Normalize variant axes and stabilize part sets, counts, and ordering.
5. Add required and useful optional parts, including visible composite controls.
6. Verify typography, assets, instances, overrides, visibility, layout,
   semantics, and behavior attachment points.
7. Save and reread every modified source node.

### Final report

Report totals for discovered, processed, compliant, view-only compatible, not
applicable, externally failed, modified, unchanged, sets, variants, font
families, font sources, image-bearing components, and vector-bearing components.

For every component report page, name, node ID, source type, family, root,
sizing, fixed dimensions, variants, required/available parts, repeated counts,
image accessibility, font status, modifications, adapter eligibility, and
status.

Statuses:

- `COMPLIANT`: valid view and complete selected behavior contract.
- `VIEW_ONLY_COMPATIBLE`: valid faithful view with public attachment points;
  engineering supplies behavior.
- `NOT_APPLICABLE`: foundation declarations such as font sources.
- `FAILED_EXTERNAL_REQUIREMENT`: only a genuinely inaccessible source or
  unavailable external resource, never a semantic decision covered here.

Include foundation validation, font validation, explicit behavior-part counts,
asset validation, forecast counts for every diagnostic, modified node IDs,
view-only decisions, external failures, and save confirmation. Confirm processed
equals discovered, source definitions were changed, saved nodes were reread,
and no fake or hidden validation layers were created.

End with `READY FOR KOLIBRI GENERATION` when every item is compliant,
view-only compatible, or not applicable. Use
`NOT READY FOR KOLIBRI GENERATION — EXTERNAL REQUIREMENT FAILED` only for a
genuine unavailable external dependency.

---

After the Figma-side pass reports readiness, run a normal kolibri generation.
The persisted Diagnostics tab is authoritative; the Figma-side forecast is
advisory until the backend imports the saved file.
