# Historical Phase 3 localization evidence

`phase3-original-i18n-coverage-v22.json` is an unmodified copy of the saved Phase 3 report at:

`C:\Users\ALI\AppData\Local\Temp\opencode\simab-phase3b-start-20261029-151537\docs\SIMAB_V22_PHASE3_I18N_COVERAGE.json`

Full-file SHA-256: `69e1d5864d17381d82d211fe11ac0a62650a64c2696011fb88121678e160dc2a`.

The same bytes were found in eleven independent existing Phase 3/3B checkpoint directories, including the earlier `simab-phase3-resume-snapshot-20261029-150342`. Its ordered 234 English `legacyUnmapped` source strings exactly match `original234[].source` in the already committed `docs/SIMAB_V22_PHASE3B_I18N_INVENTORY.json`. This is recovered evidence, not newly generated omissions or a relaxed expected count.

The current report `docs/SIMAB_V22_PHASE3_I18N_COVERAGE.json` was overwritten by later runtime coverage generation and correctly reports zero current omissions. It must not double as the historical test input. Generators may continue updating current coverage without modifying this fixture; the original assertion, complete source list, and full-file checksum are enforced in the focused test.
