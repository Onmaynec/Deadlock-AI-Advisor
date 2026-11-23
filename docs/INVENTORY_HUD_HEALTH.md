# v0.8.0 — Inventory Control & HUD Health

## What's really implemented

This update continues the native Deadlock Panorama HUD project, not an external overlay or a live neural network.

### Manual inventory with the complete current item catalog

The player can open **Найти мой предмет**, type at least two letters of an item name (English or an ID-verified Russian alias, if included in the build-time API snapshot), then press **Куплен: ...**. This records an **annotation in the advisor only**. It does not purchase a game item, change the player's actual game inventory, or access hidden items.

- Items are identified by the current synced catalog's unique ID, never by an invented match.
- Duplicate or unknown items are refused.
- A manually chosen capacity of 9–12 slots is respected. Independent items are refused when full.
- A verified component upgrade consumes its previously annotated component, frees that occupied slot and credits its known purchase price against the upgrade.
- The same logic is used for **Куплено** from recommendation rows and for marking an item through the whole-catalog search.
- Each add/remove/reset annotation records an undo snapshot (up to 10 steps). **Отменить покупку** now reverses the last manual inventory annotation, including upgrades and removals. The button does not undo an actual purchase in the game.
- **Новый матч** and hero changes still reset manual annotations. A same-hero match boundary is not reliably auto-detected; press **Новый матч** yourself.

The existing slot selector is **manual**. The game remains authoritative about inventory and shop costs, item restrictions and all mechanics.

### HUD-source diagnostic panel

A new **Источники HUD** control displays read-only status of three independent observations:

| Source | What it tries to read | When it fails |
|---|---|---|
| Души | A scoped numeric label in the player's HUD | Becomes unknown; manual override remains available |
| Враги | Visible hero-name labels in the TeamEnemy top-bar subtree | Automatically observed enemy roster is discarded; manual choice remains |
| Лента магазина | Visible recent purchase name/time labels | No recent data is claimed; manual enemy item entry remains |

**Isolation is real code, not a cosmetic indicator.** Each probe executes in its own guarded call. If one throws, returns an invalid value, or loses access to a game panel, that source is marked \`error\`, its adapter is reset and its data discarded. The other two are read independently in the same update cycle.

The diagnostic panel shows the source status, confidence label, last confirmed tick and bounded error count. It **does not print raw game label text, account IDs, player identifiers, purchase history or other sensitive fields**. The error report is entirely local and is not transmitted anywhere. The game update function still logs generic failures if unrelated UI code throws.

All automatic readers remain **experimental**, not proven to work in the real client. Their presence in test fixtures is not proof of compatibility on the current Deadlock build.

### Why real automatic inventory remains unavailable

Valve's publicly tracked \`citadel_mods_purchased_panel.xml\` exposes a \`ModIconsContainer\`, not a verified readable current-shop item ID for each slot. Source:
https://github.com/SteamTracking/GameTracking-Deadlock/blob/master/game/citadel/pak01_dir/panorama/layout/citadel_mods_purchased_panel.xml

The current game could expose runtime properties, but they must be observed and validated on a **real** Deadlock installation before the advisor can trust them. No memory scanning, DLL injection, anti-cheat bypass, image recognition of hidden information or inferred ownership is added.

## Windows acceptance procedure

From your local project folder, with Node.js 22.2+ and the current Deadlock installed:

~~~powershell
git pull
npm run check
npm run test:build
npm run sync
npm run install-mod
npm run doctor
~~~

1. Open Deadlock **in a private test session**. Use the game shop or the configured backslash key to open the native advisor.
2. Confirm the new HUD title says **0.8** and open **Источники HUD**. Check that each source's reported state matches the actual visible game UI. An unreadable source must not masquerade as \`live\`.
3. Open **Найти мой предмет**. Add an item not present in the recommended shortlist, using English and, if synced, Russian naming. Verify it appears in **МОИ ПОКУПКИ** and affects item suggestions.
4. Test full slot capacity, a verified component upgrade, removing an annotation and pressing **Отменить покупку** several times.
5. Confirm **Новый матч** drops old purchases and manual enemy annotations.
6. Test with the shop closed and the visible enemy roster temporarily missing; no old enemy/purchase data should be falsely reused.
7. To investigate errors, run \`npm run doctor -- --json\`, check Panorama console and use the game's own tools. Keep diagnostics anonymized before sharing.

## Scope and remaining work

A successful Windows/Linux CI run validates JS, mocked Panorama API calls, Source 2 resource serialization, integration-fixture VPK build and simulated gamefile installation. **It cannot certify a running game client, anti-cheat policy compliance, auto inventory, the current live item UI or actual AI inference.**

- No LLM endpoint is connected and there is no free neural model running in the game.
- The automatic roster and shop purchase adapters remain read-only and experimentally mapped.
- There is no automatic enemy item attribution.
- Source 2 \`hud.xml\` from SteamTracking still needs to be checked against the exact version of Deadlock installed on the user's PC; the SHA-256 cache alone cannot verify that source-layout equivalence.

See docs/VPK_COMPATIBILITY.md and issues #2/#5 for current game-client validation requirements.
