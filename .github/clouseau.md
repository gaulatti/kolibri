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

For this private repository, the owner permits a supported manual-merge route
when GitHub branch protections are unavailable. Automatic merge must stay
disabled, and the same test, exact coverage and AI review requirements apply.
This exception does not permit a consumer-written bypass of the shared gate.
