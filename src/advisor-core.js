/* Deadlock AI Advisor — no dependencies, ES5-compatible core for Panorama.
 * Identical code runs in Node's unit tests and inside the compiled game HUD.
 * v0.6 uses a deterministic, matchup-aware rules engine; no LLM is claimed or silently simulated.
 */
var DAA = (function () {
  'use strict';
  var THREATS = ['healing', 'control', 'bullets', 'spirit'];
  // Curated counter hints are suggestions, not guaranteed effects or patch-proof facts.
  // Names are matched only against real, shopable item records from the current API snapshot.
  var COUNTERS = {
    'healbane': {healing: 13},
    'inhibitor': {healing: 9},
    'toxic bullets': {healing: 10},
    'decay': {healing: 10},
    'debuff remover': {control: 14},
    'dispel magic': {control: 13},
    'counterspell': {control: 9},
    'debuff reducer': {control: 10},
    'reactive barrier': {control: 8},
    'metal skin': {bullets: 13},
    'return fire': {bullets: 9},
    'bullet armor': {bullets: 10},
    'bullet resilience': {bullets: 11},
    'plated armor': {bullets: 12},
    'improved bullet armor': {bullets: 13},
    'spirit armor': {spirit: 10},
    'spirit resilience': {spirit: 12},
    'spirit shielding': {spirit: 9},
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
      items.push({id: String(it.id), name: String(it.name), cost: cost, slot: category,
        components: Array.isArray(it.components) ? it.components.map(function (x) {return String(x);}) : []});
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
    var owned = {}, catalogById = {};
    items.forEach(function(it){catalogById[it.id] = it;});
    (state.owned || []).forEach(function (id) { if (catalogById[String(id)]) owned[String(id)] = true; });
    var pinned = {};
    (state.pinned || []).forEach(function(id, index) {
      if (catalogById[String(id)] && pinned[String(id)] === undefined)
        pinned[String(id)] = index;
    });
    var slotLimit = state.slots === undefined || state.slots === null ? null :
      Math.max(9, Math.min(12, money(state.slots)));
    var usedSlots = Object.keys(owned).length;
    var enemies = Array.isArray(state.enemyHeroIds) ? state.enemyHeroIds.slice(0,6) : [];
    var matchupMap = (catalog && catalog.heroMatchups && catalog.heroMatchups[String(state.heroId)]) || {};
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
      var ownedComponent = null;
      // Only an explicitly mapped item component may be credited. No guessed upgrades.
      it.components.forEach(function(id) {
        if (!owned[id]) return;
        var component = catalogById[id];
        if (component && (!ownedComponent || component.cost > ownedComponent.cost) &&
            component.cost < it.cost) ownedComponent = component;
      });
      var effectiveCost = ownedComponent ? it.cost - ownedComponent.cost : it.cost;
      var fullInventory = slotLimit !== null && usedSlots >= slotLimit && !ownedComponent;
      if (fullInventory) return;
      var canBuy = knownBudget ? effectiveCost <= available : null;
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
      var ratio = knownBudget && available ? effectiveCost / available : 0;
      var budgetScore = canBuy === null ? 0 : canBuy ? (ratio <= 1 && ratio >= 0.35 ? 2 : 0) : -5;
      var diversity = Math.max(0, 3 - ownedSlots[it.slot]) * 0.4;
      var score = strength + budgetScore + diversity + Math.min(effectiveCost / 10000, 0.8);
      if (ownedComponent) {
        score += 1.5;
        why.push('Улучшение ' + ownedComponent.name + ': зачтена стоимость компонента');
      }
      // Historical, non-causal matchup purchase frequencies, optional offline snapshot.
      var matchedEnemies = 0;
      enemies.forEach(function(eid) {
        var group = matchupMap[String(eid)] || {};
        var matches = Number(group[it.id]) || 0;
        if (matches < 100) return;
        var peak = 0;
        Object.keys(group).forEach(function(k) { peak = Math.max(peak, Number(group[k]) || 0); });
        if (peak <= 0) return;
        matchedEnemies++;
        score += Math.min(1.4, 0.6 + 0.8 * Math.sqrt(matches / peak));
      });
      if (matchedEnemies) why.push('Исторические покупки против выбранных врагов (' +
        matchedEnemies + ' совпад.): не гарантия контрпика');
      if (pinned[it.id] !== undefined) {
        score += 100 - pinned[it.id] * 2;
        why.push('Закреплено пользователем в плане');
      }
      var sample = Number(heroStats[it.id]) || 0;
      if (sample >= 100 && heroMax > 0) {
        // Popularity within a hero's purchase dataset; observational, not causal win-rate.
        score += 2 + 4 * Math.sqrt(sample / heroMax);
        why.push('Встречается в матчах за выбранного героя (' + sample + ' покупок в выборке)');
      }
      if (!why.length) why.push('Базовый кандидат; требуется проверка синергии с героем');
      if (canBuy === null) why.push('Баланс неизвестен: доступность покупки не подтверждена');
      else if (!canBuy) why.push('Недостаёт ' + (effectiveCost - available) + ' душ');
      scored.push({id: it.id, name: it.name, cost: effectiveCost, fullCost: it.cost,
        slot: it.slot, componentId: ownedComponent ? ownedComponent.id : null,
        pinned: pinned[it.id] !== undefined,
        score: Math.round(score * 100) / 100, affordable: canBuy,
        reason: why.join('. ')});
    });
    scored.sort(function (a, b) {
      return b.score - a.score || Number(b.affordable === true) - Number(a.affordable === true) ||
        a.cost - b.cost || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    });
    return scored.slice(0, Math.max(0, Math.min(80, money(limit == null ? 5 : limit))));
  }
  function plan(catalog, snapshot, count) {
    var state = snapshot || {};
    var available = state.souls === null || state.souls === undefined ||
      state.souls === '' || typeof state.souls === 'boolean' ||
      !isFinite(Number(state.souls)) || Number(state.souls) < 0 ?
      null : money(state.souls);
    var known = {}, seen = {}, owned = [];
    normalise(catalog).forEach(function(it) {known[it.id] = true;});
    (Array.isArray(state.owned) ? state.owned : []).forEach(function(x) {
      var id=String(x);
      if(known[id] && !seen[id]) {owned.push(id);seen[id]=true;}
    });
    var slots = Math.max(9, Math.min(12, money(state.slots == null ? 9 : state.slots)));
    var rows = recommend(catalog, state, count == null ? 6 : count);
    return {
      items: rows, usedSlots: owned.length, slotLimit: slots,
      freeSlots: Math.max(0,slots-owned.length), available: available,
      hasMatchupData: !!(catalog && catalog.heroMatchups &&
        catalog.heroMatchups[String(state.heroId)] && Array.isArray(state.enemyHeroIds) &&
        state.enemyHeroIds.some(function(eid) {
          var group = catalog.heroMatchups[String(state.heroId)][String(eid)];
          return !!group && Object.keys(group).length > 0;
        }))
    };
  }
  return {recommend: recommend, plan:plan, normalise: normalise, key: key, money: money, threats: THREATS};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DAA;
