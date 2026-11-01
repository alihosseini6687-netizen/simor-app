# Independent game frontend release — 2026-10-31

The current release branch contains a broad application update whose shared room includes the Seven Cards v1/v2 transition. The owner requested publication of verified independent improvements while holding Seven Cards. This smaller release starts from main `33abeedcb36b69136c86c3f4026560bb4d8f861d` and leaves PR #30 separate.

## Published scope

- Standalone Slot: Auto Stop timer cancellation, submitted-wager recovery preservation, duplicate sound suppression, page-exit/reduced-motion lifecycle and accurate gross/net paytable explanations.
- Standalone Poker: active-bot labels, accepted-action sounds, monotonic animation generations and terminal receipt deduplication.
- Standalone Backgammon: numeric dice, roll history presentation, accepted-event sounds, animation cancellation and disabled out-of-turn/pending controls.
- Legacy standalone Ludo, Hokm and Blackjack: accepted-result feedback; Ludo visible dice, numbered/packed pawns and active-player controls.
- New page-specific sound, bounded-stage and room-flow assets prevent changes to shared-room dependencies. Existing shared sound, layout, wallet, localization and practice engines retain their published bytes.

The shared `/games/room/index.html?game=...` routes, including all online room upgrades, remain at their original version. This release does not claim to publish every non-Seven-Cards change from PR #30. The original home still links to the existing routes; it is preserved.

## Boundaries

No Supabase deployment, SQL migration, function/config/auth change, wallet client change, economy change, new payout or Stars/TON change is included. The server API contract used by the independent pages is unchanged. Seventy-two protected files are checked against normalized baseline hashes, including shared room dependencies, home and every backend/schema file. Existing Seven Cards remains available with its current behavior; its new rules and bridge are held.

## Validation

- 867 Node tests passed locally, zero failures/skips. Includes exhaustive slot paytable cases, Auto Stop/recovery/lifecycle, Backgammon and Poker regressions, existing wallet/auth checks, and the protected-file boundary test.
- 9 Phase2A browser regression checks passed locally with installed Chrome and external traffic blocked.
- 12 independent portrait/landscape page checks cover script errors, local resource existence and horizontal overflow. Ludo also renders a fixture die and sixteen pawns; no production requests or financial mutations are used.
- Original tests received Windows URL/CRLF/import normalization repairs without dropping baseline assertions. The slot signature assertion now matches its intentional automatic-spin parameter.
- Existing GitHub CI plus the two browser runners must pass for this exact candidate before publication.

These checks validate the scoped frontend change; they do not certify real Telegram identities, physical devices, internet media, live wallet concurrency or real payments.

## Rollback

Revert this independent release commit through a reviewed normal commit, then verify the Pages build. Backend and room protocol are unchanged by this release. Do not revert PR #30 or run database operations as part of rollback. The baseline commit and existing rollback tag remain the recovery reference.
