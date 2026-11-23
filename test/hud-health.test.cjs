const {test}=require('node:test');
const assert=require('node:assert/strict');
const H=require('../src/hud-health.js');
function tracker(behavior) {
 let resets=0;
 return {observe(_root,t){return behavior(t);},reset(){resets++;},get resets(){return resets;}};
}
test('all three independent sources can be read in one sample',()=>{
 const m=H.createMonitor({
   souls:tracker(()=>({status:'live',value:1000,source:'HUD'})),
   roster:tracker(()=>({status:'live',ids:['1'],source:'HUD'})),
   purchases:tracker(()=>({status:'live',entries:[],source:'HUD'}))
 });
 const s=m.sample({},1);
 assert.equal(s.souls.value,1000);
 assert.deepEqual(s.roster.ids,['1']);
 assert.deepEqual(s.purchases.entries,[]);
 assert.ok(m.report().every(r=>r.validReads===1&&r.errors===0&&r.lastConfirmedAt===1));
});
test('one throwing adapter does not block other HUD sources or reuse stale data',()=>{
 let fail=false;
 const souls=tracker(()=>{if(fail)throw Error('sensitive game text');return {status:'live',value:3000};});
 const m=H.createMonitor({
  souls,roster:tracker(()=>({status:'live',ids:['7']})),
  purchases:tracker(()=>({status:'live',entries:[]}))
 });
 assert.equal(m.sample(null,0).souls.value,3000);
 fail=true;
 const out=m.sample(null,0.6);
 assert.equal(out.souls.value,null);
 assert.equal(out.souls.status,'error');
 assert.deepEqual(out.roster.ids,['7']);
 assert.deepEqual(out.purchases.entries,[]);
 assert.equal(souls.resets,1);
 const report=m.report();
 assert.equal(report.find(x=>x.source==='souls').errors,1);
 assert.equal(report.find(x=>x.source==='roster').errors,0);
 assert.ok(!JSON.stringify(report).includes('sensitive game text'));
});
test('malformed adapter values fail closed with no invented readings',()=>{
 const m=H.createMonitor({
  souls:tracker(()=>({status:'live',value:'NaN'})),
  roster:tracker(()=>({status:'live',ids:null})),
  purchases:tracker(()=>({status:'live',entries:'purchase'}))
 });
 const result=m.sample({},2);
 assert.equal(result.souls.value,null);
 assert.equal(result.roster.ids,null);
 assert.equal(result.purchases.entries,null);
 assert.ok(m.report().every(x=>x.status==='error'&&x.errors===1));
});
test('adapter recovery requires new observations and resets counters on match change',()=>{
 let broken=true;
 const t=tracker(()=>broken?{status:'missing',value:null}:{status:'live',value:650});
 const m=H.createMonitor({souls:t,roster:tracker(()=>({status:'missing',ids:null})),
  purchases:tracker(()=>({status:'missing',entries:null}))});
 assert.equal(m.sample({},0).souls.status,'missing');
 broken=false;
 assert.equal(m.sample({},0.6).souls.value,650);
 assert.equal(m.report()[0].lastConfirmedAt,0.6);
 m.reset();
 assert.ok(m.report().every(x=>x.status==='not-tested'&&x.errors===0));
 assert.equal(t.resets,1);
});
test('missing adapter fails without preventing independently healthy sources',()=>{
 const m=H.createMonitor({souls:null,roster:tracker(()=>({status:'live',ids:['1']}))});
 const s=m.sample(null,0);
 assert.equal(s.souls.status,'error');
 assert.deepEqual(s.roster.ids,['1']);
 assert.equal(s.purchases.status,'error');
});
