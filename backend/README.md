# Kolibri backend

Kolibri's NestJS backend is the authenticated API and generation worker for the
application. It stores application records in PostgreSQL in every environment, validates Cognito
access tokens, keeps runtime credentials in local SQLite or production AWS Secrets Manager, retrieves Figma
files, generates design-system packages, optionally publishes them to npm, and
stores generation material either locally or in the private S3 generation
bucket.

Detailed system contracts:

- **Required before generation:** [Universal Figma compatibility prompt](../docs/figma-compatibility-prompt.md)
- [Architecture and data](../docs/architecture.md)
- [HTTP API](../docs/api.md)
- [Generation pipeline and package output](../docs/generation-pipeline.md)
- [Generated component contracts and adapters](../docs/component-contracts.md)
- [Operations and deployment](../docs/operations.md)

## Runtime responsibilities

| Area                                                         | Responsibility                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `src/auth`                                                   | Cognito JWT validation and the authenticated user context.                                             |
| `src/design-systems`                                         | Owner-scoped design-system CRUD.                                                                       |
| `src/secrets`                                                | UUID-keyed runtime configuration in local SQLite or one production CDK-managed Secrets Manager secret. |
| `src/generation`                                             | Persisted runs, events, status, history, and orchestration.                                            |
| `src/reports`                                                | Owner-scoped generation-history report data.                                                           |
| `src/persistence`                                            | TypeORM entities and migration-driven PostgreSQL persistence.                                          |
| `src/storage`                                                | Polymorphic local or private-S3 generation storage.                                                    |
| `src/clients/figma`                                          | Figma Files API access.                                                                                |
| `src/figma-importer`                                         | Token/component extraction and diagnostics.                                                            |
| `src/component-contracts`                                    | Semantic parts, behavior-family resolution, and contract validation.                                   |
| `src/css-exporter`, `src/exporters`, `src/package-assembler` | Generated package production.                                                                          |
| `src/npm-publication`                                        | Registry version lookup and isolated npm package publication.                                          |

Application API routes are authenticated by default. `GET /health` is public.
Ownership always comes from the verified Cognito identity; APIs do not accept an
owner identifier from the browser.

The generation workflow is:

1. Create an owned design-system record containing its display name
   and optional description.
2. Read and edit its non-secret runtime settings through
   `GET/PATCH /v1/design-systems/:id/runtime-configuration`. This includes the
   Figma file key and package name. Kolibri resolves the version and registry.
3. Set or rotate each token independently through
   `PUT /v1/design-systems/:id/runtime-credentials`. Send either
   `{ "figmaAccessToken": "..." }` or `{ "npmToken": "..." }`; an omitted
   token is preserved. Token values are write-only, and reads return only
   configured/not-configured flags.
4. Queue a run with `POST /v1/generations` and
   `{ "designSystemId": "..." }`.
5. Follow persisted progress at `GET /v1/generations/:id/events` and recover
   status at `GET /v1/generations/:id`.
6. Download a successful artifact from
   `GET /v1/generations/:id/artifact`.

To publish as part of a run, send
`{ "designSystemId": "...", "publishToNpm": true }`. The npm token must already
be configured. Every run reads the registry's current `latest` version and
compares it with versions already assigned to persisted runs before incrementing
the patch component. It generates and stores the artifact with that exact
version. When publication is requested, it builds and publishes the package,
then records the published version on the design-system record
and synchronizes the version in runtime configuration. A publication failure
does not discard an artifact that was generated successfully.

## Local development with Docker Compose

The supported full-stack local setup is the root `compose.yaml`. It starts
PostgreSQL, creates the local SQLite Secrets Manager substitutes and artifact
directories, runs PostgreSQL migrations, starts the backend, and starts the
frontend:

```bash
cd /path/to/d424
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Fill in the public Cognito identifiers in both localized files.
docker compose config
docker compose up --build --watch
```

The API is available at `https://api.kolibri.dev`, and its public health endpoint
is `https://api.kolibri.dev/health`. Compose publishes port `3188` only as the
local nginx upstream. PostgreSQL stores all application records in the
`postgres-data` volume. SQLite files under `/app/data` substitute only for the
two Secrets Manager documents: `system-configuration.sqlite` for system runtime
settings and `runtime-configuration.sqlite` for Design System runtime settings
and credentials. Generated material is stored under `artifacts/`. Development
performs no Secrets Manager or S3 calls and requires no AWS credentials. Cognito
remains available for login.

## Running backend commands directly

Install and verify from this directory:

```bash
npm ci
npm run build
npm test -- --runInBand
```

For complete local verification, also run `npm run test:types` and
`npm run test:cov`. Coverage uses the same full-program TypeScript compiler as
the application build, then Jest's native Istanbul instrumentation with inline
source maps back to every executable module under `src/`. It measures unloaded
modules as well as imported code and excludes only test files. The command
cleans its ignored `.test-build/` output before compilation, writes the native
`coverage/coverage-final.json`, and fails unless line, branch, statement and
function coverage are exactly 100%. Tests retain the real Nest module graph,
HTTP authorization boundaries and SQLite persistence checks; external provider
failure paths use deterministic dependency-boundary fixtures.

Modules containing only type aliases and explicit type imports use `.d.ts`
declaration filenames. Runtime constants and other executable modules keep
`.ts` filenames and remain instrumented. TypeScript checks the declarations;
Nest's supported asset copy retains them in `dist/` for dependent generated
declarations. This naming does not remove executable code or alter coverage
counters. The declaration migration was checked against the TypeScript AST and
preserved every remaining emitted runtime module body.

Direct development startup still requires PostgreSQL. By default local mode
targets the Compose hostname `postgres`; set `DATABASE_HOST`, `DATABASE_PORT`,
`DATABASE_NAME`, `DATABASE_USER`, and `DATABASE_PASSWORD` to use a PostgreSQL
instance reachable from the host. Local runtime settings remain in the SQLite
files under `backend/data/`.

Migration commands are:

```bash
npm run migration:show
npm run migration:run
npm run migration:revert

# Compiled production image/process:
npm run migration:run:prod
```

TypeORM synchronization is disabled. Every schema change must be represented by
a migration, and migrations must run before a new backend image starts.

## Backend environment

Copy `.env.example` to the untracked `.env` file for non-Compose local commands.
The backend accepts only these runtime environment variables:

| Variable                | Required in production | Source                                                                                                                                                          |
| ----------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                  | Yes                    | On-premises runtime setting.                                                                                                                                    |
| `CORS_ALLOWED_ORIGINS`  | Yes                    | Comma-separated canonical frontend origins.                                                                                                                     |
| `AWS_REGION`            | Yes                    | `AwsRegion` CDK output.                                                                                                                                         |
| `COGNITO_USER_POOL_ID`  | Yes                    | `CognitoUserPoolId` CDK output.                                                                                                                                 |
| `COGNITO_APP_CLIENT_ID` | Yes                    | `FrontendCognitoClientId` CDK output.                                                                                                                           |
| `KOLIBRI_STACK_NAME`    | Yes                    | `KolibriStackName` CDK output.                                                                                                                                  |
| `KOLIBRI_RUNTIME_MODE`  | No                     | `local` or `production`. Unset defaults from `NODE_ENV`; set `production` to exercise PostgreSQL, Secrets Manager, and S3 while running the development server. |
| `DATABASE_*`            | No                     | Optional local-only PostgreSQL overrides for commands run outside Compose. Production reads the connection exclusively from the system secret.                  |

AWS credentials are not application environment variables. The AWS SDK uses its
standard credential provider chain. The production container mounts the
on-premises deployment user's `~/.aws` directory read-only at
`/home/node/.aws`; the default profile in that directory must identify the
CDK-created backend runtime user.

There are deliberately no `DATABASE_*`, `STORAGE_*`, Figma-token, JWT, Google,
or AWS access-key variables in `backend/.env.example`. Production PostgreSQL and
storage settings are read from `<KOLIBRI_STACK_NAME>/system`. All design-system
runtime configuration lives in the single CDK-created
`<KOLIBRI_STACK_NAME>/runtime/design-systems` secret.

The persistence boundary is invariant: TypeORM application entities always use
PostgreSQL. A local `kolibri.sqlite` file is a legacy artifact from an older
development version and is never opened by the current application. SQLite is used only
by the local implementations of the two Secrets Manager documents.

PostgreSQL stores each design system's ID, owner relationship, display name,
optional description, last successfully published version, timestamps, and
generation relationships. It does not
store the Figma file key, Figma token, package generation configuration,
npm token, or a secret reference. Each generation run snapshots its package
name, version, and generation contract so history remains correct after runtime
configuration or generator-mode changes.

The production shared runtime secret is a JSON object whose top-level keys are
PostgreSQL design-system UUIDs:

```json
{
  "8b4a26d4-50ce-4e45-936d-35f04cc098cb": {
    "figma": {
      "fileKey": "AbCdEfGhIjKlMnOp",
      "accessToken": "replace-with-figma-token"
    },
    "package": {
      "name": "@organization/design-system",
      "version": "1.0.0"
    },
    "npm": {
      "token": "replace-with-npm-token"
    }
  }
}
```

CDK creates this secret without an initial value. A missing current version or
blank value is treated as `{}` when the first owned design system is configured;
the first write therefore creates a valid object. A generation read does not
treat missing configuration as usable and fails with a safe message. The
backend only reads and replaces the value of this one secret. It never creates
or deletes a Secrets Manager resource.

Figma and npm credentials are additive. Each can be introduced or rotated with
its own request and form; updating one credential preserves the other one and
all readable runtime settings.

The authenticated runtime-configuration read API deliberately returns the
Figma file key, package name, backend-assigned version, and system registry
because they are not secret.
It never returns Figma or npm tokens. Operational failures produce bounded,
structured logs containing correlation IDs, failing operation, sanitized error
message and stack, error/code fields, process command/exit/signal/output where
applicable, HTTP status, and AWS request metadata. Known credential patterns and
the active Figma/npm token values are replaced with `[REDACTED]` before logging.

## Production PostgreSQL and system secret

The complete production database creation, grants, system-secret JSON, AWS
runtime-user setup, migration procedure, and deployment verification are in the
[infrastructure deployment runbook](../infrastructure/README.md#production-postgresql).

The infrastructure deployment initializes a missing `npm.registry` value by
merging `https://registry.npmjs.org` into the system secret without replacing
existing fields. The backend also uses that default in memory when handling an
older deployment whose npm section has not been initialized yet.

The system secret is mandatory once production configuration is populated and
must contain `postgresql`, `storage`, and `npm` objects. Malformed configuration,
AWS permission failures, and AWS/network failures are fatal; the backend does
not silently fall back after successfully locating a populated production
secret.

## Generated artifacts

Local generation stores private source snapshots and generated packages beneath
`backend/artifacts/runs/<run-id>/`. S3 generation uses the private generation
bucket and `<KOLIBRI_STACK_NAME>/runs/<run-id>/` prefix. Raw Figma
snapshots are never exposed by the normal artifact endpoint.

Compiler warnings and errors are persisted as safe generation events for the
run that produced them. Each entry includes its diagnostic code, user-facing
message, and component/node context when available. The generation detail page
separates these diagnostics from the progress timeline, so warning and error
counts always have inspectable details after refresh or disconnection. Tokens,
raw source payloads, exception messages, stack traces, and credentials are not
stored in diagnostic events.

Generated packages contain package metadata, token-aware CSS, typed React
components, and Storybook configuration/stories. New Design Systems use the
`composable-v1` contract: stateless views expose named slots and part props,
while generated higher-order adapters own interaction behavior. Existing
Design Systems remain on `legacy` until explicitly migrated. Full authoring,
consumer, manifest, and migration contracts are in
[Generated component contracts](../docs/component-contracts.md). Generated
output is build material and must not be committed to this repository.

Optional npm publication uses a temporary directory and a temporary mode-0600
`.npmrc` outside the package root. Lifecycle scripts are disabled during install
and publish, build-only dependencies are explicitly installed even when the
backend runs with `NODE_ENV=production`, and the credential file is removed
after every attempt. Successful npm output is discarded. On failure, bounded
stdout/stderr is sanitized and attached to the structured backend log and safe
persisted publication summary. Publishing currently targets public packages;
the npm token must have permission to publish the configured package and
organization.
The registry is system configuration: production reads `npm.registry` from the
system secret, while local mode reads the same value from
`data/system-configuration.sqlite`. The local Secrets Manager substitute writes
`https://registry.npmjs.org` when it initializes an empty database.
Users never submit a registry or package version. Saving package configuration
looks up the package and assigns `1.0.0` when it does not exist, or the next
patch version when it does. Every generation repeats the lookup and also
considers versions already assigned to persisted runs before fixing the run's
immutable package version.
The first reservation after changing between `legacy` and `composable-v1`
advances the major version because generated exports and extension points are a
breaking contract change.

To use another registry locally, update the `npm.registry` field in the JSON
document stored by `data/system-configuration.sqlite` through an appropriate
local configuration tool, then restart the backend. The value must be HTTPS,
except that HTTP is accepted for a registry running on localhost.

## Security boundaries

- Never store passwords, Figma tokens, Google credentials, Cognito tokens, or
  AWS credentials in PostgreSQL, browser storage, logs, documentation examples,
  generated artifacts, or commits.
- The database stores only Cognito `sub` as the external user reference.
- The browser sends only the authenticated design-system ID and an optional
  publication choice when starting a generation.
- Design-system runtime values are retrieved only when a generation needs them.
- S3 objects remain private; artifact access is owner-scoped and time-bounded.
