# kolibri system documentation

This directory is the canonical technical reference for kolibri. It explains
the deployed system, its contracts, and the complete Figma-to-package workflow.
Component READMEs remain the runbooks for working inside each package.

> **Start every Figma onboarding or structural revision with the
> [Universal Figma compatibility prompt](figma-compatibility-prompt.md).** It is
> the canonical copy-ready authoring contract and includes predetermined
> decisions for composite controls and view-only behavior boundaries.

## Documentation map

| Document                                              | Audience                                  | Contents                                                                                                                                               |
| ----------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Architecture and data](architecture.md)              | Developers, reviewers, operators          | Components, trust boundaries, runtime modes, relational model, secrets, storage, and ownership rules.                                                  |
| [HTTP API](api.md)                                    | Frontend and API developers               | Authentication, validation, every endpoint, request/response examples, SSE, errors, and status codes.                                                  |
| [Generation pipeline](generation-pipeline.md)         | Design-system and compiler developers     | Required inputs, Figma import, normalization, diagnostics, React/CSS/Storybook output, version assignment, storage, publication, and failure behavior. |
| [Bleecker toggle-family conformance](bleecker-toggle-conformance.md) | Contract and renderer developers | Black-box external-family proof, immutable release pin, fixture inventory, portability decision, and consumer ownership. |
| [Universal Figma compatibility prompt](figma-compatibility-prompt.md) | Design-system authors and Figma-side agents | Required copy-ready inventory, repair, semantic contract, deterministic decisions, and validation report. |
| [Operations](operations.md)                           | Local developers and production operators | Configuration ownership, Compose, migrations, AWS/CDK, CI/CD, deployment flow, verification, backup concerns, and troubleshooting.                     |
| [Backend README](../backend/README.md)                | Backend developers                        | NestJS module layout and backend-specific commands.                                                                                                    |
| [Frontend README](../frontend/README.md)              | Frontend developers                       | React Router, Cognito browser flow, Bleecker, static build, and publishing.                                                                            |
| [Infrastructure runbook](../infrastructure/README.md) | AWS/on-premises operators                 | Detailed Google OAuth, PostgreSQL, CDK, IAM, secret initialization, CI variables, and production deployment commands.                                  |

## System in one paragraph

kolibri is an authenticated design-system compiler. A user signs in through
Google federated into Amazon Cognito, creates an owner-scoped Design System,
saves its non-sensitive display record in the application database, and writes
its runtime Figma/npm configuration through write-only credential endpoints.
The backend reads the configured Figma file, stores a private raw snapshot,
normalizes tokens, components, variants, composition, typography, vectors, and
images, then produces a versioned React/TypeScript/CSS package with Storybook.
Each run, diagnostic, metric, event, storage reference, and publication result
is persisted. The package can be downloaded and can optionally be published to
the configured npm registry. History, reports, and the seven-day dashboard are
always scoped to the authenticated owner.

## Primary user workflow

1. Sign in through the Cognito-hosted Google flow.
2. Create a Design System with a display name and optional description.
3. Run the [Universal Figma compatibility prompt](figma-compatibility-prompt.md)
   against the saved source file.
4. Configure a Figma file key or URL and npm package name.
5. Set the Figma access token. Optionally set an npm token independently.
6. Generate a package, optionally requesting npm publication.
7. Follow progress and diagnostics in the authenticated event stream.
8. Inspect metrics, download the ZIP, review history, and monitor portfolio
   health on Home.

## Canonical configuration rule

Configuration belongs to the component that consumes it:

- Browser-safe build values: `frontend/.env.local`.
- Backend process identifiers and runtime mode: `backend/.env`.
- CDK deployment inputs, including Google OAuth credentials:
  `infrastructure/.env`.
- Production database, storage, and npm registry configuration:
  `<stack-name>/system` in Secrets Manager.
- Production per-Design-System runtime configuration:
  one shared `<stack-name>/runtime/design-systems` secret keyed by Design
  System UUID.
- Local application data: Dockerized PostgreSQL in its private data volume.
- Local system and Design System runtime configuration: private SQLite files
  that substitute for the two production Secrets Manager documents.

There is intentionally no root `.env` file.
