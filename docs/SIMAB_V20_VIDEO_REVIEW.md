# SIMAB v20 video regression review — 2026-10-27

Input: the user's 237.7-second screen recording. Reviewed the whole timeline using timestamped frames at three-second intervals and full-size frames of the reported failures.

## Findings and changes

- **00:06–00:15, 00:60–00:72: invitation creation.** The account has a previous waiting Hokm table, so the transactional single-open-table rule correctly rejects another table. Previously the UI offered only a continuation link. Game and poker entry screens now offer an explicit, confirmed leave/cancel action for the prior table. It reads current server state and invokes the existing leave operation; waiting-table refunds stay server-authoritative. No production table was cancelled automatically.
- **00:36–00:39: backgammon board.** The previous renderer used a flat twelve-column board without the central bar or triangular points. The new board has twenty-four triangle points, a central bar containing hit checkers, visible opening/turn dice, and a selectable bar for re-entry.
- **00:33–00:39, 01:18–01:24, 01:51 onwards: bot play.** Entry now prepares a waiting table with the selected seats. It does not initialize a deck or dice until the user presses Start match. Bots perform one move at a time after a variable thinking delay, are always labelled BOT, and can be paused. A human's practice turn is not played automatically on timeout.
- **02:00–02:45: Truth/Dare practice.** The single-phone bottle setup is now exclusive of online play, with an explicit return control and a disabled spin until at least two names are prepared. Bot prompts remain visibly simulated. Bots skip answers rather than fabricating personal experiences; no forced financial penalty was added.
- **03:21–03:54: daily rewards/tasks/miner.** Mission hero and card spacing are compact; daily rewards fit one row, and the miner machine takes less space. Verified at 320, 390 and 768 pixels.
- **Invitation promotion rules.** The old referral page used local counters and promised fifty welcome coins although signup attribution/reward settlement is not implemented. It now provides a working generic game link and explicitly states that signup referral rewards are inactive. Table invitation codes are a different feature. No referral rewards or counts are fabricated.
- **Miner rules.** Existing server rates/costs are unchanged. Production is capped at one day's rate between collections and remaining tank capacity. Buying/upgrading/recharging resets the production cycle. The UI explains these rules and asks users to collect ready coins before an upgrade/refill to avoid discarding them. Wallet-side legacy free-miner actions were not removed or repriced by this change.

## Verification

- 113 unit tests passed, including twelve bot decision tests across Hokm variants, backgammon, Ludo, Sevens, Morris, Snakes, Blackjack and Bingo. Decisions are based on the acting bot's public view, including its own hand, without consulting hidden opposing hands/decks.
- The video regression browser suite passed: cancellation refunds both test users; new game/poker invitations are created; bot tables wait before Start; a bot does not move instantly or while paused; no automatic human move; twenty-four points/central bar/thirty checkers/two dice; compact rewards; ready miner coins protected; referral share link valid.
- Existing setup/Hokm variant, free bot/reward-layout, and private-poker voice/video suites passed.
- Tests use isolated signed test users and a local PostgreSQL emulator. They do not spend production coins or remove the user's old room.

These are rule-based bots with deliberate pacing, not human players or a claim of human-level skill. Signup referral reward registration/settlement remains unimplemented and is clearly labelled inactive.
