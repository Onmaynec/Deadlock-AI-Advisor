# v1.0.0 — Build Blueprints (native Panorama HUD)

**Status: experimental.** v1.0 introduces offline, portable build codes inside the existing game HUD. It does not implement a neural network, read hidden player data, automate a Deadlock purchase, or prove compatibility with the current live game. The code format is versioned as \`DAA1\`.

## Using build codes

Within the existing in-game advisor, select **Код сборки** to expand a native Panorama TextEntry and control row.

1. Configure your character, manual inventory annotations, enemy heroes and their confirmed item annotations, threats, pinned recommendations and strategy.
2. Select **Создать код**. The TextEntry receives a compact, self-contained code. Use **Копировать** if the current Panorama runtime exposes a working clipboard API, or manually select the text and press **Ctrl+C**. The UI does not claim success when the API is missing.
3. Save this code in your own notes or send it to a trusted collaborator. Codes are **not automatically saved across game launches** and do not require an external helper or any website.
4. In a later session, paste the code into the same TextEntry. Press **Проверить код** to validate and preview the hero, owned-item count, enemy count, pinned count and strategy.
5. If the hero in the code differs from the currently selected hero, the preview explicitly warns about it. Press **Применить код** only when you intend to replace the advisory annotations.
6. The input is checked **again** when applying. If you changed the text after preview or the catalog is incompatible, no annotations are applied.

The import switches the enemy-hero roster to **manual**, preserving the chosen opponents from the code instead of immediately overriding them with an experimental read-only HUD probe. The user may return to automatic roster detection manually.

### Fields stored in a blueprint

- Hero ID (or no hero when none is selected)
- Up to 6 known enemy hero IDs
- Up to 12 own annotated item IDs, within the configured 9–12 slot capacity
- Up to 5 pending pinned item IDs
- Up to 12 manually confirmed enemy item IDs
- Manual healing/control/bullets/spirit threat toggles
- Slot capacity and one of the four Strategy Lab profile IDs

All IDs must exist in the **current synced real catalog**. Duplicates, impossible team assignments, unknown or removed items, over-capacity inventories and a pinned item already owned are rejected. The import never fuzzy-matches an outdated item to another similarly named item.

### Data that is NOT serialized

- Current souls, currency probes or game account / Steam IDs
- Match ID, names, chat messages, telemetry, dates, timestamps or screenshots
- Game passwords, user data, external URLs or API tokens
- Game inventory itself; annotations are not actual in-game purchase state

The code reveals your **chosen build and opponents** to anyone you share it with. Share only when comfortable. It is not encrypted.

The \`DAA1\` code has a small rolling check value to catch **accidental copy/paste errors**. It is *not* a cryptographic signature, proof of authenticity or protection against intentionally forged codes. Imported fields are never executed as script: every field is parsed as a bounded integer or a known identifier and validated again against the current catalog.

### Match boundaries

**Новый матч** clears manual inventory, opponents and threats and invalidates an already verified import. It does **not** automatically delete the TextEntry's visible code: you can verify it again to intentionally restore a build. The current souls remain unaffected by import, and the original Strategy Lab profile is overwritten only when the user explicitly applies the blueprint.

## Windows verification

From the cloned project directory, with Deadlock closed and Node.js 22.2+ installed:

~~~powershell
git pull
npm run check
npm run test:build
npm run sync
npm run install-mod
npm run doctor
~~~

Then open a private test session in Deadlock and verify:

- The native panel title displays \`1.0\` and has **Код сборки**.
- Export a build with a selected hero, known item, one or more enemies and a strategy. The generated string begins with \`DAA1:\`.
- Change the current setup, paste the string, **Проверить код**, then **Применить код**. The previous annotated items, strategy and enemies return as intended without changing the actual game shop.
- Change one character of the text; applying must fail rather than partially corrupting the build.
- Test the fallback keyboard copy path if the game has no direct clipboard function.
- Press **Новый матч** after preview and ensure a second validation is required before applying.
- Check that the budget displayed in the HUD does **not** jump when importing or exporting.

All CI mock Panorama tests and VPK round-trip build tests are separate from real in-client acceptance. We cannot claim that every current Deadlock build exposes the exact same TextEntry/clipboard behavior or that Valve has explicitly permitted this kind of mod in competitive matches.

See also docs/STRATEGY_LAB.md and docs/VPK_COMPATIBILITY.md.
