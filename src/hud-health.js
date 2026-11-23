/* v0.8 — independent fail-closed polling for the THREE read-only HUD sources.
 * Never returns account IDs, purchases ownership or hidden game data.
 */
var DAA_HUD_HEALTH = (function () {
  'use strict';
  var NAMES=['souls','roster','purchases'];
  function safeDefault(name) {
    var state={status:'error',source:'HUD',confidence:'none',ageSeconds:null};
    if(name==='souls')state.value=null;
    if(name==='roster')state.ids=null;
    if(name==='purchases')state.entries=null;
    return state;
  }
  function createMonitor(trackers) {
    var totals={},readings={},lastAt={};
    NAMES.forEach(function(n){totals[n]={ok:0,errors:0};});
    function sample(root, now) {
      var t=Number(now);
      if(!isFinite(t)||t<0)t=0;
      NAMES.forEach(function(name) {
        var tr=trackers[name], value=null;
        try {
          if(!tr||typeof tr.observe!=='function')
            throw new Error('Missing read-only adapter');
          value=tr.observe(root,t);
          if(!value||typeof value.status!=='string')
            throw new Error('Invalid read-only adapter response');
          if(name==='souls' && value.status==='live' &&
              (typeof value.value!=='number'||!isFinite(value.value)))
            throw new Error('Invalid soul reading');
          if(name==='roster' && value.status==='live' &&
              (!Array.isArray(value.ids)||!value.ids.length))
            throw new Error('Invalid enemy roster');
          if(name==='purchases' && value.status==='live' &&
              !Array.isArray(value.entries))
            throw new Error('Invalid purchase feed');
          totals[name].ok++;
          if(value.status==='live')lastAt[name]=t;
          readings[name]=value;
        } catch(e) {
          totals[name].errors++;
          try {if(tr&&typeof tr.reset==='function')tr.reset();}catch(ignore){}
          readings[name]=safeDefault(name);
        }
      });
      return {souls:readings.souls,roster:readings.roster,
        purchases:readings.purchases};
    }
    function report() {
      return NAMES.map(function(name){
        var current=readings[name] || {status:'not-tested'};
        return {
          source:name,status:current.status,confidence:current.confidence||'none',
          validReads:totals[name].ok,errors:totals[name].errors,
          lastConfirmedAt:lastAt[name] === undefined ? null : lastAt[name]
        };
      });
    }
    function reset() {
      NAMES.forEach(function(name) {
        totals[name]={ok:0,errors:0};
        delete readings[name];delete lastAt[name];
        try {
          var tr=trackers[name];
          if(tr&&typeof tr.reset==='function')tr.reset();
        }catch(e){}
      });
    }
    return {sample:sample,report:report,reset:reset};
  }
  return {createMonitor:createMonitor};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=DAA_HUD_HEALTH;
