# Kolibri agent instructions

## Required Clouseau review before creating a PR

- Before creating any pull request, run the current shared `clouseau` skill
  locally with your authenticated coding harness against the complete change.
- Fix the reported defects and required changes, run the local verification
  recipe (`.clouseau-local.json`), and rerun Clouseau after repairs. Resolve every
  actionable finding; do not create a PR with unresolved findings or an
  incomplete review.
- Review the final committed change with a clean worktree. A change to the code,
  base or protected review policy requires a matching fresh review. Preserve
  negative review records; never repeat an unchanged review to obtain a pass.
- Publish the passing signed receipt and include its returned marker in the
  initial body of a ready, non-draft PR. Agent-created PRs must not omit local
  review to move paid AI work into CI.
- CI independently verifies the receipt, tests and exact 100% line/branch
  coverage of `backend/src`. Local review never waives those checks. Below 100%
  a change is reviewed but stays pending for a human merge.
- Submit changes through protected PRs; never push directly to `main`.
