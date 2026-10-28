# Classic Roulette — specification only, approval required

No Roulette implementation, wager, migration or reward was added in Phase 2BC.
The existing daily reward wheel is a different, free, weighted UTC reward.

## Decisions before implementation

- Approve wheel variant (single-zero, double-zero or another explicitly named variant).
- Approve supported bet types, exact gross/net payouts, zero handling, minimum/maximum stake, maximum liability and virtual-currency funding model. Do not infer these from the daily wheel or slots.
- Approve betting cutoff, settlement timing, disconnect behavior and whether a multiplayer round exists. No late-wager refunds or expiry policy is implicit.

## Required design

- Signed Telegram subject only; no client-selected outcome, seed or balance.
- Server CSPRNG rejection sampling over the approved pocket set. Display every pocket and actual per-pocket probability. Do not suppress repeated numbers.
- Atomic debit, result, credit, immutable request receipt and ledger; replay returns the same outcome, conflicting reuse rejects. No wagering while unresolved recovery is pending.
- Store the approved rules/paytable version with each wager. Client animation represents an already accepted result, never controls settlement.
- Explain gross payout, net result and virtual-only/no-withdrawal status before confirmation. Support reduced motion, accessible results and cancellation of presentation timers.
- Server-side identity quotas plus distributed/perimeter controls; never treat animation duration as a security limit.

## Acceptance gates

Exhaustive bet/pocket payout matrix; rejection-boundary tests; unauthorized/forged IDs; concurrent wagers; same-ID replay/conflict; lost response/reload; conservation and liability limits in an approved disposable database; responsive browser and physical-device review. Require financial-policy approval and a separate release review before implementation/deployment.
