# v0.4.0 — HUD Context & AI Safety

## What is implemented

**Automatic enemy roster, experimental.** The new src/roster-telemetry.js reads text only from an existing user-facing HUD subtree:

  TopBar → TeamsContainer → TeamEnemy → HeroName labels

The exact containers and display labels were identified in Valve's public Deadlock Panorama layouts, archived by SteamTracking: https://github.com/SteamTracking/GameTracking-Deadlock/blob/master/game/citadel/pak01_dir/panorama/layout/citadel_hud_top_bar.xml and https://github.com/SteamTracking/GameTracking-Deadlock/blob/master/game/citadel/pak01_dir/panorama/layout/citadel_hud_top_bar_player.xml.

The code does not create game events, request account IDs or scan the client process. It compares displayed hero names against the hero catalog synchronized from the public API at build time.

**Defensive rules:**

- Only the TeamEnemy subtree is read; friendly hero rows cannot enter the result.
- Two consecutive observations of an identical enemy set are required, despite harmless row reordering.
- Every name must map unambiguously to a current catalog hero. Missing, localized/unmatched, duplicate or template values invalidate the whole observation.
- Data expires 3 seconds after a last confirmed observation. A change, lost panel or invalid text invalidates the previous set immediately.
- Auto mode is the default; the **Выбрать врагов** button opens a fully manual in-game roster picker. **Вернуть автосостав** re-enables the read-only probe. Manual threat checkboxes and purchase annotations are unchanged.
- Data is never sent to any network endpoint in game. If the current patch does not expose these labels as rendered strings, auto detection will show unavailable; the user may manually select opponents.

**Actual in-game behavior remains unverified.** The current environment cannot launch Deadlock. Public layout evidence + passing tests do not prove the running Panorama panel makes HeroName.text readable.

### How detected opponents change recommendations

The verified enemy hero IDs are passed into the v0.3 offline matchup planner. Only an optional, pre-downloaded statistical snapshot for the selected own hero can change item order. An enemy hero name by itself does **not** imply a counter profile. When matchup data is missing, no bonus is invented. Selection, data provenance and limitations are displayed in the game.

## AI boundary: implemented validation, not an online model

The v0.4 src/inference-guard.js module provides a strict protocol to validate *possible future* generative model item suggestions. A response must be an object with:

~~~json
{
  "version": 1,
  "context": "signature-from-current-in-game-context",
  "item_ids": [123, 456]
}
~~~

Context covers own hero, selected enemies, marked-owned items, available souls, slot capacity, threat flags, pinned next purchases **and a local session epoch incremented when the match is manually reset or the hero changes**. An unobservable same-hero match transition still requires the player to press **Новый матч**. Any change makes the old response stale. Recommendations must refer to existing legal shop IDs within the offline candidate shortlist. Unknown, duplicate, malformed, unaffordable or unconfirmed-budget items are rejected; all displayed prices, names and reasons are taken from the local engine, never from model-generated text. When the model is absent, the game uses the original offline planner.

**There is no live generative AI inference in v0.4.** Do not describe the model-output validator as a working LLM integration.

### Why direct external model calls are deferred

Deadlock's Panorama JavaScript environment is not a standard browser. Current modding research reports that direct AsyncWebRequest has been removed and regular fetch is unavailable. Source: https://github.com/UnExploration/deadlock-ai-mod-kit/blob/main/docs/04-persistence-and-io.md.

A hidden in-game HTTPS Chromium panel is a possible bridge, but this entails hosting a trusted website, reviewing its data handling, user consent, network/API quotas and model-provider CORS. Avoid shipping API keys inside the public VPK or silently posting match information to third parties. A browser-panel bridge was **not built, deployed, or verified** in v0.4.

## Security and data boundaries

No standalone application, service, game-memory access, DLL injection or bypass of Valve protections is used. Only visible, already-rendered hero labels and the previously known currency HUD label are probed. No accounts, match IDs, or personal data are extracted. The player controls all manual annotations. This project is unofficial; compatibility and Valve's permission for game HUD modification are not guaranteed.

## Acceptance checklist on a real Deadlock installation

1. Pull the latest main branch. Run **npm run check** (including Windows CI, unit and mocked Panorama tests).
2. Run **npm run sync**, then optionally **npm run sync:matchups -- --heroes 15** with the correct own hero ID.
3. Close Deadlock and run **npm run install-mod** (or build first without installing).
4. In a private/safe test game, open the shop or backslash toggle. Check for any Panorama console errors.
5. Confirm enemy names appear in **Авто** mode and are exactly the visible TeamEnemy heroes — not the player's teammates.
6. Confirm renamed/unreadable labels, death/respawn, scoreboard transitions, and game mode changes degrade to **HUD не определил состав** instead of retaining enemies from a previous match.
7. Switch to **Выбрать врагов**, manually choose opponents, and then **Вернуть автосостав**. Check manual purchases and threat flags remain intact.
8. Verify that pre-downloaded opponent stats only apply to available own-hero samples.
9. Rebuild after patches. Remove with **npm run uninstall-mod** and confirm other mods are unaffected.

Automatic inventory identification, live purchases, match identification, and a real LLM provider remain open tasks. See the repository's issues #2 and #5.
