# SIMAB v22 Phase 2A — local fixes

Branch: `work/simab-game-review-v22`. No commit, push, merge or deployment performed.

## Sources and scope

Read `SIMAB_V22_PHASE1_FIXES.md`, `SIMAB_V22_GAME_REVIEW.md`, the older operational Phase 1 report and security audit before implementation. A separately named Phase 2 audit was not present in this checkout; the four requested defects were verified directly against the application and existing server implementation.

- **Slot Auto Stop:** retain and cancel the next-spin timer; invalidate stale queued callbacks with a generation token. Recheck Auto after wallet initialization, before submitting an automatic wager. Manual spins cancel the old Auto timer, and the synchronous spin lock prevents repeated taps from submitting duplicates. Stop, hidden-page and pagehide cancel future automatic wagers, not an already-submitted request. An uncertain response stops Auto and leaves the wallet client's original pending request/recovery unchanged. Re-enabling Auto is an explicit new authorization.
- **Paytable:** distinguish gross payout from net result; explain exactly-two matching symbols in any positions, excluded pants/skull/bomb pairs, triple precedence and zero-payout combinations. Three energy symbols pay `20 × selected multiplier`, independent of base chip value. Example: base 100, multiplier 2, bet 200, energy payout 40, net −160. All existing server payout amounts remain unchanged.
- **Legacy Backgammon:** all six results have matching visible numbers and pips, including compact mode. Checker frames do not produce repeated roll sounds. Accepted responses with a new roll produce at most one roll cue per response; checker-only responses produce no roll cue. Pending requests and opponent turns cannot select/move checkers. Server moves, legal-move filtering, turn validation and rules are retained.
- **Sound:** legacy table action sounds follow an accepted response, not a tap/request. Repeated receipt versions are deduplicated. Slot and Blackjack use net results for win/loss/draw, including positive payouts smaller than the bet. Backgammon terminal results distinguish win/loss/draw. Phase 1 shared-room event audio remains unchanged.

No application server files, wallet client, RNG, settlement, economy rules or historical migrations were modified. No production account, database, API, payment or deployment was used. Integration balances exist only in isolated in-memory PGlite databases.

## Changed files

Application:
- `games/slot/index.html`
- `assets/js/simab-backgammon-v10.js`
- `assets/css/simab-backgammon-v10.css`
- `assets/js/simab-table-games-v13.js`

Tests/documentation/CI:
- `tests/phase2a-v22.test.mjs` — 742 new tests, including 729 separately named reel combinations. Every combination is checked against the unchanged server payout function at all five legal base values and all 50 multipliers: **182,250 payout cases**. RNG is substituted only inside a test VM.
- `tests/ui-phase2a-v22.html` — nine isolated real-browser checks using actual markup, CSS and application scripts, mocked wallet/Telegram, controlled timers and local-only CSP; no production test hooks.
- `tests/ui-phase2a-v22.mjs` — local static-server/Playwright runner; optional `SIMAB_TEST_BROWSER` executable override.
- `tests/support/ui-harness.mjs` — optional test globals and chainable inert readiness double.
- `tests/support/server-harness.mjs` — native Windows paths and existing Phase 1 CRLF-safe import stripping, required to run the previously Linux-only integration harness. Assertions and application server code unchanged.
- `tests/simab-v8-ui-gameplay.test.mjs` — retained function-presence assertion updated for the explicit automatic-spin parameter.
- `.github/workflows/simab-secure-wallet-integration.yml` — adds Phase 2A browser runner; workflow not triggered.
- `docs/SIMAB_V22_PHASE2A_FIXES.md` — this report.

## Final local validation

Windows / Node `v24.22.1`; pinned dependencies installed with `npm.cmd ci` (audit: zero dependency vulnerabilities).

| Check | Passed | Failed / skipped |
| --- | ---: | ---: |
| `node --test tests/*.test.mjs` | **876 tests** | **0 / 0** |
| `npm.cmd run test:server` | **12 named tests + 1 standalone HTTP/DB integration script** | **0 / 0** |
| `node --test tests/security-v17-integration.mjs` | **1 test** | **0 / 0** |
| Existing browser runners, listed below | **10 runners** | **0 / 0** |
| `tests/ui-phase1-v22.mjs` | **10 checks** | **0 / 0** |
| `tests/ui-phase2a-v22.mjs` | **9 checks** | **0 / 0** |
| Application JS syntax | **24 files** | **0** |

Total browser execution: **12/12 runners passed**, including **19 explicitly counted isolated checks**. Older runners report scenario summaries, not a stable individual test count; runner counts are not presented as assertion counts.

All existing browser runners executed successfully:
`ui-dice-board-v22`, `ui-language-v16`, `ui-party-v16`, `ui-private-poker`, `ui-refresh-v17`, `ui-room-setup-v19`, `ui-screenshot-regressions-v21`, `ui-shop-v15`, `ui-v13`, `ui-video-regressions-v20` (all under `tests/`, extension `.mjs`).

Playwright's pinned Chromium download returned HTTP 403 for this location. Installed Google Chrome was used instead. Python is unavailable, so the ten older browser runners used a temporary, external-to-repository Node adapter for their Python static servers and screenshot paths. That adapter also blocked unmatched external requests; their mocked Telegram/API handlers continued to use signed test requests against isolated PGlite. No assertions were removed or skipped. Temporary logs/screenshots/adapters are under `C:\Users\ALI\AppData\Local\Temp\opencode`, not committed project assets. The new runner needs no Python or adapter:

```powershell
$env:SIMAB_TEST_BROWSER='C:\Program Files\Google\Chrome\Application\chrome.exe'
node tests/ui-phase2a-v22.mjs
```

`git diff --check` passed. Remaining test failures: **none**. Initial Windows harness/import/function-signature failures were fixed and rerun successfully.

## Financial/security limits

- Stop cannot revoke or refund a wager already submitted to the server. Its original request ID remains recoverable; Stop never clears financial pending storage or creates a compensating transaction.
- This is presentation/lifecycle work, not a financial security certification. Existing wallet-slot modulo bias, Roulette and referral issues remain out of scope and unchanged, as recorded in Phase 1.
- Existing STUN-only WebRTC/TURN limitations and physical Android/iPhone Telegram behavior, audio perception and orientation still need real-device/network testing. Local fake-device WebRTC passes are not production guarantees.
- No standalone PostgreSQL/`psql` SQL-file run was performed; Node integrations execute repository migrations in isolated PGlite. No production financial validation is claimed.
- Existing asset cache URLs were retained for this local-only patch; coordinated publication/cache invalidation remains deferred. No remote CI or production activation was performed.
