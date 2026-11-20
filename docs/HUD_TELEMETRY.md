# v0.2.0 — HUD telemetry adapter and validation

## Confirmed source in public HUD layouts

The current [SteamTracking GameTracking-Deadlock](https://github.com/SteamTracking/GameTracking-Deadlock/blob/master/game/citadel/pak01_dir/panorama/layout/hud_gold_and_ap_container.xml) layout defines:

- Container: CitadelHudSoulAPContainer → CurrentGoldAmount.
- Local currency label: hudCurGoldLabel with text binding {i:hud_cur_gold}.
- **Unrelated item investment label has the same ID** hudCurGoldLabel under hudItemGoldContainer.

The adapter scopes all reads to CurrentGoldAmount. A global label lookup is unsafe.

### Implementation

File: src/telemetry.js

1. Finds the CurrentGoldAmount HUD panel and its nested hudCurGoldLabel.
2. Reads the text that the user can already see (not private game APIs).
3. Strictly parses integers and grouped thousands; rejects invalid, missing, template, negative or out-of-range values.
4. Requires **two consecutive identical readings** before returning a confirmed number.
5. Immediately invalidates a missing/unreadable/changed reading. A confirmed sample also expires after 2.5 seconds without refresh.
6. Returns an evidence object with value, source, status, confidence and ageSeconds.

The Panorama panel shows HUD / manual / unavailable. Switching to manual mode is possible in-game, and ±500 activates it automatically. Unknown souls are represented as null; the recommendation engine does not claim that any item is affordable if money is unknown.

**Important:** this public layout confirms the binding name, **not** that the running game exposes evaluated numeric text to the mod's JS sandbox. The HUD integration must be validated on a real installation. The adapter fails closed if Label.text contains only a template token.

### Hero detection

Existing class-based hero detection remains with manual fallback. v0.2 resets manual enemy threats and owned items when the HUD shows a new hero, or when a hero disappears for at least 8 seconds. Same-hero match boundaries cannot reliably be identified without a proven match ID. Use the in-game **Новый матч** button between matches if needed.

## Remaining unverified fields

| Field | v0.2 status | Reason |
|---|---|---|
| Local hero | Existing class-based detection with manual fallback | Class names may change after game patches |
| Local souls | Read-only scoped HUD probe; two samples; visible status | Real-game numeric Label.text still needs validation |
| Own inventory | Manually marked items | No validated mapping to live item IDs |
| Enemy purchases | Not collected | No verified permitted latency-safe source |
| Squad/enemy heroes | Not collected | Live mapping still unverified |
| Match identifier | Not collected | No permitted in-client match ID validated |
| AI inference | Not connected | No proven safe arbitrary HTTP/model integration in Panorama |

The **Диагностика HUD** control shows only presence of known HUD containers. It never logs player IDs or claims that finding a panel means owning its item data.

Community spectator/demo tools such as [Deadlock Live Events](https://github.com/deadlock-api/deadlock-api/tree/master/live-events) may be delayed and need careful player/match mapping. They are not silently substituted for live client data.

## Windows acceptance checklist

Do not call v0.2 game-tested until these checks pass:

1. Update Deadlock. Pull latest repository code.
2. Run npm run check. Ensure all Node and Panorama smoke tests pass.
3. Run npm run sync for a fresh hero/item snapshot. If this fails, do not label an older snapshot a new release.
4. Run npm run install-mod. Verify the VPK was placed into a free addon slot without overwriting other files.
5. Join a **private/safe match** and verify native HUD opens with the shop and the chosen hotkey; inspect Panorama console errors.
6. Check that auto souls matches the game's visible souls after gaining and spending, including zero and thousands separators, and only after two readings.
7. Force the known HUD element to be unreadable in a development fixture or test a scene without the element: the advisor must show **?**, not cached souls.
8. Switch between manual and HUD and verify evidence labels.
9. Change hero or use **Новый матч**; annotations must reset rather than carry to another match.
10. Rebuild after patches and verify rollback with npm run uninstall-mod.

When reporting a failure, share the game build, Node version and redacted [DAA] console errors. No private player identifiers or chats are needed.

## Safety

Unofficial Deadlock mod. Valve has not guaranteed that third-party HUD advice is allowed or stable. No memory reading, code injection, cheat bypass, automatic purchasing or hidden information collection is used.
