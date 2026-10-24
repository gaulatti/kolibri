# Agent instructions

Kolibri is a private, unlaunched design-system compiler. Read `README.md`,
`docs/README.md`, `docs/private-repository-provenance.md`, and the accepted
requirement before changing it. Keep the repository and its artifacts private.
Deployment remains manual-only; integration work does not authorize a release,
AWS operation, SSM command, CDK execution, or infrastructure change.

Preserve unrelated local work and use an isolated worktree when necessary.
Keep local instructions and skills owned by this repository. Clouseau's shared
agent installation is independent of CI and must not create workflows, provider
secrets, or repository settings as a bootstrap side effect.

Before opening a ready pull request:

1. Read the repository purpose in `.github/clouseau.md` and the complete accepted
   requirement. Trace and implement the complete behavior within that scope.
2. Run real verification for the complete committed candidate, including the
   application's tests, type checks, builds and native coverage. Exact 100% line
   and branch coverage must include all executable application sources; missing
   source measurements and coverage exclusions are failures.
3. Refresh and use the shared public Clouseau installation with an authenticated
   supported harness (`codex` or `claude`). Never copy its engine or review rules
   into this repository and never substitute CI provider keys for local login.
   Run `clouseau review --directory REPO --base origin/main --request-file FILE
   --harness codex`, with the accepted requirement stored outside the checkout.
4. Investigate its findings and repair demonstrated blockers within the accepted
   requirement. Retain failed reports. Recheck the final changed revision; never
   repeat an unchanged failed review merely to seek a different verdict.
5. Publish eligible signed evidence with `clouseau publish --directory REPO
   --receipt FILE`. Include the returned receipt marker in the initial ready PR
   body. Enrollment requires accepted protected configuration; public enrollment
   metadata alone belongs in source. Never expose private signing material.

The initial installation is currently blocked as recorded in
`docs/clouseau-installation.md`. Proposed policy or verification files are not
trusted protected-base configuration. Do not fabricate a receipt, claim this
preparation is an installed integration, open an ordinary ready PR without
required local review, or bypass protection to install it. Resolve the supported
bootstrap dependency first. Human decisions are for purpose, authority and
meaningful product/risk tradeoffs; routine code inspection belongs to agents.
