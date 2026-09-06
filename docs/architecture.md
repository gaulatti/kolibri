# Architecture and data

> **Figma authoring prerequisite:** Every new or structurally changed Design
> System must pass the
> [Universal Figma compatibility prompt](figma-compatibility-prompt.md) before
> generation. Its deterministic decisions are part of the compiler boundary.

## Goals and boundaries

kolibri converts an owned Figma design system into a reusable code package. It
must keep identity, external credentials, source snapshots, generated material,
and ownership boundaries explicit.

AWS hosts the public frontend and managed supporting services. The production
NestJS backend and PostgreSQL database remain on premises. CDK does **not**
provision a backend compute service or PostgreSQL instance.

## Component topology

```text
Browser
  |
  | HTTPS: static application
  v
Route 53 -> CloudFront -> private frontend S3 bucket
  |
  | Cognito hosted authorization + Google federation
  v
Amazon Cognito

Browser
  |
  | HTTPS: Bearer access token
  v
On-premises NestJS backend
  |-- PostgreSQL (application records in every environment)
  |-- SQLite (local substitute for Secrets Manager only)
  |-- Secrets Manager (production system + Design System runtime config)
  |-- Figma Files/Image APIs
  |-- private generation S3 bucket (production)
  |-- local artifact volume (development)
  |-- npm registry (version lookup and optional publication)
  `-- CloudWatch Logs through the Docker awslogs driver (production)
```

## Backend module responsibilities

| Module              | Responsibility                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `auth`              | Validate Cognito access JWTs and establish `AuthenticatedUser`.                                                   |
| `design-systems`    | Owner-scoped database CRUD and coordinated deletion.                                                              |
| `secrets`           | Read/update the single runtime configuration document without exposing tokens.                                    |
| `generation`        | Reserve versions, queue work, persist runs/events, generate, publish, and serve status/history.                   |
| `figma-importer`    | Convert Figma REST data into kolibri's normalized intermediate model.                                             |
| `component-contracts` | Resolve semantic parts and behavior families, validate completeness, and annotate the intermediate model.       |
| `css-exporter`      | Produce tokens, font imports, component selectors, variants, responsive layout, vectors, and visuals as CSS.      |
| `exporters/react`   | Produce typed legacy components or composable views, contracts, adapters, manifests, and Storybook stories.       |
| `package-assembler` | Assemble the package manifest, README, TypeScript config, Storybook config, exports, CSS, components, and assets. |
| `npm-publication`   | Resolve versions, build in an isolated directory, and publish without exposing the npm token.                     |
| `storage`           | Polymorphic local/S3 snapshot and artifact storage.                                                               |
| `persistence`       | TypeORM entities and explicit PostgreSQL migrations.                                                              |
| `dashboard`         | Seven-day portfolio metrics and per-Design-System health.                                                         |
| `reports`           | Onscreen generation-history report built from reusable history queries.                                           |

## Frontend architecture

The frontend is a client-rendered React Router application built as static
files. It has no server-rendered application dependency in production.

- Cognito authorization uses Authorization Code + PKCE.
- Callback and logout paths are derived from the browser origin:
  `/auth/callback` and `/sign-in?signedOut=1`.
- Access tokens are attached through the authenticated API client.
- Access tokens are not placed in SSE URLs; the progress stream uses an
  authenticated fetch-based SSE client.
- Protected routes redirect unauthenticated users to sign-in.
- Session restoration occurs inside the normal application shell.
- All application UI and layout primitives come from
  `@gaulatti/bleecker`; kolibri does not maintain a parallel component system.

### Browser routes and information architecture

| Route                                            | Access                           | Purpose                                                                                              |
| ------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/sign-in`                                       | public                           | Starts Cognito-hosted Google sign-in. Authenticated sessions leave this route.                       |
| `/auth/callback`                                 | public callback                  | Validates OAuth state/PKCE, exchanges the authorization code, and restores the intended destination. |
| `/`                                              | protected                        | Seven-day portfolio dashboard and Design System health.                                              |
| `/design-systems`                                | protected                        | Owned Design System list and create entry point.                                                     |
| `/design-systems/new`                            | protected                        | Display-name/description creation form.                                                              |
| `/design-systems/:designSystemId`                | protected                        | Design System workspace with Generate, Configuration, Credentials, and History tabs.                 |
| `/design-systems/:designSystemId/edit`           | protected                        | Edit display name and description.                                                                   |
| `/generations/:generationId`                     | protected                        | Progress, metrics, timing, artifact, and diagnostics for one run.                                    |
| `/design-systems/:designSystemId/history/report` | protected                        | Onscreen report for that Design System's applied history filters.                                    |
| `/generations/new`                               | protected compatibility redirect | Redirects to the requested Design System's Generate tab, or the Design System list.                  |

History is intentionally contextual to a Design System in the UI. The backend
history API remains reusable across all owned Design Systems for reporting and
other clients.

## Authentication and identity

All API routes are protected by the global Cognito guard unless explicitly
marked public. `GET /health` is public.

The browser sends:

```http
Authorization: Bearer <Cognito access token>
```

The backend verifier checks:

- JWT signature against the configured Cognito user pool.
- token use is `access`.
- app-client ID matches `COGNITO_APP_CLIENT_ID`.
- expiry and other Cognito claims accepted by `aws-jwt-verify`.

The verified Cognito `sub` is the authoritative external identity. The backend
atomically finds or creates one `UserReference` and passes this typed context:

```ts
type AuthenticatedUser = {
  userReferenceId: string;
  cognitoSub: string;
};
```

Passwords, raw JWTs, refresh tokens, Google tokens, names, email addresses, and
other profile data are not persisted in the backend database.

## Ownership model

Ownership is never accepted from request bodies or query parameters.

- `DesignSystem.ownerId` is derived from the authenticated `UserReference`.
- Design System list/get/update/delete queries include `ownerId`.
- Generation status, events, artifacts, history, report, and dashboard queries
  join through the Design System owner.
- An inaccessible UUID returns `404`, whether it does not exist or belongs to
  another user. This avoids disclosing another tenant's resources.

## Relational model

Schema changes are migration-driven. TypeORM `synchronize` is disabled in all
modes.

### `user_references`

| Field         | Type                 | Meaning                             |
| ------------- | -------------------- | ----------------------------------- |
| `id`          | UUID primary key     | Internal owner reference.           |
| `cognito_sub` | varchar(128), unique | Authoritative Cognito subject.      |
| `created_at`  | timestamp            | First successful authenticated use. |

### `design_systems`

| Field                      | Type                    | Meaning                                                    |
| -------------------------- | ----------------------- | ---------------------------------------------------------- |
| `id`                       | UUID primary key        | Also the key in the shared runtime configuration document. |
| `owner_id`                 | UUID FK                 | References `user_references`; indexed.                     |
| `name`                     | varchar(200)            | Display name.                                              |
| `description`              | varchar(1000), nullable | Display description and generated npm package description. |
| `generation_contract`      | varchar(32)             | `legacy` or `composable-v1`; new records default to composable output. |
| `last_published_version`   | varchar(64), nullable   | Most recent successful npm publication.                    |
| `created_at`, `updated_at` | timestamps              | Record lifecycle.                                          |

The database deliberately does not store Figma file keys, tokens, npm tokens,
or package-generation credentials.

### `generation_runs`

| Field                                              | Type                    | Meaning                                                          |
| -------------------------------------------------- | ----------------------- | ---------------------------------------------------------------- |
| `id`                                               | UUID primary key        | Stable run identifier and storage namespace.                     |
| `design_system_id`                                 | UUID FK                 | Owned Design System; indexed.                                    |
| `status`                                           | enum                    | `pending`, `running`, `succeeded`, or `failed`.                  |
| `started_at`, `completed_at`                       | timestamps, nullable    | Execution boundaries.                                            |
| `package_name`, `package_version`                  | varchar                 | Immutable package identity snapshot for history.                 |
| `generation_contract`                              | varchar(32)             | Immutable generator/API contract used for this artifact.         |
| `publish_requested`                                | boolean                 | Whether this run attempted npm publication.                      |
| `published_at`                                     | timestamp, nullable     | Successful npm publication time.                                 |
| `publication_failure_summary`                      | varchar(1000), nullable | Safe publication-only error. Generation may still succeed.       |
| `artifact_count`, `token_count`, `component_count` | nonnegative integers    | Generation metrics.                                              |
| `warning_count`, `error_count`                     | nonnegative integers    | Compiler diagnostics plus a runtime error when execution aborts. |
| `artifact_reference`                               | varchar(1024), nullable | Internal `local:` or `s3:` reference, never an arbitrary path.   |
| `failure_summary`                                  | varchar(1000), nullable | Safe display text for failed generation.                         |
| `created_at`, `updated_at`                         | timestamps              | Queue and update chronology.                                     |

### `generation_events`

| Field               | Type             | Meaning                                 |
| ------------------- | ---------------- | --------------------------------------- |
| `id`                | UUID primary key | SSE event ID.                           |
| `generation_run_id` | UUID FK          | Parent run; indexed with creation time. |
| `event_type`        | varchar(100)     | Progress phase or diagnostic type.      |
| `message`           | varchar(1000)    | Sanitized user-facing message.          |
| `created_at`        | timestamp        | Persisted event order.                  |

Foreign-key deletion behavior is explicit:

- deleting a user cascades to Design Systems;
- deleting a Design System cascades to runs;
- deleting a run cascades to events;
- the Design System service first removes local/S3 artifacts and its entry from
  runtime configuration, then deletes the database record.

## Runtime configuration model

### Local mode

- Application data: PostgreSQL in the Compose `postgres-data` volume.
- System runtime settings: `data/system-configuration.sqlite`.
- Design System runtime settings and credentials:
  `data/runtime-configuration.sqlite`.
- Generated material: `artifacts/runs/<run-id>/`.
- No Secrets Manager or S3 calls.

The two local SQLite files are Secrets Manager substitutes. Each contains one
JSON document with the same logical shape as its corresponding production
secret. Neither SQLite file contains application records; TypeORM always uses
PostgreSQL for users, Design Systems, runs, and events.

This is an architectural invariant, not a provider preference: changing
`KOLIBRI_RUNTIME_MODE` changes secret and artifact providers, but it never
changes the TypeORM database engine. A `kolibri.sqlite` file from an older local
checkout is not an active application database.

### Production mode

The stack name is the namespace:

```text
<KOLIBRI_STACK_NAME>/system
<KOLIBRI_STACK_NAME>/runtime/design-systems
<KOLIBRI_STACK_NAME>/runs/<run-id>/...
```

The system secret contains infrastructure/runtime settings:

```json
{
  "postgresql": {
    "host": "postgres.internal.example",
    "port": 5432,
    "database": "kolibri",
    "username": "kolibri_runtime",
    "password": "replace-with-database-password",
    "ssl": true,
    "sslRejectUnauthorized": true
  },
  "storage": {
    "driver": "s3",
    "bucket": "replace-with-generation-bucket",
    "presignedUrlTtlSeconds": 300
  },
  "npm": {
    "registry": "https://registry.npmjs.org"
  }
}
```

The shared Design System runtime secret is keyed by PostgreSQL
`design_systems.id`:

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

There is one secret for all Design Systems, not one AWS secret per tenant.
Tokens are independently additive: updating the Figma token preserves npm
configuration, and updating the npm token preserves Figma configuration.
Reads expose the file key, package name, assigned version, registry, and boolean
credential flags but never either token.

CDK creates both secret resources. The backend updates the value of the shared
runtime secret; it does not create or delete Secrets Manager resources. Empty or
missing initial secret content is treated as `{}` for the first write.

## Runtime mode selection

`KOLIBRI_RUNTIME_MODE` has precedence when set:

| Value                         | Database                      | Runtime config       | Artifacts            |
| ----------------------------- | ----------------------------- | -------------------- | -------------------- |
| `local`                       | Dockerized PostgreSQL         | local SQLite         | local filesystem     |
| `production`                  | PostgreSQL from system secret | Secrets Manager      | private S3           |
| unset + `NODE_ENV=production` | production providers          | production providers | production providers |
| unset + any other `NODE_ENV`  | local providers               | local providers      | local provider       |

Invalid values fail startup. Production does not silently fall back to local
providers when its system secret is absent or malformed.

## Storage model

The generation service depends only on abstract `GenerationStorage` operations:

- store the private raw Figma snapshot;
- store generated artifacts and produce a ZIP;
- resolve authorized artifact access;
- remove material for a deleted Design System.

Local storage validates UUIDs and paths, writes only below `artifacts/`, and
streams the ZIP through the authenticated backend. S3 uses a private,
S3-managed-encrypted bucket. It writes:

```text
<stack>/runs/<run-id>/raw/figma-file.json
<stack>/runs/<run-id>/package/<package-directory>-<version>.zip
```

The normal artifact API never returns raw snapshots. S3 downloads use a
short-lived presigned URL with a configured lifetime from 60 to 900 seconds.

## Security invariants

- No passwords, OAuth secrets, access tokens, raw JWTs, or AWS keys in the
  application database, browser storage, logs, artifacts, or documentation
  values.
- Runtime token APIs are write-only.
- Raw Figma snapshots are private and inaccessible through user artifact APIs.
- S3 buckets block all public access.
- Storage keys and local paths are validated against traversal.
- Backend logs contain run/design-system IDs, operation names, sanitized error
  messages/stacks, codes/statuses, subprocess output, and AWS request metadata.
  Fields are bounded and known credential patterns plus active runtime tokens
  are replaced with `[REDACTED]`.
- User-facing failures and diagnostics are sanitized before persistence.
