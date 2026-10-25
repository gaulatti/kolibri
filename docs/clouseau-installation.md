# Clouseau installation readiness

Status: local verification implemented; hosted integration not accepted. Audited on
2026-10-24 against remote `main` at
`fe39ef5b63110598b0e8ff0b73574f28cf98ec6d`.

## Supported shared implementation

The final thin integration targets released public Clouseau
[`4b713578475c41e097d8e325f206cdb07e88a403`](https://github.com/gaulatti/clouseau/commit/4b713578475c41e097d8e325f206cdb07e88a403),
engine digest
`01e452d5d6cc583cf0ac6515c440999b0188c7d7b01e82f66ebc0c4c27dbd890`.
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

`.github/clouseau.json` explicitly selects the released `merge_mode: "automatic"`
owner-only policy and optional local receipt reuse. The shared gate requires
accepted-base CODEOWNERS to cover every affected path. On GitHub's exact
unavailable private-plan condition, native repository auto-merge remains false
and the shared controller may atomically advance the exact base to the reviewed
head only after complete acceptance revalidation. The shared source/base
compare-and-swap admits no force or fallback merge. No consumer merge controller
or extra finalize/deployment-dispatch operation was added.

The proposed policy's `central_source` authorizes only protected public Clouseau
main. Public enrollment was exported through the released `public-identity`
command for native actor `gaulatti`; no private signing material was read or
copied.
The entry remains **proposed enrollment**, not accepted trust. Matching eligible
receipts avoid CI AI calls; absent receipts use the qualified routed CI reviewer;
invalid receipts fail without an unexpected paid fallback. Those hosted paths
remain unproved until installation is accepted and exercised.

The supported [initial trust procedure](https://github.com/gaulatti/clouseau/blob/4b713578475c41e097d8e325f206cdb07e88a403/docs/initial-installation.md)
freezes the candidate, records an explicit native administrator commit grant,
performs authenticated independent local review, then publishes installation-only
signed evidence before a ready PR. Its separate read-only checker requires real
successful PR-event verification and returns manual owner acceptance, never
ordinary approval or automatic merge. No grant, review, receipt or PR has been
created for this candidate. The separate initial checker now freezes protected
Clouseau main through its own resolver, verifies the selected content digest,
and delegates exact manifest/engine equality to the shared checker. A later
released capacity repair can reach it without changing a consumer engine pin;
an engine mismatch still rejects old evidence and requires a fresh review.

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
persistent Helix private pool. The clarified target source-merge policy is:

- An internal PR may merge automatically only when its author owns every affected
  path under immutable accepted-base CODEOWNERS, including both sides of renames,
  the full test suite passes, exact 100% line and branch coverage passes, and
  Clouseau approves the current head and base.
- External or non-owner PRs require current-head human code-owner approval and
  manual merge. Stale, dismissed and bot reviews cannot satisfy that requirement.
- Missing ownership, invalid ownership data or unverifiable membership denies
  automatic merge. Proposed ownership changes cannot authorize their own author.

Current live automatic delivery remains unactivated because the proposed trust
and gates have not been accepted or exercised. The repository native
`allow_auto_merge` setting remains false, as required by the released shared
private-plan path. The proposed configuration uses explicit owner-only automatic
mode; it is not accepted-base authority. No consumer controller, protection
bypass or waiver is permitted. Source merge does not authorize production release:
deployment remains manual-only. No AWS, SSM or CDK operation was performed.

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

The technical verification job in `.github/workflows/verify.yml` runs these
commands on the existing Helix private pool with Node 22, checks out the exact
event candidate, uses a read-only token without persisted checkout credentials,
and checks all four native reports through the released shared coverage plan.
Its exact JSON result is retained in the Actions log and job summary. This job
has no provider key, approval/merge permission or deployment step. Provider
assessment and write-capable approval are separate trusted PR-target jobs.
Push checks establish candidate verification only; the eventual PR-event check,
trusted review, signed evidence and owner/non-owner merge paths need separate
proof.

Ordinary coverage validation reads `.clouseau-local.json` from the immutable
accepted PR base. Feature pushes use the freshly fetched `origin/main`. Proposed
recipe edits cannot narrow that source inventory. The helper reads configuration
only as data and never executes its verification argument arrays. Only when
both recipe and CI policy are absent may explicit initial qualification use the
committed candidate recipe: the authorized owner installation branch, or an
internal owner-authored PR bearing the installation receipt marker. That marker
selects qualification; it grants no trust or approval. The separate signed
initial checker remains mandatory before initial owner acceptance. Missing base
objects, existing CI policy without a recipe and unqualified fallback fail.

The first hosted push
[run 40134744162](https://github.com/gaulatti/kolibri/actions/runs/40134744162)
failed before executing any steps because “an Actions budget is preventing
further use.” It is not a failed application test or CI acceptance evidence.
The owner explicitly accepted the existing persistent Helix private-pool tradeoff
for these private repositories. This pool is not a disposable runner boundary.
The verification job retains read-only permissions and no provider, approval,
deployment or infrastructure credentials. This approval does not change public
repository runner policy, Kolibri's privacy, or the source-ownership requirements.
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

`.github/clouseau.json` records the released version 2 owner-only automatic mode,
qualified routed review roles and every required native verification step.
Activation remains unproved until trust acceptance and actual hosted owner and
non-owner proof. Consumer-owned merge logic remains prohibited. Focused wiring
tests evaluate real Actions event expressions, the actual immutable-base recipe
selector, mandatory complete verification, frozen-engine handoff, credential
separation and absence of deployment/finalization calls. A separate data-only
check loads the shared configuration validator and validates consumer inputs
against the actual released action before technical acceptance.
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

1. Keep Kolibri private. Preserve the current disabled automatic-delivery state
   until the released shared owner-only path has accepted, verified gates for
   the clarified owner-only automatic/non-owner manual policy. Do not bypass
   available protections or simulate unavailable protection in consumer code.
2. Resolve the measured complete-evidence capacity limits centrally, then measure
   the full final candidate again without omitting source or review evidence.
3. Use the released initial trust procedure, signed installation evidence and
   independent initial checker before initial owner acceptance. Proposed recipe,
   public enrollment and workflows are prepared; they are not accepted trust.
4. Preserve the prepared run-wide engine resolver and verify its actual selected
   SHA/digest and source at every engine job. Upgrade selection is separate from
   receipt compatibility; an engine mismatch must reject stale evidence.
5. Retain all application tests and complete native exact coverage. Hosted initial
   qualification has passed all 740 tests, 4226/4226 lines and 3092/3092 branches;
   this is not approval or merge evidence. Existing failures remain recorded.
6. After trust acceptance, prove ordinary receipt reuse with zero CI AI calls,
   unstamped qualified CI review, owner-only automatic merge and non-owner
   current-head human approval/manual merge. Keep deployment authorization
   separate. No ready PR is allowed while complete review remains blocked.

Documentation automation is unavailable for this private, unlaunched product:
there is no wiki and no verified successful deployed-source run for a supported
catch-up. Keep these repository documents current; do not invent production
state or trigger a deployment to demonstrate documentation publication.

This preparation has not earned a local review receipt or hosted approval. No
installation PR, protected merge, unattended proof, deployment, live health,
documentation publication or ticket closeout is claimed.
