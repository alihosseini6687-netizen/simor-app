# Seven Cards: v14 → versioned bridge → v22 frontend

## Verified production facts and scope

The owner independently inspected production project `simab-game`: `simab-central-quests` is ACTIVE at **version 14**; Seven Cards consumes scalar `gift`. RPC signatures and migration history were inspected read-only by the owner. This session did not download or independently authenticate the complete live source/schema. No deployment, JWT/configuration change, migration, production query/mutation, or wallet change was performed.

The transition is implemented on the existing PR #30 branch. No app replacement or staging override is involved.

## Protocol matrix

| Room / caller | Result |
| --- | --- |
| Existing unversioned playing room | Treat as v1 without rewriting stored state; preserve `twoTarget` / `twoGift` exactly. |
| Existing unversioned waiting room | Start as v1 with its original options, including legacy draw-one/no-target variants. |
| Old client creates/joins/plays v1 | Original `gift` request, one-card effect and old idempotency signatures remain supported. |
| New client joins/plays v1 | Shows legacy rule, renders one-card controls and sends scalar `gift`. |
| New client creates v2 | First discovers backend capabilities, then explicitly sends `options.sevensRulesVersion:2` and `sevensProtocol:2`. |
| New client joins/starts/moves v2 | Must advertise protocol 2; room stays v2; only a valid exact-size `gifts` array is accepted. |
| Old client tries v2 create/join/start/move | `sevens_upgrade_required`, before any room escrow commit/debit. Preview and leave remain available. No automatic card choice or downgrade. |
| Old client leaves a room | Existing authoritative refund/forfeit/settlement rules remain available regardless of protocol. |

For v2, transfer exactly `min(2, cardsRemainingAfterThe2)` distinct owned cards. No stock replacements. For v1 hand-transfer rooms transfer exactly one if available. A room's persisted version, not a move-supplied version, selects validation. Reject ambiguous scalar+array payloads. Unknown versions fail closed. Turn checks, legal card/suit/target checks, hidden views, optimistic room versions, receipt recovery, pot conservation and single settlement are retained.

The low-level new-game/practice factory defaults to v2. The online API explicitly pins old creation requests and existing unversioned waiting rooms to v1. Capability discovery is authenticated by the existing Edge entrypoint and does not call the database/wallet. Capability claims are not identity/authentication; all authoritative move checks still apply.

## Backend-first artifact: preserve all other v14 behavior

**Do not deploy the entire PR backend merely to enable this transition.** It also contains previously reviewed non-Seven-Cards changes (including Truth or Dare behavior). The first stage must be a **Seven-Cards-only bridge built on the authenticated production v14 export**.

`scripts/prepare-sevens-backend-bridge-v22.mjs` is an offline packager. It requires a baseline directory laid out as `supabase/functions/simab-central-quests/` plus the unchanged `supabase/config.toml`. It refuses overwrites/unexpected source shapes, copies all existing dependencies, and changes only `party-games.ts` and `party-api.ts` for the bridge. It does not add the PR's rate limiter, TURN integration, other game-rule changes, migrations, secrets, or modified JWT configuration. It emits `BRIDGE_MANIFEST.json` with baseline/candidate hashes and checks relative imports.

Example preparation only (not deployment):

```powershell
node scripts/prepare-sevens-backend-bridge-v22.mjs --baseline="<AUTHENTICATED_V14_EXPORT>" --out="<NEW_EXTERNAL_BRIDGE_DIRECTORY>"
```

A reference candidate was generated and tested at:

`C:\Users\ALI\AppData\Local\Temp\opencode\simab-sevens-bridge-reference-candidate-v22`

Its baseline is the published GitHub main source at `33abeedcb36b69136c86c3f4026560bb4d8f861d`, **not a claim that those are the exact live v14 bytes**. The manifest shows **11 dependency/config files**, only the two intended source changes, **0 unresolved relative imports**, unchanged JWT config, and no SQL migrations. Four offline reference checks cover legacy play, v2 play, capabilities, and an unchanged unrelated Truth branch. Before deployment rebuild from the authenticated v14 export, review its manifest/diff and run the same focused tests on that candidate. Stop if the export/source-shape guards differ; never force-apply to an unknown live function.

## Focused verification

- Final affected Node run: **63 passed, 0 failed** (including **11** new transition tests). New Chrome runner: **19 passed**, 0 page errors. Offline bridge reference: **4 passed**.
- `tests/sevens-transition-v22.test.mjs`: legacy and v2 validation, short hands, invalid/duplicate/foreign cards, atomic rejection, private/public room consistency, capability discovery, and isolated database/API tests for old/new admission, mixed clients, idempotency, authorization, stale versions, wallet conservation and one-time settlement.
- Existing Phase 4/Seven Cards/party/practice/localization tests retained (Phase 4 fixture explicitly identifies its intended v2 contract; no assertion relaxed).
- `tests/ui-sevens-transition-v22.mjs`: real Chrome controls for legacy/v2, draw/no-target variants, short hands, and preflight blocking a two-card room debit against an old backend. Added to browser orchestration and GitHub wallet CI.
- Existing Phase 4 browser runner: **188 checks passed** after the changes. Prior screenshots were preserved rather than replaced by the test render.
- Tests are local/synthetic or isolated PGlite, not live authenticated production payments/multiplayer.

## Coordinated release sequence — requires separate explicit approval

1. Keep PR #30 draft/unmerged until its new CI is green and the owner approves this plan.
2. Archive the **complete authenticated v14 function export**, function metadata/version/JWT setting and matching source hashes. Preserve the current frontend rollback tag at `33abeed...`; keep backend and frontend rollback artifacts separate.
3. Build/review the bridge using that exact export, including unchanged imported modules and configuration. No SQL migration is needed for the version marker: room state/options already use JSONB and the inspected room/wallet RPC signatures are unchanged. The separate RNG migration in the broader PR is unrelated and must not be executed as part of this card transition.
4. After explicit backend deployment approval, deploy **only the bridge candidate**, not the full PR backend, preserving the existing function slug/project and JWT setting. Do not run database migrations or modify balances. Record the new Edge version and artifact hashes.
5. Under an approved smoke plan verify authenticated capabilities, existing v1 rooms, old-client retries and normal refund/settlement paths. Until the frontend ships, old clients continue creating v1 rooms. No v2 admission is implicit.
6. After separate frontend approval, squash-merge PR #30. GitHub Pages automatically publishes main `/`; it does not deploy the backend. New clients can resume v1 rooms; new v2 rooms explicitly opt in. Old clients invited to v2 must update before entry; they are never charged to enter an unrenderable rule.
7. Record the Pages deployment and smoke-check both client generations/room versions, especially mobile cached clients. Keep the bridge installed for the compatibility window. Any future full Phase 4 backend rollout is a separately approved operation, not implied by this bridge approval.

## Separate rollback procedures

### Frontend rollback

Keep the version-aware backend installed. A full `git revert <APPROVED_FRONTEND_SQUASH_SHA>` is safe only after proving both **no active/waiting v2 rooms and no recoverable/in-flight v2 creation/join requests or cached v2 sessions that can recreate them**. Zero active rooms alone is not enough: pending requests are stored locally and can replay later. If quiescence cannot be proved, prepare an approved forward fix/partial rollback retaining the version-aware Seven Cards route and its JS/CSS/localization dependencies. Do not reset/force-push main. Compare any proposed revert to `rollback/simab-pages-pre-v22-20261031` and test before authorizing publication.

If v2 rooms or recoveries may exist, **do not blindly publish the old frontend**: it cannot render two-card moves for those members, including a restored pending create. Keep the version-aware Seven Cards client while forward-fixing the frontend fault. Never force-settle, clear users' pending requests, or edit room/wallet rows as a rollback shortcut. Retain the bridge even after any approved frontend rollback.

### Backend rollback

Prefer restoring the archived, tested **version-aware bridge** artifact if a later broader backend release fails. Do not restore raw v14 while v2 rooms or new-client pending/recovery requests may exist: its single-gift parser is incompatible, and v14 could misinterpret an opted-in create request. Reverting the frontend alone does not remove cached clients or immutable pending requests.

If the bridge itself is faulty, stop the rollout and prepare an approved forward fix preserving v1/v2 parsing; a raw-v14 rollback requires a separate proven quiescence/drain/client-recovery plan. Record and approve any backend version change separately from Pages. No reverse migrations or wallet restoration are part of either rollback.

## Approval disposition

The **versioned transition and backend-then-frontend plan are ready for review**. Production execution is safe to authorize only after green CI on this revision, authenticated-v14 bridge build/manifest verification, archived backend recovery artifacts, and explicit staged approval. The reference-main candidate is not a substitute for the actual v14 export. No production action is authorized or performed by this preparation.
