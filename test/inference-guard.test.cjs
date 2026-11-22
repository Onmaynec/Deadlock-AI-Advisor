const {test} = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/advisor-core.js');
global.DAA = core; // Panorama provides DAA in the compiled script; Node unit tests shim it.
const guard = require('../src/inference-guard.js');

const catalog={items:[
  {id:1,name:'Healbane',slot:'spirit',cost:1200,shopable:true},
  {id:2,name:'Metal Skin',slot:'vitality',cost:3000,shopable:true},
  {id:3,name:'Ordinary',slot:'weapon',cost:600,shopable:true}
]};
function state() {return {heroId:7,enemyHeroIds:[5,6],owned:[],souls:2500,
  slots:9,threats:{healing:true},pinned:[],sessionEpoch:1};}
function proposal(s,item_ids) {
  return {version:1,context:guard.contextSignature(s),item_ids};
}
test('accepted model output is replaced with canonical local item data',()=>{
  const s=state();
  const p=proposal(s,[1]);
  p.price=1; p.reason='BUY FOR FREE'; p.name='fake';
  const result=guard.validate(catalog,s,p);
  assert.equal(result.ok,true);
  assert.equal(result.items[0].name,'Healbane');
  assert.equal(result.items[0].cost,1200);
  assert.notEqual(result.items[0].reason,p.reason);
});
test('rejects hallucinated, duplicate, structured and out-of-range item IDs',()=>{
  const s=state();
  for(const ids of [[999],[1,1],[{id:1}],[],[1,2,3,4,5,6,7]]) {
    assert.equal(guard.validate(catalog,s,proposal(s,ids)).ok,false);
  }
});
test('changes to enemy roster, threat flags, budget or pins invalidate model output',()=>{
  const s=state(), p=proposal(s,[1]);
  const edits=[
    {enemyHeroIds:[9]},{threats:{healing:false}},{souls:2300},
    {pinned:['1']},{owned:['2']},{slots:10},{heroId:8},{sessionEpoch:2},{enemyItemIds:[1]}
  ];
  edits.forEach(change=>{
    assert.equal(guard.validate(catalog,Object.assign({},s,change),p).reason,
      'stale-context');
  });
});
test('unaffordable and unknown-budget purchases never pass through inference gate',()=>{
  const s=state();
  assert.equal(guard.validate(catalog,s,proposal(s,[2])).reason,'affordability-unconfirmed');
  const unknown=Object.assign({},s,{souls:null});
  assert.equal(guard.validate(catalog,unknown,proposal(unknown,[1])).reason,'affordability-unconfirmed');
});
test('malformed protocol and invalid shapes cannot reach display',()=>{
  const s=state();
  assert.equal(guard.validate(catalog,s,null).reason,'invalid-payload');
  assert.equal(guard.validate(catalog,s,{}).reason,'stale-context');
  assert.equal(guard.validate(catalog,s,{version:2,context:guard.contextSignature(s),item_ids:[1]}).ok,false);
  assert.equal(guard.validate(catalog,s,proposal(s,['<script>'])).ok,false);
});
test('offline fallback is valid even with no model or stale enemy context',()=>{
  const s=state();
  const result=guard.fallback(catalog,s,'model-disabled');
  assert.equal(result.ok,false);
  assert.equal(result.source,'offline-statistics-and-rules');
  assert.ok(result.items.length>0);
  assert.ok(result.items.every(i=>core.normalise(catalog).some(c=>c.id===i.id)));
});
