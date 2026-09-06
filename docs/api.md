# HTTP API reference

> Before calling the generation API for a new or structurally changed Design
> System, run the canonical
> [Universal Figma compatibility prompt](figma-compatibility-prompt.md). The
> generation run's persisted diagnostics remain the authoritative result.

## Conventions

### Base URL

Local nginx exposes `https://api.kolibri.dev`. Direct Compose access is
`http://localhost:3188`. Production uses the configured on-premises API origin.

All timestamps are serialized ISO 8601 date-time strings in UTC. IDs are UUID
version 4 values. JSON requests must use `Content-Type: application/json`.

### Authentication

Every route is authenticated unless explicitly documented as public:

```http
Authorization: Bearer <Cognito access token>
```

The token must be a Cognito **access** token for the configured user pool and
app client. An ID token is not accepted.

Authentication responses:

| Status | Meaning                                                       |
| ------ | ------------------------------------------------------------- |
| `401`  | Header missing/malformed, JWT invalid, or JWT expired.        |
| `403`  | JWT verified but did not contain a permitted Cognito subject. |

### Ownership and not-found behavior

Every application resource is scoped through the authenticated
`UserReference`. A valid UUID owned by somebody else returns the same `404` as
an unknown UUID. Clients must not infer resource existence from a `404`.

### Validation

The global validation pipe transforms query values, trims documented strings,
whitelists DTO fields, and rejects unknown fields. A validation error is:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "errors": [
    {
      "field": "name",
      "messages": ["name should not be empty"]
    }
  ]
}
```

Unexpected body properties are errors rather than being silently ignored.

### Common response fields

`DesignSystem`:

```json
{
  "id": "8b4a26d4-50ce-4e45-936d-35f04cc098cb",
  "name": "Primary Design System",
  "description": "Shared components for the main product suite",
  "generationContract": "composable-v1",
  "lastPublishedVersion": "1.4.2",
  "createdAt": "2026-08-01T20:00:00.000Z",
  "updatedAt": "2026-08-03T22:00:00.000Z"
}
```

`GenerationRun`:

```json
{
  "id": "f7a86692-9892-4726-834a-3ede70664bbb",
  "designSystemId": "8b4a26d4-50ce-4e45-936d-35f04cc098cb",
  "status": "succeeded",
  "startedAt": "2026-08-03T22:00:01.000Z",
  "completedAt": "2026-08-03T22:00:13.000Z",
  "artifactCount": 95,
  "tokenCount": 70,
  "componentCount": 43,
  "warningCount": 0,
  "errorCount": 0,
  "packageName": "@organization/design-system",
  "packageVersion": "1.4.3",
  "generationContract": "composable-v1",
  "publishRequested": true,
  "publishedAt": "2026-08-03T22:00:13.000Z",
  "publicationFailureSummary": null,
  "artifactReference": "local:runs/.../download/organization-design-system-1.4.3.zip",
  "failureSummary": null,
  "createdAt": "2026-08-03T22:00:00.000Z",
  "updatedAt": "2026-08-03T22:00:13.000Z"
}
```

`artifactReference` is an internal safe reference, not a filesystem path or
public S3 URL. Clients should use the artifact endpoint.

## Public endpoint

### `GET /health`

Authentication: none.

Response `200`:

```json
{ "status": "ok" }
```

This confirms the HTTP process is accepting requests. Container health checks
use this endpoint.

## Design Systems

### `POST /v1/design-systems`

Creates the non-sensitive application record. It does not configure Figma or
npm.

Request:

```json
{
  "name": "Primary Design System",
  "description": "Shared components for the main product suite",
  "generationContract": "composable-v1"
}
```

| Field | Required | Validation |
| --- | --- | --- |
| `name` | yes | String, trimmed, nonempty, maximum 200 characters. |
| `description` | no | String, trimmed, maximum 1000 characters. Empty becomes `null`. |
| `generationContract` | no | `legacy` or `composable-v1`; defaults to composable for new records. |

Response `201`: `DesignSystem`.

The owner is always the authenticated user and cannot be supplied in the body.

### `GET /v1/design-systems`

Returns an array of the caller's Design Systems, ordered by most recently
updated and then ID.

Response `200`:

```json
[
  {
    "id": "8b4a26d4-50ce-4e45-936d-35f04cc098cb",
    "name": "Primary Design System",
    "description": "Shared components",
    "generationContract": "composable-v1",
    "lastPublishedVersion": "1.4.2",
    "createdAt": "2026-08-01T20:00:00.000Z",
    "updatedAt": "2026-08-03T22:00:00.000Z"
  }
]
```

No pagination is applied because this endpoint feeds the owned Design System
navigation and selectors.

### `GET /v1/design-systems/:id`

Path `id`: owned Design System UUID v4.

Response `200`: `DesignSystem`.

Response `404`: unknown or inaccessible Design System.

### `PATCH /v1/design-systems/:id`

Updates display metadata and the generation contract. Runtime credentials and
package configuration remain on their dedicated endpoints.

Request may contain any of these fields:

```json
{
  "name": "Updated display name",
  "description": "Updated package description",
  "generationContract": "composable-v1"
}
```

Validation matches create. An empty object returns structured `400`. An empty
description clears it to `null`. The description is used as the generated npm
manifest description; when it is absent the manifest omits `description`.
Changing the generation contract changes generated public APIs. The next run
snapshots the new value and reserves a new major package version.

Response `200`: updated `DesignSystem`.

### `DELETE /v1/design-systems/:id`

Response `204`, no body.

Deletion is intentionally complete and destructive for that owned Design
System:

1. Remove every run's local/S3 source snapshot and package artifact.
2. Remove the UUID entry from the shared runtime configuration document.
3. Delete the Design System row.
4. Database cascades delete its Generation Runs and Generation Events.

## Runtime configuration and credentials

### `GET /v1/design-systems/:id/runtime-configuration`

Returns readable configuration and credential-presence flags. It never returns
tokens.

Response `200`:

```json
{
  "designSystemId": "8b4a26d4-50ce-4e45-936d-35f04cc098cb",
  "figmaFileKey": "AbCdEfGhIjKlMnOp",
  "packageName": "@organization/design-system",
  "packageVersion": "1.4.3",
  "npmRegistry": "https://registry.npmjs.org/",
  "figmaAccessTokenConfigured": true,
  "npmTokenConfigured": true,
  "generationConfigured": true
}
```

`generationConfigured` requires a valid file key, package name, and configured
Figma token. npm is optional unless publication is requested.

Response `503`: the shared runtime configuration store is unavailable or
malformed. The response never includes AWS/Figma details.

### `PATCH /v1/design-systems/:id/runtime-configuration`

Sets readable compiler configuration and resolves the next package version.

Request:

```json
{
  "figmaFileKey": "https://www.figma.com/design/AbCdEfGhIjKlMnOp/Product-System",
  "packageName": "@organization/design-system"
}
```

| Field          | Required | Validation/normalization                                                                                                                                                                 |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `figmaFileKey` | yes      | String, trimmed, nonempty, max 255. A Figma `/file/`, `/design/`, or `/board/` URL is reduced to its key. Keys allow letters, numbers, `_`, and `-`; `figd_` access tokens are rejected. |
| `packageName`  | yes      | Trimmed valid new npm package name, max 214. Scoped and unscoped names are supported.                                                                                                    |

The backend looks up `<package>/latest` in the system npm registry. If it does
not exist, the assigned version is `1.0.0`; otherwise the patch component is
incremented. Existing runtime tokens are preserved.

Response `200`: `RuntimeConfigurationView` as shown above.

Response `503`: registry lookup or configuration write failed.

### `PUT /v1/design-systems/:id/runtime-credentials`

Adds or rotates credentials. The two inputs are independent; omitting one
preserves it.

Figma only:

```json
{ "figmaAccessToken": "figd_replace-with-token" }
```

npm only:

```json
{ "npmToken": "npm_replace-with-token" }
```

Both:

```json
{
  "figmaAccessToken": "figd_replace-with-token",
  "npmToken": "npm_replace-with-token"
}
```

Each provided value is trimmed, nonempty, and limited to 4096 characters. At
least one must be provided.

Response `200`:

```json
{
  "designSystemId": "8b4a26d4-50ce-4e45-936d-35f04cc098cb",
  "configured": true
}
```

The response confirms the write only. It cannot be used to read a token back.

## Generation

### `POST /v1/generations`

Validates ownership and runtime configuration, reserves a package version,
creates a pending run, schedules background work, and returns promptly.

Generate/download only:

```json
{
  "designSystemId": "8b4a26d4-50ce-4e45-936d-35f04cc098cb"
}
```

Generate and publish:

```json
{
  "designSystemId": "8b4a26d4-50ce-4e45-936d-35f04cc098cb",
  "publishToNpm": true
}
```

| Field            | Required | Validation                    |
| ---------------- | -------- | ----------------------------- |
| `designSystemId` | yes      | UUID v4.                      |
| `publishToNpm`   | no       | Boolean; defaults to `false`. |

Response `202`:

```json
{
  "runId": "f7a86692-9892-4726-834a-3ede70664bbb",
  "status": "pending"
}
```

Important errors:

| Status | Condition                                                                                            |
| ------ | ---------------------------------------------------------------------------------------------------- |
| `400`  | Publication requested without an npm token.                                                          |
| `404`  | Design System unknown/inaccessible.                                                                  |
| `503`  | Runtime configuration missing, version could not be resolved, or configuration provider unavailable. |

The request never accepts a token, package name, version, registry, owner ID, or
Figma file key. Those values come from owned server-side configuration.

### `GET /v1/generations/:id`

Returns the owner-scoped persisted run. Use this after refresh or SSE
disconnection and to determine terminal status or artifact availability.

Response `200`: `GenerationRun`.

### `GET /v1/generations/:id/events`

Authenticated Server-Sent Events. Clients must send the Bearer token in the
request header; never put it in the URL.

On connection, the backend returns already-persisted events in chronological
order, then live events. Duplicate event IDs are suppressed. A terminal run
returns its persisted events and closes. A live stream closes after `completed`
or `failed`.

Example wire event:

```text
id: 47c9d95d-9a88-47cb-8812-e6d5627f1e90
event: normalizing
data: {"id":"47c9d95d-9a88-47cb-8812-e6d5627f1e90","eventType":"normalizing","message":"Normalizing design tokens and components.","createdAt":"2026-08-03T22:00:03.000Z"}
```

Event types:

| Type                 | Meaning                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `queued`             | Run persisted and waiting for scheduled execution.               |
| `retrieving_source`  | Fetching the configured Figma source.                            |
| `normalizing`        | Importing tokens, components, variants, assets, and diagnostics. |
| `diagnostic_warning` | Persisted compiler warning.                                      |
| `diagnostic_error`   | Persisted compiler or safe runtime error.                        |
| `generating`         | Producing CSS, React, Storybook, and package metadata.           |
| `storing`            | Writing the generated package and archive.                       |
| `publishing`         | Optional npm build/publication is running.                       |
| `publication_failed` | Package exists, but npm publication failed safely.               |
| `completed`          | Generation succeeded; stream terminal event.                     |
| `failed`             | Generation failed; stream terminal event.                        |

### `GET /v1/generations/:id/artifact`

Available only when the run succeeded and has an artifact reference.

Local storage response: `200 application/zip` with `Content-Disposition` and a
safe versioned filename.

S3 response `200`:

```json
{
  "kind": "presigned",
  "downloadUrl": "https://private-bucket.s3...signed-query...",
  "expiresInSeconds": 300
}
```

The browser follows the returned URL. The response and backend stream use
`Cache-Control: private, no-store`. Raw snapshots are not available here.

Response `404`: inaccessible run, non-successful run, missing reference, or
missing object/file.

## History

### `GET /v1/generations`

The backend supports reusable owner-scoped history filters. The current UI
invokes it for one Design System and therefore does not show the redundant text
or Design System filters, but API/report clients may use them.

| Query            | Default | Validation/meaning                                                                    |
| ---------------- | ------- | ------------------------------------------------------------------------------------- |
| `designSystemId` | none    | UUID v4.                                                                              |
| `text`           | none    | Trimmed nonempty text, max 200; case-insensitive Design System or package-name match. |
| `status`         | none    | `pending`, `running`, `succeeded`, or `failed`.                                       |
| `startDate`      | none    | Strict ISO date/time or `YYYY-MM-DD`; inclusive. Date-only means UTC start of day.    |
| `endDate`        | none    | Strict ISO date/time or `YYYY-MM-DD`; inclusive. Date-only means UTC end of day.      |
| `page`           | `1`     | Integer >= 1.                                                                         |
| `pageSize`       | `25`    | Integer 1–100.                                                                        |
| `sortDirection`  | `desc`  | `asc` or `desc`.                                                                      |

An end date before the start date returns structured `400` on `endDate`.
Ordering is deterministic by creation time and then run ID in the same
direction.

Response `200`:

```json
{
  "items": [
    {
      "id": "f7a86692-9892-4726-834a-3ede70664bbb",
      "designSystemId": "8b4a26d4-50ce-4e45-936d-35f04cc098cb",
      "designSystemName": "Primary Design System",
      "packageName": "@organization/design-system",
      "packageVersion": "1.4.3",
      "status": "succeeded",
      "startedAt": "2026-08-03T22:00:01.000Z",
      "completedAt": "2026-08-03T22:00:13.000Z",
      "artifactCount": 95,
      "artifactAvailable": true,
      "tokenCount": 70,
      "componentCount": 43,
      "warningCount": 0,
      "errorCount": 0,
      "failureSummary": null,
      "createdAt": "2026-08-03T22:00:00.000Z",
      "updatedAt": "2026-08-03T22:00:13.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

Secrets, raw snapshots, and internal storage references are excluded.

## Generation History Report

### `GET /v1/reports/generation-history`

Accepts the same filters and pagination as `GET /v1/generations` and reuses the
same owner-scoped query. It is an onscreen report contract, not a file export.

Response `200` includes:

- title exactly `Generation History Report`;
- backend-generated ISO timestamp;
- normalized applied filters;
- fixed column metadata;
- pagination metadata;
- zero or more real rows.

An empty result still returns valid metadata with `rows: []`.

## Dashboard

### `GET /v1/dashboard`

Returns an owner-scoped seven-day portfolio report.

```json
{
  "generatedAt": "2026-08-03T22:30:00.000Z",
  "periodDays": 7,
  "summary": {
    "totalDesignSystems": 2,
    "requiringAttention": 1,
    "generatedRuns": 8,
    "successRate": 87.5,
    "failedRuns": 1,
    "medianDurationMs": 12000,
    "p95DurationMs": 19000,
    "publicationSuccessRate": 100
  },
  "designSystems": [],
  "generationVolume": [],
  "performance": [],
  "generationEfficiency": []
}
```

Calculations:

- Window: current UTC day plus the previous six UTC days.
- Success rate: successful terminal runs / all terminal runs.
- Duration: `completedAt - startedAt`, floored at zero.
- Median/p95: nearest-rank percentile over terminal-run durations.
- Publication success: runs with `publishedAt` / runs with
  `publishRequested=true`.
- Volume: one count per Design System per UTC day.
- Efficiency: one point per successful run with component count, artifact
  count, duration, and whether npm was requested.
- Health is `unproven` without a successful run, `attention` when the latest
  run failed, the latest successful run has errors, or no success occurred in
  seven days, and otherwise `healthy`.
- Component delta compares the latest two successful generations.
