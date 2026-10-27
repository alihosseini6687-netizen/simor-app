# SIMAB v19: selected settings, scoped rooms and reviewed rules

Prepared 2026-10-27. Local changes extend the unpublished v18 fixes. Public GitHub push and deployment remain unperformed pending explicit publication authorization.

## Entry flow

1. Select the game, bot/friends mode, player count, and any game-specific settings. Read the selected variant's rules.
2. Press Start bot game, or create/join the friends table. Creating a table reserves the displayed entry; it does not deal cards.
3. The host starts when all selected seats are filled. Settings are hidden while the table is displayed. Coin/chip balances remain visible.
4. On a fresh game entry, an old table is shown only as an explicit continuation link. The scoped server read neither returns its cards nor advances its timer. Explicit code/game mismatches are rejected.

## Per-game rules review

| Game | Implemented and verified behavior | Reference / variation |
| --- | --- | --- |
| Hokm 2 | First-ace hakem; trump from five cards; discard three/two, then private keep-first-or-take-second drafting to thirteen each; follow suit; seven tricks; kot scoring; match to seven. | [Pagat](https://www.pagat.com/whist/hokm.html) |
| Hokm 3 | Remove one two; seventeen cards each; trump before completing the deal; individual scoring, unreachable trick lead, and third-player win if the other two tie; match to seven. | Same Pagat reference. |
| Hokm 4 | Opposite fixed partners; initial five cards only to hakem; after trump complete 5–4–4; follow suit; seven tricks, kot/hakem-kot, match to seven. | Same Pagat reference. Partners remain fixed by seat. |
| Backgammon | Two players, fifteen checkers, separate opening dice, doubles, maximum usable dice/larger die where applicable, bar priority, legal bearing off. | [Backgammon Galore](https://www.bkgm.com/rules.html). SIMAB's friends variant explicitly omits doubling and gammon multipliers. |
| Snakes and Ladders | Two to four players, default two; distinct numbered/color-coded pieces; begin off board; one die per turn, no bonus for six, exact finish; only landing on endpoints triggers a snake/ladder. | [Hasbro 1978 edition](https://instructions.hasbro.com/en-us/instruction/chutes-and-ladders-game-retro-series-1978-edition). Dice are used instead of a spinner. |
| Ludo | Two/three/four players, four pieces each, separate board colors (opposite colors for two); exact finish and legal moves. | [Masters Traditional Games](https://www.mastersofgames.com/rules/ludo-rules-instructions-guide.htm). SIMAB uses the explicitly described star-safe variant: entry on six to start, extra turn on six/capture/finish, third consecutive six loses turn. These differ from other Ludo editions. |
| Sevens | Seven cards; suit/rank matching; stacked seven penalty, eight extra turn, ten reverse, ace skip, jack suit change; optional targeted one-card penalty on two. | [Paamizi's declared edition](https://paamizi.ir/games/haft-khabis). SIMAB declares one-round victory, automatic one-card announcement, draw ends turn, and no ending with jack. Local editions differ. |
| Three Men's Morris | Three pieces each, alternating placement, then moves along adjacent drawn links; three in a line wins; no jumping. | [US National Park Service](https://www.nps.gov/morr/learn/kidsyouth/3-men-s-morris.htm). Repetition/100-move draws are declared SIMAB rules. |
| 90-ball Bingo | Three rows, nine columns, fifteen unique numbers per ticket, five per row, ordered column ranges; unique calls, one/two/full-house awards. | [Betfair product guide](https://support.betfair.com/app/answers/detail/241-bingo-what-are-the-different-game-types/). 20/30/50 prize shares and eight-seat capacity are app settings, not universal rules. |
| Truth or Dare | Two to eight participants; selected dice numbers or bottle mode; bottle points exactly at the sampled player; separate asker/answerer steps; skip permitted, no compulsory financial penalty. | [Example game's rules](https://truthordaregame.net/how-to-play). There is no single worldwide rules authority; SIMAB's voluntary variant is displayed before entry. |
| Blackjack | Default catalogue entry now opens the existing dealer game: S17, 3:2 naturals, split and double as declared, no insurance/surrender. | [Bicycle](https://bicyclecards.com/how-to-play/blackjack). Friends pooled competitive 21 remains explicitly labelled as a different variant. |

Poker and slots/roulette rules were outside this review, as requested.

## Validation

- 101 unit tests passed, including full 2/3/4-player Hokm matches, drafting, hand secrecy, follow-suit, three-player tie scoring, player-count bounds and Ludo seat colors.
- Signed HTTP and PostgreSQL integration suite passed, including two new scope/count tests: opening each game while Hokm is active cannot resume/advance the Hokm room; starting waits for the selected number of players.
- `ui-room-setup-v19.mjs` passed: every requested game stays on setup until Start, visible balances in games, Hokm trump/discard stages, Ludo 2/3/4, Snakes default 2/max 4 and unique colors, balance error/retry.
- Existing four-person friends/media regression, ten bot-practice/layout checks, classic table portrait/landscape checks, language selection, and owner-management security checks passed.
- Visual screenshots were inspected for two-player Hokm and four-player Snakes. Browser media uses test devices and isolated local PostgreSQL emulation, not the user's production account.

## Remaining release and verification limits

Both frontend and the `simab-central-quests` Edge Function must be released together; frontend publication alone cannot enable the new server variants. No schema migration is needed. Existing four-player Hokm states are accepted with a default seat count of four.

Production project was confirmed healthy through read-only tools. Last-24-hour function status aggregates showed no 401 or 5xx, but these logs do not identify the cause of the blank balance in a particular screenshot. The UI now keeps balances visible and exposes read/auth failures with a retry action; it never substitutes fabricated balances.

Current media configuration is STUN-only, so restrictive networks may still require TURN. Automated tests do not prove all devices/networks or all possible sequences are fault-free.
