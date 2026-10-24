# kolibri frontend

kolibri is a client-rendered React Router application for Cognito
authentication, owner-scoped design-system management, package generation,
generation history, and the generation-history report. Its production output is
static and is hosted from the private frontend S3 bucket through CloudFront.

For end-to-end contracts, see the [system documentation](../docs/README.md),
[HTTP API](../docs/api.md), and [generation pipeline](../docs/generation-pipeline.md).
Every onboarded or structurally changed source file must first pass the
[Universal Figma compatibility prompt](../docs/figma-compatibility-prompt.md);
the backend Diagnostics tab remains the authoritative compiler result.

kolibri consumes the published `@gaulatti/bleecker` component library using the
same integration pattern as Mattone. Tailwind compiles Bleecker's base
stylesheet against Bleecker and application component usage; `app.css` contains
only the Bleecker import and Tailwind source declarations, with no handwritten
kolibri style rules. The shell, theme lifecycle, layout, controls, form fields,
loading states, status display, empty/error states, tables, metrics, timelines,
and pagination are Bleecker components.

## Local configuration

Copy the sanitized template:

```bash
cp .env.example .env.local
```

Only these public values belong in the frontend file:

| Variable                 | Local example                                                 | Production source                            |
| ------------------------ | ------------------------------------------------------------- | -------------------------------------------- |
| `VITE_API_BASE_URL`      | `https://api.kolibri.dev`                                     | Public HTTPS URL of the on-premises backend. |
| `VITE_COGNITO_DOMAIN`    | `https://kolibri-ACCOUNT_ID.auth.us-east-1.amazoncognito.com` | `FrontendCognitoDomain` CDK output.          |
| `VITE_COGNITO_CLIENT_ID` | Public Cognito app-client ID                                  | `FrontendCognitoClientId` CDK output.        |

The application derives its OAuth callback and logout URLs from the browser's
current origin:

```text
<origin>/auth/callback
<origin>/sign-in?signedOut=1
```

OAuth scopes are fixed by the application to `openid email profile`; they are
not deployment configuration. Never put Google client secrets, Figma tokens,
Cognito tokens, AWS credentials, PostgreSQL credentials, or other secrets in a
`VITE_*` variable because Vite embeds those values in the browser bundle.

Design-system runtime settings are split by sensitivity. The Figma file key and
package name are editable. Package versions are assigned by the backend and the
npm registry is system configuration. Figma and npm tokens each have their own independent,
write-only form, so either credential can be introduced or rotated without
resubmitting the other. The backend returns only configured/not-configured
flags, and each input is cleared after a successful update. The Figma source
field accepts either a full design URL or a file key and rejects values that
look like `figd_` access tokens.

The generation form offers npm publication only after an npm token is
configured. Publication is explicit for each run. kolibri resolves the current
registry version, selects the next patch version, and shows the resulting
version and publication outcome on the persisted run detail page. Tokens never
enter browser storage or a generation request.

The run detail page also displays the persisted compiler diagnostics behind the
warning and error totals. Diagnostic messages survive refresh and SSE
reconnection because they are stored with the generation run on the backend.

## Development and verification

```bash
npm ci
npm run dev
```

The standalone development server defaults to `http://localhost:5173`. Local
nginx exposes the Compose services at `https://kolibri.dev` and
`https://api.kolibri.dev`; ports `5188` and `3188` are nginx upstreams only.

Before publishing:

```bash
npm test
npm run test:coverage
npm run typecheck
npm run build
```

The deployable site is written to `build/client`.

`npm test` runs the deterministic browser-unit suite. It exercises PKCE/state and
callback ownership, in-memory token refresh, owner-scoped API requests, private
artifact downloads, SSE recovery, design-system configuration and write-only
credentials, explicit publication, and the saved operational reports.
`npm run test:coverage` uses native V8 instrumentation over every TypeScript and
TSX source under `app`, including unloaded files, and fails unless line and branch
coverage are exactly 100%. Native JSON reports are written to ignored `coverage/`.

The DOM suite retains real Bleecker controls. Its dashboard tests substitute the
underlying SVG chart engine's input contract because jsdom has no browser layout;
those tests verify report values and formatting, not visual or live-browser
acceptance. No Cognito account, production API, provider key, or deployment is
used by the unit suite. Hosted checks, authenticated browser acceptance, and
deployment remain separate results.

## Component development

Storybook renders kolibri's Bleecker composition examples using the same
Bleecker base stylesheet and Tailwind compilation path as the application:

```bash
npm run storybook
npm run build-storybook
```

The static Storybook output is written to `storybook-static` and is intentionally
excluded from version control.

### Bleecker 0.1.36 packaging note

The published 0.1.36 root barrel references `dist/core.js` and `dist/tokens.js`,
but the package ships those modules under `dist/core/index.js` and
`dist/tokens/index.js`. `app/bleecker.ts` temporarily re-exports Bleecker's
documented component, layout, and theme subpaths; Vite maps the library's
internal theme reference to the public `@gaulatti/bleecker/core` export. Remove
this compatibility entry after Bleecker publishes a corrected root barrel.

## Cognito and Google callback ownership

The Cognito app client must register kolibri's frontend callback and logout URLs.
Google uses a different redirect URI: Google's OAuth client must register the
Cognito identity-provider response endpoint, not the kolibri frontend callback.

```text
https://<cognito-domain-prefix>.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
```

The infrastructure deployment runbook contains the complete
[Google OAuth setup](../infrastructure/README.md#google-oauth-client) and
[frontend CI configuration](../infrastructure/README.md#ci-configuration).

## Static publishing

CloudFront provides SPA route fallback for paths such as `/design-systems/*`,
`/generations/*`, and `/auth/callback`. Hashed assets receive immutable caching;
other files receive `no-cache`, and every deployment invalidates the
distribution.

Both GitHub Actions and GitLab CI build and publish the frontend. Manual AWS CLI
publishing is documented in the
[infrastructure deployment runbook](../infrastructure/README.md#manual-frontend-publishing).
