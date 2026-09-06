# Kolibri deployment runbook

> Infrastructure readiness does not imply source compatibility. Before the
> first generation for any Design System, run the canonical
> [Universal Figma compatibility prompt](../docs/figma-compatibility-prompt.md)
> against its saved Figma source.

This is the command-level production runbook. For system topology and provider
behavior see [Architecture and data](../docs/architecture.md); for the concise
operational model, CI/CD behavior, smoke tests, and troubleshooting see
[Operations and deployment](../docs/operations.md).

This CDK application provisions Kolibri's managed AWS dependencies. It does not
provision backend compute or PostgreSQL; those remain in the on-premises
production environment.

CDK creates:

- Cognito user pool, public SPA client, AWS-hosted Cognito domain, and Google
  federation;
- private encrypted S3 buckets for generation material and the frontend;
- CloudFront with origin access control, SPA fallbacks, response headers, and
  the configured custom frontend hostname;
- ACM certificate and Route 53 A/AAAA aliases;
- retained singleton `<stack-name>/system` secret;
- private ECR repository and CloudWatch backend log group;
- least-privilege backend-runtime and CI-publisher IAM users.

The application is deployed in `us-east-1`, which is required for the ACM
certificate used by CloudFront.

## Source layout

| File                          | Context                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `lib/configuration.ts`        | Canonical domain, subdomain, FQDN, callback, and logout URLs. |
| `lib/authentication.ts`       | Cognito and Google federation.                                |
| `lib/frontend-hosting.ts`     | ACM, CloudFront, and Route 53.                                |
| `lib/storage.ts`              | Frontend/generation buckets and system secret.                |
| `lib/compute.ts`              | ECR and backend log group.                                    |
| `lib/iam.ts`                  | Backend-runtime and publisher permissions.                    |
| `lib/infrastructure-stack.ts` | Composition and deployment outputs.                           |

## Deployment order

For a new environment, complete these sections in order:

1. [Create the Google OAuth client](#google-oauth-client).
2. [Configure and deploy CDK](#infrastructure-environment).
3. [Create production PostgreSQL](#production-postgresql).
4. [Populate the system secret](#system-secret).
5. [Configure the on-premises runtime identity and host](#on-premises-runtime).
6. [Configure GitHub or GitLab CI](#ci-configuration).
7. Deploy the backend, then publish the frontend.
8. Complete the [end-to-end verification](#end-to-end-verification).

## Prerequisites

- Node.js 24 and npm.
- AWS CLI and AWS CDK v2.
- Local AWS administrator/deployment credentials available through the standard
  AWS credential chain.
- An existing public Route 53 hosted zone and its hosted-zone ID.
- A Google Cloud project where an OAuth client can be created.
- An on-premises Linux host with Docker and AWS CLI.
- A PostgreSQL 17 server reachable from the backend container.
- A public HTTPS URL for the backend API. TLS/reverse-proxy provisioning for the
  on-premises API is outside this CDK stack.

No `CDK_DEFAULT_ACCOUNT` or `CDK_DEFAULT_REGION` values belong in `.env`.
Deployment uses the active local AWS identity and the CDK application fixes the
stack region to `us-east-1`.

## Google OAuth client

The Google redirect target is Cognito, not the Kolibri frontend.

1. In Google Cloud Console, select or create a project.
2. Configure the Google Auth Platform consent screen. Add `email` and `profile`
   scopes and add test users while the application remains in testing status.
3. Open **Google Auth Platform → Clients**, create an **OAuth client ID**, and
   choose **Web application**.
4. Determine the AWS account ID used for deployment:

   ```bash
   aws sts get-caller-identity --query Account --output text
   ```

5. Add this exact **Authorized redirect URI**, substituting the configured
   subdomain and account ID:

   ```text
   https://<KOLIBRI_SUBDOMAIN>-<AWS_ACCOUNT_ID>.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
   ```

   Example shape:

   ```text
   https://kolibri-111111111111.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
   ```

6. Save the Google client ID and client secret into the localized
   `infrastructure/.env` described below.

Do not register `https://<kolibri-fqdn>/auth/callback` in Google. That URL is the
Cognito app client's callback to Kolibri and CDK registers it automatically.

## Infrastructure environment

Install dependencies and create the localized deployment file:

```bash
cd infrastructure
npm ci
cp .env.example .env
```

`infrastructure/.env` requires exactly these values:

| Variable                     | Meaning                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `KOLIBRI_DOMAIN`             | Existing hosted-zone domain, for example `example.com`. |
| `KOLIBRI_HOSTED_ZONE_ID`     | Existing public Route 53 hosted-zone ID.                |
| `KOLIBRI_SUBDOMAIN`          | Single DNS label, for example `kolibri`.                |
| `GOOGLE_OAUTH_CLIENT_ID`     | Deployment-only Google web-client ID.                   |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Deployment-only Google web-client secret.               |

The CDK entrypoint loads this file with `dotenv`. There are no CloudFormation
parameters or dummy deployment values to pass on the command line.

`KOLIBRI_SUBDOMAIN` and `KOLIBRI_DOMAIN` compose the canonical frontend FQDN:

```text
https://<KOLIBRI_SUBDOMAIN>.<KOLIBRI_DOMAIN>
```

The same FQDN is used by CloudFront, Route 53, and the Cognito app-client
callback/logout URLs. Cognito's AWS-hosted domain prefix is derived as
`<KOLIBRI_SUBDOMAIN>-<AWS_ACCOUNT_ID>` and is not configurable separately.

The Google client secret is necessarily present in the locally synthesized CDK
template and the template uploaded into the same AWS account because the current
CDK resource supplies it directly to Cognito. Keep `.env` and `cdk.out/`
uncommitted and restrict access to the deployment machine.

## Bootstrap, test, and deploy

Bootstrap the target account/region once:

```bash
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

Build and verify before deployment:

```bash
npm run build
npm test -- --runInBand
npx cdk synth
npx cdk diff
```

Deploy from this directory:

```bash
npm run deploy
```

The `deploy` script runs the TypeScript build, `cdk synth`, `cdk deploy`, and a
safe system-secret initializer. The initializer adds the default npm registry
only when it is missing and preserves every existing secret field.
CDK prints the values needed by the remaining setup. Record at least:

| Output                               | Consumer                                    |
| ------------------------------------ | ------------------------------------------- |
| `AwsRegion`                          | Backend, CI, AWS CLI.                       |
| `KolibriStackName`                   | Backend runtime namespace.                  |
| `KolibriSystemSecretNameValue`       | System-secret update.                       |
| `DesignSystemRuntimeSecretNameValue` | Shared design-system runtime configuration. |
| `CognitoUserPoolId`                  | Backend JWT verification.                   |
| `FrontendCognitoClientId`            | Backend and frontend.                       |
| `FrontendCognitoDomain`              | Frontend OAuth.                             |
| `FrontendBucketName`                 | Frontend publishing.                        |
| `FrontendDistributionId`             | CloudFront invalidation.                    |
| `GenerationStorageBucketName`        | System-secret storage configuration.        |
| `ContainerRepositoryUri`             | Backend image publishing/deployment.        |
| `BackendLogGroupName`                | On-premises container logs.                 |
| `BackendRuntimeUserName`             | On-premises AWS identity.                   |
| `FrontendPublisherAccessKeyId`       | GitHub/GitLab protected secret.             |
| `FrontendPublisherSecretAccessKey`   | GitHub/GitLab protected secret.             |
| `FrontendUrl`                        | CORS and smoke testing.                     |

The publisher secret access key is shown only when CloudFormation creates the
access key. Store it immediately in protected CI secret storage and do not put
it in a local application `.env` file.

## Production PostgreSQL

Docker Compose creates its own local database automatically. The following
steps are only for the on-premises production PostgreSQL server.

Create a dedicated login and database as the PostgreSQL administrator. The
password prompt prevents the password from being stored in shell history:

```bash
sudo -u postgres createuser --login --pwprompt kolibri_runtime
sudo -u postgres createdb --owner=kolibri_runtime --encoding=UTF8 kolibri
sudo -u postgres psql --dbname=kolibri \
  --command='CREATE EXTENSION IF NOT EXISTS pgcrypto;'
sudo -u postgres psql --dbname=kolibri \
  --command='GRANT CONNECT, TEMPORARY ON DATABASE kolibri TO kolibri_runtime;'
sudo -u postgres psql --dbname=kolibri \
  --command='GRANT USAGE, CREATE ON SCHEMA public TO kolibri_runtime;'
```

The runtime role owns the application database because the deployment workflow
runs TypeORM migrations with that identity. It needs to create and alter the
Kolibri schema but should not be a PostgreSQL superuser and should not have
access to unrelated databases.

Configure `postgresql.conf`, `pg_hba.conf`, the host firewall, and TLS so the
backend container can reach the database. If PostgreSQL runs on the Docker host,
do not use `localhost` in the system secret: inside the container, `localhost`
means the container itself. Use a DNS name or host address reachable from the
container.

Verify the application login from the backend host; `psql` prompts for the
password:

```bash
psql "host=database.internal port=5432 dbname=kolibri user=kolibri_runtime sslmode=verify-full" \
  --command='select current_database(), current_user;'
```

Use the appropriate `sslmode` for the actual PostgreSQL deployment. Production
should normally use a certificate trusted by the backend host and
`verify-full`/`sslRejectUnauthorized: true`.

## System secret

CDK creates and retains a secret named `<KolibriStackName>/system`. At the end
of `npm run deploy`, the deployment initializer writes the non-sensitive
`npm.registry` default when the secret is empty or the section is missing. It
reads, merges, and writes the JSON object, so existing PostgreSQL, storage, and
future configuration is preserved. Populate the remaining values after the
database and S3 bucket exist. A
production value must have exactly these top-level sections:

```json
{
  "postgresql": {
    "host": "database.internal",
    "port": 5432,
    "database": "kolibri",
    "username": "kolibri_runtime",
    "password": "replace-with-the-production-database-password",
    "ssl": true,
    "sslRejectUnauthorized": true
  },
  "storage": {
    "driver": "s3",
    "bucket": "replace-with-GenerationStorageBucketName-output",
    "presignedUrlTtlSeconds": 300
  },
  "npm": {
    "registry": "https://registry.npmjs.org"
  }
}
```

Rules enforced by the backend:

- `postgresql.host`, `database`, `username`, and `password` must be non-empty
  strings.
- `postgresql.port` defaults to `5432` and must be an integer from 1 through 65535.
- `postgresql.ssl` defaults to `false`; production should normally set it
  explicitly.
- `postgresql.sslRejectUnauthorized` defaults to `true`.
- Production storage driver must be `s3` and `storage.bucket` must be the
  `GenerationStorageBucketName` output.
- `presignedUrlTtlSeconds` defaults to `300` and must be from 60 through 900.
- The S3 key prefix is derived from `KolibriStackName`; it is not stored in the
  secret.
- `npm.registry` is required, must use HTTPS, and is shared by all design
  systems. The registry is configuration, not a credential.

Recommended AWS Console procedure:

1. Open **Secrets Manager** and select the secret named by
   `KolibriSystemSecretNameValue`.
2. Choose **Retrieve secret value → Edit**.
3. Select plain text/JSON, paste the complete object above with production
   values, and save a new version.

Equivalent AWS CLI procedure using a temporary file:

```bash
umask 077
${EDITOR:-vi} system-secret.json
aws secretsmanager put-secret-value \
  --region us-east-1 \
  --secret-id '<KolibriSystemSecretNameValue>' \
  --secret-string file://system-secret.json
rm system-secret.json
```

Do not pass the JSON directly on the command line, print it in CI logs, or commit
the temporary file. Confirm metadata without displaying the value:

```bash
aws secretsmanager describe-secret \
  --region us-east-1 \
  --secret-id '<KolibriSystemSecretNameValue>' \
  --query '{Name:Name,LastChangedDate:LastChangedDate}'
```

The system secret is required in production. Missing sections, invalid data,
AWS permission errors, or network errors are fatal. Development does not read
this secret: it uses Dockerized PostgreSQL for application records, SQLite for
the two local secret substitutes, and local filesystem artifact storage.

The initializer is idempotent and can be run independently after upgrading an
existing stack:

```bash
npm run initialize:system-secret
```

It does not print the secret value. It refuses to replace malformed JSON and
does not change a registry that is already configured.

The system secret never stores Google, Figma, or npm credentials. Its npm
section contains only the registry URL. Google
credentials are deployment-only inputs. CDK also creates one retained shared
runtime secret at:

```text
<KolibriStackName>/runtime/design-systems
```

CDK deliberately creates that secret without an initial value. The backend
treats a missing current version or blank value as an empty JSON object only
when handling the first configuration write. It then writes a valid object
whose top-level keys are PostgreSQL `DesignSystem.id` UUIDs:

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

The design-system `npm` object is optional. PostgreSQL stores application identity, ownership,
display data, timestamps, and relationships; runtime source/package settings
and credentials stay in this secret. Generation runs snapshot package name and
version for history. The backend can get and put this exact secret value, but it
cannot create or delete Secrets Manager resources.

Package versions are backend-managed. The configuration endpoint accepts the
package name but not a version or registry. Kolibri checks the system registry
when configuration is saved and immediately before each generation, assigns a
new patch version, and records the assigned version on the generation run. A
successful publication also updates the design system's
`last_published_version` database field.

### One-time upgrade from per-design-system secrets

If an earlier Kolibri build has already stored Figma/package fields in
`design_systems` and created one secret per design system, capture those values
before deploying the backend migration that removes the old columns. After CDK
has created `DesignSystemRuntimeSecretNameValue`, write one combined object in
the shape above, keyed by the existing PostgreSQL UUIDs. Use an administrative
AWS identity for this one-time transfer; do not add legacy wildcard access back
to the runtime user. Confirm a generation for every migrated design system,
then remove the old standalone secrets administratively. Kolibri deliberately
does not delete those legacy AWS resources during the schema migration.

## On-premises runtime

CDK creates `BackendRuntimeUserName` without an access key. Its policy permits
only:

- reading `<KolibriStackName>/system`;
- reading and replacing the exact
  `<KolibriStackName>/runtime/design-systems` secret value;
- reading, writing, and deleting generation objects below
  `<KolibriStackName>/runs/*` in the generation bucket;
- pulling images from the Kolibri ECR repository;
- writing container logs to the Kolibri backend log group.

Create one runtime access key administratively:

```bash
aws iam create-access-key --user-name '<BackendRuntimeUserName>'
```

The command returns the secret access key only once. On the on-premises host,
sign in as the same deployment user configured in CI and install those
credentials in its **default** AWS CLI profile:

```bash
aws configure
# AWS Access Key ID: runtime-user key ID
# AWS Secret Access Key: runtime-user secret key
# Default region name: us-east-1
# Default output format: json
```

The deployment workflows verify this identity and mount that user's `~/.aws`
directory read-only into the backend container. Test the host setup without
printing secret material:

```bash
aws sts get-caller-identity
aws secretsmanager get-secret-value \
  --secret-id '<KolibriSystemSecretNameValue>' \
  --query ARN --output text
aws ecr get-login-password --region us-east-1 |
  docker login --username AWS --password-stdin \
  '<AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com'
```

The host must also have Docker, outbound HTTPS access to AWS and Figma, network
access to PostgreSQL, permission for the deployment user to manage Docker, and
the backend HTTP port exposed through the intended reverse proxy/firewall.

The production backend container receives only:

```text
AWS_REGION=<AwsRegion>
PORT=<on-premises HTTP port>
NODE_ENV=production
KOLIBRI_STACK_NAME=<KolibriStackName>
COGNITO_USER_POOL_ID=<CognitoUserPoolId>
COGNITO_APP_CLIENT_ID=<FrontendCognitoClientId>
CORS_ALLOWED_ORIGINS=<FrontendUrl>
```

Database and S3 configuration come from the system secret. AWS credentials come
from the mounted host profile.

## CI configuration

The CDK-created publisher user can push only to the Kolibri ECR repository,
publish only to the Kolibri frontend bucket, and invalidate only the Kolibri
CloudFront distribution. It cannot read either runtime secret.

### Shared values

Configure these protected secrets in both GitHub and GitLab:

| Secret                  | Value                                         |
| ----------------------- | --------------------------------------------- |
| `AWS_ACCESS_KEY_ID`     | `FrontendPublisherAccessKeyId` output.        |
| `AWS_SECRET_ACCESS_KEY` | `FrontendPublisherSecretAccessKey` output.    |
| `DEPLOY_HOST`           | On-premises SSH hostname/address.             |
| `DEPLOY_USER`           | On-premises deployment username.              |
| `DEPLOY_SSH_KEY`        | Dedicated private SSH key for that host/user. |

Configure these non-secret deployment variables:

| Variable                     | Value/source                                                  |
| ---------------------------- | ------------------------------------------------------------- |
| `AWS_REGION`                 | `AwsRegion`.                                                  |
| `ECR_REPOSITORY_URI`         | `ContainerRepositoryUri`.                                     |
| `FRONTEND_BUCKET_NAME`       | `FrontendBucketName`.                                         |
| `CLOUDFRONT_DISTRIBUTION_ID` | `FrontendDistributionId`.                                     |
| `VITE_API_BASE_URL`          | Public HTTPS URL of the on-premises backend.                  |
| `VITE_COGNITO_DOMAIN`        | `FrontendCognitoDomain`.                                      |
| `VITE_COGNITO_CLIENT_ID`     | `FrontendCognitoClientId`.                                    |
| `KOLIBRI_STACK_NAME`         | `KolibriStackName`.                                           |
| `COGNITO_USER_POOL_ID`       | `CognitoUserPoolId`.                                          |
| `CORS_ALLOWED_ORIGINS`       | `FrontendUrl`; comma-separate additional intentional origins. |
| `BACKEND_HTTP_PORT`          | Port exposed by the backend container.                        |
| `BACKEND_CONTAINER_NAME`     | Stable Docker container name, for example `kolibri`.          |
| `BACKEND_LOG_GROUP`          | `BackendLogGroupName`.                                        |

`KOLIBRI_STACK_NAME` is needed by the backend deployment, not by the frontend
build. It derives both singleton secret names and the generation S3 prefix at
runtime.

### GitHub Actions

Both workflows use the GitHub environment named `production`.

1. Open **Settings → Environments → production**.
2. Add the five protected secrets from the shared table.
3. Add the deployment variables from the shared table.
4. Protect the environment as appropriate for production.

`.github/workflows/frontend-deploy.yml` builds and publishes the SPA when
frontend files change. `.github/workflows/backend-deploy.yml` builds an immutable
ECR image, connects to the on-premises host, runs migrations using the new image,
replaces the container, and waits for its health check.

### GitLab CI/CD

1. Open **Settings → CI/CD → Variables**.
2. Add the shared secret and variable names exactly as shown above.
3. Scope production values to the `production` environment and protect them when
   the default branch is protected.
4. Store `DEPLOY_SSH_KEY` as the multiline private-key content because the
   current pipeline pipes that value into `ssh-add`; do not configure it as a
   GitLab File-type variable.

The GitLab backend build uses Docker-in-Docker, so the runner must allow the
Docker service. The deployment runner must reach `DEPLOY_HOST` over SSH.

### Dedicated deployment SSH key

Create the key on an administrator workstation without overwriting an existing
SSH identity:

```bash
ssh-keygen -t ed25519 -a 100 \
  -f "$HOME/.ssh/kolibri_deploy" \
  -C 'kolibri-ci-deploy'
```

Install only the public key for the on-premises deployment user:

```bash
ssh-copy-id -i "$HOME/.ssh/kolibri_deploy.pub" DEPLOY_USER@DEPLOY_HOST
ssh -i "$HOME/.ssh/kolibri_deploy" DEPLOY_USER@DEPLOY_HOST
```

Put the complete contents of the private `kolibri_deploy` file into the
`DEPLOY_SSH_KEY` CI secret. Never upload the `.pub` file as the private key and
never commit either file.

## Manual frontend publishing

CI is the normal deployment path. To publish manually with the publisher AWS
identity already configured in the standard credential chain:

```bash
cd frontend
npm ci
VITE_API_BASE_URL='https://api.example.com' \
VITE_COGNITO_DOMAIN='<FrontendCognitoDomain>' \
VITE_COGNITO_CLIENT_ID='<FrontendCognitoClientId>' \
npm run build

aws s3 sync build/client 's3://<FrontendBucketName>' \
  --delete --cache-control 'no-cache' --only-show-errors
aws s3 cp build/client/assets 's3://<FrontendBucketName>/assets' \
  --recursive --cache-control 'public,max-age=31536000,immutable' \
  --only-show-errors
aws cloudfront create-invalidation \
  --distribution-id '<FrontendDistributionId>' --paths '/*'
```

## Backend deployment behavior

GitHub and GitLab both:

1. authenticate the publisher identity to ECR;
2. build `backend/Dockerfile` and push an immutable run-specific image;
3. SSH to the on-premises host;
4. use the host's backend-runtime AWS identity to pull the image;
5. run `npm run migration:run:prod` in a one-shot container;
6. replace the existing backend container;
7. send Docker logs to `BackendLogGroupName`;
8. wait until the image health check passes.

The backend runtime and publisher identities are intentionally different. CI
publisher credentials are never copied into the backend container.

## End-to-end verification

After infrastructure, database, secret, backend, and frontend deployment:

1. Confirm DNS and CloudFront:

   ```bash
   dig +short '<KolibriFqdn>'
   curl --head '<FrontendUrl>'
   ```

2. Confirm the backend public health endpoint through its production URL:

   ```bash
   curl --fail 'https://<backend-api-host>/health'
   ```

3. Confirm migrations as `kolibri_runtime`:

   ```sql
   SELECT * FROM kolibri_migrations ORDER BY id;
   ```

4. Sign into the frontend through Google.
5. Create a design system with a display name and optional description.
6. Set its readable generation settings and its write-only credentials. Confirm
   the UI can reload the Figma file key, package name, and backend-assigned
   version while
   displaying only configured/not-configured status for both tokens. Confirm
   the existing shared runtime secret contains an object keyed by that
   PostgreSQL design-system UUID.
7. Start a generation and confirm the run moves from pending to running and then
   succeeded or a safe failed state.
8. For a successful run, confirm metrics/events persist after refresh and the
   artifact downloads while the raw Figma snapshot remains inaccessible.
9. Confirm the run appears in history and the generation-history report.

If frontend authentication succeeds but API screens fail, verify
`VITE_API_BASE_URL`, backend CORS, Cognito pool/client IDs, and public API TLS. If
the backend cannot start, inspect the CloudWatch log group and validate the
system-secret shape, PostgreSQL reachability, and mounted runtime identity.

## Local runtime

The root `compose.yaml` is strictly for development. It runs PostgreSQL, the
backend, and the frontend with SQLite secret substitutes, local filesystem
artifact storage, health checks, and Compose Watch:

```bash
cd ..
docker compose config
docker compose up --build --watch
```

Do not use Docker Compose as the production deployment definition.
