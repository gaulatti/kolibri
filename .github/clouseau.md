# Kolibri review contract

Kolibri is a private, authenticated design-system compiler: an owner connects a
Figma file, the NestJS backend normalizes tokens, components and variants into a
versioned React/CSS/Storybook package, and the React Router frontend drives that
workflow behind Cognito. The `contract/` package and `conformance/` suite define
the renderer-neutral output contract. Kolibri is private and unlaunched; its
deployment workflows are manual-only and a merge is never a deployment claim.

Preserve owner scoping on every read and write, write-only runtime credentials
(secrets never leave Secrets Manager or the local substitute), explicit failures
instead of silent fallbacks, deterministic generation output, immutable contract
releases, and the documented generation-run lifecycle and event history. The
Universal Figma compatibility prompt is the authoring contract for design
systems; do not weaken it or the compiler boundary it protects.

Assess purpose and evidence rather than the number of changed files or lines.
Bug fixes, meaningful tests that raise coverage, dependency repairs and
operational maintenance serve this existing product without a new product
decision. New capabilities need repository documentation or linked acceptance
criteria that establish their need and boundaries.

Ask gaulatti for a second opinion for a product-direction or authority decision:
for example a new tenant or sharing model, a new external publication target,
a change to what credentials the backend may read back, or a new public surface.
Ordinary implementation uncertainty and repairable bugs belong to automated
investigation. Changes to review controls, coverage measurement, the immutable
contract release, or this purpose contract require explicit owner confirmation.

Every material capability and mechanism must independently score at least 80 for
fit, need and proportionality under Clouseau's shared protocol. A causal technical
finding at or above 70 blocks; unrelated features or good scores cannot average
away a defect. Integrity and review-completeness gates remain independent.

Tests must assert actual production behavior and failure outcomes. Reject
fabricated coverage, disabled tests, swallowed errors, unconditional assertions
and mocks that replace the behavior being claimed. Exactly 100% line and branch
coverage of the backend application sources under `backend/src` is the
requirement for automatic approval; the backend measures every `.ts` source
(modules, entities and DTOs included) with no exclusions. Below 100% a change
may still be reviewed, but it stays pending for a human merge. Narrowing or
widening this measurement is a review-control change that requires explicit
owner confirmation.

A passing local Clouseau review may be reused only through a signed receipt from
an enrolled trusted workstation and the matching native GitHub author. CI must
independently verify current protected policy, exact head/base and engine content,
expiry, evidence and deterministic scores. All native tests and exact coverage
remain mandatory. Clouseau owns the shared scoring, investigation, repair
bounds, evidence ledger, native approval and auto-merge; this repository owns its
purpose and real tests.
