# SIMAB game display and dice review

Based on main commit 33abeed and the eight supplied screenshots. Available prior-conversation excerpts and the v21 repository review were checked; the complete prior chat transcript was not available.

## Corrected

- Replace ambiguous 3D dice rotations with a face showing the actual result and an explicit numeric label. No fabricated result is shown before a roll. All six values use matching pip counts. Backgammon dice include numeric labels.
- Keep Ludo's last roll and roller after a blocked move, a completed move, a turn change or a third six. Active `die` still controls move legality; history does not grant another move.
- Number Ludo pawns, preserve full color for disabled pieces, place pawns above home decoration and pack pieces sharing a cell. Highlight the active player and state each player's color. Narrow-screen arena padding is smaller so boards have more room.
- Enlarge table video avatars (60px in common rooms; 58px in poker), make room for the larger Hokm seats and counter-rotate the video independently of a CSS-rotated table. Add a direction switch for either landscape fallback. Refresh avatars when incoming tracks unmute.
- Ignore repeated taps during a roll animation and cancel pending rolls when leaving/resetting a table.
- Invalidate changed asset URLs, regenerate offline practice rules from the authoritative source and add the new browser regression to CI.

## Rules and randomness

The existing RNG uses Web Crypto with rejection sampling. It was retained: suppressing repeated threes would bias independent throws. Deterministic tests cover rejection of the biased tail, all six results and allowed repeats. This is not a claim of physical randomness or a statistical proof.

Hokm's trump selection from five cards, compulsory following suit, two-player discard/draw phases, scoring, hidden views and complete matches are covered by existing tests. The variants were compared with https://www.pagat.com/whist/hokm.html. Backgammon maximum-dice use, higher-die restriction, bar entry and bearing off are tested against the rules at https://www.bkgm.com/rules.html. Ludo and several social games use the variants explicitly described in the application's rules; no unrequested rule changes were made.

## Validation

- 121 Node tests pass, including the three new dice/history regressions.
- `npm run test:server` passes against isolated PGlite databases and signed test Telegram requests.
- v21 screenshot regressions pass.
- v22 mobile UI: nine practices, all six pip/number combinations, pawn hit-testing, active seat, rapid taps and portrait/landscape direction pass.
- v13 portrait/landscape UI and v19 room setup/variants pass.
- Party UI: ten friends games render without horizontal overflow; four camera streams and real audio packets work in a simulated four-seat Hokm room; drafts survive polling.
- Private poker: both camera streams render in table avatars, real audio packets flow and two-wallet settlement passes.

Browser tests use fake camera devices and local peers. Physical Android/iPhone camera orientation and internet connectivity still require device testing. Existing STUN-only WebRTC can fail on restrictive networks without TURN. A successful local test does not establish that all production devices or all game states are bug-free.

Changes are prepared for review; this report does not claim production deployment. Server-side Ludo history requires deployment of the existing function after merge; the frontend tolerates older states without it.
