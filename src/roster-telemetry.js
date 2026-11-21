/* Deadlock AI Advisor v0.4.0 — read-only enemy roster from VISIBLE Panorama top bar.
 * All reads are restricted to TopBar > TeamEnemy and its HeroName labels.
 * No game memory, account identifiers, event injection or hidden state.
 * This does NOT claim to work in the current game until tested in a real client.
 */
var DAA_ROSTER = (function () {
  'use strict';
  var SOURCE = 'HUD/TopBar/TeamsContainer/TeamEnemy/HeroName';
  var TTL = 3.0;
  function valid(p) {
    try { return !!p && (!p.IsValid || p.IsValid()); } catch (e) { return false; }
  }
  function child(p, id) {
    if (!valid(p) || typeof p.FindChildTraverse !== 'function') return null;
    try {
      var c = p.FindChildTraverse(id);
      return valid(c) ? c : null;
    } catch (e) { return null; }
  }
  function norm(value) {
    return String(value === undefined || value === null ? '' : value)
      .toLowerCase().replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
  }
  function heroIndex(heroes) {
    var index = {};
    if (!Array.isArray(heroes)) return index;
    heroes.forEach(function (hero) {
      if (!hero || !hero.name || !isFinite(Number(hero.id))) return;
      var k = norm(hero.name);
      if (!k) return;
      // A duplicate localized display name is ambiguous: reject it.
      if (index[k] !== undefined) index[k] = '';
      else index[k] = String(hero.id);
    });
    return index;
  }
  function collectHeroLabels(team) {
    if (!valid(team)) return [];
    try {
      if (typeof team.FindChildrenWithClassTraverse === 'function') {
        var list = team.FindChildrenWithClassTraverse('HeroName');
        if (Array.isArray(list)) return list.slice(0, 7);
      }
    } catch (e) {}
    // On stripped mock panels / engine variants, bounded tree walk.
    var out = [], queue = [{panel:team,depth:0}], seen = 0;
    while (queue.length && seen < 220 && out.length < 7) {
      var cur = queue.shift(), panel = cur.panel;
      seen++;
      if (!valid(panel)) continue;
      try {
        if (panel.BHasClass && panel.BHasClass('HeroName')) out.push(panel);
      } catch (e) {}
      if (cur.depth >= 10) continue;
      var kids = [];
      try {
        if (typeof panel.Children === 'function') kids = panel.Children() || [];
      } catch (e) {}
      for (var i = 0; i < kids.length && i < 24; i++)
        queue.push({panel:kids[i],depth:cur.depth+1});
    }
    return out;
  }
  function probe(root, heroes) {
    var top = child(root, 'TopBar');
    var team = child(child(top, 'TeamsContainer'), 'TeamEnemy');
    if (!team) return {ids:null,status:'missing',source:SOURCE};
    var labels = collectHeroLabels(team);
    if (!labels.length || labels.length > 6)
      return {ids:null,status:'missing',source:SOURCE};
    var index = heroIndex(heroes), ids = [], known = {};
    for (var i = 0; i < labels.length; i++) {
      var value = '';
      try { value = norm(labels[i].text); } catch (e) {}
      var id = index[value];
      // Reject unresolved templates, empty text, duplicates, unknown names.
      if (!id || known[id]) return {ids:null,status:'unmapped',source:SOURCE};
      known[id] = true;
      ids.push(id);
    }
    if (!ids.length) return {ids:null,status:'missing',source:SOURCE};
    // Preserve team order for UI, but use order-independent signature.
    return {ids:ids,status:'observed',source:SOURCE};
  }
  function createTracker(heroes) {
    var pending = '', repeats = 0, last = null, acceptedAt = null;
    var status = 'missing';
    function current(now) {
      var seconds = Number(now);
      if (!isFinite(seconds) || seconds < 0) seconds = 0;
      var age = acceptedAt === null ? null : Math.max(0,seconds-acceptedAt);
      var ok = !!last && age !== null && age <= TTL;
      return {ids:ok ? last.slice() : null,
        status:status !== 'observed' ? status : ok ? 'live' : 'confirming',
        source:SOURCE,confidence:ok ? 'confirmed-twice' : 'none',ageSeconds:age};
    }
    function observe(root, now) {
      var result = probe(root, heroes);
      status = result.status;
      if (!result.ids) {pending='';repeats=0;last=null;acceptedAt=null;return current(now);}
      var signature = result.ids.slice().sort().join(',');
      if (signature === pending) repeats++;
      else {pending=signature;repeats=1;}
      if (repeats >= 2) {
        last = result.ids.slice();
        acceptedAt = Number(now);
      } else {last=null;acceptedAt=null;}
      return current(now);
    }
    function reset() {pending='';repeats=0;last=null;acceptedAt=null;status='missing';}
    return {observe:observe,current:current,reset:reset};
  }
  return {probe:probe,createTracker:createTracker,heroIndex:heroIndex,source:SOURCE};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DAA_ROSTER;
