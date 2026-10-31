# SIMAB v22 GitHub release preparation

## Release identity and preservation

- Review branch: `release/simab-v22-github-review`; base: `33abeedcb36b69136c86c3f4026560bb4d8f861d`.
- Original and integration worktrees are left untouched. Release changes are copied into a third worktree: `E:\SIMAB\SIMAB_V22_GITHUB_RELEASE`.
- All 206 modified/untracked integration files were separately copied and SHA-256 verified at `C:\Users\ALI\AppData\Local\Temp\opencode\simab-github-release-preserved-1793407455353` (`PRESERVED_FILES.json`). Existing user backup remains untouched.
- Excluded only from this release copy: Cloudflare staging builders, disabled preview launcher and its guide, superseded Cloudflare readiness report/screenshots, and local Node test log. They remain preserved in the integration worktree and preservation snapshot.
- Full original application, 11 active games, images, profiles, seven locales, Telegram SDK, authoritative wallet client and multiplayer code remain intact. No staging wallet stub, fake balances, banner or API-blocking override is installed into runtime source.

## Exact deployed revision and rollback reference

Authenticated GitHub API checks identified:

- Pages source: **main**, path **/**, build type **legacy**, HTTPS enforced.
- Latest Pages build: **1318575422**, status **built**, commit **33abeedcb36b69136c86c3f4026560bb4d8f861d**.
- Latest deployment: **7357414405**, environment **github-pages**, status **success**.
- Successful Pages run: https://github.com/alihosseini6687-netizen/simor-app/actions/runs/40497570807
- Annotated rollback tag: **rollback/simab-pages-pre-v22-20261031** at that exact commit. **Created locally; publication blocked by GitHub 403** for stored account `dododia88-dotcom`. Do not move or delete it. It records the deployed frontend revision, not the deployed Supabase function/schema version or a guarantee that all production behavior is defect-free.

## Review and tests

The branch carries the preserved Phase 1–4 integration, including Luna's Phase 3/4 stylesheet links, localization modules and bottle SVG, and Sol's Mill 900–1300 ms delay fix. No new game/economy changes were made during GitHub preparation.

Prior supplied and recorded results (not rerun as part of publication preparation):

- Node suite: **991/991** before the added Mill timing test; do not mistake this historical count for a newly run suite on this commit.
- Browser orchestration: **15/15**.
- Integrated app routes/assets: **42** checks.
- Phase 3 browser: **253** checks.
- Phase 4 browser: **188** checks.
- Mill timing regression passed.

Publication preparation checks passed: **198 integration files copied byte-for-byte**, **38 original image files unchanged**, **11 active catalog cards**, **0 missing local HTML/CSS references** (dynamic template paths excluded), **0 staging runtime markers**, and Git whitespace checks. Workflow triggers were reviewed. CI results on a future PR are separate and must be reviewed before approval. Local synthetic Telegram/camera/server tests do not certify live auth, payments, two-account multiplayer, physical devices, or restrictive-network media.

## Workflow and deployment boundaries

- GitHub Pages uses GitHub's generated `pages-build-deployment` workflow, not a repository Pages YAML. **Merging into main publishes the frontend automatically** under current settings. Therefore approving/merging the PR is a production deployment decision; do not merge merely to stage code.
- Release-branch and rollback-tag pushes do not change Pages' configured `main` source. Repository push-triggered tests are scoped to named older feature branches; PR-triggered checks run on this PR.
- `.github/workflows/deploy-simab-central-quests.yml` is **workflow_dispatch only**. It deploys the existing production function and must **not** be dispatched without separate explicit approval. It does not apply SQL migrations.
- The new migration `20261028090000_wallet_unbiased_random.sql` is preserved from the integration worktree as **review-only SQL**. No existing migration was edited, no migration executed, and no production data/balance touched. Its schema-drift guard deliberately aborts on an unexpected installed wallet-function definition.
- The API CORS origin remains the existing GitHub Pages origin. Server-side Telegram verification, service-role authorization, idempotency and wallet recovery remain in source. No production secrets are embedded into frontend source.

## Approval gates and exact future deployment procedure

1. Review the PR diff and its CI checks. Confirm all added locale/CSS/SVG/JS files are included; never publish only the HTML links.
2. Before merging, obtain explicit production approval and inspect the currently deployed Edge Function/schema versions. The integration includes server-side gameplay/security changes: notably Seven Cards transfer behavior must agree with the frontend. Frontend/backend compatibility must not be assumed from the frontend rollback tag.
3. Obtain a separately approved backend rollout plan if those server changes or the new RNG migration are required; review the migration against actual schema in an isolated copy first. Do not run a migration or deploy a function under this PR-preparation request.
4. Only after authorization and compatibility gates, merge the PR through GitHub (prefer a squash commit for a single reviewable frontend rollback). Pages will then run automatically from `main` `/`. Record the resulting main commit, Pages build/run/deployment IDs, and separately record any approved backend rollout version.
5. Verify full home, all 11 game links, localization, CSS/JS/image responses at `/simor-app/`, Telegram launch/back navigation, authorized wallet and multiplayer using the approved test plan. Do not manufacture signed identity or make unapproved financial actions.

## Exact rollback procedure (future approval required)

Nothing has been deployed by this task, so there is currently nothing new to roll back.

If an approved squash release later fails, open a **new rollback branch/worktree from the then-current origin/main**, run `git revert <APPROVED_SQUASH_RELEASE_SHA>`, push that rollback branch, and open a rollback PR to main. Review for subsequent changes, then obtain explicit rollback/deployment approval before merging. The revert restores the old frontend while preserving history; Pages republishes automatically on merge. If a merge commit was used instead, use `git revert -m 1 <RELEASE_MERGE_SHA>` after confirming parent 1 is main.

Use `git show rollback/simab-pages-pre-v22-20261031:index.html` (and the tagged tree) to compare with the known deployed source. **Do not reset/force-push main**, blindly overwrite intervening changes, run down migrations, restore balances, or dispatch backend deployment as part of a frontend rollback. Backend rollback requires its own approved plan and previously recorded function version; the tag alone cannot restore backend state.

## Remaining blockers

- GitHub write access: authenticated reads work, but the stored account `dododia88-dotcom` receives **403 Permission denied** when publishing the rollback tag to `alihosseini6687-netizen/simor-app`. No alternate stored account exists. No fork was created. The branch and tag cannot be published and a same-repository PR cannot be opened with these permissions. Authenticate an owner/collaborator with repository contents and pull-request write access; never paste tokens into chat.
- Production deployment/merge approval has not been granted.
- Production database migration state and live backend/frontend contract compatibility still need authorized confirmation before release.
- Real Telegram auth, payments, real-device WebView and internet multiplayer/media are not newly tested here.
- Provider-level distributed abuse controls and TURN/device verification remain previously documented follow-ups.

This is a review branch/PR only; auto-merge is not enabled, and no Pages/Supabase deployment is requested.

## Resume publication after authorized login

From `E:\SIMAB\SIMAB_V22_GITHUB_RELEASE`, after configuring an authorized GitHub identity:

```powershell
git push origin refs/tags/rollback/simab-pages-pre-v22-20261031:refs/tags/rollback/simab-pages-pre-v22-20261031
git push --set-upstream origin release/simab-v22-github-review
```

Then open a **draft PR** targeting main at:
https://github.com/alihosseini6687-netizen/simor-app/compare/main...release/simab-v22-github-review?expand=1

Use the prepared PR text in `docs/SIMAB_V22_RELEASE_PR_BODY.md`. Do not merge or enable auto-merge. A compare link is **not** an existing PR URL.
