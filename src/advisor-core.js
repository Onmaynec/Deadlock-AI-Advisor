/* Deadlock AI Advisor — no dependencies, ES5-compatible core for Panorama.
 * Identical code runs in Node's unit tests and inside the compiled game HUD.
 * v0.2 uses an explainable rules engine; no LLM is claimed or silently simulated.
 */
var DAA = (function () {
  'use strict';
  var THREATS = ['healing', 'control', 'bullets', 'spirit'];
  // Curated counter hints are suggestions, not guaranteed effects or patch-proof facts.
  // Names are matched only against real, shopable item records from the current API snapshot.
  var COUNTERS = {
    'healbane': {healing: 13},
    'toxic bullets': {healing: 10},
    'decay': {healing: 10},
    'debuff remover': {control: 14},
    'debuff reducer': {control: 10},
    'reactive barrier': {control: 8},
    'metal skin': {bullets: 13},
    'return fire': {bullets: 9},
    'bullet armor': {bullets: 10},
    'improved bullet armor': {bullets: 13},
    'spirit armor': {spirit: 10},
    'improved spirit armor': {spirit: 13},
    'enchanters barrier': {spirit: 9}
  };
  function key(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function money(n) {
    n = Number(n);
    return isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  function normalise(raw) {
    var items = [];
    if (!raw || !Array.isArray(raw.items)) return items;
    raw.items.forEach(function (it) {
      if (!it || !isFinite(Number(it.id)) || !it.name) return;
      var category = key(it.slot);
      var cost = money(it.cost);
      if (['weapon', 'vitality', 'spirit'].indexOf(category) < 0 || cost === 0 || it.shopable === false) return;
      items.push({id: String(it.id), name: String(it.name), cost: cost, slot: category});
    });
    return items;
  }
  function recommend(catalog, snapshot, limit) {
    var items = normalise(catalog);
    var state = snapshot || {};
    // Unknown budget must NEVER be interpreted as zero or "can buy".
    var knownBudget = state.souls !== null && state.souls !== undefined &&
      state.souls !== '' && isFinite(Number(state.souls)) && Number(state.souls) >= 0;
    var available = knownBudget ? money(state.souls) : null;
    var owned = {};
    (state.owned || []).forEach(function (id) { owned[String(id)] = true; });
    var threats = state.threats || {};
    var ownedSlots = {weapon: 0, spirit: 0, vitality: 0};
    var heroId = String(state.heroId == null ? '' : state.heroId);
    var heroStats = (catalog && catalog.heroStats && catalog.heroStats[heroId]) || {};
    var heroMax = 0;
    Object.keys(heroStats).forEach(function (id) {
      heroMax = Math.max(heroMax, Number(heroStats[id]) || 0);
    });
    items.forEach(function (it) { if (owned[it.id]) ownedSlots[it.slot]++; });
    var scored = [];
    items.forEach(function (it) {
      if (owned[it.id]) return;
      var canBuy = knownBudget ? it.cost <= available : null;
      var why = [];
      var strength = 0;
      var counters = COUNTERS[key(it.name)] || {};
      THREATS.forEach(function (threat) {
        if (threats[threat] && counters[threat]) {
          strength += counters[threat];
          why.push({
            healing: 'Может помочь против восстановления здоровья',
            control: 'Стоит рассмотреть против контроля',
            bullets: 'Стоит рассмотреть против оружейного урона',
            spirit: 'Стоит рассмотреть против урона способностей'
          }[threat]);
        }
      });
      // The engine intentionally prefers plausible prices for the player's budget,
      // but avoids claiming a statistically optimal build without match data.
      var ratio = knownBudget && available ? it.cost / available : 0;
      var budgetScore = canBuy === null ? 0 : canBuy ? (ratio <= 1 && ratio >= 0.35 ? 2 : 0) : -5;
      var diversity = Math.max(0, 3 - ownedSlots[it.slot]) * 0.4;
      var score = strength + budgetScore + diversity + Math.min(it.cost / 10000, 0.8);
      var sample = Number(heroStats[it.id]) || 0;
      if (sample >= 100 && heroMax > 0) {
        // Popularity within a hero's purchase dataset; observational, not causal win-rate.
        score += 2 + 4 * Math.sqrt(sample / heroMax);
        why.push('Встречается в матчах за выбранного героя (' + sample + ' покупок в выборке)');
      }
      if (!why.length) why.push('Базовый кандидат; требуется проверка синергии с героем');
      if (canBuy === null) why.push('Баланс неизвестен: доступность покупки не подтверждена');
      else if (!canBuy) why.push('Недостаёт ' + (it.cost - available) + ' душ');
      scored.push({id: it.id, name: it.name, cost: it.cost, slot: it.slot,
        score: Math.round(score * 100) / 100, affordable: canBuy,
        reason: why.join('. ')});
    });
    scored.sort(function (a, b) {
      return b.score - a.score || Number(b.affordable === true) - Number(a.affordable === true) ||
        a.cost - b.cost || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    });
    return scored.slice(0, Math.max(0, Math.min(12, money(limit == null ? 5 : limit))));
  }
  return {recommend: recommend, normalise: normalise, key: key, money: money, threats: THREATS};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DAA;
