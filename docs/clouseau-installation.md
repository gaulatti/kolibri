# Clouseau installation readiness

Status: preparation only, not an installed or accepted integration. Audited on
2026-10-24 against remote `main` at
`fe39ef5b63110598b0e8ff0b73574f28cf98ec6d`.

## Supported shared implementation

The public protected-main channel inspected was Clouseau
[`4f441cb5abba0600cfad1b86adb561f347e93d96`](https://github.com/gaulatti/clouseau/commit/4f441cb5abba0600cfad1b86adb561f347e93d96),
with engine digest
`efc1e48363f73edd317dc61a231ab2fa01b0808d8a53ff6c0f6a9c7c2a5c3691`.
There were no GitHub release tags. Its documented consumer interface requires
an immutable engine pin. The shared local agent bootstrap is independent of CI;
Codex and Claude Code are the supported authenticated harnesses.

Clouseau owns the engine, scoring, provider integration, receipt validation and
review protocol. Its [local-review documentation](https://github.com/gaulatti/clouseau/blob/4f441cb5abba0600cfad1b86adb561f347e93d96/docs/local-review.md)
requires a verification recipe and public signing enrollment from the accepted
protected base. Proposed files cannot establish their own trust. No supported
generic first-consumer bootstrap procedure was available in this revision.

## Repository audit

| Surface | Observed state |
| --- | --- |
| Visibility | Private; public launch explicitly deferred until graduation. |
| Existing managed agent files | None; no bastille updater was installed to run. |
| Local policy preparation | `AGENTS.md` and `CLAUDE.md` now require local review, repairs, final-revision recheck, signed evidence and its marker in the initial ready PR body. |
| Purpose and ownership preparation | `.github/clouseau.md` records the product contract; `.github/CODEOWNERS` records `@gaulatti`, the repository owner and sole recorded contributor. Neither is accepted base policy yet. |
| Clouseau CI and local recipe | Not installed; no previously valid installation to replace. |
| Default branch | `main`, `protected: false`. |
| Protection and rulesets | Both APIs return HTTP 403: “Upgrade to GitHub Pro or make this repository public to enable this feature.” Privacy must be preserved. |
| Merge/settings | Auto-merge disabled; Actions has read-only default permissions and cannot approve PR reviews. No settings were weakened or bypass actors introduced. |
| Secrets | No repository secret names returned; no secret values read. No keys requested while the selected integration remains blocked. |
| Open PRs | None at audit time. |
| Existing CI | Contract conformance; it is path-filtered and uses the existing Helix self-hosted runner. It is not a complete application verification gate. |
| Deployments | Backend and frontend dispatch-only. Only recorded production deployments were failures. No deployment or infrastructure operation was triggered. |
| Wiki | Disabled on this private repository; in-repository documentation is authoritative. |

Existing successful hosted conformance evidence predates this preparation:
[run 34060592268](https://github.com/gaulatti/kolibri/actions/runs/34060592268).
It proves neither Clouseau acceptance nor complete application coverage.

## Complete source inventory and native verification

The tracked source inventory at the audited base contains:

| Area | Source inventory | Existing verification |
| --- | --- | --- |
| Backend | 119 `.ts` files excluding the 52 colocated `.spec.ts` files; includes declaration-only modules. | Nest build and Jest tests/native Istanbul coverage. |
| Frontend | 39 `.ts`/`.tsx` files under `frontend/app`. | React Router type generation, TypeScript check and client/server build; no application test command or coverage reporter. |
| Neutral contract | Four modules under `contract/src` and two executable modules in the immutable release. | Node tests, release validation and determinism check. |
| Conformance | One module under `conformance/bleecker-toggle/src`. | Black-box Node tests and actual conformity check. |
| Infrastructure | Eleven `.ts` files under `infrastructure/bin` and `infrastructure/lib`. | Existing build/tests; no CDK command, synthesis or deployment executed in this installation task. |

The existing backend configuration excludes modules, constants, types, entities,
DTOs, entrypoints and other application paths and permits 90% branch coverage.
That configuration does not meet the requested complete exact-coverage contract.
A one-time native diagnostic used every backend `.ts` source except tests and
raised all coverage thresholds to 100% without changing repository settings:

```bash
npm --prefix backend ci --ignore-scripts
npm --prefix backend run build
npm --prefix backend run test:cov -- --runInBand \
  --collectCoverageFrom='**/*.ts' --collectCoverageFrom='!**/*.spec.ts' \
  --coverageReporters=json --coverageReporters=json-summary \
  --coverageReporters=text-summary \
  --coverageThreshold='{"global":{"lines":100,"branches":100,"statements":100,"functions":100}}'
```

The measured native report contained **2,630/2,761 lines** and
**2,057/2,267 branches**. The exact coverage gate failed. The run passed 329/330
tests; the generated-package TypeScript test exceeded its existing five-second
timeout under parallel fleet verification. This failure was retained. A separate
30-second-deadline run passed all 330 tests across 52 suites. A final native
coverage run with that deadline also passed all 330 tests and reproduced the
same line/branch counts, failing the unchanged exact thresholds. This establishes
the coverage gap independently of the first timeout.

Backend build, frontend typecheck and frontend client/server build passed.
Contract tests (four), conformance tests (four), immutable release validation,
determinism and actual black-box conformance passed. Those checks are local
software evidence; no browser, hosted integration, deployment or live product
acceptance is claimed.

The shared Istanbul checker was also run against the real native report. It
rejected the missing source inventory: it walks every JS/TS file beneath one
`source_directory`, including colocated specs and declaration-only `.ts` modules
that Jest correctly does not instrument. A complete monorepo recipe also needs
multiple application roots. Pointing at `backend/src` omits the frontend and
contract; pointing at the repository root adds tests, dependencies and generated
output. No complete recipe is claimed or fabricated, no coverage artifact was
rewritten, and no consumer-specific coverage checker was added. A narrowly tested
shared source-inventory capability (or an explicitly reviewed source-layout
migration) is needed before this native layout can meet the supported protocol.

## Outstanding dependencies and delivery boundary

1. Enable protected branches for this private repository through the account's
   supported GitHub plan. Do not make Kolibri public to obtain this entitlement.
2. Release a generic initial consumer trust-enrollment procedure that can accept
   the first local recipe, policy, engine digest and public signer without
   trusting contributor-proposed controls or bypassing checks.
3. Release code-owner-only automatic merge centrally. The inspected controller
   arms auto-merge without complete affected-path ownership evaluation. Do not
   activate it for Kolibri until the requested owner/non-owner policy is supported.
4. Release the shared run-wide automatic engine upgrade mechanism. A fixed-pin
   installation must not be described as self-updating.
5. Support this monorepo's complete native source inventory, close the demonstrated
   backend coverage gaps with meaningful tests, and add real frontend tests and
   native coverage. Do not omit production files or lower thresholds.
6. After these dependencies, install the independently permissioned CI jobs,
   enroll public signer metadata, configure only the chosen provider's required
   secret, establish real required check sources, and demonstrate eligible
   receipt reuse plus ordinary unstamped CI review on protected PRs.

Documentation automation is unavailable for this private, unlaunched product:
there is no wiki and no verified successful deployed-source run for a supported
catch-up. Keep these repository documents current; do not invent production
state or trigger a deployment to demonstrate documentation publication.

This preparation has not earned a local review receipt or hosted approval. No
installation PR, protected merge, unattended proof, deployment, live health,
documentation publication or ticket closeout is claimed.
