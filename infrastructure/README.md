# Kolibri deployment runbook

Kolibri's backend deploys the way Angelina, Pompeii and Alexandria do (gaulatti/kolibri#19):

- a push to `main` that touches `backend/**` (or the workflow) runs `.github/workflows/backend-deploy.yml` on the Helix runner, which builds the image and pushes `ghcr.io/gaulatti/kolibri:<sha>`;
- an ssh step on Helix pulls that image, runs `npm run migration:run:prod`, and starts the container `kolibri-backend` on `127.0.0.1:3190` (restart always, bounded local logs), then waits for the image health check (`/health`);
- nginx on Helix proxies `https://api.kolibri.gaulatti.com` to `127.0.0.1:3190`.

No ECR, AWS key pair or CloudFormation stack is needed to deploy. The CDK application in this directory (`lib/`, `bin/`) is no longer part of the deploy path; it is kept only until its remaining resources (Cognito, the S3 buckets, the frontend hosting) are moved or retired in their own tickets.

## Production settings: one source of truth

The backend reads its production settings from **its entry of the shared Secrets Manager envelope**, as Angelina and Pompeii do: `SECRET_ARN` names the envelope (a JSON object) and `UNIQUE_KEY` is the opaque key of Kolibri's entry. Both are repository secrets passed to the container; nothing else about the database or sign-in is an environment variable in production.

Kolibri's entry has this shape (placeholders only; never print or commit real values):

```json
{
  "<UNIQUE_KEY>": {
    "postgresql": { "host": "host.docker.internal", "port": 5432, "database": "kolibri", "username": "kolibri", "password": "<from ~/.config/kolibri/database_url>", "ssl": false },
    "storage": { "driver": "s3", "bucket": "<private artifact bucket>" },
    "npm": { "registry": "https://registry.npmjs.org" },
    "cognito": { "userPoolId": "<pool id>", "appClientId": "<app client id>" },
    "cors": { "allowedOrigins": ["https://kolibri.gaulatti.com"] }
  }
}
```

In production the entry is authoritative: `postgresql`, `storage` and `npm` are read as before, and `cognito` and `cors` are copied (only those fields, replacing any environment value) into the process environment before the application starts. A missing envelope or entry, or a missing or malformed required field, stops the start; there is no fallback. The old `<KOLIBRI_STACK_NAME>/system` secret is gone. `KOLIBRI_STACK_NAME` remains only as an optional namespace for the Design System runtime secret (`<name>/runtime/design-systems`) and the S3 key prefix (default `kolibri`).

## Choices the ticket asked to be stated

- **Sign-in:** the backend verifies tokens against the Cognito user pool and app client named in the entry (`cognito`). To use the shared Macondo client (Google IdP) like the other gaulatti apps, put the Macondo pool id and client id there; I could not tell from the repository whether the ids in `.env.example` are Macondo's, so the entry must be filled by someone who knows. The frontend sign-in configuration is part of the frontend deploy follow-up.
- **Database:** a dedicated `kolibri` role and database in Helix's PostgreSQL, created by `infrastructure/helix/provision-postgres.sh` (below). The container reaches it through `host.docker.internal` (the deploy adds the host gateway), so the entry's `postgresql.host` is `host.docker.internal`.
- **Artifact storage:** unchanged, S3: the `storage` entry names a private bucket (existing practice; generation material is written to `<KOLIBRI_STACK_NAME or kolibri>/runs/<run-id>/`). The container uses the Helix host's AWS credentials mounted read-only at `/home/node/.aws`, as Angelina's does for Secrets Manager. A local volume was not chosen because the backend's S3 driver is the only production driver; if the CDK buckets are retired, a bucket must exist first.

## One-time setup on Helix and in GitHub

1. **Runner:** a Helix runner (`self-hosted, linux, x64, helix`) must serve `gaulatti/kolibri`.
2. **Database:** on Helix run `infrastructure/helix/provision-postgres.sh ghcr.io/gaulatti/kolibri:<a published sha>`. It creates the role and database and keeps the generated URL in `/home/gaulatti/.config/kolibri/database_url` (mode 0600); copy the password from it into the entry's `postgresql.password` without printing it.
3. **Envelope entry:** add Kolibri's entry (shape above) under a new opaque key in the shared envelope, preserving the other applications' keys.
4. **Repository secrets** (names only): `SECRET_ARN`, `UNIQUE_KEY`, `DEPLOYMENT_TOKEN` (already present), `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`; repository variable `AWS_REGION`. The `DEEPSEEK_API_KEY` and `TYPESAFE_API_KEY` secrets are unrelated to the deploy.
5. **nginx:** install the staged config for `api.kolibri.gaulatti.com` proxying to `127.0.0.1:3190` (needs sudo: see gaulatti/kolibri#18).
6. **First deploy:** run the workflow by hand (`workflow_dispatch`), then check `https://api.kolibri.gaulatti.com/health`.

## After a deploy

`docker logs kolibri-backend` shows the application log; a failed migration fails the workflow before the running container is replaced. Rolling forward is the only path: fix the cause and push.

## Legacy CDK application

The sections below this line described the CDK-based production runbook and no longer apply to the backend deploy. See `docs/operations.md` for the platform topology that remains (Cognito, S3, CloudFront).
