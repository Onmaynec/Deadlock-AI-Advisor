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

## v0.2.0 — Trustworthy match data

- [ ] Identify verified HUD fields for player souls, owned items and team roster
- [ ] Add read-only adapters for publicly exposed in-game UI state
- [ ] Display confidence, source and age for each field; fail closed on missing data
- [ ] Validate matching the correct player to purchases in live event feeds
- [ ] Never assume spectator streams offer zero-delay private match data
- [ ] Keep manual fallback for unreliable telemetry

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
