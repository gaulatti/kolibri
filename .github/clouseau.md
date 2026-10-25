# Kolibri repository purpose

Kolibri is a private, unlaunched, authenticated design-system compiler. It imports
Figma source, normalizes tokens and components, and produces versioned
React/TypeScript/CSS packages with Storybook. Owner-scoped generation history,
events, diagnostics, downloads and optional npm publication are part of its
product contract. The renderer-neutral contract and Bleecker conformance proof
preserve explicit producer/consumer boundaries.

`docs/README.md`, `docs/architecture.md`, `docs/api.md`,
`docs/generation-pipeline.md`, and `docs/component-contracts.md` define existing
behavior. `docs/private-repository-provenance.md` requires continued privacy and
explicitly defers public launch until graduation. Deployment remains manual-only.

Acceptance requires real tests and exact nonempty 100% line and branch coverage
for the complete executable application inventory. Do not exclude production
paths, weaken thresholds, replace behavior with test shortcuts, or invent an
application to manufacture coverage. Keep shared Clouseau implementation,
scoring, review protocol, provider qualification, and receipt validation in the
public central project. This repository owns its purpose, verification recipe,
source inventory, ownership and deployment contract, and thin integration.

The accepted task is to install the supported Clouseau integration without
weakening controls or triggering production infrastructure. Proposed installation
files do not authorize themselves. The initial blockers and verified baseline
are recorded in `docs/clouseau-installation.md`.

The accepted source-merge policy permits automatic merge only for an internal
PR whose author owns every affected path under immutable accepted-base
CODEOWNERS, including old and new rename paths, after the full test suite,
exact 100% line and branch coverage and current-head/base Clouseau approval
pass. External or non-owner PRs require current-head human code-owner approval
and manual merge. Missing ownership or unverifiable membership denies automatic
merge. A proposed ownership edit cannot authorize its own author.

The released shared private-plan owner-only path is prepared; automatic delivery
remains unactivated until initial trust is accepted and its actual gates are
verified. Native repository auto-merge stays disabled on this supported private
plan. Only the shared acceptance gate may perform an eligible automatic merge;
proposed configuration grants no authority. Do not implement a competing consumer
controller or weaken checks.
This source-merge policy does not authorize a deployment: the product remains
private and deployment workflows remain manual-only.
