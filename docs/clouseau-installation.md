# Clouseau installation readiness

Status: local verification implemented; hosted integration not accepted. Audited on
2026-10-24 against remote `main` at
`fe39ef5b63110598b0e8ff0b73574f28cf98ec6d`.

## Supported shared implementation

The final thin integration targets released public Clouseau
[`29eab7152004a42b14c029cd7f1eadb4d7c647c1`](https://github.com/gaulatti/clouseau/commit/29eab7152004a42b14c029cd7f1eadb4d7c647c1),
engine digest
`4e0425c6f49efb070783e9984f1fbf8327d548b9c67b930881d964b4ba442d4d`.
It includes initial trust installation, public identity export, multi-root native
coverage, code-owner enforcement, review completeness/convergence, bounded
job-output acceptance-record transport and run-wide frozen engine selection.
Codex and Claude Code are the supported authenticated local harnesses.

The stable resolver is pinned at
`f5b6f04a5b95090fc0b5dc0e6fec85cc426273f0`; it validates protected public
Clouseau main once per workflow run. Every engine job directly needs the
resolver and consumes its exact SHA and digest. Missing outputs select an
invalid all-zero checkout revision; actual content and engine identity are
checked before acceptance. Summary provenance avoids an optional diagnostic
artifact upload without changing resolution or verification. This wiring is
proposed and has not established ordinary PR acceptance or upgrade proof yet.

`.github/clouseau.json` selects released manual merge mode and optional local
receipt reuse. Its `central_source` authorizes only public Clouseau main. The
public enrollment was exported through the released `public-identity` command
for native actor `gaulatti`; no private signing material was read or copied.
The entry remains **proposed enrollment**, not accepted trust. Matching eligible
receipts avoid CI AI calls; absent receipts use the qualified routed CI reviewer;
invalid receipts fail without an unexpected paid fallback. Those hosted paths
remain unproved until installation is accepted and exercised.

The supported [initial trust procedure](https://github.com/gaulatti/clouseau/blob/29eab7152004a42b14c029cd7f1eadb4d7c647c1/docs/initial-installation.md)
freezes the candidate, records an explicit native administrator commit grant,
performs authenticated independent local review, then publishes installation-only
signed evidence before a ready PR. Its separate read-only checker requires real
successful PR-event verification and returns manual owner acceptance, never
ordinary approval or automatic merge. No grant, review, receipt or PR has been
created for this candidate.

A deterministic complete-evidence capacity blocker remains. Against protected
base `fe39ef5b63110598b0e8ff0b73574f28cf98ec6d`, the earlier fully committed
candidate `3bb2584e8ff82a1454d44a589e0835a76d8b4766` contains 98 changed paths
and 153 complete immutable source entries. Their source JSON alone is
1,595,031 JavaScript string characters. Including every changed patch and history
produces a **1,990,080-character lower bound**, above the shared **900,000**
source-evidence limit; the shared `refresh` rejects it. The initial numbered
model packet is 2,396,566 characters. No individual file exceeds 300,000 bytes.
These measurements omit accepted trust metadata, requirement, verification,
additional requested source and review reports: they are not an eligible review
snapshot or signed evidence. New thin wiring does not make that lower bound fit.
Do not omit source, manufacture trust, obtain a grant or spend model calls while
this shared limit prevents complete review. A central supported capacity repair
is required, followed by a fresh full-candidate measurement.

The owner requires continued privacy and explicitly accepts the existing
persistent Helix private pool. Where GitHub's private plan cannot enforce branch
protection, the released manual mode preserves tests, exact coverage, review and
current-head ownership requirements. Repository auto-merge remains disabled.
The controller never merges or deploys in this mode. Deployment and infrastructure
authorization remain separate; no AWS, SSM or CDK operation was performed.

## Resumed verification

The frontend now has 241 deterministic behavior tests. All pass, as do its type
check and production build. Native V8 measures every one of the 39 TypeScript and
TSX application source entries, with no production exclusions:

- **918/918 lines**
- **806/806 branches**
- **1,020/1,020 statements**
- **270/270 functions**

The released shared `coverage` checker independently accepts the unmodified
native `frontend/coverage/coverage-final.json` against `frontend/app`, reporting
the same exact line and branch counts. The ESM-only Bleecker re-export barrel
and declarative route table remain present in the native inventory with empty
counter maps; they have not been omitted or assigned invented counters.

Tests exercise public authentication and API boundaries, credential isolation,
configuration, collection/create/edit/delete workflows, explicit publication,
saved report filters, SSE reconnection, replay deduplication, stale terminal
status protection, private artifacts, and component fixtures. DOM tests are not
live-browser evidence. The real Bleecker dashboard wrappers remain in use; only
their underlying SVG engine uses an explicit input/formatter contract fixture.

Narrow source changes make the state boundaries explicit without weakening
behavior: refresh receives the already validated token from its sole caller;
credential state updates share one pure transition that preserves independent
fields; unavailable/in-flight downloads bind no action; and the SSE parser uses
the guaranteed final element returned by `String.split`. Behavioral tests retain
the sign-out, invalid-input, concurrent-download and late-response obligations.

All four product areas pass native exact coverage on the CI runtime, Node
22.23.4:

| Product area | Tests | Lines | Branches |
| --- | ---: | ---: | ---: |
| Backend | 392 across 62 suites | 2,761/2,761 | 1,991/1,991 |
| Frontend | 241 | 918/918 | 806/806 |
| Neutral contract source and immutable release | 94 | 338/338 | 225/225 |
| Black-box conformance | 13 | 209/209 | 70/70 |

The backend now compiles source and tests through the production TypeScript
compiler before native Istanbul measurement. This avoids testing decorator
metadata branches introduced only by ts-jest's isolated per-file compilation.
Its inventory retains every production source; test fixtures are type-checked
instead of suppressing diagnostics. The original 119 emitted module bodies
matched the coverage compilation, differing only in source-map comments. A
subsequent TypeScript-AST audit proved that exactly seven source modules contain
only type aliases and explicit type imports. They now use canonical `.d.ts`
filenames; no runtime `.types.ts` file was renamed. All 112 remaining runtime
module bodies are byte-identical, and Nest copies the seven declaration assets
into `dist/`. Native counters are unchanged. The immutable neutral-contract
release also remains byte-identical.

Released Clouseau
[`c4e07381a288fc74200fd712f04ac3265ef2184a`](https://github.com/gaulatti/clouseau/commit/c4e07381a288fc74200fd712f04ac3265ef2184a)
supports multiple native reports through version 2 local recipes and fixed
test/declaration inventory conventions. `.clouseau-local.json` now records the
four nonoverlapping product roots and their real argument-array commands. Its
installation commands and verification run independently of GitHub Actions and
contain no provider or signing credentials. This proposed recipe is not trusted
accepted-base policy until the supported initial bootstrap accepts it.

The thin `.github/workflows/verify.yml` configures these commands on the existing
Helix private pool with Node 22, checks out the exact event candidate, uses a
read-only token without persisted checkout credentials, and checks all four
native reports through the released shared coverage plan. Its exact JSON result
is retained in the Actions log and job summary. It has no provider key,
approval/merge permission or deployment step.
Push checks establish candidate verification only; the eventual PR-event check,
trusted review, signed evidence and manual merge still need their own proof.

The first hosted push
[run 40134744162](https://github.com/gaulatti/kolibri/actions/runs/40134744162)
failed before executing any steps because “an Actions budget is preventing
further use.” It is not a failed application test or CI acceptance evidence.
The owner explicitly accepted the existing persistent Helix private-pool tradeoff
for these private repositories. This pool is not a disposable runner boundary.
The verification job retains read-only permissions and no provider, approval,
deployment or infrastructure credentials. This approval does not change public
repository runner policy, Kolibri's privacy, or its manual-merge requirement.
No billing change, host mutation or new runner infrastructure was performed.

The first Helix [run 40136216800](https://github.com/gaulatti/kolibri/actions/runs/40136216800)
passed all backend checks and 392 tests. Three frontend tests exposed a test
portability error: Node's response Blob and jsdom's global Blob belong to
different realms. The tests now verify the actual download bytes, size and MIME
type. All 241 frontend tests pass locally with unchanged exact coverage. That
run also failed artifact publication because the account's artifact storage
quota was exhausted. After the Blob correction,
[run 40136641131](https://github.com/gaulatti/kolibri/actions/runs/40136641131)
passed all 740 tests, builds, type checks and conformance checks; diagnostic
artifact publication was its sole failed step. Both failed runs remain evidence.
The new verification workflow replaces that diagnostic upload with a mandatory
released shared coverage-plan check plus its full result in the job summary.
No test or coverage gate was removed. Trusted acceptance-record transport is a
separate pending central integration dependency, not an optional diagnostic.

`.github/clouseau.json` records the released version 2 manual-merge policy,
qualified routed review roles and every required native verification step.
Deployment is deliberately absent from the shared controller: Kolibri's existing
deployment workflows remain manual-only. Public signing enrollment and separated
trusted assessment/write jobs are now prepared using released interfaces.
Assessment executes only accepted-base configuration and the frozen shared
engine on ready PR-target events. The separate writer receives no provider key;
it runs only on those same trusted events and fails if assessment fails or is
unavailable. Push verification has no provider or write job. Manual dispatch
only requests a trusted PR-event reassessment. This proposed configuration is
not accepted policy or an approval.

The original negative baseline below is retained as historical evidence. It is
not the current frontend result.

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
| Secrets | `DEEPSEEK_API_KEY` and `TYPESAFE_API_KEY` are available for the selected routed read-only assessment. Secret values were not read. |
| Open PRs | None at audit time. |
| Existing CI | Contract conformance; it is path-filtered and uses the existing Helix self-hosted runner. It is not a complete application verification gate. |
| Deployments | Backend and frontend dispatch-only. Only recorded production deployments were failures. No deployment or infrastructure operation was triggered. |
| Wiki | Disabled on this private repository; in-repository documentation is authoritative. |

Existing successful hosted conformance evidence predates this preparation:
[run 34060592268](https://github.com/gaulatti/kolibri/actions/runs/34060592268).
It proves neither Clouseau acceptance nor complete application coverage.

## Initial source inventory and native baseline

The tracked source inventory at the audited base contains:

| Area | Source inventory | Existing verification |
| --- | --- | --- |
| Backend | 119 `.ts` files excluding the 52 colocated `.spec.ts` files; includes declaration-only modules. | Nest build and Jest tests/native Istanbul coverage. |
| Frontend | 39 `.ts`/`.tsx` files under `frontend/app`. | React Router type generation, TypeScript check and client/server build; no application test command or coverage reporter. |
| Neutral contract | Four modules under `contract/src` and two executable modules in the immutable release. | Node tests, release validation and determinism check. |
| Conformance | One module under `conformance/bleecker-toggle/src`. | Black-box Node tests and actual conformity check. |
| Infrastructure | Eleven `.ts` files under `infrastructure/bin` and `infrastructure/lib`. | Existing build/tests; no CDK command, synthesis or deployment executed in this installation task. |

The initial backend configuration excluded modules, constants, types, entities,
DTOs, entrypoints and other application paths and permits 90% branch coverage.
That initial configuration did not meet the requested complete exact-coverage contract.
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

1. Keep Kolibri private and automatic merge disabled. Use a released shared
   manual-merge route that preserves tests, exact coverage and AI review when
   GitHub cannot enforce protection. Do not simulate protection or bypass the
   current controller's protection validation in consumer code.
2. Release a generic initial consumer trust-enrollment procedure that can accept
   the first local recipe, policy, engine digest and public signer without
   trusting contributor-proposed controls or bypassing checks.
3. Use protocol v2's now-released code-owner merge enforcement where protection
   supports automatic merge. This capability is present in `7d350031`; it does
   not grant Kolibri an exception from its explicit no-automatic-merge policy.
4. Release the shared run-wide automatic engine upgrade mechanism. A fixed-pin
   installation must not be described as self-updating.
5. Retain complete native coverage for every product module through the released
   multi-root recipe. The initial coverage and frontend-testing gaps are closed;
   specs follow the shared fixed test conventions and AST-proved declarations
   use `.d.ts` names. Do not fabricate counters for non-executable code, omit
   executable production paths, or lower thresholds. Establish a qualified
   runner route before claiming the native gates actually passed in GitHub.
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
