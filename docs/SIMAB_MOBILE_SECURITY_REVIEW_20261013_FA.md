# SIMAB — mobile layout and security review, 2026-10-13

## Observed root cause (proven from source)
In nine pages, the secure-wallet link was inserted immediately after `<body>`. These pages often use `body { display:flex; }` for layout. The link became a second horizontal flex item beside the main application. On mobile, it squeezed the content to the left and produced the long narrow purple column shown in the screenshots.

## Remediation included in this single PR
- Move the existing wallet link **inside `.app-wrapper` directly after its header** for wrapper-based pages.
- Move the link **below `.top-bar`** for games that do not use `.app-wrapper`.
- Remove nine copies of the duplicated wallet inline styles; use one compact shared `assets/css/simab-secure-entry-v7.css` file.
- Make secure-wallet cards fluid-width, RTL, wrap-safe, accessible with `:focus-visible`, and with reduced-motion support.
- Improve wallet UI at 320–360px, responsive balance amounts, gold-neon panel hierarchy, 16px numeric inputs to prevent iOS auto-zoom.
- Mark old Swap and Streak balances as **local DEMO balances**. This does not change any stored number.
- Add automated regression assertions so no future wallet link can again be a direct child of a flex body.

## Live Supabase security audit completed
- Project `simab-game` is ACTIVE_HEALTHY; database is PostgreSQL 17.
- Secure wallet and transaction ledger tables exist, and deployed central quests Edge Function is version 4.
- SQL permission audit: `simab_secure_wallet_action`, `simab_credit_verified_quest` and `simab_claim_verified_telegram` are callable only by `service_role`, not by `anon` or `authenticated`.
- RLS is enabled on the protected tables.
- Supabase security advisor shows `rls_enabled_no_policy` as INFO (10 tables). Those particular server-only tables intentionally deny direct client access; **do not add a permissive policy simply to silence the warning**. See https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Performance advisor reports unindexed foreign keys (2) and unused indexes (3) at INFO level; review indexing when usage grows. https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

### Security properties already present (not added by this UI-only patch)
- Telegram initData HMAC/Ed25519 is verified server-side with time limits; auth via `initDataUnsafe` is not trusted.
- Server wallet updates are atomic PostgreSQL functions; request IDs are idempotent; no browser balance import.
- Roulette/slot server result is computed by PostgreSQL; legacy pages are **not** connected to the secure wallet.
- Edge Function has restrictive CORS for the GitHub Pages origin and max 10K input body check.

### Remaining security and engineering tasks — NOT falsely marked as complete
1. **High priority:** implement proper server-driven rules, bets, settlement, and replay protection for Poker and Backgammon before their balances can be trusted.
2. **High priority:** add layered rate limiting at the Edge gateway and Telegram login abuse telemetry. Current SQL slot cooldown protects that action, not the entire API.
3. **High priority:** security-test all HTML/JS dynamic DOM updates for stored/reflected XSS; signed Telegram data cached in browser session storage can be stolen by successful XSS. Consider removing that cache after authenticated sessions are redesigned.
4. **High priority:** consistent account and UX presentation: older local balance may differ dramatically across browser/Telegram/WebView or devices. Never equate it with server credits, and decide migration only with proof of ownership.
5. **Medium:** centralized game settings and admin moderation/audit log, anti-bot account limits, authenticated multiplayer matchmaking.
6. **Medium:** accessibility/visual test on real 320px iPhone, Android Telegram, desktop and browser back navigation.
7. **Medium:** security incident readiness: token rotation, limited-scope GitHub Actions token, anomaly alerts, DB backup/restore drill.
8. **Later:** full design system with locally hosted suitable Persian fonts, improved game art, PWA/iPhone/Android distribution.

**No security review can prove an app is unhackable.** No malicious activity is established by these screenshots. This code and database-permission audit is not a penetration test.

## Verification
`node --test tests/*.test.mjs`, GitHub Actions PR status, then real Telegram screenshots after Pages deployment. The screenshot defect is visual: inspect phone after reopening Telegram and clearing stale WebView cache if needed.
