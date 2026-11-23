# v0.9.0 — Strategy Lab & Transparent Build Comparison

**Status: experimental source release.** Strategy Lab is a deterministic, entirely offline feature inside the existing Deadlock Panorama HUD. It does **not** use a generative model, predict game wins, execute purchases, contact an external API during a match or access hidden game data.

## Using Strategy Lab in-game

Open the advisor in the Deadlock HUD using the shop or configured shortcut. In the new **СТРАТЕГИЯ БИЛДА · ОФЛАЙН** section:

1. Press **Профиль: ...** to cycle through **Баланс**, **Выживание**, **Натиск**, and **Экономия**.
2. Press **Сравнить стратегии** to see all four interpretations of the **same** current hero, known balance, marked inventory and enemy threat snapshot. Each row shows the first confirmed affordable item when possible; otherwise the highest-ranked candidate with a truthful warning about affordability.
3. Press **Выбрать [профиль]** inside a comparison row to switch directly.
4. Press **План на эти души**: the three-step purchase simulation now uses the *selected profile* at **every step**, instead of always falling back to the balanced ranking. Costs, owned components, inventory capacity and remaining souls are still verified by the existing offline rules.

### What the profiles actually do

| Profile | Additional deterministic preference | What it does **not** claim |
|---|---|---|
| Баланс | Original item ordering using known threats, owned upgrades, affordability and available offline historical purchase counts | No evidence that it is a statistically optimal build |
| Выживание | +9 score to items classified in the current catalog as \`vitality\` | No guaranteed survivability, damage reduction or win-rate increase |
| Натиск | +9 to \`weapon\`, +5 to \`spirit\` items | No damage simulation, build synergy proof or counter certainty |
| Экономия | Bounded 0..9 bonus favoring smaller current item prices | Does not predict farming income or calculate true long-term value |

The original candidate list is always obtained from \`DAA.recommend()\`. Strategy modifiers cannot turn an item with a missing catalog ID or a full-inventory restriction into a valid candidate. They also **cannot** change an item's real catalog cost, verified component discount, or known/unknown affordability. Player-pinned purchase priorities remain the strongest preference.

### How to interpret a recommendation

A recommendation displays the original reasons from the offline rules plus a short reason for any profile-specific bonus. The HUD also displays the source of its conclusions:

- Whether the current hero is present in the synced catalog.
- How many manually selected or read-only observed enemy heroes have a precomputed historical matchup snapshot.
- Whether a budget is known; an unknown budget cannot be treated as zero.
- Warnings for missing historical hero samples or unsupported opponent matchups.

These are **evidence availability indicators**, not AI confidence percentages and not victory probabilities.

**Profile preference persists when the user presses Новый матч.** All manually recorded own/enemy items, threat toggles and the other per-match annotations still reset; the selected viewing preference does not have to be reselected.

### Safeguard for future AI integrations

The v0.4 output firewall now includes the selected strategy profile in the context signature. A future LLM response generated for a different profile is stale and cannot be applied without validation. **No LLM is connected in v0.9.**

## Validation

On Windows, with the newest Deadlock installation and Node 22.2+:

~~~powershell
git pull
npm run check
npm run test:build
npm run sync
npm run install-mod
npm run doctor
~~~

Then test in a **private** Deadlock match:

1. Open the native advisor and verify the title shows \`0.9\`.
2. Set a known budget, note your hero and mark an owned item.
3. Cycle profiles and verify shortlist prices and affordability **never** change solely from changing profiles; only ranks and explanatory notes should change.
4. Open **Сравнить стратегии** and test direct selection of another profile.
5. With **План на эти души** open, change profile and verify the route recalculates using only current funds and known components, without buying anything.
6. Turn on enemy threat checkboxes, mark a known purchased item, and ensure the original rule reasons remain visible.
7. Press **Новый матч**: check that manually recorded items reset while the selected strategy remains.
8. Inspect Panorama console and \`npm run doctor -- --json\` if anything fails.

All Node tests, mocked Panorama runs and fixture VPK build tests are **not substitutes for actually launching the game**. The project still does not provide verified automatic inventory ID reading, attributed enemy purchases, an attached neural inference endpoint, or evidence that Valve permits every kind of competitive advice HUD.

See docs/INVENTORY_HUD_HEALTH.md and docs/VPK_COMPATIBILITY.md for known compatibility limitations.
