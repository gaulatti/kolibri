# Bleecker toggle-family conformance proof

This directory is a black-box consumer of Kolibri's checked-in neutral contract
release. It does not import `contract/src`, Kolibri backend code, Bleecker source,
or an unpublished package.

The fixture models Bleecker's `Toggle` family because it combines two visual
variants, three sizes, pressed and disabled state, ordered state-change events,
focus intent, an icon asset, and accessible button semantics in a small bounded
contract. The fixture is renderer-neutral: it records semantic intent and does
not contain CSS classes, React props, screenshots, or native view types.

## Run the proof

From the repository root:

```sh
npm --prefix contract run validate
npm --prefix conformance/bleecker-toggle test
npm --prefix conformance/bleecker-toggle run conform
```

The successful command emits stable output including the release manifest and
semantic-output SHA-256 values. `contract-pin.json` pins release `0.1.0`, schema
`1.0.0`, its immutable manifest checksum, and the merge commit where the release
landed on `main`.

Capture the required incompatible-contract result with:

```sh
npm --prefix conformance/bleecker-toggle run conform:incompatible
```

It intentionally exits `1` with:

```text
FAIL $.metadata.schemaVersion=2.0.0; supported=1.0.0; release=0.1.0
```

The [portability decision](../../docs/bleecker-toggle-conformance.md) explains
the family rationale, fixture inventory, consumer ownership, and reuse guidance.
