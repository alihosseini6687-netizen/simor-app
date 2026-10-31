# SIMAB v22 — GitHub Pages source integration

**Date:** 2026-10-31  
**Review branch:** `work/simab-v22-integration-review`  
**Production source:** `alihosseini6687-netizen/simor-app` (GitHub Pages)  
**Disposition:** focused Phase 3/4 source integration and local Chrome validation complete. No production deployment, backend change, migration, or data mutation occurred.

## Source comparison

- Integration worktree HEAD is `33abeed` (`origin/main`); original worktree HEAD is `3fcfc91` on `work/simab-game-review-v22`. Both worktrees contain uncommitted changes and were preserved.
- Compared application files in `E:\SIMAB\simor-app` and `E:\SIMAB\SIMAB_INTEGRATION_REVIEW`, normalizing line endings. Existing Phase 3/4 localization catalogs, CSS, gameplay code, and the bottle SVG are present in both worktrees; substantive source differences are the review integration's focused Mill delay and the HTML stylesheet references described below. The actual deployment was not fetched from GitHub Pages in this session; `origin/main` is the checked-out production-source baseline, not a live-site verification.
- Follow-up HTTP checks reached the live GitHub Pages home. The published site currently returns **404** for the Phase 3 CSS, Phase 4 CSS, and `assets/v22/glass-bottle.svg`; the new modular i18n catalog and launch-routing script paths also return 404. These are integration assets not yet published, rather than missing files in the local review worktree. The live root page itself returned successfully. This confirms why an approved GitHub Pages source update must include the asset/module files together with the HTML links.
- The full application remains the root SIMAB UI: original homepage/theme, 11 active game cards, navigation, profiles, wallet/shop/admin/task pages, Telegram entry points, and the game/multiplayer routes. No preview launcher, staging banner, fake balance, wallet stub, or staging API override was added to these pages.

## Confirmed integration defect and fix

The verified stylesheets `assets/css/simab-phase3-v22.css` and `assets/css/simab-phase4-v22.css` and image `assets/v22/glass-bottle.svg` existed but were not linked by the live root/game HTML entries. As a result, the integration had the gameplay implementation and visual assets but omitted the corresponding Phase 3/4 presentation on those routes.

Added versioned stylesheet links (`?v=22`) to:

- `index.html` — Phase 3 common/accessibility/home presentation.
- `games/room/index.html` — Phase 3 and Phase 4 practice, social-game, dice, Ludo, and bottle presentation.
- `games/backgammon/index.html` — Phase 3/4 board and dice presentation.
- `games/hokm/index.html`, `games/ludo/index.html`, `games/blackjack/index.html` — Phase 3/4 shared legacy game UI, dice, and round-end presentation.

No image file was missing in the local HTML/CSS static-path check. Its sole apparent miss was the game-slot template string `${s.img}`, which is a dynamically interpolated path rather than a literal asset reference. The browser smoke confirmed no failed local requests and explicitly loaded the glass-bottle SVG through the Phase 3 CSS URL. The live-production 404s above are fixed by shipping the present integration assets, not by changing their relative path.

## Changed files in this task

- `index.html`
- `games/room/index.html`
- `games/backgammon/index.html`
- `games/hokm/index.html`
- `games/ludo/index.html`
- `games/blackjack/index.html`
- `tests/ui-integrated-app-routes-v22.mjs` — local real-app route, asset, CSS, and interaction regression.
- `docs/SIMAB_V22_PRODUCTION_SOURCE_INTEGRATION.md` — this report.
- `docs/SIMAB_V22_FINAL_RELEASE_READINESS.md` — marked the old disabled-Cloudflare-package report as superseded; that package must not be used for this source-based release.

Earlier changes already present in this worktree—including Phase 3/4 implementation and the Mill 900–1300 ms practice timing fix—were left intact. The original `E:\SIMAB\simor-app` worktree was not edited in this task.

## Verification

- `tests/ui-integrated-app-routes-v22.mjs`: **42 checks passed** on installed Chrome. Opened the real home, navigated the game tab, confirmed 11 active cards, visited all 11 catalog routes, checked Phase 3/4 CSS links and HTTP success, ran Mill local practice, and verified the bottle SVG request. **0 failed local requests, 0 page errors, 0 external requests.** Google Fonts and the Telegram SDK were locally stubbed/blocked; Telegram had empty `initData`, so this was not authenticated testing.
- `tests/ui-phase3-v22.mjs`: **253 checks passed**.
- `tests/ui-phase4-v22.mjs`: **188 checks passed**.
- Prior integrated regression evidence remains: **991/991 Node tests** and **15/15 browser runners** after the Mill timing fix. The complete suites were not repeated for stylesheet-only changes.
- Existing Node security tests and signed-request harness remain the basis for backend claims. No production request was made during the browser run.

## Backend/security boundary

The app's configured Edge Function origin is the existing Supabase production endpoint. A read-only live CORS preflight returned **204** and `Access-Control-Allow-Origin: https://alihosseini6687-netizen.github.io`, matching the GitHub Pages origin for `alihosseini6687-netizen/simor-app` (origin does not include the repository path). A second preflight using the Mango staging origin still returned only the production allow-origin, confirming staging is not authorized. No POST/authenticated request was sent, and no CORS policy was changed.

Inspected code and existing tests cover server-side Telegram HMAC/official Ed25519 `initData` verification, signed-subject authorization, server-held Supabase keys, admin identity checks, authoritative wallet/game mutations, request idempotency, transactional locking, server-side settlement/RNG, and bounded per-isolate request limits. These are source/test findings, not a live authentication or payment certification. Per-isolate throttling is not a distributed abuse limit; provider-level controls remain advisable. Existing voice/video is permission-gated and STUN-only; TURN/restrictive networks and physical Telegram devices remain unverified.

No wallet client, endpoint, CORS policy, Telegram identity configuration, Supabase function, migration, economy, game rule, or production balance was changed. Do not enable or repoint any staging action to the production backend.

## Release / rollback

- **No deployment or push occurred.** The review branch contains working-tree edits but no release commit/hash, so there is no production rollout to roll back.
- Keep changes on `work/simab-v22-integration-review` for review. Before any production release, review the diff and backend migration state, run the accepted CI suite, obtain explicit owner approval, then publish through the existing GitHub Pages repository workflow. Do not alter `main`, deploy, or migrate under this task.
- If a future approved release is deployed and must be rolled back, use GitHub's revert of that specific release commit/merge (or restore the prior Pages artifact/source revision), then let the existing Pages workflow publish it. Do not reset/clean either worktree and do not run rollback migrations or alter wallet data unless separately approved.

## Remaining blockers and next action

1. Current live Pages has not received this branch's changes; the confirmed 404s remain until an approved update publishes the HTML links, Phase CSS, bottle SVG, localization modules, and launch-routing asset together.
2. No production approval/deployment authorization was given; nothing was pushed or deployed.
3. Telegram live WebView authentication, wallet/payment behavior, multiplayer with two real accounts, and mobile-device media/network behavior still need their appropriate real-environment checks. Local empty-initData browser runs intentionally made no production API calls.

**Next action:** review the seven changed application/test files on this branch and approve or request edits. Only after explicit approval should a release be published to the existing `alihosseini6687-netizen/simor-app` GitHub Pages source; no new Cloudflare app is needed or proposed.
