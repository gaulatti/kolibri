# Bleecker toggle-family conformance

## Decision

**Proceed with an adapter.** Kolibri release `0.1.0` is sufficient to carry the
renderer-neutral intent for one representative Bleecker component family. It
does not and should not define Bleecker's React API, event wiring, focus ring,
theme presentation, or screen-reader behavior.

This is local conformance evidence, not a Bleecker integration. The separately
mergeable consumer implementation is tracked by
[gaulatti/bleecker#3](https://github.com/gaulatti/bleecker/issues/3). That issue
retains its repository-owned startup and delivery boundary; no Bleecker files
are changed or bypassed here. Kolibri's prerequisite contract release was
delivered by [gaulatti/kolibri#2](https://github.com/gaulatti/kolibri/issues/2).

## Why the toggle family

Bleecker's hand-authored `Toggle`/`ToggleGroup` family is bounded but exercises
more than static structure:

- `default` and `outline` variants plus `sm`, `md`, and `lg` sizes;
- controlled pressed state in both directions and disabled state;
- activation, state-change emission, and focus intent;
- button, accessible-name, and `aria-pressed` semantics; and
- an optional icon asset with a verifiable content identity.

That makes the family representative without expanding this proof into a whole
library, renderer implementation, or pixel-parity exercise.

## Immutable artifact and fixture inventory

`conformance/bleecker-toggle/contract-pin.json` identifies the complete landed
artifact:

- repository merge commit: `f14a631a001f867e208be6053ac07df32fda4dca`;
- release: `0.1.0`;
- schema: `1.0.0`;
- release source revision: `24e6905a0a6b9e6dae08b0832781b0f06f8c0b5f`;
- manifest SHA-256: `aec1a74fb557ab0a5d254b5ac8d98306e552dc88cdb6ebeeb6f98d1460cfe134`.

The proof owns these neutral inputs and expectations:

| File | Evidence |
| --- | --- |
| `fixtures/toggle-family.json` | Variants, state vocabulary, both pressed transitions, declared events/actions, focus target, icon reference, accessible name, and pressed/disabled semantics |
| `assets/bold.svg` | Local neutral icon input whose bytes must match the contract integrity value |
| `expected/semantic-output.json` | Renderer-independent projection of the artifact, family, semantic transitions, asset reference, and ownership boundary |
| `fixtures/incompatible-schema-version.json` | Expected failure that names `$.metadata.schemaVersion`, the rejected value, supported version, and release |

The harness first executes the validator from the immutable release directory.
It then inspects only contract data, verifies the referenced asset's SHA-256,
projects the portable semantics, and compares the result with the checked-in
expectation. Tests repeat the command for byte-stable output and run it from a
clean temporary consumer containing only the release and proof directories.

## Portability boundary

The contract guarantees:

- entrypoint and component identity;
- declared variant and state vocabulary;
- control element and semantic part names;
- accessible-name and pressed-state attributes;
- ordered state, emit, and focus actions; and
- checksummed asset identity.

The renderer or consumer continues to own:

- DOM, native, remote-control, or gesture event wiring;
- disabled-event suppression and controlled-state callback scheduling;
- focus movement, focus-ring presentation, and keyboard modality;
- light/dark tokens, sizing, spacing, motion, and responsive layout;
- actual asset rendering or platform icon substitution; and
- browser/device screen-reader verification and public API stability.

Passing this proof therefore means semantic adaptation can proceed. It does not
claim pixel-identical rendering, runtime accessibility compliance, or that any
consumer integration has shipped.

## Reuse by Sabella and Thompson

Sabella and Thompson can reuse the pin-and-project pattern without copying
Bleecker presentation:

1. pin the whole release manifest rather than a sibling branch or source path;
2. validate the consumer fixture with the release-owned executable;
3. project the same state/event/action/asset semantics into platform-neutral
   expected output; and
4. keep focus, input, accessibility adaptation, view types, and visual tokens in
   the consumer repository.

Native and React Native consumers may substitute platform icons and controls as
long as they preserve the declared accessible name, state vocabulary, event
meaning, action ordering, and asset identity/provenance classification.

## Launch boundary

No package or registry publication, hosted demo, deployment, public repository,
announcement, marketing, or consumer rollout is part of this proof. Kolibri
remains private and unlaunched until graduation.
