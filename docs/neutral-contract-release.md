# Renderer-neutral contract release

Kolibri's private `contract/releases/0.1.0` bundle is the immutable integration
surface for web, native, and React Native consumers. It does not publish a
package, launch a service, or require access to Kolibri backend source.

## Build and validate

```sh
npm --prefix contract run build
npm --prefix contract test
npm --prefix contract run verify:determinism
npm --prefix contract run validate
```

A clean consumer may copy only `contract/releases/0.1.0` and run:

```sh
node releases/0.1.0/bin/validate.mjs releases/0.1.0
```

The validator checks every artifact's SHA-256 and byte length plus the release
and schema versions. To validate a consumer document against the bundled
contract rules, pass it as a second path:

```sh
node releases/0.1.0/bin/validate.mjs releases/0.1.0 path/to/contract.json
```

It imports no unpublished Kolibri module.

## Contract and ordering

Schema `1.0.0` describes component trees, component references, semantic parts,
events, actions, assets, and behavior sequences. Composition references a
component by stable `componentId`. Every identifier is unique within its scope;
missing references fail validation. Sequence steps are serialized and executed
in ascending, consecutive `order`, beginning at one. Duplicate identifiers,
missing event/action/component references, unsupported behavior keys, and
incompatible schema versions fail with a path or identifier in the diagnostic.

The checked-in golden fixtures cover a static component, a composed component,
and a two-step sequential behavior. `manifest.json` records release `0.1.0`,
schema `1.0.0`, compatibility range `>=1.0.0 <2.0.0`, the exact landed compiler
source revision, and checksums for every distributable artifact.

## Compatibility policy

- Additive: optional fields or new enum values may be introduced only in a new
  schema minor version, after old consumers demonstrate that they ignore the
  addition safely. The release compatibility range must be updated explicitly.
- Breaking: removing or renaming a field, changing behavior ordering, making an
  optional field required, or changing a field's meaning requires a new schema
  major version and a new immutable release directory.
- Patch: documentation and validator fixes that do not change accepted data may
  use a release patch. Existing release directories are never overwritten after
  landing; a correction creates a new version.
- Consumers pin the complete release directory and verify its manifest before
  reading fixtures. Generated output never overwrites hand-authored consumer
  source.

Kolibri remains private and unlaunched until graduation. This bundle is local
conformance evidence only: there is no registry publication, hosted demo,
consumer rollout, repository visibility change, or marketing in this release.
