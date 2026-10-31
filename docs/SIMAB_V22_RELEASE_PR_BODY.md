## Summary

Prepare the complete existing SIMAB application for review on GitHub Pages. Preserve original home/theme/images, all 11 game cards and routes, profiles, wallet UI, Telegram authentication and multiplayer infrastructure. Integrate Phase 3/4 localization/gameplay/presentation, explicit stylesheet links and the bottle SVG, plus Mill's 900–1300 ms pacing regression fix.

**Review only — no merge/auto-merge, Pages deployment, Supabase deployment or migration is authorized.** Pages publishes main automatically, so merging requires explicit production approval.

## Preservation / rollback

- Base and verified currently deployed Pages SHA: `33abeedcb36b69136c86c3f4026560bb4d8f861d` (build 1318575422 / deployment 7357414405 succeeded).
- Rollback tag: `rollback/simab-pages-pre-v22-20261031`; verify it has been published before release approval.
- Both original dirty worktrees and backups remain intact. Release prepared in a separate worktree.
- No Cloudflare builder, staging banner, disabled wallet stub, fake balance or staging API override is included in app runtime.

## Prior test evidence

- 991/991 Node tests (historical full suite before added Mill test).
- 15/15 browser runners; 42 integrated route/asset checks; 253 Phase 3 checks; 188 Phase 4 checks; Mill timing regression passed.
- Final preparation: 198 source files copied byte-for-byte, 38 baseline images unchanged, 11 active games, no missing local static references or staging runtime markers. Full suites not redundantly rerun.

These are local/synthetic tests, not certification of live Telegram authentication, payments, real-account multiplayer or physical-device media. PR CI must pass independently.

## Deployment gates

- Confirm frontend/backend contract compatibility, including Seven Cards transfer behavior, against the deployed Edge Function before approving a merge.
- The preserved new wallet RNG migration is review-only. No existing SQL migration was edited and no SQL was executed against production. Review actual migration history/schema separately; no automatic backend deploy is triggered by this PR.
- Existing backend deploy workflow is manual-only; do not dispatch it without explicit authorization. Keep current GitHub Pages CORS origin, server-side Telegram validation, and wallet/idempotency boundaries.
- Rollback is a separately reviewed revert PR after approval, not force-resetting main or rolling back balances/schema.

See `docs/SIMAB_V22_GITHUB_RELEASE_PREPARATION.md` for deployment record, detailed gates, and exact deployment/rollback steps.
