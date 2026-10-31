# SIMAB v22 Phase 2B + 2C — local repair and security hardening

Date: 2026-10-28. Repository: `E:\SIMAB\simor-app`.
Branch: **`work/simab-game-review-v22`**, baseline HEAD **`e5e6f82`**.

## 1. Preconditions and boundaries

- Initial working tree was clean. History contains Phase 1 `d3bede2`, Phase 2A `e5e6f82` and the earlier v22 fixes `d825060`. Branch/HEAD were not changed.
- Read the Phase 1/2A fixes reports, v22 game review, full-game security audit, operational Phase 1 report and current implementation/tests/workflows. No separately named Phase 2 audit exists in this checkout; unavailable material was not invented.
- Baseline default Node suite: **876 passed, 0 failed**. Existing Phase 1/2A regressions remain in the suite, including all 729 reel combinations at all 250 stake/multiplier choices (**182,250 payout cases**).
- Economy remains server-authoritative, virtual-only and non-withdrawable. Verified quest opening credits only; no import of localStorage/CloudStorage money. Coin/chip exchange remains 1:1. Existing stakes, multipliers, payouts, miner prices, UTC eligibility, escrow and voluntary-leave rules are unchanged.
- No historical migration changed. No database integration ran: this request did not explicitly approve a disposable database environment. Prior reports' database passes are historical evidence, not passes for this patch.
- SIMAB only; no Artistry files, credentials or services were accessed.

## 2. Changes by subsystem / before and after

### A. Legacy slot RNG and daily wheel fairness (items 1–2)

New **unapplied** forward migration `20261028090000_wallet_unbiased_random.sql` adds a restricted, volatile cryptographic rejection sampler. UUID v4 bytes 0–3 contain 32 random bits without version/variant bits. Values at or above `2^32 - (2^32 mod bound)` are rejected, then reduced modulo the bound.

- Legacy `walletAction:slot`: three independent samples in `[0,6)` replace biased byte `%6`. Six symbol indices, triple `5 × bet`, any pair `2 × bet`, other `0`, bet 1–50 and two-second cooldown remain unchanged. There are 6 triple, 90 exact-pair and 120 distinct combinations out of 216 intended equiprobable combinations.
- This is NOT the current nine-symbol `action:game, game:slot` endpoint. Its existing rejection-sampled RNG and payout function are untouched. Repository caller search found no active application caller of the legacy wallet slot; the server still allows it for backward compatibility. It was **not retired** based on that search, because external/old clients cannot be ruled out locally.
- Daily wheel: `%100` becomes a uniform ticket in `[0,100)`, preserving weights **30/35/20/12/3%** for **0/1/2/5/10 coins**, and one claim per server UTC date. No streak or reward values changed.
- Wheel UI now states the unequal weights, explains that equal visual sectors are decorative, associates the explanation with the claim button, and explicitly distinguishes the wheel from Roulette.
- Migration reads the installed function definition and replaces exactly four known RNG assignments, aborting atomically on unexpected drift. All other function text, grants, payout/date/locking/receipt behavior stays intact. The old, now-unused wheel UUID draw is harmlessly retained to minimize replacement scope.
- **Not active anywhere:** SQL execution, migration syntax against PostgreSQL, live randomness and real wallet effects remain untested/unapplied. Deterministic tests check guarded source replacements, rejection mathematics and weights; they are not SQL execution or a statistical certification.

### B. Wallet retries, concurrency and identity (item 3)

- Previously two concurrent reads could repaint older balances; now only the latest read in the current wallet epoch can paint.
- Refreshes during settlement cannot paint while a mutation is in flight. Completion invalidates outstanding reads/refreshes, including refreshes begun during a pending mutation.
- Negative integer balances are rejected as malformed responses and do not clear financial recovery.
- Original request persistence, signed identity, same-account recovery, request-ID reuse, exact-once server receipts and atomic SQL settlement were retained. A 429 is deliberately non-definitive: recovery keeps the original request, with no replacement wager/refund.
- New deterministic tests cover overlapping reads, settlement/refresh races, rapid duplicate submits, 429 recovery, conservation in a wallet double, and invalid negative receipts. Existing lost-response/reload/account-change tests still pass.
- Browser locks/localStorage are not a distributed financial lock. Two independent devices can submit distinct intentional requests; database locks, uniqueness and operation signatures remain the authority. No cross-device financial guarantee is newly claimed from mocked tests.

### C. Private poker monotonicity and table recovery (items 4–5)

- Older same-room versions cannot update lobby, game listeners or media. Equal versions remain usable for fresh chat/signalling. Newer versions from a second device are accepted.
- Generation guards reject polls begun before create/join/leave or room transitions, including an initial empty response arriving after recovered-room state.
- Retired-room receipts cannot resurrect a room after leave or a room switch. Explicit confirmed rejoin may reopen a still-valid room.
- `stale_game` refreshes state. Missing private/shared invites clear stale navigation context and leave settings usable; no refund, expiry or escrow policy is invented.
- Full/closed invitation previews are explained before confirmation or financial submission in private and shared rooms. Server capacity checks still decide actual admission after confirmation.
- Wrong-game shared invitations offer a correct explicit link, including private-poker codes; they do not silently change games. Previous-room recovery uses the appropriate poker/shared endpoint and no longer constructs `game=null` links.
- Existing waiting-room refunds, host cancellation, playing-room forfeit/fold and settlement remain server policies, unchanged.

### D. Server abuse defenses (item 6)

All authenticated POST dispatches now pass a bounded per-isolate, per-verified-subject limiter after Telegram authentication and before game/wallet/room/reward handlers:

| Bucket | Limit per 60-second window | Includes |
| --- | ---: | --- |
| Reads | 240 | Wallet/game state, room state/preview, invitation lookup, histories/catalog, other authenticated reads |
| Writes | 120 | Game actions, wallet mutations/rewards, room actions/chat, task start/claim, purchase and offer claim |
| Signalling | 1,200 | Private/shared room signalling, separated to avoid starving wallet recovery |

429 includes `retryAfterSeconds` and `Retry-After`; no mutation/receipt is created by the limiter. Caller JSON identities and changing room codes do not create fresh quotas. At most 10,000 live counters are retained; expired entries are reclaimed and excess new keys fail closed rather than evicting active limits.

- Strict UUID version/variant syntax now matches wallet/game contracts for private/shared financial room requests. Shared receipt-lookup failures fail closed rather than proceeding after a failed query.
- Tests exercise actual signed wallet dispatch rejection before RPC, bucket boundaries/reset, forged JSON IDs, signal/poll compatibility, counter bounds and malformed room IDs.
- **Limitation:** this is not distributed across Edge isolates/restarts. It does not replace transactional cooldowns, row locks, request uniqueness, membership checks or perimeter protection. Public GET listing, pre-auth floods and the separately authenticated Telegram payment webhook need infrastructure-level protection. No live thresholds/load tests were performed.

### E. Invitations and home routing (item 7)

- One allowlisted launch router handles `tgWebAppStartParam`, `startapp` and `start` consistently, plus Telegram launch data. Only known game, poker and offer patterns route.
- Explicit `home` opts out. A consumed implicit Telegram launch does not repeatedly redirect after normal home navigation in the same tab. Duplicate script execution cannot redirect twice. An explicit invitation URL remains an intentional retry.
- URL data selects a screen only; it grants no membership, balance or reward. Preview and explicit confirmed join are preserved. Malformed/unknown paths cannot become navigation targets.
- Session storage can be unavailable; in that case same-document deduplication and `home` work, but cross-document consumed-launch suppression cannot be persisted.

### F. Poker bots, turn/result presentation and legacy review (items 8–9)

- Bot turns previously displayed “your turn” outside friends mode. The banner now names the actual active bot; viewer actions remain disabled off-turn.
- Existing public bot frames remain serialized at their existing delay. Newer accepted state invalidates delayed older frames, and duplicate receipts cannot replay an animation.
- Poker move/shuffle sounds follow acceptance instead of taps/rejected requests. Terminal poker feedback distinguishes net win/loss/draw and deduplicates by session/version, including polling/recovery.
- Reviewed existing Ludo, Hokm, Backgammon, Blackjack and other shared/practice presentation and their tests. Their passing Phase 1 active-seat, dice, safe-area, sound and Phase 2A result corrections were not redone. Rules, server public-card filtering, bot decisions and card visibility were not changed; no future/hidden cards were added to payloads.
- This is targeted repair, not a redesign or an exhaustive visual certification of every screen/device/state.

### G. Slot presentation lifecycle (item 10)

- Track/cancel reel and delayed-tone timers with a generation guard; even callbacks already queued before exit become inert.
- Bet/multiplier controls visibly lock during a spin; chip controls expose disabled state. Existing synchronous wager lock remains.
- Page exit cancels presentation, stops Auto, silently retains an accepted result and prevents a late network response from starting off-page reel animation. Submitted/uncertain wagers are never revoked, discarded or compensated.
- Reduced motion presents the accepted result immediately without reel timers; scoped CSS suppresses named decorative transitions/animations.
- Auto Stop semantics and original request recovery remain intact. Stop alone does not cancel an already submitted wager or suppress its on-page result.

### H. Camera/voice and optional TURN (item 11)

- Preserved existing rotation compensation, track/avatar rendering, opt-in permission capture, generation-based late-capture cleanup and stop-on-pagehide behavior.
- Failed/disconnected peers now support bounded ICE restart (maximum two attempts before manual reconnect), with one deterministic offer owner to avoid simultaneous restart offers. Disconnection has an eight-second grace period; failed peers use a one-second delay. Restart timers/handlers are removed on stop/peer removal; stale callbacks cannot revive a closed peer. Successful connection resets retry count.
- Optional server-only `SIMAB_TURN_URLS` (comma-separated `turn:`/`turns:` host:port URLs, at most four) and `SIMAB_TURN_SECRET` (32–2048 characters) produce coturn REST HMAC-SHA1 credentials expiring after **600 seconds**. Username has a random nonce, not a user ID. Shared secret is never returned or embedded in client assets. HMAC-SHA1 here is the coturn REST credential protocol, not wallet authentication.
- No configuration/incomplete/invalid configuration retains existing STUN-only operation. Both room APIs supply the same optional configuration. Existing polling supplies fresh configuration for new/restarting peers.
- No provider is required, installed or paid. No TURN config/secret was set. To activate later, an operator must own/approve a compatible relay, configure its shared secret securely, set matching server-only environment variables and test restrictive networks. Relay expiry enforcement and capacity are operator responsibilities.
- Tests cover synthetic credential verification/expiry, absent/invalid config, restart ownership/cleanup, permission denial and late microphone capture cleanup. No real TURN relay, physical camera mirroring/rotation, permission prompts on mobile, NAT traversal or real-device media success was tested or claimed. Existing camera permission/track logic was retained rather than changed without device evidence.

### I. Tests, CI and portability (item 12)

- Default Node suite includes new regressions automatically. Isolated browser tests use actual markup/scripts/styles, mocked wallet/media, controlled timers and blocked external traffic; no database or real Telegram credentials are used.
- Main integration workflow now selects CSS, root home, friends/offers/streak/quests changes in addition to existing JS, tests and all `supabase/**` (including migrations). It runs the new browser runner and has an explicit forward-migration/disposable SQL check step. Remote CI was **not triggered**.
- Phase 1 browser runner now accepts the same optional `SIMAB_TEST_BROWSER` override as Phase 2A/2BC. Project paths use existing `fileURLToPath`-based helpers. No dependencies were added or installed.
- Standalone `tests/integration-phase2bc.sql` is prepared for disposable PostgreSQL: verifies repaired installed function, sample ranges and non-public helper grants. It is **not run**, not a deterministic proof of SQL rejection boundaries, and not a replacement for existing wallet integration suites.

## 3. Validation and counts

Environment: Windows, Node `v24.22.1`, pinned Playwright with installed Google Chrome.

| Check | Passed | Failed / skipped |
| --- | ---: | ---: |
| Baseline `node --test tests/*.test.mjs` | 876 | 0 / 0 |
| Final default Node suite | 907 | 0 / 0 |
| Phase 1 isolated browser runner | 10 checks | 0 / 0 |
| Phase 2A isolated browser runner | 9 checks | 0 / 0 |
| Phase 2BC isolated browser runner | 5 checks | 0 / 0 |
| Application JavaScript syntax | 25 files | 0 |
| Changed server module syntax after TypeScript/import stripping | 4 files | 0 |

`git diff --check` passed. Git's LF-to-CRLF checkout warnings are informational, not whitespace errors.

**31 additional Node regressions; 24 browser checks across three runners.** Tests were run after RNG, wallet/poker, abuse/navigation, slot and media/poker-display groups, not solely at the end. The exhaustive 182,250 current-slot payout cases remain included, not counted as 182,250 named tests.

Intermediate test-only failures were corrected and rerun: the poker DOM double initially lacked the actual call-dock fixture; malformed-UUID tests initially omitted the code needed to bypass an unrelated active-room lookup. The Phase 1 runner first failed because bundled Chromium was absent; adding its optional executable override allowed the unchanged ten browser assertions to pass in installed Chrome. No assertions were removed or skipped.

Coverage limits: no DB/PGlite integrations, `test:server`, SQL execution, legacy browser runners that start PGlite, production APIs/accounts, remote CI, real mobile Telegram or live TURN. No numeric code-coverage percentage is claimed. New RNG tests validate source/mathematics, not executed PL/pgSQL. Mocked financial tests do not prove PostgreSQL concurrency/conservation.

Reproduce browser runs with `SIMAB_TEST_BROWSER=C:\Program Files\Google\Chrome\Application\chrome.exe` in the environment and `node tests/ui-phase1-v22.mjs`, `node tests/ui-phase2a-v22.mjs`, `node tests/ui-phase2bc-v22.mjs`. Each binds a local-only static server and blocks external requests.

## 4. Changed, created and deleted files

Modified (17):

- `.github/workflows/simab-secure-wallet-integration.yml`
- `assets/js/simab-party-v16.js`
- `assets/js/simab-poker-v10.js`
- `assets/js/simab-private-poker-v14.js`
- `assets/js/simab-room-media-v16.js`
- `assets/js/simab-wallet-client.js`
- `games/slot/index.html`
- `games/tap/index.html`
- `index.html`
- `supabase/functions/simab-central-quests/index.ts`
- `supabase/functions/simab-central-quests/party-api.ts`
- `supabase/functions/simab-central-quests/poker-room-api.ts`
- `tests/admin-credit-edge.test.mjs`
- `tests/phase2a-v22.test.mjs`
- `tests/support/ui-harness.mjs`
- `tests/ui-phase1-v22.mjs`
- `tests/wallet-client.test.mjs`

Created (15):

- `assets/js/simab-launch-routing-v22.js`
- `supabase/functions/simab-central-quests/ice-config.ts`
- `supabase/migrations/20261028090000_wallet_unbiased_random.sql`
- `tests/integration-phase2bc.sql`
- `tests/phase2bc-rng.test.mjs`
- `tests/phase2bc-poker.test.mjs`
- `tests/phase2bc-poker-display.test.mjs`
- `tests/phase2bc-security.test.mjs`
- `tests/phase2bc-navigation.test.mjs`
- `tests/phase2bc-media.test.mjs`
- `tests/ui-phase2bc-v22.html`
- `tests/ui-phase2bc-v22.mjs`
- `docs/SIMAB_V22_PHASE2BC_FIXES.md`
- `docs/SIMAB_CLASSIC_ROULETTE_SPEC.md`
- `docs/SIMAB_REFERRAL_REWARDS_SPEC.md`

Deleted: **none**. Historical migrations: **none modified**.

## 5. Security findings, financial risks and approval gates

| Priority | Finding / next action |
| --- | --- |
| High — release gate | New RNG migration has not executed in any DB. Approve an explicitly disposable PostgreSQL environment and run all migrations plus existing/new SQL and signed HTTP concurrency/replay/conservation tests before release. Preserve installed-function drift checks; do not bypass them on production. |
| High — existing lifecycle | No autonomous waiting-room expiry/refund scheduler or guaranteed background deadline advancement was found. Poker/shared deadlines advance on requests. An abandoned table can retain escrow until existing explicit leave/cancel/settlement paths run. Approve a separate lifecycle policy and recovery-job design before adding expiry or financial release. |
| High — infrastructure | Per-isolate quotas can be bypassed with multiple instances/restarts; signed launches can be replayed within their validity period. Financial IDs/signatures/versions prevent replay from becoming a new settlement, not infrastructure cost. Distributed atomic quotas and perimeter protection need an approved design/configuration. |
| Medium — database contention | Current commits combine room/session and wallet locks, replay records and conservation checks. Multi-wallet lock ordering/deadlock/retry behavior, parallel room creation/join and two-device settlement need real PostgreSQL fault/concurrency tests. No SQL financial-lock refactor was attempted without that validation. |
| Medium — client receipts | Room version protects state, not every independently fetched chat timestamp. Equal-version chat snapshots can still arrive out of order; signalling IDs retain their own cursor. Full causal chat/message merging is follow-up work. |
| Medium — media | Optional relay remains inactive; restrictive networks may still fail. Physical-device rotation/mirroring, camera denial/toggle, ICE glare/expiry/reconnect and audio perception need device/network tests. |
| Medium — invitation UX | Wrong-type direct private invitations with no active membership may still surface server guidance rather than a rich cross-game preview. No automatic redirect or paid join is performed. Error-driven shared recovery links and full/missing invites are covered; exhaustive cross-game/mobile navigation remains follow-up. |
| Low — publication | Asset cache versions were not coordinated for release. New routing asset has a new path; existing asset URLs remain unchanged. A later approved release must handle cache invalidation and staged compatibility. |

Proposed lifecycle work, **not implemented/approved**: record server-owned liveness independently of financial state; define waiting-room ownership, abandonment criteria, maximum retention and explicit player notices; decide exactly who receives any remaining escrow and when; design idempotent audited jobs and reconciliation. **No expiry duration, new refund, automatic forfeit or payout amount is proposed as an active policy here.**

Roulette and referral rewards are separate specification documents only. Their economic/eligibility decisions remain explicitly unapproved. No missing secret or credential was invented; test identities/keys are synthetic.

## 6. Rollback and operational confirmation

- All work is an uncommitted local working-tree patch atop `e5e6f82`, grouped by subsystem with independent tests. No production or local database needs rollback because none was modified.
- Full tracked/untracked patch artifact: `C:\Users\ALI\AppData\Local\Temp\opencode\SIMAB_V22_PHASE2BC.patch`. It can be reviewed/applied to the baseline or reverse-checked against this tree. Review later user changes before applying/reversing anything; do not reset/discard unrelated work.
- A future applied DB migration must not be rolled back by editing historical files or erasing ledger rows. Any operational reversal requires a reviewed new forward migration and retained receipts/balances.
- **Nothing committed, pushed, merged, deployed, or executed against production.** No branch switch, main change, paid service, secret/config activation or remote workflow execution occurred.
