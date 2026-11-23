/* Deadlock AI Advisor v0.4.0 — strict boundary for any future model output.
 * This module NEVER executes or contacts a model. It validates untrusted suggestions
 * against the game's current catalog and the locally calculated legal shortlist.
 */
var DAA_INFERENCE = (function () {
  'use strict';
  function ctx(state) {
    var s = state || {};
    var ids = Array.isArray(s.enemyHeroIds) ? s.enemyHeroIds.map(String).slice(0,6).sort() : [];
    var owned = Array.isArray(s.owned) ? s.owned.map(String).sort() : [];
    var enemyItems = Array.isArray(s.enemyItemIds) ? s.enemyItemIds.map(String).slice(0,12).sort() : [];
    var threats = s.threats || {};
    var flagKeys = ['healing','control','bullets','spirit'];
    var flags = flagKeys.map(function(k){return threats[k] === true ? '1' : '0';}).join('');
    var pins = Array.isArray(s.pinned) ? s.pinned.map(String).slice(0,5) : [];
    return [String(s.heroId == null ? '' : s.heroId), ids.join(','),
      owned.join(','), s.souls == null ? '?' : String(s.souls),
      String(s.slots == null ? 9 : s.slots), flags, pins.join(','),
      String(s.sessionEpoch == null ? 0 : s.sessionEpoch),enemyItems.join(','),
      String(s.strategy == null ? 'balanced' : s.strategy)].join('|');
  }
  function validate(catalog, state, proposal) {
    if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal))
      return {ok:false,reason:'invalid-payload'};
    if (proposal.version !== 1 || proposal.context !== ctx(state))
      return {ok:false,reason:'stale-context'};
    if (!Array.isArray(proposal.item_ids) ||
        !proposal.item_ids.length || proposal.item_ids.length > 6)
      return {ok:false,reason:'invalid-item-list'};
    var candidates = DAA.recommend(catalog,state,12);
    var legal = {}, seen = {}, out = [];
    candidates.forEach(function (c) {legal[c.id] = c;});
    for (var i=0; i<proposal.item_ids.length; i++) {
      var raw = proposal.item_ids[i];
      if (typeof raw !== 'string' && typeof raw !== 'number')
        return {ok:false,reason:'invalid-id'};
      var id = String(raw);
      if (!/^[0-9]{1,15}$/.test(id) || seen[id] || !legal[id])
        return {ok:false,reason:'unknown-or-illegal-item'};
      if (legal[id].affordable !== true)
        return {ok:false,reason:'affordability-unconfirmed'};
      seen[id] = true;
      // Never take name, cost, affordability or reason from the model.
      out.push(legal[id]);
    }
    return {ok:true,items:out,source:'untrusted-model-output-validated-locally'};
  }
  function fallback(catalog,state,reason,preparedPlan) {
    return {ok:false,source:'offline-statistics-and-rules',
      reason:String(reason||'model-unavailable'),
      items:preparedPlan && Array.isArray(preparedPlan.items) ? preparedPlan.items :
        DAA.plan(catalog,state,6).items};
  }
  return {contextSignature:ctx,validate:validate,fallback:fallback};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DAA_INFERENCE;
