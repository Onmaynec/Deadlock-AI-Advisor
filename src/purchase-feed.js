/* Deadlock AI Advisor v0.5.0 — visible, unattributed recent purchase feed.
 * Source: vanilla shop's RecentPurchasesContainer / RecentPurchase snippet.
 * A shop purchase row does not establish which team/player bought an item.
 * This module NEVER attributes purchases or modifies the user's inventory.
 */
var DAA_PURCHASES = (function () {
  'use strict';
  var SOURCE = 'HUD/CitadelHudHeroShop/RecentPurchasesContainer';
  var MAX_ROWS = 10, MAX_AGE = 3.0;
  function valid(p) {
    try {return !!p && (!p.IsValid || p.IsValid());} catch (e) {return false;}
  }
  function child(p, id) {
    if (!valid(p) || !p.FindChildTraverse) return null;
    try {var v = p.FindChildTraverse(id);return valid(v) ? v : null;}
    catch(e) {return null;}
  }
  function canonical(s) {
    // English source catalog only. Do not transliterate, fuzzy-match or invent item IDs.
    return String(s == null ? '' : s).toLowerCase().replace(/^\s+|\s+$/g,'')
      .replace(/\s+/g,' ');
  }
  function catalogIndex(catalog) {
    var index = {};
    (catalog && Array.isArray(catalog.items) ? catalog.items : []).forEach(function(it) {
      if (!it || !it.name || !isFinite(Number(it.id)) || it.shopable === false) return;
      var names=[it.name].concat(Array.isArray(it.aliases)?it.aliases:[]);
      names.forEach(function(name){
        var k=canonical(name), id=String(it.id);
        if(!k) return;
        if(index[k]===undefined) index[k]=id;
        else if(index[k]!==id) index[k]=null; // ambiguous across IDs
      });
    });
    return index;
  }
  function rows(p) {
    if (!valid(p)) return [];
    try {
      if (typeof p.FindChildrenWithClassTraverse === 'function') {
        var found = p.FindChildrenWithClassTraverse('recentPurchase');
        if (Array.isArray(found)) return found.slice(0,MAX_ROWS);
      }
    } catch(e) {}
    var result=[], queue=[{panel:p,depth:0}], seen=0;
    while (queue.length && result.length<MAX_ROWS && seen++<160) {
      var cur=queue.shift(), x=cur.panel;
      if(!valid(x)) continue;
      try {if(x.BHasClass && x.BHasClass('recentPurchase')) {
        result.push(x);
        continue;
      }} catch(e) {}
      if(cur.depth>=8) continue;
      var kids=[];
      try {kids=x.Children ? x.Children() : [];} catch(e) {}
      for(var j=0;j<kids.length&&j<20;j++)
        queue.push({panel:kids[j],depth:cur.depth+1});
    }
    return result;
  }
  function label(row, cls) {
    if(!valid(row)) return null;
    try {
      if(row.FindChildrenWithClassTraverse) {
        var match=row.FindChildrenWithClassTraverse(cls);
        if(match && match.length) return valid(match[0]) ? match[0] : null;
      }
    }catch(e){}
    var all=[],queue=[row],count=0;
    while(queue.length && count++<40) {
      var p=queue.shift();
      if(!valid(p)) continue;
      try {if(p.BHasClass && p.BHasClass(cls)) all.push(p);}catch(e){}
      try {if(p.Children) queue=queue.concat((p.Children()||[]).slice(0,14));}catch(e){}
    }
    return all[0] || null;
  }
  function readText(p) {
    if(!valid(p)) return '';
    try {return typeof p.text==='string'?p.text.trim().slice(0,100):'';}
    catch(e){return '';}
  }
  function probe(root,catalog) {
    var shop=child(root,'CitadelHudHeroShop');
    var list=child(shop,'RecentPurchasesContainer');
    if(!list) return {entries:null,status:'missing',source:SOURCE};
    var r=rows(list);
    if(!r.length) return {entries:[],status:'empty',source:SOURCE};
    var index=catalogIndex(catalog),entries=[];
    for(var i=0;i<r.length;i++) {
      var name=readText(label(r[i],'recentModPurchaseName'));
      var time=readText(label(r[i],'recentTimePurchased'));
      if(!name || /^\{[^}]+\}$/.test(name) || name[0]==='#')
        return {entries:null,status:'unreliable',source:SOURCE};
      var id=index[canonical(name)] || null;
      entries.push({id:id,name:name.slice(0,75),time:time.slice(0,32),
        attributed:false});
    }
    return {entries:entries,status:'observed',source:SOURCE};
  }
  function createTracker(catalog) {
    var pending=null, count=0, accepted=null,at=null,status='missing';
    function current(now) {
      var s=Number(now);
      if(!isFinite(s)||s<0) s=0;
      var age=at===null?null:Math.max(0,s-at);
      var live=accepted!==null&&age!==null&&age<=MAX_AGE;
      return {entries:live?accepted.map(function(x){return {
        id:x.id,name:x.name,time:x.time,attributed:false
      };}):null,
        status:status==='observed' ? (live?'live':'confirming'):status,
        ageSeconds:age,source:SOURCE,confidence:live?'confirmed-twice':'none'};
    }
    function observe(root,now) {
      var sample=probe(root,catalog);
      status=sample.status;
      if(sample.status!=='observed') {
        pending=null;count=0;accepted=null;at=null;return current(now);
      }
      var signature=JSON.stringify(sample.entries);
      if(signature===pending) count++;
      else {pending=signature;count=1;}
      if(count>=2) {accepted=sample.entries;at=Number(now);}
      else {accepted=null;at=null;}
      return current(now);
    }
    function reset() {pending=null;count=0;accepted=null;at=null;status='missing';}
    return {observe:observe,current:current,reset:reset};
  }
  return {probe:probe,createTracker:createTracker,catalogIndex:catalogIndex,
    canonical:canonical,source:SOURCE};
})();
if(typeof module!=='undefined'&&module.exports) module.exports=DAA_PURCHASES;
