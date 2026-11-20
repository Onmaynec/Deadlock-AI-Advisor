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

## v0.3.0 — Competitive builds

- [ ] Per-hero statistical build priors from public analytics
- [ ] Versioned and reviewed item counter relationships
- [ ] Synergy, build completion, item slots and affordability
- [ ] Stable plan that doesn't oscillate between successive updates

## v0.4.0 — AI

- [ ] Research allowed ways to call an external model from the game without a companion window
- [ ] Never ship hidden LLM API keys or bypass the game's sandbox
- [ ] Output schema validation against current real item IDs and economy
- [ ] Fully functional deterministic fallback when no model is available

No DLL injection, memory scanner, anti-cheat bypass or automatic game input.
