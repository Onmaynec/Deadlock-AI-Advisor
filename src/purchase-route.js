/* Deadlock AI Advisor v0.6.0 — conservative offline purchase route.
 * Never creates souls or claims future income. Purchases are SIMULATED,
 * NOT executed in the game; discount/slot effects rely on current catalog.
 * Standalone ES5-compatible module; DAA is supplied by the Panorama bundle.
 */
var DAA_ROUTE = (function () {
  'use strict';
  var MAX_BALANCE = 99999999;
  function budget(s) {
    if (!s || s.souls === null || s.souls === undefined || s.souls === '' ||
      typeof s.souls === 'boolean' || !isFinite(Number(s.souls)) ||
      Number(s.souls) < 0 || Number(s.souls) > MAX_BALANCE) return null;
    return Math.floor(Number(s.souls));
  }
  function itemSet(catalog, ids) {
    var known = {}, result = [], seen = {};
    (DAA.normalise(catalog) || []).forEach(function (it) { known[it.id] = true; });
    (Array.isArray(ids) ? ids : []).forEach(function (id) {
      id = String(id);
      if (known[id] && !seen[id]) {result.push(id);seen[id] = true;}
    });
    return result;
  }
  function withOwned(state, owned, balance) {
    var result = {}, key;
    for (key in state) if (Object.prototype.hasOwnProperty.call(state, key))
      result[key] = state[key];
    result.owned = owned.slice();
    result.souls = balance;
    result.pinned = (Array.isArray(state.pinned) ? state.pinned : []).filter(function (id) {
      return owned.indexOf(String(id)) < 0;
    });
    return result;
  }
  function savingTarget(rows, balance) {
    var item = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].affordable === false && rows[i].cost > balance) {
        item = rows[i];break;
      }
    }
    if (!item) return null;
    return {id:item.id,name:item.name,required:item.cost,shortfall:item.cost - balance,
      pinned:!!item.pinned,reason:item.reason};
  }
  function edgeScore(item, stepIndex) {
    // Bounded preference so a single pinned item never overwhelms the total.
    var utility = Math.max(0, Math.min(28, Number(item.score) || 0));
    var discount = stepIndex === 0 ? 1 : stepIndex === 1 ? 0.63 : 0.39;
    return utility * discount + (item.componentId ? 0.35 : 0);
  }
  function run(catalog, input, count) {
    var state = input || {};
    var souls = budget(state);
    var owned = itemSet(catalog, state.owned);
    var cap = Math.max(9, Math.min(12, DAA.money(state.slots == null ? 9 : state.slots)));
    var result = {status:souls === null ? 'unknown-budget' : 'ready',source:'local-rules',
      balance:souls, steps:[],spent:0,remaining:souls,
      slotLimit:cap,ownedCount:owned.length,saveFor:null,explored:0};
    if (souls === null) return result;

    var all = DAA.recommend(catalog, withOwned(state, owned, souls), 80);
    result.saveFor = savingTarget(all, souls);
    var maxSteps = Math.min(3, Math.max(1, DAA.money(count == null ? 3 : count)));
    var beam = [{owned:owned, money:souls,steps:[],reward:0,spent:0}];
    var best = beam[0], i,j,k;
    for (i=0;i<maxSteps;i++) {
      var next = [];
      for(j=0;j<beam.length;j++) {
        var node = beam[j];
        var options = DAA.recommend(catalog, withOwned(state,node.owned,node.money),80);
        // Keep top affordable candidates; no predictions about future soul gains.
        var used=0;
        for(k=0;k<options.length && used<7;k++) {
          var pick=options[k];
          if(pick.affordable !== true || pick.cost>node.money) continue;
          if(node.owned.indexOf(pick.id)>=0) continue;
          var newOwned = node.owned.filter(function(id){return id!==pick.componentId;});
          if(newOwned.indexOf(pick.id)>=0) continue;
          newOwned.push(pick.id);
          if(newOwned.length>cap) continue;
          var remaining = node.money - pick.cost;
          var routeStep = {id:pick.id,name:pick.name,cost:pick.cost,
            fullCost:pick.fullCost,componentId:pick.componentId,
            remaining:remaining,reason:pick.reason,pinned:pick.pinned};
          next.push({owned:newOwned,money:remaining,
            spent:node.spent+pick.cost,steps:node.steps.concat([routeStep]),
            reward:node.reward+edgeScore(pick,i)});
          used++;
        }
      }
      if(!next.length) break;
      next.sort(function(a,b) {
        var diff = b.reward-a.reward;
        if (diff) return diff;
        diff = a.spent-b.spent;
        if(diff) return diff;
        var aa=a.steps.map(function(x){return x.id;}).join(','),
          bb=b.steps.map(function(x){return x.id;}).join(',');
        return aa<bb?-1:aa>bb?1:0;
      });
      // Different purchase orders can lead to the same inventory; don't waste beam width.
      var unique={}, pruned=[];
      for(j=0;j<next.length && pruned.length<12;j++) {
        var signature=next[j].money+'|'+next[j].owned.slice().sort().join(',');
        if(unique[signature]) continue;
        unique[signature]=true;
        pruned.push(next[j]);
      }
      beam=pruned;
      result.explored += next.length;
      if(beam[0].reward>best.reward) best=beam[0];
    }
    result.steps=best.steps;
    result.spent=best.spent;
    result.remaining=best.money;
    return result;
  }
  return {run:run,budget:budget};
})();
if (typeof module!=='undefined' && module.exports) module.exports = DAA_ROUTE;
