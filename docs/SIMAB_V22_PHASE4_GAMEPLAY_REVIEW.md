# SIMAB v22 Phase 4 — release-candidate and Telegram test readiness

**Review date:** 2026-10-31
**Branch:** `work/simab-game-review-v22`
**Disposition:** local release candidate prepared; **not deployed**. No isolated Telegram test environment is configured in the repository or available in this workspace.

## Release identifiers and links

- Local candidate identifier: `SIMAB-V22-TEST-RC-20261031-local` (working-tree snapshot, not a published build).
- Test HTTPS URL: **none**. Do not use the production Pages URL as a test URL.
- Telegram test bot / Mini App link: **none**. No test bot username, BotFather Mini App entry, or test bot credential is configured.
- Existing production Pages URL found in `tonconnect-manifest.json`: `https://alihosseini6687-netizen.github.io/simor-app/`. This is production-facing and was **not changed or used as a test deployment**.
- Deployment destination: none. The only Supabase deploy workflow targets production project `pwjlyryrrgbaprfnrieq` and verifies the production bot identity. It was not run. No Pages deployment workflow or separate staging project was found.

## Preservation

- Verified the earlier external Phase 4 backup manifest and SHA-256 hashes: **127 files** at `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase4-start-20261030-145129`.
- Created and verified a fresh external backup of all current modified/untracked files: **142 files** at `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase4-rc-20261031-001132`.
- Remained on `work/simab-game-review-v22`. Existing changes remain uncommitted. No commit, push, merge, reset, deployment, migration, Artistry edit, or production-data change was made.

## Verification results

| Check | Result | Scope / caveat |
| --- | ---: | --- |
| Complete Node suite (`node --test tests/*.test.mjs`) | **991 passed, 0 failed** | Includes synthetic Telegram HMAC/Ed25519 validation tests; not a live Telegram launch. |
| Focused Node rerun after RC localization/test corrections | **45 passed, 0 failed** | Phase 4 rules, i18n catalog, and Seven Cards transfer regressions. |
| Full browser orchestration, Chrome-backed | **13/15 runners passed** initially | Two stale tests expected removed free refusal and old one-card transfer guidance. Both assertions were updated to the requested behavior; see focused reruns below. The aggregate was not rerun after fixes. |
| Updated screenshot regression runner | **passed** | Re-run after updating the refusal, two-card transfer, and recipient-count expectations. |
| Phase 3B localization browser runner | **1,251 checks; 0 unknown strings; 0 runtime errors** | Re-run after adding a complete translated Seven Cards rule string. |
| Phase 4 browser runner | **188 checks passed** | Includes bottle player-count/responsive/language/state preservation and Ludo viewport/pawn checks. |
| Hokm/bottle browser runner | **425 checks passed** | Real UI controls in 2/3/4-player matches; actual human next-round button; bot Hakem continuation; repeated language switches preserve names and game state. |
| Local preview startup smoke | **passed** | Menu/game/assets served; CSP `connect-src 'none'`; admin page 404; POST 405; wallet transport is a fixed disabled stub. Preview process was stopped after verification. |
| Real Telegram launch/auth smoke | **not run / unavailable** | Local preview intentionally removes the Telegram SDK and has no authentication backend. No test bot or staging backend exists. No physical Android/iPhone testing was performed. |

The browser orchestration was not silently treated as green: its first Chrome-backed run returned 13/15, then the two affected browser cases were individually rerun and passed. Other Phase 4-focused browser runners also passed. This is not a final, post-fix aggregate 15/15 invocation.

## Candidate behavior and isolation

The available local preview offers practice for Hokm, Ludo, Backgammon, Seven Cards, and Truth or Dare, including local bottle play. It has no Telegram identity, server persistence, multiplayer backend, or financial transport. It cannot satisfy a Telegram-authenticated test release by itself.

If launched locally, use:

```powershell
Set-Location 'E:\SIMAB\simor-app'
node .\scripts\preview-local-v22.mjs
```

Then open `http://127.0.0.1:8787/` in a desktop browser. This is not a public HTTPS URL and cannot be launched as a real Telegram Mini App.

In any future test release, real payments, wallet mutations, payouts, production balances, and production database writes must remain disabled. No test backend or isolated persistent storage was configured in this review.

## Blocking prerequisites for a real Telegram test release

1. Create or identify a **separate Telegram test bot** with its own Mini App URL and BotFather configuration. Keep the production bot unchanged.
2. Provide an **isolated staging backend/project** with test-only credentials, separate database/storage, and the required server-side Telegram `initData` validation secret/public-key configuration. Do not point the test UI at the production endpoint or production database.
3. Provide or authorize an **isolated HTTPS hosting target** and the exact deployment mechanism. Current source is uncommitted; publishing through the configured GitHub remote would require a Git publication operation. No such operation was performed. The only checked-in Supabase deployment workflow is production-targeted and is not safe for this RC.
4. After those are available, deploy, configure the test bot entry point, and run Telegram launch/auth plus Android/iPhone checks. Do not send bot tokens or raw `initData` in chat or commit them to the repository.

Because these prerequisites are absent, there is no valid test URL, bot launch link, deployment identifier, or remote rollback target to report. **No deployment was attempted.** Once an isolated deployment exists, rollback should disable/revert only that test Pages release and test bot Mini App URL; do not touch the production bot, Pages target, Supabase project, or balances.

## Known gaps, ranked

1. **Release blocker:** no isolated public HTTPS target, test bot, staging backend, or Telegram initData-authenticated test route. Real Mini App authentication and persistent server behavior remain unverified.
2. **Release verification gap:** full browser orchestration was not rerun as a single post-fix aggregate after the two stale expectations were corrected. The affected runners passed focused reruns; other 13 passed in the full run.
3. **Device verification:** Telegram Android/iOS viewport, app lifecycle, back navigation, and real-device audio were not tested. Automated browser evidence is not physical-device evidence.
4. **Scope limitation:** local preview is practice-only; wallet, payments, persistence, multiplayer, invitations, and voice/video are unavailable. Subjective Backgammon audio quality was not certified.
