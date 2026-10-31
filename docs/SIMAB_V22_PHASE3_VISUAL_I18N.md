# SIMAB v22 Phase 3 — recovered work, visual UX and localization

## Phase 3B Sevens draw-penalty fix — 2026-10-30 (latest verification)

**The confirmed `کارت بردار (2)` regression is fixed. Focused tests passed first; the complete Node and browser suites were then each run once and passed.** Admin-shop work and previous localization changes were not repeated.

### Exact changes and behavior

- `assets/js/simab-party-v16.js`: the Sevens renderer used to concatenate `کارت بردار` with an optional formatted penalty. Its `#controls` subtree is rebuilt on `render()`; language changes also rebuild the practice/public presentation. A new presentation-only `sevensDrawButton` helper now selects **`sevens.drawPenalty` with `{number: s.penalty}`**, or the existing **`cards.draw`** key when the penalty is zero. It explicitly binds that label so both immediate language changes and later renders use the current count, rather than a cached dynamic source string.
- The helper retains the original **`move({type:'draw'})`** callback and the same disabled flag. Existing `button()` busy/pending guards still apply. No game state is written by this helper. The remainder of the Sevens rendering branch is unchanged apart from calling this helper (verified after CRLF/LF normalization).
- `assets/js/i18n/game-messages.js`: **one new seven-language key**, `sevens.drawPenalty`. English: `Draw cards ({number})`; Persian: `کارت بردار ({number})`; Russian: `Взять карты ({number})`; Arabic: `اسحب أوراقًا ({number})`; Hindi: `कार्ड उठाएँ ({number})`; French: `Piocher des cartes ({number})`; German: `Karten ziehen ({number})`. The existing runtime localizes the numeric digits. Current catalogs: **1,009/1,009 keys per language**, **0 missing keys**, **479/479 legacy mappings**. No runtime/alias rewrite was needed.
- New `tests/i18n-sevens-v22.test.mjs`: seven language cases exercise the actual production presentation helper with counts **0, 1, 2, 4, 6, 12, 20**, enabled/disabled states, exact labels/bindings, the unchanged draw action, state conservation and compatibility translation of dynamic count strings.
- New `tests/support/ui-i18n-sevens-v22.mjs`: deterministic fixtures use fixed hands/deck/discard, **penalties 0, 2, 4, 6, 12, 20**, and the two `(current, direction)` pairs **(0, +1)** and **(1, −1)**. Each of the 84 language/fixture combinations checks (1) immediate language switching inside the same browser task, (2) repeated later renders and (3) a new accepted event with a changed count, including clearing to zero. Subsequent events additionally exercise counts **8 and 14**. Private practice state and public state are compared byte-for-byte as JSON, including hands/deck, current player, direction and penalty. Wallet state is unchanged and no game/wallet mutation is submitted. Fixed test fixtures neither call a random game start nor replace RNG.
- `tests/ui-i18n-phase3b-v22.mjs`: includes the deterministic checks in normal full runs and offers **`--sevens-only`**. A test-server-only getter exposes the private fixture state for conservation assertions; production does not expose it. The pre-existing randomized snapshot-generation/render test is **byte-for-byte unchanged** and still runs in the full suite.

### Exact validation results

| Check | Result |
| --- | --- |
| New focused tests before the fix | **0/7 passed**, confirming the missing key |
| Focused Sevens Node tests after the fix | **7 passed**, 0 failed/skipped |
| Focused `--sevens-only` browser runner | **252 checkpoints passed**, **36 per language**, 0 page errors |
| Complete default Node suite, once after focused success | **964 passed**, 0 failed/skipped/cancelled/todo |
| Complete browser suite, once after focused success | **15/15 runners passed**, none skipped/timed out |
| Full Phase 3B browser runner | **1,251 checkpoints passed** = retained 593 + prior targeted 266 + shop 140 + Sevens 252; **0 page errors** |
| Retained current-DOM audit | **62 page/state groups per language**, **0 unknown strings** across those groups, including the unchanged randomized Sevens fixture |
| Syntax / whitespace | **108 JS/MJS files passed**; `git diff --check` passed (LF/CRLF warnings only) |

These checkpoint counts are not a complete assertion count or application-coverage percentage. A separate source-preservation comparison initially needed CRLF/LF normalization; the corrected comparison passed. No application or regression assertion was removed or weakened, and the complete suites were not repeated.

Evidence: [deterministic Sevens results](SIMAB_V22_PHASE3B_I18N_SEVENS.json), [full runtime results](SIMAB_V22_PHASE3B_I18N_RUNTIME.json). Existing [shop](SIMAB_V22_PHASE3B_I18N_SHOP.json), [targeted](SIMAB_V22_PHASE3B_I18N_TARGETED.json) and [inventory](SIMAB_V22_PHASE3B_I18N_INVENTORY.json) evidence now records the current schema. Full browser logs/exit codes: `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-sevens-full-20261030\results.json`. Node/focused logs: `phase3b-sevens-red-node.log`, `phase3b-sevens-focused-node.log`, `phase3b-sevens-focused-browser.log`, `phase3b-sevens-full-node.log` in the approved OpenCode temporary directory.

**Remaining failures in these suites: none.** Native-speaker review, exhaustive unrelated application states and real-device Telegram behavior remain unverified; this is not a full-localization or release certification. Static inventory remains **1,763 candidates / 854 without a direct source key**, including prompts/fragments/numbers, not 854 confirmed UI defects.

Recovery: before editing, SHA-256-verified **122 changed/untracked files** at `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-sevens-start-20261030-041010`. All earlier work/backups remain preserved. Still on **`work/simab-game-review-v22`**. No gameplay rules, RNG, settlement, economics, wallet, migrations, database, production settings or Artistry were changed. Nothing was committed, pushed, merged or deployed.

Final SHA-256-verified snapshot: **125 changed/untracked files**, `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-sevens-complete-20261030-042606`. Comparison with the pre-edit manifest permits only the two production files, browser runner, report/generated evidence and regenerated verification screenshots described above. All other inherited code, the completed shop implementation and older screenshot/baseline artifacts remain byte-for-byte identical. New files are the Sevens Node test, deterministic browser helper and Sevens JSON.

Focused reproduction:

```powershell
node --test tests/i18n-sevens-v22.test.mjs
$env:SIMAB_TEST_BROWSER='C:\Program Files\Google\Chrome\Application\chrome.exe'
node tests/ui-i18n-phase3b-v22.mjs --sevens-only
```

The focused browser flag updates only Sevens evidence, not the full runtime/shop/previous targeted JSON. Historical snapshots below are retained; their previously outstanding Sevens defect is resolved by this section.

## Phase 3B admin-shop handlers — 2026-10-30 (preceding verification snapshot)

**Requested shop fixes implemented; focused checks pass. The one complete browser run is not green: 14/15 runners passed because a pre-existing Sevens penalty label was reached.** The earlier 986-key/35-key work is retained, not repeated.

### Changed files and behavior

Production changes are limited to two files:

1. `assets/js/simab-shop-admin-v15.js` — explicit keyed settings-saved, payment-connected, webhook-replaced and offer-created messages; bind/replace/publish confirmations; offer/channel selection error; webhook host/conflict and all four ready/sales-status combinations; preview reward/capacity/hours/total-cap labels; all five publication results (`sent`, `already_attempted`, `failed`, `unknown`, `not_registered`). Reused existing keys for no external connection, channel-registration guidance and the offer-picker prompt.
   - Preview title/body and publication channel names are separate `data-user-content` spans, created with `textContent`, never HTML. Hosts remain opaque template parameters. Literal `Home`, `Wallet`, Persian text and `<b>Alice</b>` survive live switching unchanged.
   - Each preview amount has a keyed numeric label, avoiding the demonstrated misclassification of the former mixed `سکه • ظرفیت` preview fragment by automatic aliases. Explicit bindings keep owned labels reversible without relabeling user text. Container replacement clears obsolete whole-container bindings before inserting protected child spans.
   - Preserved price/enabled payloads, webhook replacement fingerprint, selected offer code, channel IDs/order, consent gates, action names, integer parsing, zero-reward branch and the original `reward * maxClaims` preview-cap calculation. No financial calculation or server action was added. Known publication statuses are keyed; an unrecognized future status is displayed as its raw code, not a fabricated success.
2. `assets/js/i18n/owned-screens.js` — **22 new keys**, in all seven languages. Current catalogs: **1,008/1,008 each**, **0 missing keys**, **479/479 legacy mappings**. `runtime.js`, the alias system, previous 35 keys and prompt banks are unchanged.

Tests/integration: new `tests/i18n-shop-admin-v22.test.mjs` (seven language cases), new `tests/support/ui-i18n-shop-admin-v22.mjs` (real handlers with an in-page synthetic transport), and `tests/ui-i18n-phase3b-v22.mjs` (adds the shop checks to normal runs and provides `--shop-only`). New evidence: [shop results](SIMAB_V22_PHASE3B_I18N_SHOP.json). Updated generated evidence: [runtime](SIMAB_V22_PHASE3B_I18N_RUNTIME.json), [prior targeted tests with current catalog schema](SIMAB_V22_PHASE3B_I18N_TARGETED.json), [static inventory](SIMAB_V22_PHASE3B_I18N_INVENTORY.json), and normal `screenshots/phase3b-verified/` captures. Earlier screenshot directories and the original Phase 3 baseline remain intact.

### Exact test results — focused first, then full suites once

| Check | Result |
| --- | --- |
| New tests before fixes | **0/7 passed**, confirming the missing shop-message mappings |
| Focused Node suites after fixes | **53 passed**, 0 failed/skipped |
| Focused `--shop-only` browser checks | **140 passed**, 0 page errors; **20 per language**, 0 unknown strings in each final shop DOM audit |
| Full default Node suite, once | **957 passed**, 0 failed/skipped/cancelled/todo |
| Full browser suite, once | **14/15 passed**, 1 failed, none skipped/timed out |
| Phase 3B runner within that full run | **999 checkpoints completed** (593 retained + 266 prior targeted + 140 new shop); final unknown-text assertion failed on Sevens; **0 page errors** |
| Syntax / whitespace checks | **106 JS/MJS files passed**; `git diff --check` passed (LF/CRLF warnings only) |

All new shop checks passed both focused and in the complete run. They cover synthetic successful settings/bind/replacement/create/publish responses, canceled confirmations sending no action, invalid selection sending no action, exact payloads, disabled-channel exclusion, positive reward **13**, zero reward **0**, capacity **3**, duration **24**, computed cap **39/0**, all five publication statuses, and live switching that preserves names/drafts/selected codes and sends no extra request. Wallet state remains identical; the financial mutation transport receives no calls. These synthetic successes do not exercise production settings or certify real authentication/settlement.

Full logs: `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-shop-full-20261030\results.json` and per-runner logs there. Node logs: `phase3b-shop-red-node.log`, `phase3b-shop-focused-node.log`, `phase3b-shop-full-node.log` in the approved OpenCode temporary directory. The full runtime JSON intentionally retains the failing observations; it has not been replaced with a partial green run. The full suites were **not repeated**.

### Exact remaining defect and limits

- **Confirmed outstanding defect:** `assets/js/simab-party-v16.js:87` builds the Sevens draw button as `کارت بردار` plus ` (penalty)`. In `games/room/index.html?game=sevens#move-1`, penalty **2** produced unmapped **`کارت بردار (2)`** in en/ru/ar/hi/fr/de and **`کارت بردار (۲)`** in fa. The 62 baseline groups per language thus contain **one unknown observation per language** in this run (two unique rendered strings overall). The Persian observation is an unmapped owned template, not proof of wrong Persian wording. The same string has no source key when loading locale resources from the **pre-edit backup**, confirming this was not introduced by the shop changes. It remains unfixed because this batch is scoped to admin-shop handlers; no assertion was removed or weakened. A deterministic penalty-draw fixture and a keyed seven-language label are the next precise resume point.
- No confirmed untranslated message remains in the **tested shop handler states**. Unrecognized server status/error strings outside known catalogs, other application states, native-speaker review, real signed-admin UI and physical Telegram devices remain unverified. No full-application localization claim is made.
- Refreshed static inventory: **1,763 candidate strings**, **854 without a direct key**. As before, these include prompts, fragments, numbers and dormant code—not 854 confirmed omissions.

Recovery: before editing, copied and SHA-256-verified **119 changed/untracked files** to `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-shop-start-20261030-023510`. All earlier backups remain intact. Branch is still **`work/simab-game-review-v22`**. No Artistry, wallet economics, payouts, RNG, gameplay rules, SQL, database or production settings were changed. Nothing was committed, pushed, merged or deployed.

Final SHA-256-verified snapshot: **122 changed/untracked files**, `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-shop-complete-20261030-025029`. A manifest comparison confirms only the two production files, browser runner, documented generated evidence and regenerated verification screenshots changed in this batch; all other inherited code and older screenshot/baseline artifacts are byte-for-byte identical to the pre-edit snapshot. New files are the shop Node test, shop browser helper and shop JSON.

Focused reproduction:

```powershell
node --test tests/i18n-shop-admin-v22.test.mjs tests/i18n-targeted-v22.test.mjs tests/i18n-phase3b-v22.test.mjs tests/i18n-v16.test.mjs tests/phase3-v22.test.mjs
$env:SIMAB_TEST_BROWSER='C:\Program Files\Google\Chrome\Application\chrome.exe'
node tests/ui-i18n-phase3b-v22.mjs --shop-only
```

`--shop-only` updates only the shop JSON and does not overwrite full runtime/previous targeted evidence. Historical verification snapshots below are preserved, not current pass claims.

## Phase 3B targeted review fixes — 2026-10-30 (preceding verification snapshot)

Implemented only the independently reported error/confirmation and ambiguous-context fixes; the completed translation banks were not recreated. Branch remains **`work/simab-game-review-v22`**, with all earlier work retained and uncommitted.

### Exact changes

- `assets/js/simab-central-quests.js`: explicit keys for the incomplete-login diagnostic, credit wallet-limit/admin-permission errors and archive confirmation. Covered the adjacent existing authentication/credit/HTTP branches in the same handler as well: missing signed data, old/future/fresh-but-rejected signatures, validation failure, seven credit errors plus unknown-status fallback, four named 401 reasons and its diagnostic fallback, two 403 cases, 409, two 503 cases and generic HTTP failure. Original Persian wording, TTL/candidate selection, request bodies, retries and `error.definitive` decisions are unchanged.
- `assets/js/simab-shop-admin-v15.js`: keyed refund-review row, settlement button, confirmation, remaining-balance message and channel-registration success. The subject ID is an opaque parameter; only amount presentation is localized. The settlement/channel calls and arguments are unchanged.
- `assets/js/simab-party-v16.js`: explicit waiting/started previous-table confirmations, previous-table-closed status and missing-invite error. Shared Backgammon move labels now use a keyed template with explicitly selected `board.bar` / **`board.off`** endpoints, not a generic translation of «خروج». Selection, legal moves and submitted move objects are unchanged.
- `assets/js/simab-backgammon-v10.js`: standalone bear-off button declares `backgammon.bearOff` explicitly; its handler is unchanged.
- `assets/js/i18n/runtime.js`: a declared `data-i18n` key now takes precedence on the **first text scan**, before an automatic alias can overwrite it. Existing aliases, including **«خروج» → `nav.exit`**, are intentionally unchanged. Explicit context—not a global alias reassignment—resolves bearing off versus leaving.
- `assets/js/i18n/errors.js`: **35 additional keys**, translated in all seven languages. Catalogs now have **986/986 keys per language**, with **0 missing keys** and **479/479 retained legacy mappings**. English/Persian and translated prompt banks are untouched.
- New tests: `tests/i18n-targeted-v22.test.mjs` and `tests/support/ui-i18n-targeted-v22.mjs`. The existing Phase 3B browser runner includes them in full runs and supports **`--targeted`** for focused execution. Closure hooks are injected only by the local test server, not exposed by production code.

### Focused first, then one full regression run

| Check | Exact result |
| --- | --- |
| New seven-language Node regression before fixes | 0/7 passed, confirming the missing mappings |
| Focused Node suites after fixes | **46 passed**, 0 failed/skipped |
| Focused browser run, `--targeted` | **266 checkpoints passed**: **38 per language** |
| Full default Node suite, run once after focused checks | **950 passed**, 0 failed/skipped/cancelled/todo |
| Full browser suite, run once after focused checks | **15/15 runners passed**, none skipped/timed out |
| Full Phase 3B runner | **859 checkpoints** = retained 593 + targeted 266; **0 page errors** |
| Retained current-DOM audit | **62 groups per language** (434 audits); **0 unknown strings** in those groups |
| Syntax checks / `git diff --check` | **104 JS/MJS files passed** / passed (LF/CRLF warnings only) |

The 266 new checkpoints exercise real client functions and controls with synthetic transports in **English, Persian, Russian, Arabic, Hindi, French and German**. They cover all listed error branches, actual archive/refund/previous-room dialogs, cancel-without-request behavior, synthetic successful refund/channel responses and exact arguments, unchanged wallet/game state, opaque `Home` task/subject text and drafts, selected bear-off actions before/after live switches, first-scan explicit-key precedence, the unchanged navigation alias and the standalone bear-off button. New Node tests also check distinct navigation/game meanings and no unexpected fallback. An initially reversed Backgammon test-fixture direction was corrected against the existing legal-move engine; no engine change was made.

Evidence: [targeted results](SIMAB_V22_PHASE3B_I18N_TARGETED.json), [full runtime results](SIMAB_V22_PHASE3B_I18N_RUNTIME.json), [refreshed static inventory](SIMAB_V22_PHASE3B_I18N_INVENTORY.json). Full browser logs and exit codes: `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-targeted-full-20261030\results.json`. Focused logs: `phase3b-targeted-focused-node.log` and `phase3b-targeted-focused-browser.log` in the approved external OpenCode temporary directory. The complete full Node log is `phase3b-targeted-full-node.log` there.

The refreshed static scan still has **1,765 candidate strings**, now **870 without a direct source key**, down from 900. This remains a heuristic backlog including prompts/fragments/numbers—not 870 confirmed missing translations. Native-speaker review, exhaustive other dialogs/error/terminal states, all ambiguous contexts outside these fixes, real signed-admin presentation and physical Telegram devices remain unverified. Synthetic success/error responses do **not** certify authentication, production settlement or real wallet behavior. No full-application localization claim is made.

Before editing, SHA-256-verified **116 existing changed/untracked files** at `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-targeted-20261030-013235`. Earlier backups remain intact. No Artistry, gameplay rules/RNG, wallet economics, database, migrations, server contracts or production settings were changed. Nothing was committed, pushed, merged or deployed.

Final SHA-256-verified snapshot: **119 changed/untracked files**, `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-targeted-complete-20261030-014842`. Comparison with the pre-edit manifest confirms that only the six production files listed above, the browser runner, report/inventory/runtime evidence and regenerated verification screenshots changed; all other inherited files remain byte-for-byte identical. The three new files are the Node test, browser helper and targeted JSON. Previous verification screenshots remain in the pre-edit snapshot; older `phase3/` / `phase3b/` images and the original Phase 3 coverage artifact are unchanged.

Focused reproduction:

```powershell
node --test tests/i18n-targeted-v22.test.mjs tests/i18n-phase3b-v22.test.mjs tests/i18n-v16.test.mjs tests/phase3-v22.test.mjs
$env:SIMAB_TEST_BROWSER='C:\Program Files\Google\Chrome\Application\chrome.exe'
node tests/ui-i18n-phase3b-v22.mjs --targeted
```

`--targeted` updates only the targeted JSON, leaving the full runtime JSON intact. For future full verification, use the safe all-runner command documented below. The sections below preserve the preceding verification snapshot; their 951-key/943-test counts are historical, superseded above.

## Phase 3B continuation — 2026-10-30 (preceding verification snapshot)

Branch remains **`work/simab-game-review-v22`**. All work is uncommitted. **Dictionary coverage is complete; application-wide localization is not certified complete.**

### Recovery and implemented work

- Verified the required branch and existing uncommitted work before continuing. SHA-256-verified recovery snapshot of all **85** then-changed/untracked files: `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-resume-20261030-001156`. Earlier rescue snapshots remain untouched.
- Additional SHA-256-verified checkpoint: **115 files**, `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-verified-checkpoint-20261030-004232` (during final browser verification; the report/runtime artifact may advance afterward).
- Final SHA-256-verified completion snapshot, including this updated report: `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-complete-20261030-005106` (**116 changed/untracked files**). `manifest.json` records each file's path, size and hash; this is not a commit.
- Final preservation audit verified all **40** original screenshot/baseline artifacts against that manifest. The initial recovered-baseline test regenerated seven older Phase 3B images before the output-directory change; their original bytes were restored from the verified snapshot, with the regenerated versions retained externally at `C:\Users\ALI\AppData\Local\Temp\opencode\phase3b-baseline-regenerated-20261030`. New verification captures use only `phase3b-verified/`.
- Recovered implementation already contained 939 keys per language and translations of the original 500 prompts. It was retained, not recreated. Recovered baseline: **942 Node tests** and **413 multilingual browser checkpoints**, no unknown strings in those fixtures.
- Full legacy mapping, local ordered catalogs, typed templates, policies, solo/variant rules, navigation and synchronous live switching remain in place. Original English/Persian banks remain unchanged; Russian/Arabic/Hindi/French/German each contain **308 truths + 208 dares**, covering the original **300 + 200** positions and retaining the eight curated additions per category.
- Populated fixtures exposed unprotected task/draft/channel titles. Their DOM nodes now explicitly exclude user text from translation. Offer-picker labels use an opaque title parameter; task deletion accessibility labels preserve names. IDs, selected values and action payloads are unchanged.
- Added twelve catalog keys for populated task/admin/order/draft presentation and accepted-result refund text. Paid-order dates now retain their machine timestamp and reformat locally on language changes, without another API read.
- Fixed stale bindings retaining a removed label: unknown replacement text remains measurable, and cleared elements are not repopulated on switching. `bindSource` also clears an obsolete binding when its new source has no key.
- Added an optional test-only Windows adapter and all-browser orchestrator. Older assertions still use their existing isolated handlers and disposable PGlite databases. External browser/Node HTTP is blocked except explicitly intercepted synthetic requests; no production service is contacted.
- Updated obsolete browser expectations: live bottle preservation rather than lobby reload; restored poker session rather than necessarily fresh lobby; rendered mill pieces rather than old emoji; count human rolls separately from legitimate bot turns. The synthetic orientation stage now uses the real poker overlay's `z-index:40`, avoiding an artificial overlap with the language selector. Actual pointer clicks remain required; no force-click bypass was added. No gameplay timing or rules changed to satisfy tests.

### Current per-language coverage

| Language | Catalog keys | Missing keys | Legacy aliases mapped | Direction | Audited page/state groups | Unknown text in those groups |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| English | 951 / 951 | 0 | 479 / 479 | LTR | 62 | 0 |
| Persian | 951 / 951 | 0 | 479 / 479 | RTL | 62 | 0 |
| Russian | 951 / 951 | 0 | 479 / 479 | LTR | 62 | 0 |
| Arabic | 951 / 951 | 0 | 479 / 479 | RTL | 62 | 0 |
| Hindi | 951 / 951 | 0 | 479 / 479 | LTR | 62 | 0 |
| French | 951 / 951 | 0 | 479 / 479 | LTR | 62 | 0 |
| German | 951 / 951 | 0 | 479 / 479 | LTR | 62 | 0 |

The original **234 omissions were unique dictionary strings**, not rendered occurrences. Current source classification finds **485 literal occurrences**, including repeated/sub-string occurrences, and **17 retained compatibility entries absent from scanned active files**. All 234 now have keys. See [current inventory](SIMAB_V22_PHASE3B_I18N_INVENTORY.json). The [old Phase 3 coverage artifact](SIMAB_V22_PHASE3_I18N_COVERAGE.json) is intentionally preserved as historical evidence defining those original 234 entries.

The static scan finds **1,765 candidate strings**, **900 without a direct source key**. These are **not 900 confirmed missing UI translations**: they include the original 500 prompts localized through separate banks, numeric strings, concatenation fragments, redirects, technical text and dormant states. The JSON retains locations for follow-up. Catalog-schema coverage, static candidates and rendered runtime coverage are different measurements; no overall translation percentage is claimed.

### Validation and scope

- Default Node suite: **943 passed; 0 failed, skipped, cancelled or todo**. Includes **13** Phase 3B Node tests plus every earlier default test.
- JavaScript syntax: **102 files passed** across `assets/js`, its locale resources, `tests` and `tests/support`. `git diff --check` passes; Git emits only existing LF/CRLF conversion warnings.
- **Complete browser regression: 15/15 runners passed, none skipped or timed out.** Exact per-runner exit codes/logs: `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-browser-complete-20261030\results.json`.
- Phase 3B: **593 checkpoints**, including **434 current-DOM audits** (62 groups × seven languages), **140 overflow checkpoints** (five pages × four widths × seven languages), **seven dialog checkpoints**, **seven question-draft/focus checkpoints**, **two preference persistence checkpoints** and **three stale-binding probes**. Each checkpoint may contain multiple assertions; these are not code-coverage percentages. Runtime errors: **0**; unknown text across audited groups: **0**. Evidence: [current runtime report](SIMAB_V22_PHASE3B_I18N_RUNTIME.json).
- Retained explicit counters from the other Phase runners: Phase 1 **10**, Phase 2A **9**, Phase 2BC **5**, Phase 3 **253**. These plus Phase 3B total **870 named checkpoints**; the ten older runners have additional assertions without a uniform printed counter, so 870 is **not a claimed total assertion count for the entire suite**.
- Earlier full attempts were **11/15**, **14/15**, then **13/15**, before the final passing run. The initial **0/15** launch was solely a Windows `--import` URL adapter error, not an application result. Besides obsolete UI expectations, the final two intermittent failures were test races: comparing a bottle's identity matrix before its first animation frame against an identical full-rotation endpoint, and allowing a bot timer to run between a pre-pause assertion and a later pointer action. Tests now require an observed intermediate bottle transform and capture/pause atomically in one browser task; elapsed-time, paused-state, resumed-state and element-identity assertions remain. Production timing was not changed. All fixes were followed by another complete 15-runner pass.
- Multilingual fixtures use real pages with synthetic read-only transports, not real accounts. Administration is an admin-identity **DOM fixture**, not proof of server authentication/authorization. Older DB-backed suites separately exercise signed local transport/financial behavior in disposable fixtures.
- Routes: ten shared-room games; home; wallet/shop, privacy and purchase terms; tasks; daily streak; wheel; tap; admin; standalone poker/friends, backgammon, blackjack and slots; gift cards; miner; AI; offers; friends; swap. Shared-game follow-up snapshots exercise three stepped positions per game and two-/three-player Hokm.
- Checks cover seven directions/live switches, same-document sentinel, exact game/wallet state conservation, no financial mutations, wallet/admin drafts and selected offer IDs, task/channel/offer/card/AI user text, synchronous illegal-move errors and a localized leave/refund dialog. Additional probes cover question/category drafts, focus/selection, reload/navigation preference persistence and stale unknown/empty bindings.
- Geometry: **320/375/430/768px** on home, wallet, admin, shared Hokm and Ludo in each language. This checks document overflow, not every text box, keyboard, overlay or device/state combination.
- **20** new targeted screenshots: `docs/screenshots/phase3b-verified/` (Hokm/Ludo in all languages; populated admin/wallet in Persian/Arabic/German). Examples: [Arabic Hokm](screenshots/phase3b-verified/hokm-ar.png), [German Ludo](screenshots/phase3b-verified/ludo-de.png), [Arabic wallet](screenshots/phase3b-verified/wallet-ar.png), [German admin](screenshots/phase3b-verified/admin-de.png). Earlier `phase3/` and `phase3b/` captures are preserved. Arabic Hokm/wallet/admin and German Ludo/admin were visually inspected; the admin inspection exposed the subsequently translated draft controls. Screenshots are representative randomized practice hands, not pixel-comparison proofs.

### Outstanding work / precise resume point

1. Browser verification above is complete for the listed fixtures. Keep its distinction from full state/application coverage; do not infer localization completion from a green suite or catalog schema.
2. Review static candidate locations, particularly old standalone Hokm/Ludo lobby descriptions, transient loading states, redirect entry pages, dormant admin/purchase/refund/webhook-conflict states and server-originated errors not exercised by current fixtures. Notifications, all terminal game outcomes and every modal are **not exhaustively covered across all seven languages**.
3. Add seven-language authenticated admin verification through the disposable signed local handler; the current multilingual admin fixture only verifies presentation/draft/content ownership. Do not substitute a real admin account or production calls.
4. Native-speaker review, physical Telegram Android/iPhone checks, long-name/bidi/accessibility/keyboard testing and third-party TON/Telegram widget localization remain outstanding. No all-device/full-application localization or release-readiness claim is made.
5. Preserve all changes and backups. No Artistry, game engine/rules/RNG, economics, migrations, production configuration or server contracts were changed in this continuation. No commit, push, merge or deployment occurred.

Reproduce safely (the last command preserves the old Phase 3 coverage/screenshots):

```powershell
node --test tests/*.test.mjs
node tests/i18n-phase3b-inventory-v22.mjs
$env:SIMAB_TEST_BROWSER='C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:SIMAB_TEST_ARTIFACTS='C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-browser-next'
node tests/ui-all-v22.mjs
```

For focused debugging, append runner names to `ui-all-v22.mjs`, or use `node tests/ui-i18n-phase3b-v22.mjs --only=admin/index.html`. **A targeted Phase 3B run writes a partial runtime artifact; rerun the full runner before reporting final per-language runtime coverage.** Browser logs and per-runner exit codes are written to the external artifact directory. A default run is synthetic/local only, not production testing.

---

## Historical Phase 3 report — 2026-10-29 (preserved)

Date: 2026-10-29. Branch: **`work/simab-game-review-v22`**. HEAD: `3fcfc91`.

**Status: implemented and tested visual/gameplay improvements; localization remains incomplete. This is not full Phase 3 completion or a release approval.**

## Recovery and protection

- First commands verified the required branch, seven modified tracked files and five untracked entries/directories, matching the interrupted handoff.
- Before editing, copied **all 22 existing changed/untracked files** outside the repository to:
  `C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3-rescue-20261029-142550`.
- Every copied file was compared with its source using SHA-256. `manifest.json` contains paths, hashes and sizes; `tracked-changes.patch` is an additional diff artifact. The original rescue backup remains unchanged.
- The eight inherited screenshots remain byte-for-byte identical to that backup. New captures use `head-before-*` and `resume-after-*` names.
- Read the Phase 1, Phase 2A and Phase 2BC reports. No earlier standalone Phase 3 report existed in this checkout. Existing Phase 3 source, tests, SVG and screenshots were examined and continued, not reset or replaced with a clean tree.
- Recovered baseline actually passed **907 Node tests** and **60 browser checks**, rather than assuming the previous count.

### Recovered versus finished in this session

Recovered: a seven-locale loader and 92-key catalog, compatibility dictionary, smaller translated prompt packs, larger avatars/navigation styles, glass-bottle SVG, faster practice-delay API, audio synthesis changes, preliminary animation guards and a browser runner.

Completed/extended here: reload-free language switching; reversible DOM/attribute translation; form-draft and user-name protection; expanded screen/rule catalogs; turn/roster localization; additional cancellation/BFCache guards; shared Backgammon pips, roll history and legal destinations; tighter seat grids and larger pawns; quieter, better-spaced audio; dedicated draw cues; 23 new Node regressions; broader browser tests, coverage evidence and documented before/after captures.

## Implemented improvements

### Localization infrastructure and covered UI

- Seven local dictionaries: English, Persian, Russian, Arabic, Hindi, French and German. **302 stable keys in each locale**, with matching interpolation parameters and no missing keyed entries.
- Switching updates the current DOM, title and direction synchronously, without navigation/reload or restarting a practice game. Preference persists through navigation/reload when localStorage is available. Persian/Arabic are RTL; others LTR.
- Original text and attribute sources are retained for switching back. Placeholders on inputs/textareas are translated without changing entered values. Shared-room question/answer drafts, selected options and focus survive re-rendering.
- Player names, chat, entered answers/questions, invite codes, IDs and wallet amount nodes are excluded from generic translation. Browser tests include literal names `خانه`, `Home`, `Wallet` and `<b>Alice</b>` across all seven locales; they remain literal text, not translated or interpreted as HTML.
- Added navigation, homepage, practice setup, turn, dice, wallet, reward, task, media and common-error vocabulary. Full standard shared-game rule paragraphs are keyed for Hokm, Ludo, Backgammon, Snakes & Ladders, Seven Cards, Morris, friendly 21, Bingo and friends Slots. Ludo/Snakes setup variants and Seven Cards' optional 2-card rule also have explicit localized text.
- No runtime translation service, external translation request, API-schema change or translation of amounts into different economic values.
- An explicit localized notice discloses incomplete legacy coverage. English compatibility fallback remains rather than hiding or abbreviating rules/financial terms.

### Hokm and practice pacing

- Avatars are 64–76px where space permits, with active-player gold rings, teammate accents, and a separate trump-picker label. Mobile card/seat spacing remains scoped to presentation; no device-wide orientation change.
- New practice UI uses **450–850ms** normal action pacing, **900–1300ms** for trump selection, **300–550ms** for private drafting/discarding, and **850–1100ms** between rounds. The legacy delay API remains available for older callers, but this UI no longer uses its 1.8–4.5s delays.
- Generation/state guards invalidate stale bot callbacks. Pausing, resetting and leaving cancel pending work. BFCache restoration schedules at most one next bot action.
- The first-five-card trump stage and real legal actions are unchanged. Regression tests complete legal bot matches for 2, 3 and 4 players.

### Dice, pawns and other boards

- Dice use matching numerical/pip faces. Unrolled dice remain unknown rather than displaying a fabricated 3.
- Shared and legacy Ludo keep authoritative last-roll presentation; shared/legacy Backgammon retain the last **observed** roll while dice are consumed. No history is invented on recovery if the state does not contain one.
- Four-player seat strips fit a four-column mobile grid instead of wrapping the last avatar unnecessarily. Human/bot names, current-seat badges and the turn banner identify the actual active player.
- Ludo pawns have larger numbers/targets, legal-move outlines, packed shared cells and active/focus feedback. Existing movement, safe-square, exact-finish and extra-roll rules are unchanged.
- Shared Backgammon shows real pip dice and highlights legal destinations for the selected source; existing explicit die/action buttons remain available when multiple dice can reach a target. Bar priority, maximum-dice use and turn validation are still engine-owned.
- Morris pieces have contrasting shapes, selected-piece feedback and adjacency-based legal-cell highlights. Rules were not rewritten.
- Queued roll animations are cancelled on reset/page exit and cannot submit a stale action after a newer event. Dice display settles by re-rendering the accepted state, never by sampling an animation result.

**Repeated 3 investigation:** practice uses the existing cryptographic rejection-sampled `randomInt(6)+1`; no constant-3 branch was found or introduced. Tests feed all six authoritative faces and eight successive legitimate threes into the actual practice engine, plus repeated-three UI fixtures. No repeat prevention or RNG adjustment was added. This is not a statistical audit of production rolls.

### Sound and animation lifecycle

- Dice Foley uses six soft, unevenly spaced, decaying wooden impacts over roughly 0.64s instead of dense rapid clicks. Checker placement uses a short wooden cue; cards use filtered paper noise. Win, loss and draw have distinct envelopes.
- Shared-room and legacy Backgammon draws now request the dedicated `draw` cue. Other existing game callers retaining their earlier `tap` draw cue are not claimed migrated.
- Accepted-response/event deduplication remains. Backgammon does not play roll audio on each checker frame; optional receipt IDs additionally deduplicate sound calls. Audio is serialized with a bounded presentation backlog.
- Muting immediately stops scheduled sources and retains the original preference key. Hidden/page-exited clients suppress late cues; page restoration permits future cues. Audio cannot block a game action or settlement.
- Backgammon animation generations prevent old frames from overwriting a newer receipt. Page exit silently retains an already accepted final result; it does not cancel/refund the action or discard its receipt.
- Audio is local procedural synthesis, not a recording of real dice. Tests verify sequencing, not subjective acoustic realism.

### Truth or Dare bottle and navigation

- Transparent green-glass SVG with neck, cap, reflections, label and shadow replaces the plain cylinder. Rotation uses smooth acceleration/deceleration and the accepted target angle.
- Existing neck-to-answerer convention is preserved. The animation never selects or changes a result. Tests cover 2–20 player labels and actual animated endpoint angles at 2, 3, 4, 7, 12 and 20 seats.
- Reduced motion removes the spin transition. Local spin controls prevent overlapping spins; closing/editing invalidates old callbacks. Dense-player labels use alternating rings.
- Scoped dark/gold navigation buttons cover shared page headers, balances and existing navigation containers. Existing styled homepage navigation is retained, not replaced.

## Actual translation coverage — not 100% of the application

Machine-readable evidence: [SIMAB_V22_PHASE3_I18N_COVERAGE.json](SIMAB_V22_PHASE3_I18N_COVERAGE.json).

| Language | Keyed messages | Direction | Retained legacy inventory |
| --- | ---: | --- | --- |
| English | 302 / 302 | LTR | 479 existing Persian-to-English entries retained; additional unmatched UI remains |
| Persian | 302 / 302 | RTL | Original Persian source retained; this does not audit all English-owned UI |
| Russian | 302 / 302 | LTR | 245 / 479 source aliases map to keyed translations; 234 unmapped |
| Arabic | 302 / 302 | RTL | 245 / 479 source aliases map to keyed translations; 234 unmapped |
| Hindi | 302 / 302 | LTR | 245 / 479 source aliases map to keyed translations; 234 unmapped |
| French | 302 / 302 | LTR | 245 / 479 source aliases map to keyed translations; 234 unmapped |
| German | 302 / 302 | LTR | 245 / 479 source aliases map to keyed translations; 234 unmapped |

**302/302 measures catalog-schema completeness only.** The 479-entry compatibility inventory is also not an exhaustive inventory of application text. Thus **no overall application translation percentage is claimed**. Dynamic numbers/names can create many observations from one missing template.

The JSON contains per-page accumulated unmatched observations from nine shared-game fixtures and seven additional pages in every language. These include transient/pre-ready strings and unknown text; they are a conservative follow-up list, not a count of all currently visible untranslated labels. Persian's zero entries in that mechanism does **not** prove full Persian UI coverage because it retains original text by design.

English/Persian original prompt banks retain **300 truths + 200 dares each**. Each new locale currently has only **8 truths + 8 dares**. These smaller packs are not a full translation of the original banks. Native-speaker review of translations remains outstanding.

## Validation

Environment: Windows, Node `v24.22.1`, pinned Playwright with installed Google Chrome through `SIMAB_TEST_BROWSER`. All browser traffic outside the ephemeral local test server is blocked. Wallet state is synthetic and financial mutation transport throws; no real account or production financial request is used.

| Check | Passed | Failed / skipped |
| --- | ---: | ---: |
| Recovered baseline default Node suite | 907 | 0 / 0 |
| Final default Node suite, including all previous tests | 930 | 0 / 0 |
| New `tests/phase3-v22.test.mjs` | 23 | 0 / 0 |
| Phase 3 browser regression runner | 253 checks | 0 / 0 |
| Prior Phase 1 browser runner | 10 checks | 0 / 0 |
| Prior Phase 2A browser runner | 9 checks | 0 / 0 |
| Prior Phase 2BC browser runner | 5 checks | 0 / 0 |
| HEAD-before screenshot capture | 5 fixtures | 0 |
| Application JavaScript syntax | 30 files | 0 |
| New Node/browser runner syntax; `git diff --check` | Passed | 0 |

Final regression browser total: **277 checks**, plus the separate five baseline screenshot fixtures. Assertions are not code-coverage percentages. Earlier new-test fixture failures (missing VM globals, incorrect Backgammon seat count and a hidden bottle test container) were corrected and rerun; no assertions were removed or skipped.

Layout checks include 320, 375, 430 and 768px widths: Hokm across all seven locales, Hokm 2/3/4-player layouts in RTL, and the other shared boards in German. Seven additional pages (home, wallet, tasks, daily streak, wheel, miner and admin's unauthenticated view) are loaded at 375px in every language. This is **not** every page/state at every width, authenticated admin testing, or a real-device certification.

Existing Phase 1/2A result-audio assertions were retained and updated from `tap` to `draw` only for the intentionally changed shared-room/Backgammon draw cue. All other previous regressions remain in place.

Reproduce:

```powershell
node --test tests/*.test.mjs
$env:SIMAB_TEST_BROWSER='C:\Program Files\Google\Chrome\Application\chrome.exe'
node tests/ui-phase3-v22.mjs
node tests/ui-phase1-v22.mjs
node tests/ui-phase2a-v22.mjs
node tests/ui-phase2bc-v22.mjs
node tests/ui-phase3-v22.mjs --capture-before
```

No database integration suite, SQL execution, production API, remote CI or physical device test was run for this phase.

## Browser screenshots

Before captures are served directly from committed HEAD via read-only `git show`, without changing the worktree. After captures use the current working files. These are representative practice fixtures, not identical randomized hands or live multiplayer sessions.

| Screen | HEAD before | Current after |
| --- | --- | --- |
| Hokm | [Before](screenshots/phase3/head-before-hokm.png) | [After](screenshots/phase3/resume-after-hokm.png) |
| Ludo | [Before](screenshots/phase3/head-before-ludo.png) | [After](screenshots/phase3/resume-after-ludo.png) |
| Backgammon | [Before](screenshots/phase3/head-before-backgammon.png) | [After](screenshots/phase3/resume-after-backgammon.png) |
| Morris | [Before](screenshots/phase3/head-before-mill.png) | [After](screenshots/phase3/resume-after-mill.png) |
| Bottle | [Before](screenshots/phase3/head-before-truth.png) | [After](screenshots/phase3/resume-after-truth.png) |

Homepage captures: [English](screenshots/phase3/resume-after-home-en.png), [Persian](screenshots/phase3/resume-after-home-fa.png), [Russian](screenshots/phase3/resume-after-home-ru.png), [Arabic](screenshots/phase3/resume-after-home-ar.png), [Hindi](screenshots/phase3/resume-after-home-hi.png), [French](screenshots/phase3/resume-after-home-fr.png), [German](screenshots/phase3/resume-after-home-de.png). These intentionally show remaining fallback text rather than hiding it.

## Modified and new files

Modified tracked files (11):

- `assets/css/simab-safe-area-v16.css` — imports scoped Phase 3 presentation.
- `assets/js/simab-i18n-v16.js` — ordered local-resource entrypoint.
- `assets/js/simab-party-v16.js` — game presentation, localization, drafts, user-name protection and lifecycle guards.
- `assets/js/simab-practice-ai-v20.js` — phase-aware presentation pacing and localized prompt selection, not bot move rules.
- `assets/js/simab-backgammon-v10.js` — roll history, turn label, accepted-result audio and animation cancellation.
- `assets/js/simab-game-sound-v8.js` — local Foley, cue sequencing, mute and lifecycle handling.
- `tests/i18n-v16.test.mjs` — exercises the split local resources while preserving previous checks.
- `tests/phase1-v22.test.mjs`, `tests/phase2a-v22.test.mjs`, `tests/ui-phase1-v22.html`, `tests/ui-phase2a-v22.html` — dedicated draw-cue expectations, existing assertions retained.

New/untracked assets, tests and documentation, including inherited untracked work:

- `assets/css/simab-phase3-v22.css`
- `assets/js/i18n/legacy-en-fa.js`, `catalogs.js`, `screens.js`, `prompts.js`, `runtime.js`
- `assets/v22/glass-bottle.svg`
- `tests/phase3-v22.test.mjs`, `tests/ui-phase3-v22.mjs`
- `docs/SIMAB_V22_PHASE3_VISUAL_I18N.md`, `docs/SIMAB_V22_PHASE3_I18N_COVERAGE.json`
- `docs/screenshots/phase3/` — 25 images: eight preserved inherited captures, five HEAD-before captures, five current game captures and seven current homepage captures.

No files were deleted.

## Incomplete requirements and exact resume priorities

1. **Release blocker: full localization.** Inventory remaining application-owned literals beyond the compatibility dictionary, then replace the 234 unmapped legacy strings and dynamic fallbacks with stable keys. This includes authenticated administration, settings/dialog states, notifications, purchase/payment/error/economic prose, guest-profile fallback labels, two-/three-player Hokm rule variants, solo-game rule/status text, some board tooltips and dynamic labels. Translate the remaining original prompt banks. Do not replace detailed terms with shortened generic messages.
2. Add explicit localized rendering to the remaining legacy game/lobby clients rather than relying solely on DOM compatibility scanning. Generic scanning must continue to exclude names/chat/amounts. Extend draft/state-preservation tests to those clients.
3. Exhaustively test all pages and modal/authenticated/terminal states at 320/375/430/tablet widths in all locales. Current checks do not cover every combination. Navigation styling is scoped to shared containers, not certified as a rewrite of every plain link. Ludo offers immediate legal-move action plus focus/press feedback, not a new two-stage selection workflow.
4. Roll history observed only in the current client cannot be reconstructed after reload when the existing payload lacks it; no API contract was changed to fabricate persistence. Audio replay suppression is tested within the client lifecycle, not guaranteed across independent tabs/new browser sessions. Other legacy game's draw-cue callers still need the same dedicated-cue migration.
5. Native-speaker review and real listening tests remain necessary. Dense 20-player bottle labels are compact; long names, localization expansion and touch readability need further device review. No physical realism or universal readability guarantee is claimed from screenshots.
6. Physical Android/iPhone **inside Telegram**: verify touch targets, safe areas, keyboard/draft focus, browser back/BFCache behavior, card visibility, dense pawns/labels, audio unlock/volume/mute restoration, reduced motion, slow-device animation settling, voice/camera permissions and restrictive networks. No physical Android/iPhone tests have been completed here.
7. Publication/cache-version coordination is deferred. No deployment readiness claim is made for existing cached entry URLs or incomplete locale resources.

## Safety confirmation

**Nothing was committed, pushed, merged or deployed.** No branch switch, stash, reset, clean or removal of earlier tests was performed. Artistry was not touched. No production database, SQL migration, wallet economics, balances, payouts, RNG rules, financial settlement or server API contracts were modified. The practice engine and server gameplay implementation remain unchanged; deterministic RNG inputs exist only in isolated tests. No production financial endpoints were called.
