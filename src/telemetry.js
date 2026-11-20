/* Deadlock AI Advisor v0.2.0 — read-only, fail-closed Panorama HUD evidence.
 * Only reads an explicitly named player-currency panel already shown by the game.
 * No hidden player data, memory access, networking or inference of enemy purchases.
 * The module is dependency-free and testable in Node without a game process.
 */
var DAA_TELEMETRY = (function () {
  'use strict';
  var MAX_SOULS = 99999999;
  var MAX_AGE_S = 2.5;
  function valid(panel) {
    try { return !!panel && (!panel.IsValid || panel.IsValid()); }
    catch (e) { return false; }
  }
  function child(parent, id) {
    if (!valid(parent) || typeof parent.FindChildTraverse !== 'function') return null;
    try {
      var result = parent.FindChildTraverse(id);
      return valid(result) ? result : null;
    } catch (e) { return null; }
  }
  function parseSouls(text) {
    if (typeof text === 'number') text = String(text);
    if (typeof text !== 'string') return null;
    var value = text.replace(/^\s+|\s+$/g, '');
    // Permit digits with correctly grouped thousands. Reject localization tokens,
    // suffixes, negative numbers, ranges, HTML, decimals and non-finite values.
    if (!/^(?:[0-9]+|[0-9]{1,3}(?:[ ,.\u00a0\u202f][0-9]{3})+)$/.test(value))
      return null;
    var amount = Number(value.replace(/[ ,.\u00a0\u202f]/g, ''));
    if (!isFinite(amount) || amount < 0 || amount > MAX_SOULS || Math.floor(amount) !== amount)
      return null;
    return amount;
  }
  function probe(root) {
    var container = child(root, 'CurrentGoldAmount');
    // hudCurGoldLabel is also used elsewhere: scope it to CurrentGoldAmount
    // to avoid mistakenly using total item value or death-penalty souls.
    var label = child(container, 'hudCurGoldLabel');
    if (!label) return {value: null, state: 'missing', source: 'HUD/CurrentGoldAmount/hudCurGoldLabel'};
    var text;
    try { text = label.text; }
    catch (e) { return {value:null,state:'unreadable',source:'HUD/CurrentGoldAmount/hudCurGoldLabel'}; }
    var amount = parseSouls(text);
    return {value: amount, state: amount === null ? 'unreadable' : 'observed',
      source: 'HUD/CurrentGoldAmount/hudCurGoldLabel'};
  }
  function createTracker() {
    var pendingValue = null, repeats = 0;
    var acceptedValue = null, acceptedAt = null, lastState = 'missing';
    function observe(root, now) {
      var seconds = Number(now);
      if (!isFinite(seconds) || seconds < 0) seconds = 0;
      var result = probe(root);
      lastState = result.state;
      if (result.value === null) {
        pendingValue = null;
        repeats = 0;
        // Fail closed immediately: old gold must not be used after HUD loss.
        acceptedValue = null;
        acceptedAt = null;
        return current(seconds, result.source);
      }
      if (pendingValue === result.value) repeats++;
      else {pendingValue = result.value; repeats = 1;}
      if (repeats >= 2) {
        acceptedValue = result.value;
        acceptedAt = seconds;
      } else {
        // New value has not yet been corroborated by a second HUD observation.
        acceptedValue = null;
        acceptedAt = null;
      }
      return current(seconds, result.source);
    }
    function current(now, source) {
      var age = acceptedAt === null ? null : Math.max(0, Number(now) - acceptedAt);
      var ok = acceptedValue !== null && age !== null && age <= MAX_AGE_S;
      return {
        value: ok ? acceptedValue : null,
        status: lastState !== 'observed' ? lastState : ok ? 'live' : 'confirming',
        source: source || 'HUD/CurrentGoldAmount/hudCurGoldLabel',
        confidence: ok ? 'confirmed-twice' : 'none',
        ageSeconds: age
      };
    }
    function reset() {
      pendingValue = null; repeats = 0; acceptedValue = null; acceptedAt = null;
      lastState = 'missing';
    }
    return {observe:observe,current:current,reset:reset};
  }
  function diagnostics(root) {
    // Only report the existence of whitelisted UI containers, no player IDs
    // or generic tree scraping: helps investigate later adapters responsibly.
    return {
      soulsContainer: !!child(root, 'CurrentGoldAmount'),
      soulsLabel: !!child(child(root, 'CurrentGoldAmount'), 'hudCurGoldLabel'),
      playerShop: !!child(root, 'CitadelHudHeroShop'),
      abilities: !!child(root, 'AbilitiesContainer'),
      playerHud: !!child(root, 'gameplay_hud_alive'),
      inventorySurface: !!child(root, 'PlayerModsContainer'),
      scoreboardSurface: !!child(root, 'hud_top_bar')
    };
  }
  return {parseSouls:parseSouls,probe:probe,createTracker:createTracker,
    diagnostics:diagnostics,MAX_AGE_S:MAX_AGE_S};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DAA_TELEMETRY;
