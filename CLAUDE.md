# Agent instructions

Kolibri is a private, unlaunched design-system compiler. Read `README.md`,
`docs/README.md`, `docs/private-repository-provenance.md`, and the accepted
requirement before changing it. Keep the repository and its artifacts private.
Deployment remains manual-only; integration work does not authorize a release,
AWS operation, SSM command, CDK execution, or infrastructure change.
The accepted merge policy permits automatic merge for an internal PR only when
its author owns every affected path under the immutable accepted-base CODEOWNERS
(including both sides of renames), the full test suite passes, exact 100% line
and branch coverage passes, and Clouseau approves the current head and base.
External or non-owner PRs require current-head human code-owner approval and
manual merge. Missing or unverifiable ownership denies automatic merge.

The released shared owner-only path is prepared but remains unactivated until
initial trust is accepted and its actual gates are verified. On the supported
unavailable private-plan path, native repository auto-merge stays disabled; the
shared acceptance gate alone may merge an eligible owner revision after all
checks. Proposed configuration does not authorize itself. Do not build a consumer
merge controller, bypass protections or waive tests, exact coverage or review.

Preserve unrelated local work and use an isolated worktree when necessary.
Keep local instructions and skills owned by this repository. Clouseau's shared
agent installation is independent of CI and must not create workflows, provider
secrets, or repository settings as a bootstrap side effect.

Before opening a ready pull request:

1. Read the repository purpose in `.github/clouseau.md` and the complete accepted
   requirement. Trace and implement the complete behavior within that scope.
2. Run real verification for the complete committed candidate and record the
   actual test, type-check, build and native coverage outcomes, including failed,
   partial, missing, invalid or unavailable results. Never invent passing counts
   or treat an old artifact as this run's coverage. These outcomes do not suppress
   the local AI review. Full passing tests and exact 100% line and branch coverage
   across all executable application sources remain mandatory for automatic
   approval and merge.
3. Refresh and use the shared public Clouseau installation with an authenticated
   supported harness (`codex` or `claude`). Never copy its engine or review rules
   into this repository and never substitute CI provider keys for local login.
   Always run `clouseau review --directory REPO --base origin/main --request-file
   FILE --harness codex` before opening a PR, regardless of verification or
   coverage status, with the accepted requirement stored outside the checkout.
   Safe complete source, accepted purpose and material behavioral evidence are
   still required; a coverage gap alone is not an AI quality verdict.
4. Investigate its findings and repair demonstrated blockers within the accepted
   requirement. Retain failed reports. Recheck the final changed revision; never
   repeat an unchanged failed review merely to seek a different verdict.
5. Publish eligible signed AI quality evidence with `clouseau publish --directory
   REPO --receipt FILE`. A passing quality review can produce reuse evidence even
   when local coverage is partial or unavailable. Include its returned marker in
   the initial ready PR body and report AI quality separately from verification
   and coverage status. CI independently requires every mandatory test and exact
   100% coverage before automatic approval or merge; this receipt grants neither.
   Enrollment requires accepted base trust. Only public enrollment metadata
   belongs in source; never expose private signing material.

The released initial-installation procedure is separate from ordinary review:
freeze the complete candidate with `clouseau installation-prepare`, obtain its
explicit native administrator grant, then use `installation-review` and
`installation-publish`. Include the returned installation marker in the initial
ready PR body. This authorization is initial trust enrollment, not ordinary PR
approval. The independent checker belongs in a separate workflow and waits for
real successful PR-event verification. Initial owner acceptance is manual.

This candidate is currently blocked by the shared complete-evidence capacity
limit recorded in `docs/clouseau-installation.md`. This is a complete-source
capacity blocker, not a coverage prerequisite. Do not request a grant, repeat an
unchanged source-budget rejection or open a PR while that blocker remains.
Proposed enrollment and configuration are not accepted base trust. Do not
fabricate evidence, omit sources, claim this preparation is installed, or bypass
protection. Human decisions are for purpose, authority and meaningful
product/risk tradeoffs; routine code inspection belongs to agents.
