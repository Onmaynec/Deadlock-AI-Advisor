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

## v0.5.0 — Purchase Intelligence (experimental)

- [x] Read-only recent-purchase evidence from vanilla shop RecentPurchasesContainer
- [x] Confirm two identical observations; drop stale/missing/unreadable events
- [x] Explicitly **unattributed** evidence: never assume shop purchase belongs to enemy or ally
- [x] In-game manual confirmation of observed purchase as enemy-owned
- [x] In-game item search / mark / remove independent of feed availability
- [x] Conservative counter-threat hints from manually confirmed enemy items
- [x] Feed merged hypotheses into local deterministic advisor; manual threat toggles preserved
- [x] Context fingerprint invalidated when enemy item annotations change
- [x] Optional Russian aliases from public build-time API; matching by validated IDs
- [x] Unit tests, Panorama smoke tests, CI on Windows and Linux
- [ ] Verify actual purchase feed rows and localization on current Deadlock client
- [ ] Validate item ownership attribution from an explicitly permitted and reliable live source
- [ ] Automatically observe own equipped items (not implemented)
- [ ] Connect free generative inference (not implemented)

See docs/PURCHASE_INTELLIGENCE.md.

## v0.6.0 — Economy Route & Installation Doctor (experimental)

- [x] Multi-step (up to 3) deterministic purchase route using existing current soul budget only
- [x] Never simulate unearned souls, hidden information, unknown-budget affordability or automatic purchases
- [x] Account for verified owned components, upgrade discounts, available inventory slots and pinned purchase preference
- [x] Show remaining souls after each purchase and separately display an optional save-for target
- [x] Add native in-game button and collapsible purchase-route presentation
- [x] Repair in-game item search to match validated Russian catalog aliases
- [x] Read-only Windows installation doctor for stock VPK resource paths, gameinfo, catalog freshness, installed VPK and integrity
- [x] Unit tests for multi-step budget limits, full inventory, components, unknown currency, integrity and game discovery
- [x] Panorama interaction smoke tests, CI Windows/Linux
- [ ] Compile and launch this VPK in the actual Deadlock client and verify the current HUD
- [ ] Validate that production slot/upgrade metadata matches actual game behavior
- [ ] Prove safe, permitted live own inventory telemetry and player-attributed events
- [ ] Enable actual free neural inference after a verified transport & model provider are available

See docs/ECONOMY_ROUTE.md. The read-only doctor is a diagnostic aid, not a substitute for launching the game.

## v0.7.0 — VPK Compatibility & Packaging (experimental)

- [x] Compile the full native Panorama bundle from an offline fake Deadlock installation
- [x] Verify VPK round trip for HUD layout, styles and script byte for byte
- [x] Require resource templates with DATA and RED2 blocks
- [x] Validate stock HUD structure and refuse duplicate injection
- [x] Bind cache to installed source VPK and downloaded XML SHA-256 checksums
- [x] Write a build manifest with nonidentifying source/result checksums
- [x] Stage VPK installs and restore previous own VPK after failed replacement
- [x] Reject occupied addon slots and untrusted installation-record destinations
- [x] Extend read-only doctor to detect source/manifest/installed file mismatches
- [x] Integrate offline full build/install/uninstall regression tests into Windows/Linux CI
- [ ] Validate real compiled VPK and startup on an actual up-to-date Deadlock Windows client
- [ ] Verify SteamTracking HUD XML exactly matches installed local game build
- [ ] Verify actual native Panorama JS/CSS parser support and panel event controls
- [ ] Verify owner-attributed purchases and permitted runtime neural inference

See docs/VPK_COMPATIBILITY.md.

## v0.8.0 — Inventory Control & HUD Health (experimental)

- [x] Full-catalog own-item search inside native Panorama HUD, including validated Russian aliases
- [x] Single verified inventory-state module for buys from recommendations and full-catalog search
- [x] Reject duplicate, nonexistent or over-capacity manual items; account for consumed upgrades
- [x] Up to 10 reversible manual inventory operations (add/remove/reset)
- [x] Local HUD-source status panel for currency, roster and purchase feed
- [x] Independently guard each read-only adapter; prevent one thrown exception from blocking other sources
- [x] Immediately discard invalid adapter data and reset the failing reader
- [x] Run new inventory/health unit tests and in-game mock Panorama smoke tests
- [x] Include both modules in compiled VPK bundle and CI integration build
- [ ] Verify read-only HUD probes and Source 2 panel event handling inside the current real Deadlock client
- [ ] Confirm safe automatic own inventory item IDs in exposed runtime panels; do not guess based on icon containers
- [ ] Resolve same-hero match boundary without manual reset, using confirmed permitted HUD data
- [ ] Implement actual consent-based free LLM transport and inference after validated network capabilities

See docs/INVENTORY_HUD_HEALTH.md.

## v0.9.0 — Strategy Lab (experimental)

- [x] Four transparent offline item strategies: balanced, survival, pressure, budget
- [x] Source-preserving score modifiers based only on catalog slot and price facts
- [x] Profile selection and comparison controls inside the native Panorama HUD
- [x] Display first affordable candidate or explicit unconfirmed/insufficient balance
- [x] Display hero and matchup sample coverage limitations without fake win-rate claims
- [x] Apply selected strategy to every step of the 3-purchase offline route
- [x] Preserve current slot, component, budget, pinned priority and inventory legality rules
- [x] Include profile in future generative response context signature
- [x] Reject boolean/out-of-range budget values in core recommendation engine
- [x] Add strategy, audit, route and Panorama smoke regression tests
- [x] Include strategy engine in Source 2 VPK and run Windows/Linux CI
- [ ] Verify full HUD interaction with real Deadlock on Windows
- [ ] Connect a permitted free local/hosted neural inference provider after in-game transport validation
- [ ] Improve sample coverage and source confidence from validated match data, never fabricated telemetry

See docs/STRATEGY_LAB.md.

## Next steps

- Test the latest compiled VPK directly in an actual Deadlock client (Issues #2 and #5)
- Explore permitted, consent-based HTTPS in-game browser-panel inference (no additional UI window), never embedding API tokens
- Only then automate item inventories, purchases and context-aware generative explanations
- Add mode-aware active-item limits and versioned confidence calibration

No DLL injection, process memory scanning, cheat bypass, or automatic purchasing is used.
