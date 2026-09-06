<strong>**DO NOT DISTRIBUTE OR PUBLICLY POST SOLUTIONS TO THESE LABS. MAKE ALL FORKS OF THIS REPOSITORY WITH SOLUTION CODE PRIVATE. PLEASE REFER TO THE STUDENT CODE OF CONDUCT AND ETHICAL EXPECTATIONS FOR COLLEGE OF INFORMATION TECHNOLOGY STUDENTS FOR SPECIFICS. **</strong>

# WESTERN GOVERNORS UNIVERSITY

## D424 – SOFTWARE ENGINEERING CAPSTONE

Welcome to Software Engineering Capstone! This is an opportunity for students to develop full stack software engineering documentation and applications. They will execute documentation, unit testing, revision of software applications, and deploy software applications with scripts and containers on a cloud platform.

FOR SPECIFIC TASK INSTRUCTIONS AND REQUIREMENTS FOR THIS ASSESSMENT, PLEASE REFER TO THE COURSE PAGE.
BASIC INSTRUCTIONS
For this assessment, you will deploy your developed full stack software product to a web service of your choice.

## SUPPLEMENTAL RESOURCES

1. How to clone a project to IntelliJ using Git?

> Ensure that you have Git installed on your system and that IntelliJ is installed using [Toolbox](https://www.jetbrains.com/toolbox-app/). Make sure that you are using version 2022.3.2. Once this has been confirmed, click the clone button and use the 'IntelliJ IDEA (HTTPS)' button. This will open IntelliJ with a prompt to clone the proejct. Save it in a safe location for the directory and press clone. IntelliJ will prompt you for your credentials. Enter in your WGU Credentials and the project will be cloned onto your local machine.

2. How to create a branch and start Development?

- GitLab method

> Press the '+' button located near your branch name. In the dropdown list, press the 'New branch' button. This will allow you to create a name for your branch. Once the branch has been named, you can select 'Create Branch' to push the branch to your repository.

- IntelliJ method

> In IntelliJ, Go to the 'Git' button on the top toolbar. Select the new branch option and create a name for the branch. Make sure checkout branch is selected and press create. You can now add a commit message and push the new branch to the local repo.

## SUPPORT

If you need additional support, please navigate to the course page and reach out to your course instructor.

## FUTURE USE

Take this opportunity to create or add to a simple resume portfolio to highlight and showcase your work for future use in career search, experience, and education!

## Kolibri documentation

> **Private product baseline:** Kolibri remains private and unlaunched until
> graduation. The source and working-tree provenance for this GitHub baseline is
> recorded in
> [`docs/private-repository-provenance.md`](docs/private-repository-provenance.md).
> Deployment workflows are manual-only while this gate is active; pushes to
> `main` do not publish images, deploy services, or update the hosted frontend.

> **Required Figma authoring gate:** Before generating any new or structurally
> changed Design System, run the complete
> [`Universal Figma compatibility prompt`](docs/figma-compatibility-prompt.md).
> Do not shorten it or replace its predetermined decisions with ad hoc choices.

Start with the system documentation:

| Document                                                     | Covers                                                                                                                                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/README.md`](docs/README.md)                           | Documentation index and end-to-end product workflow.                                                                                                                                         |
| [`docs/architecture.md`](docs/architecture.md)               | System topology, trust boundaries, authentication, ownership, relational schema, secrets, runtime modes, and storage.                                                                        |
| [`docs/api.md`](docs/api.md)                                 | Complete authenticated HTTP/SSE contract, validation, inputs, outputs, errors, history, reports, and dashboard calculations.                                                                 |
| [`docs/generation-pipeline.md`](docs/generation-pipeline.md) | Figma source contract, metadata, normalization, versioning, diagnostics, React/CSS/Storybook generation, artifacts, and npm publication.                                                     |
| [`docs/component-contracts.md`](docs/component-contracts.md) | Composable generated views, semantic Figma parts, behavior adapters, manifest schema, stability guarantees, and legacy migration.                                                          |
| [`docs/figma-compatibility-prompt.md`](docs/figma-compatibility-prompt.md) | Canonical copy-ready Figma inventory, audit, repair, and validation prompt required before generation.                                                                        |
| [`docs/operations.md`](docs/operations.md)                   | Configuration, local runtime, AWS/IAM, CI/CD, deployment behavior, smoke tests, backups, and troubleshooting.                                                                                |
| [`backend/README.md`](backend/README.md)                     | Backend architecture, authenticated generation flow, migrations, runtime variables, secrets, and local execution.                                                                            |
| [`frontend/README.md`](frontend/README.md)                   | Public browser configuration, local development, Cognito callback ownership, and static publishing.                                                                                          |
| [`infrastructure/README.md`](infrastructure/README.md)       | Complete deployment runbook: Google OAuth, CDK, production PostgreSQL, grants, system-secret JSON, IAM identities, on-premises host, GitHub/GitLab variables, deployment, and smoke testing. |

For a technical overview, start with [`docs/README.md`](docs/README.md). For a
new production environment, start with the numbered deployment order in
[`infrastructure/README.md`](infrastructure/README.md#deployment-order). It is
the canonical operations guide; component README files link back to the relevant
runbook sections rather than duplicating production credentials or commands.

## Kolibri local development

The root `compose.yaml` is for local development only; it is not a production deployment definition. Development uses Dockerized PostgreSQL for application records, SQLite as the local Secrets Manager substitute, and local filesystem artifact storage. Production backend and PostgreSQL services remain on premises and are not provisioned by CDK or Compose.

Configuration is owned by the component that consumes it:

- `frontend/.env.example` contains only the public Vite API URL, Cognito hosted domain, and Cognito app-client ID.
- `backend/.env.example` contains only API, Cognito, and stack-namespace settings. PostgreSQL and production generation-storage configuration belong exclusively in the stack-derived system secret.
- `infrastructure/.env.example` contains the canonical Route 53 inputs and deployment-only Google OAuth values used when invoking CDK.

There is no shared root environment file. Values that represent the same deployed resource, such as the public Cognito app-client ID, should be copied from the same CDK output into each consuming component's localized environment.

1. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`.
2. Set the same public Cognito app-client ID in the backend and frontend files, along with their other localized runtime settings. Do not add AWS, Google, Figma, database-production, or other credentials.
3. Validate and start the local stack:

```bash
docker compose config
docker compose up --build --watch
```

Local nginx exposes the frontend at `https://kolibri.dev`, the API at `https://api.kolibri.dev`, and the public health endpoint at `https://api.kolibri.dev/health`. Compose publishes ports `5188` and `3188` only as nginx upstreams. PostgreSQL migrations run before the API process, and the frontend waits for the backend health check.

Compose Watch synchronizes backend `src/` and frontend `app/` or `public/` changes into their development containers. Nest and React Router then reload automatically. Changes to package manifests, Dockerfiles, or framework configuration rebuild only the affected service. Stop the stack with `Ctrl+C`, or run `docker compose down` if it was started in the background.

Compose loads the committed sanitized defaults from `backend/.env.example` and `frontend/.env.example`, then overlays the corresponding untracked localized file when present. Application records are stored in PostgreSQL's private `postgres-data` volume. The private `backend-data` volume contains only the SQLite substitutes for the system and shared Design System secrets. Generated snapshots and packages use the private `generation-artifacts` volume. Development does not read Secrets Manager or S3 and does not need AWS credentials. Cognito remains the configured authentication service. Production uses the `KolibriStackName` CDK output and reads PostgreSQL, S3, and runtime configuration through the host's AWS credential chain.

To exercise the production runtime-configuration and artifact providers while retaining the development server, set `KOLIBRI_RUNTIME_MODE=production` in `backend/.env` and provide the normal production stack namespace and AWS credential chain. PostgreSQL remains the application database in both modes; production mode obtains its connection from the system secret.

Infrastructure deployment configuration remains separate: copy `infrastructure/.env.example` to `infrastructure/.env` only when running CDK commands from that directory. There is intentionally no root environment template.

Infrastructure bootstrap, deployment, runtime permissions, and frontend publishing instructions are in `infrastructure/README.md`.
