# SIMAB v22 phase 1 — local fixes

Branch: `work/simab-game-review-v22`. Based on `d825060`.

## Scope and behavior

- **Windows tests:** native filesystem paths now come from `fileURLToPath()`. Test-only source extraction normalizes CRLF before matching the admin block and removing static imports. Assertions were retained, not skipped or weakened.
- **Shared-room Start:** the enabled state now requires a waiting room, its host, exactly the selected seat count, and no busy/pending wallet operation. Polling and wallet notifications use the same condition. The existing server validation is unchanged. Private poker's explicitly declared minimum-two-player start rule is unchanged.
- **Legacy Ludo:** actual active/last dice values render as matching pips and numbers. Unknown initial results remain unknown. Last-roll history never enables a pawn move. Pawns have visible numbers, correct seat colors, explicit turn status, stable board rows, non-intercepting decorative layers and packed shared cells. Old states without history remain supported without fabricated history.
- **Rotation:** dimensions are re-read on every fit, including near-square orientation changes, small resizes, height-only changes, Telegram viewport events and visual viewport changes. Both direction-switch settings and inverse video rotation are preserved. Small available viewports are no longer forced to overflow by 240/220px layout minimums.
- **Insets:** safe-area and content-area insets apply to all four edges, while retaining the existing 64px fullscreen top reserve. Visual viewport offsets are included when applicable.
- **Sound:** shared-room rolls unlock audio on the gesture but play the result sound only when a new accepted event arrives. Existing event IDs deduplicate receipt/poll repeats. Failed/unconfirmed rolls play no result sound. Finished games distinguish viewer wins, losses and draws rather than always playing victory audio.

No game rules, RNG implementation, payout, stake, wallet economy, SQL migration or server API was changed. Existing Web Crypto rejection-sampled dice/shuffles are preserved.

## Changed files

### Application

- `assets/js/simab-game-room-v12.js` — responsive stage fitting, all-edge insets, viewport listeners and retained video compensation.
- `assets/js/simab-party-v16.js` — shared-room Start validation and event/result audio.
- `assets/js/simab-table-games-v13.js` — legacy Ludo history, dice, numbered/packed pawns and turns.
- `assets/css/simab-room-flow-v18.css` — scoped legacy Ludo board, pawns, dice and active-seat styles; previous v22 styles retained.

### Tests and CI

- `tests/support/source.mjs` — cross-platform paths and LF/CRLF source helpers.
- `tests/admin-credit.test.mjs`, `tests/admin-credit-edge.test.mjs`, `tests/verified-quest-rewards.test.mjs`, `tests/simab-wallet-contract.test.mjs`, `tests/simab-official-channel.test.mjs` — portable test-source extraction.
- `tests/gamewide-legacy-safety.test.mjs`, `tests/simab-mobile-wallet-layout.test.mjs` — native project paths.
- `tests/support/ui-harness.mjs` — isolated DOM/timer/wallet doubles for behavior regressions; not used to claim pixel-layout correctness.
- `tests/phase1-v22.test.mjs` — 13 new Node regressions covering every phase 1 fix.
- `tests/ui-phase1-v22.html` — 10 real-browser checks using actual application markup, CSS and scripts, with mocked wallet/Telegram/media and local-only CSP. The srcdoc harness supplies the original route query and adds test-only closure hooks; application code exposes no test hooks.
- `tests/ui-phase1-v22.mjs` — optional Playwright runner with a Node-only local static server and external requests blocked. No Python, database, credentials or screenshot output is needed.
- `.github/workflows/simab-secure-wallet-integration.yml` — adds the isolated browser runner after the existing v22 regression step.
- `docs/SIMAB_V22_PHASE1_FIXES.md` — this report.

## Validation performed locally

Environment: Windows, Node `v24.22.1`.

| Check | Passed | Failed |
| --- | ---: | ---: |
| Original Node suite after portability fix, before new tests | 121 | 0 |
| `node --test tests/phase1-v22.test.mjs` | 13 | 0 |
| `node --test tests/*.test.mjs` including new regressions | 134 | 0 |
| Isolated browser page in OpenCode Chromium | 10 | 0 |

All 24 browser JavaScript files passed a syntax parse; `node --check tests/ui-phase1-v22.mjs` and `git diff --check` passed. The final browser run recorded no console errors. Git's informational LF-to-CRLF checkout warnings are not test or whitespace failures.

Browser checks cover 320/390/768px legacy Ludo, pawn hit-testing and full opacity, sixteen packed finish pawns without overlap, six history faces, turn indicators, partial/full room Start state, rapid taps/repeated receipts, loss/draw/win sounds, near-square and height-only resizes, both rotation directions and all-edge/fullscreen inset bounds.

To repeat the browser checks with the project's pinned Playwright dependency and Chromium installed:

```sh
node tests/ui-phase1-v22.mjs
```

Alternatively, serve the repository locally and open `tests/ui-phase1-v22.html`. It displays exact pass/fail results. The local run here used the in-app Chromium browser, not the Playwright CLI, because Playwright is not installed in this checkout. Python is also unavailable; a temporary in-memory Node static server was used instead.

Database integration suites and production API tests were not run. No production database or account was accessed or changed. No commit, push, merge or deployment was performed.

## Remaining limits / follow-up

- Physical Android/iPhone Telegram camera orientation, keyboard behavior and real audio perception still require device testing. Desktop Chromium geometry and sound-event assertions are not those device tests.
- TURN support, the legacy wallet-slot modulo bias, Roulette implementation and referral attribution/rewards remain outside phase 1 and are unchanged.
- Existing legacy/shared game-engine duplication remains; this patch does not refactor rules or settlement.
- Asset URL cache-version changes are deferred to a coordinated publication pass; current URLs were retained because this is a local-only patch. No deployment readiness or production activation is claimed.
- New Node regressions are in the default suite. The new browser runner is wired into existing CI, but that remote workflow was not triggered.
