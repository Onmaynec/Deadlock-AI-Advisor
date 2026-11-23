/* v0.8 — local, explicit inventory annotations; never mutates the game shop. */
var DAA_INVENTORY = (function () {
  'use strict';
  function catalogMap(catalog) {
    var map = {};
    DAA.normalise(catalog).forEach(function (item) {
      map[String(item.id)] = item;
    });
    return map;
  }
  function clean(catalog, owned) {
    var known=catalogMap(catalog), out=[], seen={};
    (Array.isArray(owned) ? owned : []).forEach(function (raw) {
      var id=String(raw);
      if(known[id] && !seen[id]) {seen[id]=true;out.push(id);}
    });
    return out;
  }
  function capacity(value) {
    var n=Number(value);
    return isFinite(n) ? Math.max(9, Math.min(12,Math.floor(n))) : 9;
  }
  function mark(catalog, owned, rawId, slots) {
    var map=catalogMap(catalog), id=String(rawId), item=map[id],
      base=clean(catalog,owned), max=capacity(slots);
    if(!item)return {ok:false,error:'unknown-item',owned:base};
    if(base.indexOf(id)>=0)return {ok:false,error:'already-owned',owned:base};
    var consumed=null;
    (Array.isArray(item.components)?item.components:[]).forEach(function(raw) {
      var cid=String(raw), candidate=map[cid];
      if(base.indexOf(cid)<0 || !candidate || candidate.cost>=item.cost)return;
      if(!consumed || candidate.cost>map[consumed].cost)consumed=cid;
    });
    if(base.length>=max&&!consumed)return {ok:false,error:'full-inventory',owned:base};
    var next=base.filter(function(x){return x!==consumed;});
    next.push(id);
    return {ok:true,error:null,owned:next,consumed:consumed,
      payment:item.cost-(consumed?map[consumed].cost:0),
      previous:base};
  }
  function remove(catalog,owned,id) {
    var base=clean(catalog,owned);
    id=String(id);
    if(base.indexOf(id)<0)return {ok:false,error:'not-owned',owned:base};
    return {ok:true,error:null,owned:base.filter(function(x){return x!==id;}),
      previous:base};
  }
  function undo(catalog,history,owned) {
    var h=Array.isArray(history)?history:[];
    if(!h.length)return {ok:false,owned:clean(catalog,owned),history:[]};
    var last=h[h.length-1];
    return {ok:true,owned:clean(catalog,last),
      history:h.slice(0,-1)};
  }
  function push(history,previous) {
    var h=Array.isArray(history)?history.slice():[];
    h.push(previous.slice());
    return h.slice(-10);
  }
  return {clean:clean,capacity:capacity,mark:mark,remove:remove,undo:undo,push:push};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=DAA_INVENTORY;
