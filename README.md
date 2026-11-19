# Deadlock AI Advisor

**Native Panorama HUD mod for Deadlock.** The player sees and controls the panel **inside the game**, not in an external window. The distributable is a Source 2 VPK: no DLL injection, process-memory reading or shop automation.

**Status: v0.1.0 / experimental.** The native UI and offline recommendation engine are implemented in source. Live neural inference, automated inventory/enemy-item tracking and end-to-end game verification are NOT implemented. Do not treat this build as a finished AI assistant.

## Implemented

- In-game HUD panel that can open with the in-game shop or the backslash key.
- Hero detection from visible HUD classes, with manual hero selection fallback.
- Item and hero catalog from Deadlock API at build time (no paid runtime API).
- Recommendations updated when the player manually changes budget, owned items or enemy threat flags.
- Explainable counter hints for healing, control, gun damage and spirit damage.
- VPK compiler with collision-resistant installer/uninstaller; Node unit tests.
- No additional window or companion app while playing.

## Build / install (Windows)

Requires **Node.js 22.2+**, Deadlock installed through Steam, Internet access for the first API snapshot and stock HUD download.

Clone the repository at https://github.com/Onmaynec/Deadlock-AI-Advisor.git. Copy **config.example.json** to **config.json**. If Steam auto-discovery fails, set **gamePath** to the Deadlock install folder containing the game directory. Change **pakNumber** if pak88 is occupied.

From the project root run:

~~~powershell
npm run check
npm run sync
npm run install-mod
~~~

The install command builds and places a VPK in **game/citadel/addons/pak88_dir.vpk** (or your configured number). It may add safe search paths to **gameinfo.gi**; the original is backed up at **cache/gameinfo.gi.bak**. It refuses to overwrite another mod's VPK.

Open the game shop or press backslash. The panel is part of the in-game HUD. Enemy threat flags, souls and purchased items are **manual** in this version. Select another hero if HUD auto-detection fails.

To build without installation: run **npm run build** (output: **out/pak88_dir.vpk**). To remove a VPK installed by this tool: run **npm run uninstall-mod**. The installer verifies SHA-256 before deleting. Shared addon search paths remain in gameinfo.gi on uninstall so it does not break other mods; use the backup or Steam verification to restore stock files after removing all mods.

## What recommendations mean

The rules engine only considers real shopable items from the API snapshot, filters items marked as bought, considers manual counter-threat signals and flags purchases that cost more than the currently entered budget. It is deterministic and explainable.

It is **not a neural network**. There is no validated live AI-to-Panorama network integration, and no hero-specific build scoring yet. Identifying the current hero only labels the panel. Results are preliminary candidates, not verified optimal builds.

## Known limitations

- Local hero detection relies on game UI class names and may break in a patch.
- Soul count, owned items, enemy heroes and enemy purchased items are not read automatically.
- No free LLM is called at runtime. Panorama has no verified general HTTP API in this HUD context and API keys should never be embedded into a public VPK.
- This environment cannot launch Deadlock. Node tests are not a substitute for testing a compiled VPK in a real game session.
- HUD layout resources conflict with mods that also replace **panorama/layout/hud.vxml_c**. Rebuild after patches.

Valve has not guaranteed that a third-party HUD which gives competitive advice is permitted. Test privately and install at your own risk. The project does not read hidden data or evade anti-cheat.

## Project

| Directory | Role |
|---|---|
| src/advisor-core.js | Dependency-free ranking engine for both Node and Panorama |
| src/panorama/ | In-game widget and native CSS |
| tools/sync-data.cjs | API metadata import |
| tools/build.cjs | Native HUD resource compilation, VPK install/uninstall |
| tools/common.js, s2res.js, vpk.js | Apache-2.0 build helpers, attributed below |
| test/ | Unit tests |
| docs/ROADMAP.md | Remaining technical work and acceptance criteria |

Third-party Source 2 build helpers come from [Deadlock Build Bubble](https://github.com/cheetohsum/deadlock-build-bubble), licensed under Apache 2.0. See THIRD_PARTY_NOTICES.md and licenses/Apache-2.0.txt.

Independent open-source project; not affiliated with Valve or deadlock-api.com.
