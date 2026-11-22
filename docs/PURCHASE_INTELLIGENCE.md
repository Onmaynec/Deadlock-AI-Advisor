# Deadlock AI Advisor v0.5 — Purchase Intelligence

**Experimental source.** v0.5 adds read-only shop purchase *observations*, a manual enemy item list, and conservative counter hypotheses inside the game's Panorama HUD. It is NOT a tested playable VPK yet, and DOES NOT automatically know who bought any given item.

## Evidence from current stock Deadlock files

Valve's panorama/layout/citadel_hud_hero_shop.xml includes:

- CitadelHudHeroShop → RecentPurchasesPanel → RecentPurchasesContainer
- snippet RecentPurchase, containing classes recentPurchase, recentModPurchaseName, recentTimePurchased, and a hero image

See: https://github.com/SteamTracking/GameTracking-Deadlock/blob/master/game/citadel/pak01_dir/panorama/layout/citadel_hud_hero_shop.xml

**Critical:** the stock snippet does **not** expose an unambiguous player ID, local/enemy team flag or item acquisition event. The mod does not assume the purchaser is an opponent, or that a name is an equipped item. No memory reading, DLL injection or anti-cheat workaround is used.

## User interaction in the native in-game HUD

- Open the usual advisor through the game shop or its hotkey (backslash by default).
- Press **Последние покупки** to view recently observed shop labels. The panel says **БЕЗ определения покупателя**.
- If you personally know a purchase belongs to an enemy, press **Подтвердить у врага**. Otherwise leave it unmarked.
- If the feed isn't populated or a name isn't recognized, press **Найти предмет**, enter at least two letters from the item name and select **Отметить у врага: ...**. This also requires user confirmation.
- Enemy items are listed separately and can each be **Убрать**. Maximum 12 manual marks per match.
- The curated threat metadata includes common healing, control, bullet and spirit-oriented items. **These are hypotheses, not proven matchups**. Only verified real item IDs that the player manually marked contribute; unknown items do nothing. Original manual threat toggles continue to work.
- **Новый матч** and observed local hero changes reset these annotations.

### Localization

During npm run sync, the tool first fetches English hero/item metadata, then optionally fetches Russian metadata and maps translations to those **same IDs**. Only names returned for known items/heroes are recognized; transliteration and fuzzy matching are disallowed. If the Russian API request fails, the English catalog still builds. Colliding localized aliases are rejected as ambiguous. This makes Russian UI usable when translations are available but does not guarantee full translation coverage.

## What is and is not automatic

| Signal | Status | Reliability |
|---|---|---|
| Own visible currency | Experimental read-only HUD adapter (v0.2) | Not validated in real game |
| Enemy hero names | Experimental read-only top-bar adapter (v0.4) | Not validated in real game |
| Recently visible item names/times | New scoped shop adapter (v0.5) | No player/team ownership; not validated in real game |
| Enemy-owned purchases | User confirmation or item search ONLY | Manual assertion |
| Threat categories from confirmed items | Short curated name→category table | Heuristic only |
| Own inventory and enemy purchases attributed by player | Not available | No unverified guessing |
| Real LLM inference | Not connected | Offline rules and statistics still used |

No external site, local helper process, API key, paid LLM or additional user-facing window is introduced.

## Validation (Windows)

1. Clone or pull current main, make sure Node.js 22.2+ is installed.
2. Run **npm run check**, **npm run sync**, **npm run install-mod**.
3. Open a **private test game**. Open advisor; verify title says 0.5.
4. Open the in-game shop and inspect the **Последние покупки** section. If rows are missing or unreadable, it must say so rather than invent a recent purchase.
5. Check that a row is never marked enemy-owned without pressing **Подтвердить у врага**.
6. Confirm an enemy-owned healing/control item and inspect the signal/status; verify suggestions recalculate. Remove the item and verify evidence disappears.
7. Test **Найти предмет** with English and Russian client localization (when aliases are present in catalog).
8. Change match/hero and verify all selected enemy items are reset.
9. Check compatibility with other HUD mods and capture redacted Panorama errors. Use **npm run uninstall-mod** to roll back.

The CI mocks Panorama and VPK serialization; it **cannot replace the current Deadlock client**. The next milestone must be actual installed-game testing and verification of allowed data access.
