# Generation pipeline

This document describes the compiler contract from persisted Design System to
downloadable/published package.

## Inputs

Generation accepts only:

```json
{
  "designSystemId": "8b4a26d4-50ce-4e45-936d-35f04cc098cb",
  "publishToNpm": false
}
```

Everything else is resolved server-side.

| Input                 | Source                                    | Secret?                      | Used for                                             |
| --------------------- | ----------------------------------------- | ---------------------------- | ---------------------------------------------------- |
| Owner                 | verified Cognito `sub` -> `UserReference` | no                           | Authorization.                                       |
| Display name          | PostgreSQL Design System                  | no                           | UI, history, dashboard.                              |
| Description           | PostgreSQL Design System                  | no                           | Generated npm manifest description.                  |
| Generation contract   | PostgreSQL Design System                  | no                           | Select legacy or composable generated public API.    |
| Figma file key        | shared runtime configuration              | no, but server-managed       | Figma Files API.                                     |
| Figma access token    | shared runtime configuration              | yes                          | Figma file and image access.                         |
| npm package name      | shared runtime configuration              | no                           | Version lookup, archive root, manifest, publication. |
| Assigned version      | npm registry + persisted runs             | no                           | Immutable run/package version.                       |
| npm registry          | system configuration                      | no                           | Version lookup and publication.                      |
| npm token             | shared runtime configuration              | yes                          | Private lookup when needed and optional publication. |
| Storage configuration | system secret or local mode               | sensitive operational config | Snapshot/archive storage.                            |

Request headers cannot override package name/version, Figma file/token,
registry, or owner.

## Figma source contract

Before this pipeline is invoked, run the complete
[Universal Figma compatibility prompt](figma-compatibility-prompt.md) against
the saved source file. It is the canonical onboarding and repair procedure.
The prompt's forecast is advisory; persisted diagnostics produced by this
pipeline are authoritative.

The backend calls:

```text
GET https://api.figma.com/v1/files/<file-key>?geometry=paths
X-Figma-Token: <configured-token>
```

`geometry=paths` preserves vector geometry needed to produce icon/shape output.
The complete response is stored as a private raw snapshot before normalization.

### Page organization

kolibri recognizes these case-insensitive page names:

| Page            | Purpose                                                                           |
| --------------- | --------------------------------------------------------------------------------- |
| `01-foundation` | Colors, spacing, radii, typography, sizes, shadows, and font source declarations. |
| `02-atoms`      | Atomic components and component sets.                                             |
| `03-molecules`  | Composed controls/content groups.                                                 |
| `04-organisms`  | Page regions, shells, tables, forms, and other larger compositions.               |

Components outside the three component pages are not emitted as React
components. Nested components inside a component set are treated as variants,
not independent top-level exports.

### Foundation token naming

Direct token nodes can use:

| Prefix    | Expected node data                    | Output                                       |
| --------- | ------------------------------------- | -------------------------------------------- |
| `color.`  | non-text node with visible solid fill | CSS color variable.                          |
| `space.`  | non-text node width                   | pixel spacing variable.                      |
| `radius.` | non-text node corner radius           | pixel radius variable.                       |
| `font.`   | text node typography style            | family, size, weight, line-height variables. |
| `size.`   | node bounds                           | width/height size variables.                 |

The importer also understands the documented foundation specimen structure:

- `colors` section containing `swatch` nodes and label/hex text;
- `spacing` section containing `bar-*` nodes with scale and pixel labels;
- `radius` section containing `sample` nodes;
- `typography` section containing `row` nodes and styled text samples;
- `shadows` section containing `sample` nodes with Figma shadow effects.

Token names are normalized to lowercase CSS custom properties. Duplicate CSS
names keep the first encountered value.

### Font source declarations

Figma font family information does not provide downloadable font files. To make
generated packages load typography, add a component on `01-foundation` named:

```text
font-source.<identifier>
```

Its component property defaults must include:

| Property        | Required value                                            |
| --------------- | --------------------------------------------------------- |
| `font.family`   | Exact Figma/CSS family name.                              |
| `font.provider` | `css`.                                                    |
| `font.cssUrl`   | HTTPS stylesheet URL, for example a Google Fonts CSS URL. |
| `font.fallback` | Safe CSS fallback stack.                                  |

The exporter emits CSS imports for declared sources. Each font family used by
tokens or component styles without a matching declaration produces
`FONT_SOURCE_UNRESOLVED`.

### Component metadata

Figma component property definitions are kolibri's semantic metadata. Figma may
suffix names with `#<node-id>`; the importer removes that suffix.

Recognized namespaces are:

```text
semantic.*       prop.*            content.*
accessibility.*  behavior.*        visibility.*
responsive.*     layout.*          image.*
link.*           navigation.*      icon.*
```

Common un-namespaced variant axes such as `variant`, `state`, `tone`,
`content`, `icon`, and `label` are also accepted. Unknown properties are
retained but produce `UNKNOWN_METADATA` so Figma authors can correct drift.

Important layout metadata:

| Property                               | Values/meaning                                          |
| -------------------------------------- | ------------------------------------------------------- |
| `layout.widthMode`                     | `hug`, `fill`, or `fixed`.                              |
| `layout.heightMode`                    | `hug`, `fill`, or `fixed`.                              |
| `layout.width`, `layout.height`        | Required numeric values for corresponding `fixed` mode. |
| `layout.minWidth`, `layout.maxWidth`   | Numeric constraints.                                    |
| `layout.minHeight`, `layout.maxHeight` | Numeric constraints.                                    |
| `layout.overflow`                      | `visible`, `hidden`, or `auto`.                         |
| `layout.aspectRatio`                   | Numeric aspect ratio.                                   |

The importer prefers Figma auto-layout/bounds where appropriate and uses
metadata to make intent explicit or fill gaps. Missing width/height intent
produces `MISSING_SIZING_INTENT`. Fixed modes without dimensions produce
`FIXED_WIDTH_REQUIRED` or `FIXED_HEIGHT_REQUIRED` errors.

For composable output, descendants named `@part/<name>` or `@part:<name>`
become stable semantic parts. The component's `semantic.component` selects a
behavior family such as `dialog`, `tabs`, or `tooltip`. Required and optional
parts, adapter behavior, generated APIs, and migration rules are specified in
[Generated component contracts](component-contracts.md).

Accessibility metadata drives semantic output. For example, a component with
`semantic.element=img` must supply `prop.alt` unless
`accessibility.decorative=true`; otherwise `IMAGE_ALT_REQUIRED` is emitted.
Composable Image, Divider, TextInput, Checkbox, Slider, Textarea, and Select
views emit valid empty intrinsic elements instead of nesting Figma visual
children inside void controls. Table components translate their visual row and
cell hierarchy to `thead`, `tbody`, `tr`, `th`, and `td` markup. Unsupported
void-root requests fall back to a valid container rather than producing invalid
HTML.

### Variants and composition

For a Figma component set, child names are parsed as comma-separated axes:

```text
tone=info, state=default
tone=success, state=default
tone=warning, state=dismissible
```

Each combination becomes:

- normalized variant axes;
- a typed React prop union where supported;
- a dedicated Storybook story;
- one entry in the `All variants` matrix;
- variant-specific CSS selectors.

Nested Figma component instances retain their referenced component names,
overridden text, visibility, metadata, styles, nested instances, and stable CSS
classes. Non-instance visual children retain text, geometry, vectors, styles,
and hierarchy. This lets molecule/organism output reflect the Figma composition
instead of flattening everything into a generic container.

### Images and vectors

Image fill references are collected from the complete Figma tree. The backend
queries the Figma images endpoint, downloads private image URLs, and stores each
asset as:

```text
src/assets/figma-<image-reference>.png
```

Figma endpoint and CDN fetches use bounded retry for transient network errors,
HTTP 429, and server failures. Generated React code resolves packaged assets
with `new URL(..., import.meta.url)` where applicable.

Vector fill/stroke geometry is retained as normalized SVG paths and emitted in
React/CSS output rather than replaced with arbitrary text glyphs. Standard UI
icons use `lucide-react`, which is included in the generated package.

## Version reservation

Version selection occurs before the run is created so each persisted run has an
immutable identity.

1. Read the system npm registry.
2. Request `<encoded-package-name>/latest`, optionally authenticated with the
   configured npm token.
3. Read the newest persisted run for the same package name.
4. Select the greater valid semantic version from the registry and persisted
   run.
5. Increment its patch component; use `1.0.0` when neither exists. When the
   newest run used a different generation contract, increment the major
   component because the generated public API changes.
6. Serialize reservations within the backend process so concurrent requests do
   not receive the same local assignment.
7. Persist `packageName`, `packageVersion`, and the Design System's generation
   contract snapshot on the new run.
8. Best-effort synchronize the assigned version into runtime configuration.

Example:

| Registry latest | Latest assigned run | New version |
| --------------- | ------------------- | ----------- |
| none            | none                | `1.0.0`     |
| `1.4.2`         | none                | `1.4.3`     |
| `1.4.2`         | `1.4.4`             | `1.4.5`     |
| `1.4.2`         | `1.4.4` on another contract | `2.0.0` |

The user never enters or patches a package version.

## Execution lifecycle

### 1. Queue

- Verify owner-scoped Design System.
- Read runtime configuration.
- Require npm token only when publication was requested.
- Reserve version.
- Create `pending` Generation Run with zero metrics.
- Persist `queued` event.
- Schedule background execution.
- Return `202` with run ID.

### 2. Start and retrieve source

- Reload run with its Design System relation.
- Set `running` and `startedAt`.
- Persist `retrieving_source`.
- Load Figma JSON.
- Store `raw/figma-file.json` privately.

### 3. Normalize

- Persist `normalizing`.
- Extract tokens and font sources.
- Extract atoms, molecules, organisms, variants, composition, visuals, vectors,
  styles, and image references.
- Calculate component/token/warning/error counts.
- Persist every compiler diagnostic as `diagnostic_warning` or
  `diagnostic_error` before external image retrieval.
- Download image assets.

Persisting metrics/diagnostics before image retrieval ensures a later network
failure does not erase work the compiler already completed.

### 4. Generate package

- Persist `generating`.
- Generate CSS from tokens, fonts, normalized styles, layout, visual children,
  variants, animations, and assets.
- Generate typed React components and indexes. Under `composable-v1`, emit
  stateless views, typed part/slot APIs, contract descriptors, behavior
  adapters, and a package-root manifest.
- Generate a foundation-token story, per-variant stories, and all-variant
  matrices.
- Assemble package metadata and tooling.

### 5. Store

- Persist `storing`.
- Write the unpacked local package tree in local mode.
- Build a ZIP in both modes.
- Store the versioned ZIP locally or in S3.
- Persist artifact count and internal reference.

### 6. Optional npm publication

When `publishToNpm=true`:

- persist `publishing`;
- create a private temporary working directory;
- validate every artifact remains under the package root;
- write a mode-0600 temporary `.npmrc` outside the package root;
- run `npm install --include=dev --ignore-scripts --no-audit --no-fund` so the
  generated package's build toolchain is present even when the backend itself
  runs with `NODE_ENV=production`;
- run the generated TypeScript build;
- run `npm publish --ignore-scripts --access public`;
- remove the entire temporary directory in `finally`;
- set `publishedAt` and Design System `lastPublishedVersion`;
- synchronize the published version to runtime configuration.

The token is never placed in package artifacts or process logs. Successful npm
output is discarded. Failed commands retain bounded, sanitized stdout/stderr,
the npm phase, exit code, and terminating signal for structured backend logs.

Publication failure does not invalidate a successfully generated package. The
run remains `succeeded`, the artifact stays downloadable, and
`publicationFailureSummary` plus `publication_failed` explain the partial
outcome.

### 7. Complete or fail

Success sets `succeeded`, `completedAt`, and `completed`.

An execution error:

- logs safe run ID, Design System ID, operation, error class/message/stack,
  error and HTTP codes, subprocess context, AWS request metadata, and cause when
  present;
- sets `failed`, `completedAt`, and a generic safe `failureSummary`;
- increments `errorCount`;
- persists a phase-specific safe `diagnostic_error`, such as
  `FIGMA_IMAGE_RETRIEVAL_FAILED`;
- persists terminal `failed`;
- never persists raw exception messages, credentials, or stack traces in the
  user-facing generation-event stream. Detailed backend logs are sanitized and
  bounded before emission.

## Diagnostic codes

Compiler diagnostics currently include:

| Code                     | Severity | Meaning                                                       |
| ------------------------ | -------- | ------------------------------------------------------------- |
| `UNKNOWN_METADATA`       | warning  | Component property is outside recognized metadata namespaces. |
| `MISSING_SIZING_INTENT`  | warning  | Width or height mode is not explicit/resolvable.              |
| `FIXED_WIDTH_REQUIRED`   | error    | Fixed width has no numeric width.                             |
| `FIXED_HEIGHT_REQUIRED`  | error    | Fixed height has no numeric height.                           |
| `IMAGE_ALT_REQUIRED`     | error    | Non-decorative image lacks alt text.                          |
| `SEMANTIC_ELEMENT_FALLBACK` | warning | A void HTML root cannot represent the component's visual tree, so the view uses a safe container. |
| `FONT_SOURCE_UNRESOLVED` | warning  | Used font family has no `font-source.*` declaration.          |
| `UNKNOWN_COMPONENT_PART` | warning  | A semantic part is outside its component behavior contract.   |
| `REQUIRED_COMPONENT_PART_MISSING` | warning | A view can be generated but its default behavior adapter cannot be attached. |
| `VARIANT_PART_MISMATCH` | warning | Component-set variants do not expose the same stable parts. |
| `COMPONENT_PART_CARDINALITY_MISMATCH` | warning | Repeated behavior parts cannot be paired safely, such as three accordion items but only one panel. |

Runtime failure diagnostics use safe operation-specific codes, including source
retrieval, normalization, image retrieval, package generation, storage,
diagnostic persistence, and final state persistence failures.

## Generated package output

For package `@organization/design-system` at `1.4.3`, the archive is named:

```text
organization-design-system-1.4.3.zip
```

Representative tree:

```text
organization-design-system/
  package.json
  README.md
  tsconfig.json
  .storybook/
    main.ts
    preview.ts
  src/
    index.ts
    styles/
      kolibri.css
    assets/
      figma-<image-ref>.png
    components/
      index.ts
      Button.tsx
      Button.stories.tsx
      Alert.tsx
      Alert.stories.tsx
      ...one component and story module per imported component
      DesignTokens.stories.tsx
```

With `composable-v1`, each component is a folder containing
`<Name>.view.tsx`, `<Name>.contract.ts`, the default `<Name>.tsx` behavior
binding when complete, its Storybook story, and a barrel. The package also
contains `src/behaviors/index.tsx`, root `styles/` and `assets/` directories,
and `kolibri.manifest.json`. See
[Generated component contracts](component-contracts.md) for the exact API.

The manifest contains:

- configured npm name and backend-assigned version;
- Design System description when present (field omitted when absent);
- ESM/type entry points;
- package export for the component index and `styles/kolibri.css`;
- public registry publish configuration;
- build and Storybook scripts;
- React peer dependency;
- `lucide-react` runtime dependency;
- TypeScript, Vite, React, and Storybook development dependencies;
- published file allowlist covering compiled output, source/stories,
  Storybook configuration, root CSS/assets, README, and the composable manifest.

## Consumer workflow

Downloaded package:

```bash
unzip organization-design-system-1.4.3.zip
cd organization-design-system
npm install
npm run build
npm run storybook
```

Application use:

```tsx
import "@organization/design-system/styles/kolibri.css";
import { Alert, Button } from "@organization/design-system";

export function Example() {
  return (
    <Alert tone="info" action="Review">
      Something requires your attention.
    </Alert>
  );
}
```

If published, consumers install the exact version from the configured registry:

```bash
npm install @organization/design-system@1.4.3
```

## Counts

| Metric     | Definition                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------- |
| Components | Imported top-level components/component sets on recognized component pages.                       |
| Tokens     | Unique normalized foundation CSS tokens.                                                          |
| Artifacts  | Files passed to storage, including package metadata, CSS, component modules, stories, and assets. |
| Warnings   | Persisted importer/compiler warning diagnostics.                                                  |
| Errors     | Compiler error diagnostics plus one safe runtime error when execution aborts.                     |
