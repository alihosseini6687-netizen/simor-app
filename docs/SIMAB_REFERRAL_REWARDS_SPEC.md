# Referral rewards — specification only, approval required

No referral attribution service, reward issuance or financial migration was added.
Existing browser referral counters are untrusted UI data, not verified attribution or reward eligibility.

## Policy decisions required

- Define an eligible new user and qualifying event (opening a link alone must not pay).
- Approve attribution window, competing-invite precedence, existing-user treatment and attribution immutability.
- Approve reward asset, exact amount, recipient(s), funding/budget ceiling, reward timing and abuse-review policy. No proposed amount is authorized here.
- Approve privacy/retention rules and how mistaken/fraudulent attribution is reviewed. Do not introduce automatic clawbacks or balance changes without approval.

## Required design

- Validate signed Telegram identity. Resolve an opaque invite token to its server owner; never use a URL user ID or localStorage counter as proof.
- Record at most one approved attribution per referred subject; reject self-referral, invalid/revoked tokens and ineligible accounts. Transactional uniqueness must handle two devices and simultaneous invites.
- Qualifying event and reward receipt have stable server IDs. Atomic budget reservation, ledger issuance and idempotent recovery; no client-side minting or retroactive import of local counters.
- Bound token lookup and claim requests per verified subject, add distributed abuse protection and monitor referral rings. Shared IP/device signals are risk indicators, not proof of fraud by themselves.
- UI distinguishes pending attribution, verified qualification, issued reward and rejection; never promises an amount before policy approval.

## Acceptance gates

Signed/forged identity, self-referral, token tampering/revocation, duplicate qualification, competing invites, concurrent claims, depleted budget, lost response, two-device recovery and ledger conservation. Test only with synthetic users and an explicitly approved disposable database. A separate policy/security review is required before any activation.
