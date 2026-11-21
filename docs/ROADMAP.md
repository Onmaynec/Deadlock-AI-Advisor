# Development roadmap

A milestone is not complete until its unit tests AND real in-game checks pass.

## v0.1.0 — Native HUD foundation

- [x] Node 22 dependency-free build tooling
- [x] Public hero/item catalog sync with strict minimum counts
- [x] Offline explainable shortlist with unit tests
- [x] Panorama window with manual threat, budget and purchase controls
- [x] Controlled VPK installer/uninstaller, no replacement of foreign mod slots
- [x] CI check workflow
- [ ] Compile VPK on a machine with Deadlock installed
- [ ] Test the compiled script in an actual game session
- [ ] Test shop auto-open, keybind and class-based hero detection in current patch

## v0.2.0 — Scoped HUD Telemetry (experimental)

- [x] Investigate public HUD XML for the player's visible currency label
- [x] Implement scoped read-only currency probe avoiding duplicated label IDs
- [x] Double-confirm readings, invalidate changed/missing/unreadable data
- [x] Expose HUD/manual/unknown status and evidence provenance in the in-game panel
- [x] Reject unknown affordability in the core engine instead of assuming zero
- [x] Reset tracked manual items and threats when changing heroes, or via New Match
- [x] Add optional in-game diagnostics of selected HUD container existence
- [x] Unit tests and Panorama emulation smoke tests
- [ ] Verify numeric label read and update in real Deadlock client
- [ ] Build/install/rollback VPK from Windows running latest game patch
- [ ] Identify and validate own inventory, squad/enemy roster sources
- [ ] Validate item acquisition and match identity with permitted data sources

See docs/HUD_TELEMETRY.md for evidence and test steps.

## v0.3.0 — Matchup Build Planner (experimental)

- [x] Manual enemy hero picker in native HUD, up to six opponents
- [x] Deterministic pinned next-purchase priority and manual inventory list
- [x] Buy mark, undo last mark, remove owned mark, match reset
- [x] Manual universal slot capacity 9–12 and full-inventory restrictions
- [x] Verified component upgrades from API catalog with discounted effective cost
- [x] Optional build-time enemy_hero historical item stats, strictly validated and bounded
- [x] Source/availability disclaimers for missing matchup data
- [x] CI tests for upgrade paths, inventory capacity, enemy priors and Panorama interactions
- [ ] Real Deadlock VPK compilation and end-to-end test on current Windows client
- [ ] Automatic team roster, enemy purchases, match ID (not verified)
- [ ] Enforce 4-active-item restriction after a verified catalog flag is found
- [ ] Verify item components and actual price against installed game build

See docs/MATCHUP_PLANNER.md and docs/HUD_TELEMETRY.md.

## v0.4.0 — HUD Context and Inference Safety (experimental)

- [x] Research currently exposed top-bar team containers and hero-name labels
- [x] Implement read-only opponent hero detection scoped exclusively to TeamEnemy
- [x] Two identical observations, strict catalog matching, short expiration and immediate fail-closed invalidation
- [x] Auto / manual roster selector inside Panorama; never silently trust unreadable labels
- [x] Feed verified enemy IDs into matchup-aware item ranking; show provenance in HUD
- [x] Model-response validation boundary: context identity, selected opponents, threats, inventory, slots and currency
- [x] Reject hallucinated, duplicate, unaffordable, malformed and stale model item suggestions; use offline fallback
- [x] Unit tests and Panorama smoke tests for roster transitions and inference firewall
- [ ] Verify opponent names are readable from the current Deadlock Panorama client
- [ ] Validate and build the actual game VPK on Windows with Deadlock installed
- [ ] Automatic own inventory and enemy item purchases (not implemented)
- [ ] Real free LLM integration (not implemented; requires validated permitted transport and explicit trust/consent)

See docs/HUD_CONTEXT_AI.md for source evidence, limitations and game acceptance checklist.

## Next steps

- Test the latest compiled VPK directly in an actual Deadlock client (Issues #2 and #5)
- Explore permitted, consent-based HTTPS in-game browser-panel inference (no additional UI window), never embedding API tokens
- Only then automate item inventories, purchases and context-aware generative explanations
- Add mode-aware active-item limits and versioned confidence calibration

No DLL injection, process memory scanning, cheat bypass, or automatic purchasing is used.
