# Deadlock AI Advisor

**Native Panorama HUD mod for Deadlock.** The player sees and controls the panel **inside the game**, not in an external window. The distributable is a Source 2 VPK: no DLL injection, process-memory reading or shop automation.

**Status: v0.6.0 / experimental.** The native UI and offline recommendation engine are implemented in source. Live neural inference, automatic inventory/enemy-item tracking and end-to-end game verification are NOT implemented. The game HUD now has an experimental read-only opponent-roster adapter, requiring real-client confirmation. A scoped read-only HUD currency adapter now exists, but its in-game numeric behavior remains unverified. Do not treat this build as a finished AI assistant.

## Implemented

- In-game HUD panel that can open with the in-game shop or the backslash key.
- Read-only current-souls probe from the game's named HUD label, requiring two matching samples; manual/unknown fallback and evidence status.
- Hero detection from visible HUD classes, with manual hero selection fallback.
- Item and hero catalog from Deadlock API at build time (no paid runtime API).
- Hero-specific purchase popularity from the public item-stats API (when available); recommendations update when budget, marked owned items or enemy threat flags change.
- Explainable counter hints for healing, control, gun damage and spirit damage.
- Per-match manual annotation reset, in-game diagnostics of known HUD container presence, and explicit unknown-affordability handling.
- **Matchup Build Planner:** select up to six opponents manually or attempt to read visible enemy hero names automatically from the existing top-bar HUD; pin purchase priorities, track owned items and undo annotations inside the game.
- **Universal inventory slots:** manual 9–12 available slots, no new independent item when full; a verified upgrade can consume a component instead.
- **Verified upgrade components:** uses current API component relationships and calculates the difference in souls instead of always charging the full price.
- **Optional offline matchup snapshot:** API historical purchased items when facing selected enemy heroes, precomputed before compiling the VPK.
- **v0.4 read-only opponent roster:** only the TeamEnemy top-bar panel's HeroName labels are examined; invalid, ambiguous or stale data causes immediate safe fallback. Automatic name mapping requires matching English hero names.
- **Model-output firewall:** optional future neural suggestions cannot inject unknown item IDs, costs or stale-match context; no model is contacted yet.
- **v0.6 Economy Route:** a real in-game button **План на эти души** simulates up to three purchases using **only the player's currently known souls**, with inventory capacity, verified component discounts, pinned-item preference, remaining balances and a separate save-for target. It never predicts future income or buys items automatically.
- **v0.6 Installation Doctor:** **npm run doctor** audits game files, VPK resource list, catalog age, addon search paths, installation tracking and SHA-256 integrity without modifying anything. Add **-- --json** for machine-readable troubleshooting.
- **v0.6 Russian item search fix:** in-game item search uses validated Russian aliases as well as English names.
- **v0.5 Visible Purchase Feed:** live-looking read-only **shop recent-purchase rows** can be displayed in the native panel when present. The displayed shop row **does not identify the buyer or team**. Use **Подтвердить у врага** only after you personally recognize the ownership.
- **Opponent Item Search:** find and mark up to 12 enemy-owned items by a built-in in-game name search, even if the game feed is missing.
- **Counter hypotheses from confirmed enemy-owned items:** conservative editable item-name hints feed healing/control/bullet/spirit threat flags; unknown items contribute no guessed effect.
- **Russian alias matching:** optional build-time localization sync adds alternative names to the same known item/hero IDs for Russian game UI. Failure falls back to exact English names.
- VPK compiler with collision-resistant installer/uninstaller; Node unit tests.
- No additional window or companion app while playing.

## Build / install (Windows)

Requires **Node.js 22.2+**, Deadlock installed through Steam, Internet access for the first API snapshot and stock HUD download.

Clone the repository at https://github.com/Onmaynec/Deadlock-AI-Advisor.git. Copy **config.example.json** to **config.json**. If Steam auto-discovery fails, set **gamePath** to the Deadlock install folder containing the game directory. Change **pakNumber** if pak88 is occupied.

From the project root run (for an optional matchup-aware snapshot, see the separate guide):

~~~powershell
npm run check
npm run sync
npm run doctor
npm run install-mod
npm run doctor
~~~

The install command builds and places a VPK in **game/citadel/addons/pak88_dir.vpk** (or your configured number). It may add safe search paths to **gameinfo.gi**; the original is backed up at **cache/gameinfo.gi.bak**. It refuses to overwrite another mod's VPK.

Open the game shop or press backslash. The panel is part of the in-game HUD. Enemy threat flags and purchased items remain **manual**. Enemy hero names can be detected from existing HUD labels only if the running game exposes those labels; the in-game **Выбрать врагов** selector is always available as fallback. Souls can be read from the named HUD label **only if the installed game exposes evaluated numeric text**; otherwise it stays unknown until manually entered. Select another hero if HUD auto-detection fails.

**v0.6 economy route and Windows installation diagnostics:** [Economy Route & Doctor](docs/ECONOMY_ROUTE.md).

**v0.5 purchase intelligence and live HUD checks:** [Purchase Intelligence](docs/PURCHASE_INTELLIGENCE.md).

**v0.4 limitations and client test protocol:** [HUD Context & AI Safety](docs/HUD_CONTEXT_AI.md).

**Optional matchup recommendations:** after running **npm run sync**, identify your numeric hero ID in **generated/catalog.json** and run **npm run sync:matchups -- --heroes 15** (replace 15 with your own hero ID). Rebuild and install to include that data in the VPK. See [v0.3.0 Matchup Planner](docs/MATCHUP_PLANNER.md).

To build without installation: run **npm run build** (output: **out/pak88_dir.vpk**). To remove a VPK installed by this tool: run **npm run uninstall-mod**. The installer verifies SHA-256 before deleting. Shared addon search paths remain in gameinfo.gi on uninstall so it does not break other mods; use the backup or Steam verification to restore stock files after removing all mods.

## What recommendations mean

The rules engine only considers real shopable items from the API snapshot, filters items marked as bought, considers manual and **user-confirmed enemy-item** counter-threat signals and flags purchases that cost more than a known balance. When currency is unavailable, affordability remains **unknown** rather than assumed zero. It is deterministic and explainable. When a verified API component is marked owned, the advisor estimates the upgrade payment as the cost difference. When inventory is full, only valid component upgrades can appear. A user-pinned plan remains prioritized.

It is **not a neural network**. There is no validated live AI-to-Panorama network integration. If the optional hero-level analytics request succeeds during sync, selected heroes affect item ranking using their observed purchase counts; this is not causal evidence of optimal builds. Results are preliminary candidates, not verified optimal builds.

## Known limitations

- Local hero detection relies on game UI class names and may break in a patch.
- Soul count is probed from a known public HUD label with double-confirmation; real-game evaluation of that label is **unverified**. Owned items, enemy heroes and enemy purchases are still manually tracked or unavailable.
- Hero priors and optional opponent matchup priors are historical purchase frequencies, **not** item win rates or proven counters. Matchup priors are only available for heroes explicitly precomputed during sync. Optional analytics failures fall back gracefully.
- Enemy hero and shop purchase label probes are experimental and not verified in the live client. The shop's recent-purchase snippet has no reliable buyer/team identity, so **no feed item is automatically marked as owned by an enemy**. Manual confirmation is required. The player can switch to manual roster selection at any time. Universal inventory slot count is chosen manually and active-item restrictions are unverified.
- No free LLM is called at runtime. The direct Panorama HTTP request API has been removed in current mod research. A hosted HTTPS browser-panel bridge could be investigated later with explicit consent, but it is not part of v0.5. **No API key is embedded in this VPK.**
- A three-purchase route is a **heuristic preview** of how to spend current souls, not an optimal build, an automatic purchase order, or a future-income forecast.
- The diagnostic tool validates files and checksums, **not** actual mod compatibility with the running Deadlock process.
- This environment cannot launch Deadlock. Node tests are not a substitute for testing a compiled VPK in a real game session. See [HUD telemetry and the Windows test checklist](docs/HUD_TELEMETRY.md).
- HUD layout resources conflict with mods that also replace **panorama/layout/hud.vxml_c**. Rebuild after patches.

Valve has not guaranteed that a third-party HUD which gives competitive advice is permitted. Test privately and install at your own risk. The project does not read hidden data or evade anti-cheat.

## Project

| Directory | Role |
|---|---|
| src/advisor-core.js | Dependency-free ranking engine for both Node and Panorama |
| src/telemetry.js | Fail-closed read-only HUD currency adapter and evidence tracker |
| src/roster-telemetry.js | Read-only enemy roster detector with double-confirmation and strict fallback |
| src/purchase-feed.js | Read-only, unattributed shop purchase feed adapter |
| src/enemy-item-evidence.js | Conservative threat hints from explicitly marked enemy items |
| src/purchase-route.js | Offline, three-purchase route simulation on currently known souls |
| tools/doctor.cjs | Read-only Windows installation / VPK / catalog diagnostics |
| src/inference-guard.js | Validation and safe offline fallback for possible future LLM outputs |
| tools/sync-matchups.cjs | Optional offline historical item-versus-enemy-hero snapshot |
| src/panorama/ | In-game widget and native CSS |
| tools/sync-data.cjs | API metadata import |
| tools/build.cjs | Native HUD resource compilation, VPK install/uninstall |
| tools/common.js, s2res.js, vpk.js | Apache-2.0 build helpers, attributed below |
| test/ | Unit tests |
| docs/ROADMAP.md | Remaining technical work and acceptance criteria |

Third-party Source 2 build helpers come from [Deadlock Build Bubble](https://github.com/cheetohsum/deadlock-build-bubble), licensed under Apache 2.0. See THIRD_PARTY_NOTICES.md and licenses/Apache-2.0.txt.

Independent open-source project; not affiliated with Valve or deadlock-api.com.
