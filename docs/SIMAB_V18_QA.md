# SIMAB room flow and live seat media — 2026-10-27

This patch addresses the reported Sevens exit lock, invitation host controls, Truth switching to a previous Hokm room, stacked entry/game screens, and cameras outside player avatars.

## Changes

- Setup and table views are mutually exclusive. Bot mode first selects settings, then explicitly enters the game. Legacy Hokm, Blackjack and Ludo tables also hide entry settings while playing.
- Joining/loading a different game never redirects automatically. The previous room is offered as an explicit link. Invitation landing previews an unjoined room without debiting the wallet.
- Host start and leave buttons refresh after pending wallet requests. Finished/cancelled rooms can return to settings without another financial operation. Sevens practice exits clear timers and local state.
- Explicit Home navigation ignores the original Telegram start parameter so an old invitation cannot reopen the table.
- Shared WebRTC media code supports both friends games and private poker. Cameras occupy circular, subject-matched seat avatars; remote camera-off restores the avatar. Audio plays through one remote media element per peer, while avatar copies remain muted.
- Room changes/exit release capture tracks and peers, clear ICE queues, and discard queued signals from an old capture generation.

## Verification

- `npm test`: 93 passed.
- `npm run test:server`: signed HTTP, transactional wallet, all table-game integration suites, private poker, shop and party tests passed.
- `node --test tests/security-v17-integration.mjs`: owner-only management and private tables/RPC access passed.
- `node tests/ui-v13.mjs`: legacy table setup separation, restored games, profile emoji, and poker portrait/landscape controls passed.
- `node tests/ui-refresh-v17.mjs`: ten free bot modes, no wallet mutations, mission/reward layouts at 320/390/768 widths, owner UI isolation passed.
- `node tests/ui-party-v16.mjs`: invitation landing, host start, four participants exchanging audio and in-seat video, remote camera-off, Truth with an existing Hokm table, Sevens practice/finished exits, explicit Home with retained Telegram invite, all ten friends game layouts and preserved text drafts passed.
- `node tests/ui-private-poker.mjs`: real audio packets, video within both matching seat avatars, microphone/camera toggles and two-wallet settlement passed.

Browser tests use separate signed test users, an isolated PGlite database, and synthetic camera/microphone devices. The local browser uses loopback WebRTC for deterministic peer tests. These checks do not establish compatibility with every real device or mobile network. Current production signaling supplies STUN only; restrictive networks can still require a TURN relay.

## Release status

Changes are committed locally. The automatic approval review rejected pushing to the public GitHub repository because the current request was not considered permission to publish publicly. No push, PR, merge, or production deployment was performed.
