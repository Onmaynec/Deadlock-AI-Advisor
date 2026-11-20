# v0.3.0 — Matchup Build Planner

This release adds **in-game UI features**, but remains **experimental source**, not a tested matchmaking mod. Its interactive panel is part of the Deadlock Panorama HUD. No extra window or standalone application is required while playing.

## Player controls

- Manually choose **up to six enemy heroes** through a paged native hero picker. Selected enemies appear in the roster.
- Mark threats (healing, control, bullet and spirit damage). These are *not automatically inferred* from heroes.
- See six ranked purchase candidates with costs and confirmed/unknown affordability.
- Pin up to five intended purchases with **В план**; pin priority stays stable even as threats or money change. Unpin using **Убрать из плана**.
- Mark an item as **Куплено** and undo the last purchase annotation. Manually remove older marks in **МОИ ПОКУПКИ**. No in-game purchase/sale is made by these buttons.
- Cycle available universal inventory slots between 9 and 12 with **Слоты**. At capacity, recommend only verified component upgrades.
- Display local money from existing HUD text when readable, else manual/unknown (v0.2).

### Component upgrades

The build-time item sync resolves *API-supplied component_items class names* to known, lower-cost shopable items. It never fabricates an upgrade link or price. If a verified component is currently marked owned, the advisor displays the price difference and allows the upgrade while at full inventory because it consumes the component. These are **advisor-only estimates**. Always trust the actual game shop for the final price and whether a purchase is allowed.

Current normal-match inventory uses universal slots, initially nine with three unlockable extras. Source: [Deadlock Wiki](https://deadlock.wiki/Item), [Shop Rework](https://steamdb.info/patchnotes/18393584/).

The four-active-item cap and special modes are **not handled in this version**.

## Offline historical opponent-aware purchase suggestions

The [Deadlock item stats API](https://api.deadlock-api.com/docs) accepts the query group **bucket=enemy_hero** and the own-hero filter **hero_id**. The API returns historical item purchase counts when playing against particular heroes. These counts indicate popularity in a specific matchup, *not* proven counter effectiveness.

This data is downloaded **before launching Deadlock**, only when you explicitly invoke the sync command. The mod never sends HTTP requests during a match.

### Prepare the matchup data

1. Run **npm run sync**. This generates a new hero/item catalog.
2. Find your hero's numeric ID in **generated/catalog.json**.
3. Run, replacing the example IDs with your own: **npm run sync:matchups -- --heroes 15,16**
4. Run **npm run build** or **npm run install-mod**.
5. Inside Deadlock, select an enemy in the mod's roster picker. When a relevant matchup snapshot exists for the current own hero, observed purchase popularity modestly affects ranking.

You can fetch up to eight own heroes per invocation. Subsequent calls may add more. The script verifies item/hero IDs, requires >=100 match samples per item and bounds the snapshot to 60 items per opponent. Rate limits apply. If no sample exists, the adviser shows **статистика противников не загружена** and applies no phantom bonus. The sync step does not ask for an API key and does not include player IDs.

Running **npm run sync** again refreshes the catalog and wipes the optional matchup data. Repeat the optional sync before rebuilding if you want a fresh opponent-aware snapshot.

### Acceptance checklist

On Windows with Node.js 22.2+ and Deadlock installed:

1. Run **npm run check**.
2. Run **npm run sync**.
3. Optionally run **npm run sync:matchups -- --heroes 15** (replace the own hero ID).
4. Run **npm run build** or **npm run install-mod**.
5. In a private test session verify the native HUD panel loads; add/remove enemy heroes; pin purchases; mark owned items, undo, cycle inventory slots; check full-slot and upgrade prices against the actual shop.
6. Confirm the v0.2 souls HUD probe still degrades safely on missing text.
7. After a client patch, rebuild from current game resources; if needed uninstall with **npm run uninstall-mod**.

Tests in CI check JavaScript, mocked Panorama controls and VPK serialization. They **cannot certify that the current game client loads the built mod**.

## Deferred

Automatic enemy/ally detection, validated live purchase tracking, match identifiers, active-item limits, and a verified permission-safe path to free LLM inference. No DLL injection, anti-cheat bypass, game memory access, or automated purchases are used.
