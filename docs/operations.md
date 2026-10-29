# Operations and deployment

> **Generation preflight:** the saved Figma source must first pass the
> [Universal Figma compatibility prompt](figma-compatibility-prompt.md). A
> successful Figma-side audit does not replace checking the persisted backend
> Diagnostics tab after generation.

The command-level AWS/PostgreSQL production runbook remains
[infrastructure/README.md](../infrastructure/README.md). This document explains
how the operational pieces work together and provides verification and failure
recovery guidance.

## Toolchain

Recommended local tools:

- Node.js 24 and npm;
- Docker Desktop with Compose Watch support;
- AWS CLI v2;
- AWS CDK CLI installed through `infrastructure/node_modules`;
- an AWS account and credentials able to deploy the stack;
- an existing public Route 53 hosted zone;
- a Google Cloud OAuth web client;
- PostgreSQL reachable from the on-premises backend host;
- local nginx and a trusted wildcard development certificate when using
  `https://kolibri.dev` and `https://api.kolibri.dev`.

## Configuration ownership

### Infrastructure `.env`

Consumed only by local CDK commands:

| Variable                     | Required | Meaning                                                    |
| ---------------------------- | -------- | ---------------------------------------------------------- |
| `KOLIBRI_DOMAIN`             | yes      | Existing hosted-zone domain, e.g. `example.com`.           |
| `KOLIBRI_HOSTED_ZONE_ID`     | yes      | Route 53 zone ID.                                          |
| `KOLIBRI_SUBDOMAIN`          | yes      | Single label used to form `<subdomain>.<domain>`.          |
| `GOOGLE_OAUTH_CLIENT_ID`     | yes      | Google web OAuth client ID for Cognito federation.         |
| `GOOGLE_OAUTH_CLIENT_SECRET` | yes      | Google web OAuth client secret used during CDK deployment. |

Google values are CDK deployment inputs. They do not belong in either kolibri
runtime secret. Infrastructure always deploys in `us-east-1`, required for the
CloudFront certificate.

### Backend `.env`

| Variable                | Production                    | Meaning                                                              |
| ----------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `PORT`                  | required                      | HTTP listen/container port.                                          |
| `CORS_ALLOWED_ORIGINS`  | required                      | Comma-separated exact browser origins.                               |
| `AWS_REGION`            | required                      | Region containing Cognito, S3, and Secrets Manager.                  |
| `COGNITO_USER_POOL_ID`  | required                      | Cognito user pool ID.                                                |
| `COGNITO_APP_CLIENT_ID` | required                      | Public frontend app-client ID.                                       |
| `KOLIBRI_STACK_NAME`    | required                      | Namespace for both secrets and S3 key prefix.                        |
| `KOLIBRI_RUNTIME_MODE`  | optional                      | Explicit `local` or `production`; otherwise derived from `NODE_ENV`. |
| `NODE_ENV`              | production deployment sets it | Selects production providers when no explicit runtime mode exists.   |

Database credentials, S3 bucket, registry, and presigned lifetime are not
backend environment variables. They are loaded from the system secret.

AWS access keys are not application variables. The SDK uses the standard AWS
credential chain. Production mounts the deployment account's AWS config at
`/home/node/.aws:ro`.

### Frontend `.env.local` / CI build variables

All `VITE_*` values are public because Vite embeds them in the static bundle.

| Variable                 | Meaning                                       |
| ------------------------ | --------------------------------------------- |
| `VITE_API_BASE_URL`      | Canonical API origin, without a route suffix. |
| `VITE_COGNITO_DOMAIN`    | Cognito hosted-domain origin.                 |
| `VITE_COGNITO_CLIENT_ID` | Public app-client ID.                         |

Scopes are fixed by the application to `openid email profile`. Callback and
logout URLs are derived from `window.location.origin`, so they do not need
separate environment variables.

## Local development

### Prepare

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Set matching local Cognito identifiers. Google/Cognito remain real external
authentication; application persistence, runtime config, and artifacts are
local.

Validate and start:

```bash
docker compose config
docker compose up --build --watch
```

`--watch` matters. The Compose file declares `develop.watch`; ordinary
`docker compose up` does not activate source synchronization. With watch:

- `backend/src` syncs to `/app/src`, and Nest recompiles;
- `frontend/app` and `frontend/public` sync, and Vite reloads;
- package manifests, Dockerfiles, and framework configuration rebuild the
  affected image.

Local services:

| Service    | Compose upstream               | Canonical nginx URL              |
| ---------- | ------------------------------ | -------------------------------- |
| PostgreSQL | internal `postgres:5432`       | Not exposed through nginx.       |
| Frontend   | `http://localhost:5188`        | `https://kolibri.dev`            |
| Backend    | `http://localhost:3188`        | `https://api.kolibri.dev`        |
| Health     | `http://localhost:3188/health` | `https://api.kolibri.dev/health` |

The local nginx configuration must proxy `kolibri.dev` to `5188` and
`api.kolibri.dev` to `3188`, preserve request headers, and use the existing
trusted wildcard development certificate. Vite must allow `kolibri.dev`.

### Local persistence

Docker named volumes:

| Volume                 | Container path             | Contents                                                    |
| ---------------------- | -------------------------- | ----------------------------------------------------------- |
| `postgres-data`        | `/var/lib/postgresql/data` | All application records and migration state.                |
| `backend-data`         | `/app/data`                | Local substitutes for the system and Design System secrets. |
| `generation-artifacts` | `/app/artifacts`           | Raw snapshots, unpacked package files, downloadable ZIPs.   |

The volumes survive container rebuilds and `docker compose down`. Deleting
volumes is destructive and is not part of normal restart/rebuild.

Useful commands:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart backend
docker compose up -d --build backend
docker compose down
```

If source changes do not appear in a running container, confirm the stack was
started with `--watch`; otherwise rebuild the affected service.

### Direct verification

```bash
(cd backend && npm ci && npm run build && npm test -- --runInBand)
(cd frontend && npm ci && npm run typecheck && npm run build)
(cd infrastructure && npm ci && npm run build && npm test -- --runInBand && npx cdk synth)
docker compose config
```

## AWS infrastructure

`npm run deploy` in `infrastructure/` performs:

1. TypeScript build.
2. CDK synth.
3. CDK deploy.
4. System-secret default initialization (`npm.registry`) without overwriting
   existing values.

Provisioned resources:

### Authentication

- Cognito user pool.
- Public frontend app client (no client secret).
- Cognito hosted domain.
- Google identity provider.
- Callback `<fqdn>/auth/callback`.
- Logout `<fqdn>/sign-in?signedOut=1`.

Google Cloud must authorize the Cognito IdP response URL, not the frontend
callback:

```text
https://<cognito-domain>.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
```

The Cognito app client then redirects the browser to the frontend callback.

### Frontend hosting and DNS

- private encrypted S3 frontend bucket;
- CloudFront distribution with Origin Access Control;
- HTTP-to-HTTPS redirect and TLS 1.2 2021 minimum;
- managed security response headers;
- ACM certificate in `us-east-1`;
- Route 53 A and AAAA aliases for `<subdomain>.<domain>`;
- SPA fallback to the static application entry point.

### Generation storage and configuration

- private encrypted generation S3 bucket;
- block all public access;
- retained system secret `<stack>/system`;
- retained shared runtime secret `<stack>/runtime/design-systems`.

### Compute-adjacent resources

- encrypted ECR repository for the backend image.

The backend container uses Docker's host-local `local` logging driver with a
10 MiB rotation threshold and three retained files. CDK creates no application
log group.

No backend host, load balancer, ECS/EKS service, RDS database, or PostgreSQL
instance is created.

## IAM identities and permissions

### Backend runtime user

Used by the on-premises host through its mounted AWS profile. Least privilege:

- pull backend images from the stack ECR repository;
- read the system secret;
- read/write the one shared Design System runtime secret;
- read/write/delete generation objects only under the stack-compatible S3
  prefix.

It does not need CloudFormation permissions and does not create secrets.

### Frontend publisher user

Credentials are emitted by CDK once and should be stored immediately in the CI
secret store. Permissions:

- list/get location for the frontend bucket;
- put/delete frontend bucket objects;
- invalidate the one CloudFront distribution;
- push backend images to the one ECR repository.

The publisher does not need `cloudformation:DescribeStacks`; workflows consume
known CDK outputs as CI variables.

## CDK outputs and consumers

| Output                                                              | Consumer                                  |
| ------------------------------------------------------------------- | ----------------------------------------- |
| `AwsRegion`                                                         | backend, CI AWS region.                   |
| `CognitoUserPoolId`                                                 | backend token verifier.                   |
| `FrontendCognitoClientId`                                           | frontend and backend.                     |
| `FrontendCognitoDomain`                                             | frontend.                                 |
| `KolibriStackName`                                                  | backend namespace.                        |
| `GenerationStorageBucketName`                                       | system secret `storage.bucket`.           |
| `FrontendBucketName`                                                | frontend publishing workflow.             |
| `FrontendDistributionId`                                            | CloudFront invalidation workflow.         |
| `ContainerRepositoryUri`                                            | backend image build/deploy workflows.     |
| `FrontendPublisherAccessKeyId` / `FrontendPublisherSecretAccessKey` | GitHub/GitLab protected secrets.          |
| `FrontendUrl`, callback/logout URLs, FQDN                           | OAuth verification and smoke tests.       |

## Production PostgreSQL

Database creation is performed by a PostgreSQL administrator, outside CDK.
The detailed SQL and grant sequence is in
[Production PostgreSQL](../infrastructure/README.md#production-postgresql).

Required outcomes:

- dedicated database;
- dedicated runtime/migration role with only required database/schema rights;
- `pgcrypto` extension installed by an administrator;
- host/port/database/username/password and TLS flags written to the system
  secret;
- network access restricted to the backend host;
- migration image executed before the new application container.

TypeORM never synchronizes. Production migration command:

```bash
npm run migration:run:prod
```

The deployment workflow runs migrations in a short-lived image using the same
system secret and mounted AWS identity as the application container.

## CI/CD

GitHub workflows and `.gitlab-ci.yml` implement equivalent flows.

### Required protected secrets

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
DEPLOY_HOST
DEPLOY_USER
DEPLOY_SSH_KEY
```

### Required variables

```text
AWS_REGION
ECR_REPOSITORY_URI
FRONTEND_BUCKET_NAME
CLOUDFRONT_DISTRIBUTION_ID
VITE_API_BASE_URL
VITE_COGNITO_DOMAIN
VITE_COGNITO_CLIENT_ID
BACKEND_CONTAINER_NAME
BACKEND_HTTP_PORT
KOLIBRI_STACK_NAME
COGNITO_USER_POOL_ID
CORS_ALLOWED_ORIGINS
```

### Frontend deployment

1. Install with Node 24.
2. Validate all build/AWS variables.
3. Build static client output.
4. `aws s3 sync --delete` to the private frontend bucket.
5. Re-upload hashed `assets/` with immutable one-year caching.
6. Invalidate `/*` on the configured CloudFront distribution.

### Backend deployment

1. Build the production Docker image from `backend/`.
2. Tag with immutable commit/pipeline identity.
3. Authenticate and push to ECR.
4. SSH to the on-premises host with the dedicated deployment key.
5. Validate the host AWS profile with STS.
6. Pull the exact image tag.
7. Run migrations in a temporary container.
8. Stop/remove the old named container.
9. Start the new container with production identifiers, AWS profile mount,
   restart policy, health check, and Docker `local` logging capped at three
   10 MiB files.
10. Poll health and fail deployment if the container becomes unhealthy or does
    not become healthy before timeout.

## Production smoke test

After infrastructure/database/backend/frontend deployment:

1. `GET <api>/health` returns `{"status":"ok"}`.
2. Open the canonical frontend URL over HTTPS.
3. Sign in through Google; verify callback returns to the same canonical FQDN.
4. Create a Design System and set readable runtime configuration.
5. Set Figma token; optionally set npm token separately.
6. Start generation and observe persisted events.
7. Refresh during/after the run and verify status/event recovery.
8. Inspect components, tokens, artifacts, warnings, errors, and diagnostics.
9. Download the versioned ZIP and build its generated package/Storybook.
10. If publication is enabled, verify the exact assigned version in npm and
    Design System `lastPublishedVersion`.
11. Verify Home charts and Design System History include the run.
12. Confirm raw snapshots are private and no credentials appear in frontend
    output, API reads, package files, logs, S3 metadata, or object keys.

## Backup and retention considerations

CDK marks persistent buckets, ECR, user pool, and secrets for
retention. Operators remain responsible for:

- PostgreSQL backups and restore testing;
- Secrets Manager recovery/version retention policy;
- S3 lifecycle/retention policy appropriate to private source snapshots;
- ECR image lifecycle policy;
- host disk monitoring for the bounded Docker log store;
- rotation of CI publisher keys, backend runtime credentials, deployment SSH
  key, Google OAuth secret, database password, Figma tokens, and npm tokens.

Deleting a Design System through the application deletes its run material and
history intentionally; backups are the only recovery mechanism after provider
retention windows.

## Troubleshooting

### Browser remains on session restoration or returns to sign-in

- Confirm frontend/client ID and backend/client ID are the same CDK output.
- Confirm Cognito callback/logout URLs exactly match the browser origin.
- Confirm Google authorizes Cognito `/oauth2/idpresponse`.
- Do not configure localhost callback paths for a deployed frontend.
- Clear stale site data after changing Cognito pools/clients.

### Mixed-content or CORS failure locally

- `VITE_API_BASE_URL` must be `https://api.kolibri.dev`, not an HTTP localhost
  URL, when the page is HTTPS.
- Add `https://kolibri.dev` to backend CORS origins.
- Confirm nginx proxies both hosts to the correct non-colliding ports.

### Host change blocked by Vite

Confirm `kolibri.dev` remains in Vite `server.allowedHosts` and restart/rebuild
the frontend container after framework-config changes.

### Source edit has no effect in Docker

Compose was probably started without watch. Restart with:

```bash
docker compose down
docker compose up --build --watch
```

### Runtime configuration unavailable

Local:

- confirm `/app/data/runtime-configuration.sqlite` exists and is writable;
- inspect backend logs for the safe runtime configuration event;
- do not expect Secrets Manager calls in local mode.

Production:

- validate `KOLIBRI_STACK_NAME` and `AWS_REGION`;
- run `aws sts get-caller-identity` using the mounted host profile;
- verify read/write permissions to `<stack>/runtime/design-systems`;
- verify the secret is a JSON object, including `{}` when initially empty.

### Generation fails while loading Figma images

- The raw snapshot is stored before image retrieval.
- Image requests retry transient network errors, HTTP 429, and server errors.
- A failed run persists `FIGMA_IMAGE_RETRIEVAL_FAILED`, increments error count,
  and retains already-calculated metrics/diagnostics.
- Verify the Figma token can access the file and image endpoint from the backend
  host.

### Artifact exists in S3 but download fails

- Run must be `succeeded` and contain an `s3:` artifact reference.
- Backend identity needs access to the object prefix.
- S3 key must match `<stack>/runs/<run-id>/package/<name>-<version>.zip`.
- Presigned TTL must be 60–900 seconds.
- Frontend must treat the artifact API's JSON as a presigned redirect contract,
  not as ZIP bytes.

### npm publication fails after generation

This is a partial success. Download remains available.

- inspect the persisted `publication_failed` event;
- locate the matching `npm_publication_failed` backend log by `runId`; inspect
  `command`, `exitCode`, `signal`, `stderr`, `stdout`, `errorCode`, and
  `errorStack` after confirming sensitive values appear only as `[REDACTED]`;
- verify npm token presence and permission for the configured package/scope;
- verify system `npm.registry`;
- verify the assigned version is not already published;
- build the downloaded package locally to isolate generated-code failures.

### AWS signature or access denied in CI

- Re-enter access key ID and secret as separate protected secrets without
  surrounding quotes/newlines.
- Validate identity with an action the publisher is supposed to perform (ECR
  login, frontend bucket list, or distribution invalidation), not
  CloudFormation stack inspection.
- Ensure `AWS_REGION` matches the deployed stack.

## Pull request verification and Clouseau review

Every PR runs `.github/workflows/ci.yml` on the Helix self-hosted runners: the
backend build, frontend type-check, infrastructure tests, neutral contract
validation and tests, backend tests with source coverage, and Clouseau's exact
100% line and branch coverage gate over `backend/src`. Run the same commands
locally:

```sh
npm ci --prefix backend && npm run build --prefix backend
npm run test:coverage --prefix backend   # writes backend/coverage/coverage-final.json
```

`test:coverage` measures every backend `.ts` source (no `collectCoverageFrom`
exclusions, no threshold) so the Clouseau gate sees the real inventory. The
repository is below 100% today (recorded baseline: 95.25% lines, 90.73%
branches by Jest, and seven type-only files that Istanbul reports no entry for),
so the coverage step is red and a PR stays pending for a human merge until
coverage reaches 100%. Reviewed PRs carrying a signed local Clouseau receipt
use the CI verifier without provider keys; see `AGENTS.md` and
`.github/clouseau.md` for the purpose contract and the central-source upgrade
model. The CI needs the `DEEPSEEK_API_KEY`, `TYPESAFE_API_KEY` and
`DEPLOYMENT_TOKEN` repository secrets.
