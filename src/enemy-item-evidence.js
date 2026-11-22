/* Curated, reviewable v0.5 item-threat hints.
 * Only items that a person manually marked as enemy-owned are considered.
 * This is a conservative heuristic, never inferred just from an unattributed shop feed.
 */
var DAA_ENEMY_EVIDENCE = (function() {
  'use strict';
  // Review each entry on a game patch. Unknown current items produce NO threat guess.
  var HINTS = {
    'healing nova':'healing', 'healing rite':'healing',
    'healing booster':'healing', 'radiant regeneration':'healing',
    'extra regen':'healing', 'leech':'healing', 'bullet lifesteal':'healing',
    'spirit lifesteal':'healing', 'melee lifesteal':'healing',
    'slowing hex':'control', 'knockdown':'control',
    'silence glyph':'control', 'curse':'control',
    'mystic slow':'control',
    'berserker':'bullets', 'swift striker':'bullets',
    'pristine emblem':'bullets', 'rapid rounds':'bullets',
    'boundless spirit':'spirit', 'surge of power':'spirit',
    'escalating exposure':'spirit', 'improved spirit':'spirit'
  };
  function derive(catalog, ids) {
    var byId = {}, seen = {}, threats = {
      healing:false,control:false,bullets:false,spirit:false
    }, signals=[],unknown=0;
    (catalog && Array.isArray(catalog.items) ? catalog.items : []).forEach(function (it) {
      if(it && it.name && isFinite(Number(it.id)) && it.shopable!==false)
        byId[String(it.id)] = it;
    });
    (Array.isArray(ids)?ids:[]).slice(0,12).forEach(function (raw) {
      var id=String(raw);
      if(seen[id]||!byId[id]) return;
      seen[id]=true;
      var item=byId[id], name=DAA_PURCHASES.canonical(item.name);
      if(!Object.prototype.hasOwnProperty.call(HINTS,name)) {unknown++;return;}
      var category=HINTS[name];
      threats[category]=true;
      signals.push({id:id,name:item.name,category:category,
        source:'user-confirmed-enemy-item',confidence:'heuristic'});
    });
    return {threats:threats,signals:signals,unknown:unknown};
  }
  function merge(manual, evidence) {
    var result={};
    ['healing','control','bullets','spirit'].forEach(function(k) {
      result[k] = (manual && manual[k]===true) ||
        !!(evidence && evidence.threats && evidence.threats[k]===true);
    });
    return result;
  }
  return {derive:derive,merge:merge};
})();
if(typeof module!=='undefined'&&module.exports) module.exports=DAA_ENEMY_EVIDENCE;
