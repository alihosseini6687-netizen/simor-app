# SIMAB v21: screenshot regression fixes

Reported against v20: failed table creation, unclear two-player Hokm discards, missing visible friends entry for Blackjack, wrong source of the card-2 penalty, interrupted bottle animation and unnumbered seats, and card audio/button presentation.

## Findings and behavior

- Read-only production lookup confirmed owner 702007470 remains in waiting Hokm table YKW86Q2XMN (version 2, two members). The single-open-table financial rule still applies. The previous-room panel now scrolls into view after a create conflict and offers “close previous table and create selected game.” Cancellation/forfeit stays behind the existing in-app confirmation and server settlement. No real table or wallet was modified by this review.
- Common recovery buttons are resynchronized after requests, including buttons built during a request. Poker recovery now scrolls into view. The previous common recovery panel could be far above the visible error.
- Two-player Hokm discards are not tricks. Their hidden pile and count are now visible, with a precise phase prompt; no private discarded faces are exposed. Old four-player states without a discard field remain readable.
- The friends entry for competitive 21 is inside the main Blackjack screen. Its pooled-pot rules remain distinct from classic dealer Blackjack.
- New Sevens tables and practice explicitly use `twoGift`: after a legal 2, select a different card from your own hand and another player; transfer that exact card, without drawing from stock. Selecting the played 2 as its own gift is rejected. A final 2 needs no gift. If the gift empties your hand you finish. Existing rooms without the new option retain their original agreed draw-from-stock rule.
- Bottle renders keep the same rotating element through follow-up renders (including bot questions). Round identity triggers rotation even for repeated target zero. Seats display numbers and names. Dice-only dare checkboxes hide in bottle mode.
- Card audio uses an enveloped, filtered paper sweep instead of the former short noise ticks. It remains locally synthesized audio, not a recording. Buttons/cards have clearer focus/pressed/available states; unnecessary wallet and duplicate roster elements are removed from the playing view. Practice shows no time limit, matching its actual behavior.

## Verification

- Full Node suite, including transfer/no-stock-draw, invalid gift atomicity, last-card cases, private views, old-room compatibility, and complete rule-based bot matches.
- Signed Telegram handler / SQL integration suite with isolated accounts; production credentials and balances are not used by browser tests.
- `ui-screenshot-regressions-v21.mjs`: create conflict and explicit recovery; new invitation plus guest join for all nine main games; visible Blackjack friends link; repeated-zero bottle spins retaining their DOM element through bot question updates; numbered seats; Hokm hidden discard count; required Sevens gift selection and transfer in practice.
- Previous video regression, room setup, and existing UI tests remain in CI. Mobile screenshots are captured as CI artifacts.

These checks cover the reported paths; they do not prove every possible multi-device/network/game state. Media still uses STUN without TURN, and bots remain visibly labelled rule-based opponents.
