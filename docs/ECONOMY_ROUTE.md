# v0.6.0 — Economy Route & Installation Doctor

**Status: experimental.** The v0.6 source contains working deterministic purchase simulation and installation diagnostics. All game UI is still built as native Deadlock Panorama resources. No external desktop overlay, companion app, DLL injection, game memory access, anti-cheat workaround, automatic purchase, or AI-network request has been added.

## Economy Route: preview what your CURRENT souls can buy

Use the **План на эти души** button inside the advisor HUD.

The planner:

1. Starts from the known local soul count (read from validated HUD text if possible, otherwise manual).
2. Uses the existing item catalog, manually tracked inventory, confirmed upgrade components, manual threat signals, manually marked enemy items and historical item popularity when it was synced before the match.
3. Expands a bounded, deterministic search over up to **three simulated purchases**, at most seven legal candidate choices per step and 12 retained distinct inventory states.
4. Every purchase must be affordable **at that step**; the remaining budget is decremented. It cannot invent future earnings.
5. Replacing a verified owned upgrade component frees the old slot and uses the already-implemented price difference. Full-inventory independent items remain unavailable.
6. Shows each selected item, estimated cost and souls remaining after the step. It may separately show an **alternative saving target** and exactly how many souls are currently missing.

This is a **heuristic route**, not a prediction of game economy or an optimized win-rate build. The game shop remains authoritative about item cost, upgrade eligibility and any item-specific active-slot limits not represented in the current catalog.

**Unknown souls:** no multi-step route is presented. The button explains that the budget must be determined first. A verified zero balance is distinct from unavailable currency.

The normal one-item recommendation list and manual buy/pin controls are unchanged.

## Local installation doctor

After installing Node.js 22.2+, from the project's root folder:

~~~powershell
git pull
npm run check
npm run sync
npm run doctor
npm run install-mod
npm run doctor
~~~

The doctor requires no additional packages or internet access and **never edits files**. Its report checks:

- Whether the Deadlock installation was found (or the configured gamePath is valid).
- Whether the game's stock VPK index contains the expected Panorama HUD layout, styles and compatible script template.
- Whether gameinfo.gi has an addon search path.
- Whether the generated local item catalog exists, has the expected minimum number of entries and is no more than 14 days old.
- Whether the selected addon VPK slot is occupied, and whether the installed VPK matches the SHA-256 stored by this project's installer.
- Whether installed VPK resources include the mod's compiled layout, style and script.
- Whether Deadlock files are newer than the installed VPK and the mod should be rebuilt.

For a structured report, use **npm run doctor -- --json**. It exits nonzero if a critical error is found, while informational warnings (for instance, a clean but not-yet-installed mod) are shown without failing.

The doctor **does not verify real Panorama execution, Valve's permission for mods, the actual game build's compatibility, or access to match telemetry**. After an update, run **npm run install-mod** again, then validate inside a private test game. An existing foreign VPK in the same slot is treated as a collision and must never be overwritten.

## Russian item search

Items synced with optional, ID-verified Russian names can now be found in the **Найти предмет** box in Panorama using either English or Russian names. Unrecognized names, duplicate aliases and missing localizations still fail closed, rather than matching by approximation.

## Acceptance checklist

1. Run npm run check on Windows and confirm all unit, integration-mock, doctor and packaging tests pass.
2. Run npm run doctor before and after npm run install-mod; check addon mounting, resource list and hash status.
3. In a private test game, open the in-game HUD with the shop/hotkey and press **План на эти души**.
4. With an observed soul balance, confirm every simulated purchase cost and remaining balance against the actual game shop. Check upgrade, full-inventory and zero-souls cases.
5. With an unreadable HUD balance, verify that the route refuses to claim affordability; switch to manual and re-test.
6. Open **Найти предмет** and search a validated Russian alias.
7. After a patch, ensure doctor flags an older installed VPK; rebuild and retest. If problems appear, run npm run uninstall-mod and verify the game's original files.

**No local Deadlock client was available in the development environment**, so actual in-client acceptance remains pending. Do not confuse a green Node CI with a tested game release.

See docs/HUD_TELEMETRY.md and docs/HUD_CONTEXT_AI.md for previous read-only adapter limitations.
