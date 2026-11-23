const {test}=require('node:test');
const assert=require('node:assert/strict');
global.DAA=require('../src/advisor-core.js');
const S=require('../src/strategy-engine.js');
const R=require('../src/purchase-route.js');
const catalog={heroes:[{id:1,name:'Hero'},{id:2,name:'Enemy'}],
  items:[
    {id:1,name:'Basic Gun',slot:'weapon',cost:1200,shopable:true},
    {id:2,name:'Basic Vitality',slot:'vitality',cost:1200,shopable:true},
    {id:3,name:'Basic Spirit',slot:'spirit',cost:1200,shopable:true},
    {id:4,name:'Cheap Sidearm',slot:'weapon',cost:600,shopable:true},
    {id:5,name:'Major Weapon',slot:'weapon',cost:6000,shopable:true},
    {id:6,name:'Upgrade Vitality',slot:'vitality',cost:3600,
      components:[2],shopable:true}
  ],
  heroStats:{'1':{'1':100,'2':200}},heroMatchups:{'1':{'2':{'1':300}}}
};
const makeState=()=>({heroId:1,souls:2400,owned:[],slots:9,
  pinned:[],enemyHeroIds:[2],threats:{}});
test('profile names and IDs are exact, unknown falls back to balanced',()=>{
  assert.deepEqual(S.profiles.map(x=>x.id),
    ['balanced','survival','pressure','budget']);
  assert.equal(S.profile('unused').id,'balanced');
  assert.equal(S.rank(catalog,makeState(),'unused',6)[0].id,
    S.rank(catalog,makeState(),'balanced',6)[0].id);
});
test('profile changes ranking using only catalog slot and price facts',()=>{
  const state=makeState();
  state.heroId=999;state.enemyHeroIds=[]; // isolate profile bonus from historical popularity
  const survival=S.rank(catalog,state,'survival',6);
  const pressure=S.rank(catalog,state,'pressure',6);
  const budget=S.rank(catalog,state,'budget',6);
  assert.equal(survival[0].slot,'vitality');
  assert.equal(pressure[0].slot,'weapon');
  assert.equal(budget[0].id,'4');
  assert.match(survival[0].strategyReason,/vitality/);
  assert.match(pressure[0].strategyReason,/weapon/);
  assert.match(budget[0].strategyReason,/меньшей цене/);
  assert.equal(S.rank(catalog,state,'balanced',6)[0].strategyBonus,0);
});
test('ranking cannot override affordability, prices, component credits or owned inventory',()=>{
  const state=makeState();
  state.owned=[2];
  const actual=global.DAA.recommend(catalog,state,80);
  for(const profile of S.profiles) {
    const ranked=S.rank(catalog,state,profile.id,80);
    assert.equal(ranked.length,actual.length);
    for(const row of ranked) {
      const original=actual.find(x=>x.id===row.id);
      assert.ok(original);
      for(const key of ['id','cost','fullCost','componentId','affordable','slot','pinned'])
        assert.deepEqual(row[key],original[key],key+' '+profile.id);
      assert.ok(row.reason.includes(original.reason));
    }
  }
});
test('pinned next purchase remains top priority across all profiles',()=>{
  const state=makeState();
  state.pinned=['5'];
  for(const p of S.profiles) {
    const ranked=S.rank(catalog,state,p.id,6);
    assert.equal(ranked[0].id,'5',p.id);
    assert.equal(ranked[0].affordable,false);
  }
});
test('unknown currency never becomes a claim of affordability',()=>{
  const state=makeState();
  state.souls=null;
  const rows=S.rank(catalog,state,'budget',6);
  assert.ok(rows.length);
  assert.ok(rows.every(x=>x.affordable===null));
  const comparison=S.compare(catalog,state);
  assert.equal(comparison.evidence.budgetKnown,false);
  assert.ok(comparison.profiles.every(x=>x.affordable===null));
  assert.ok(comparison.evidence.warnings.some(w=>w.includes('Баланс')));
});
test('comparison emits four auditable choices with non-causal evidence warnings',()=>{
  const result=S.compare(catalog,makeState());
  assert.equal(result.profiles.length,4);
  assert.equal(result.evidence.heroKnown,true);
  assert.equal(result.evidence.matchupsCovered,1);
  assert.equal(result.evidence.enemyCount,1);
  assert.equal(result.evidence.historicalHeroData,true);
  assert.ok(result.profiles.every(x=>x.source==='offline-rules'));
  const missing=S.audit(catalog,{heroId:999,souls:null,enemyHeroIds:[2]});
  assert.ok(missing.warnings.some(x=>x.includes('Герой')));
  assert.equal(missing.heroKnown,false);
});
test('strategy-dependent route uses only current budget and known inventory',()=>{
  const simple={items:[
    {id:1,name:'Weapon',slot:'weapon',cost:1000,shopable:true},
    {id:2,name:'Vitality',slot:'vitality',cost:1000,shopable:true}
  ]};
  const state={souls:1000,slots:9};
  const ranker=id=>(cat,s,limit)=>S.rank(cat,s,id,limit);
  const survival=R.run(simple,state,1,ranker('survival'));
  const pressure=R.run(simple,state,1,ranker('pressure'));
  assert.equal(survival.steps[0].id,'2');
  assert.equal(pressure.steps[0].id,'1');
  for(const outcome of [survival,pressure]){
    assert.equal(outcome.steps.length,1);
    assert.equal(outcome.remaining,0);
    assert.equal(outcome.spent,1000);
  }
});
test('profile scores are deterministic, bounded and do not mutate catalog or state',()=>{
  const c=JSON.stringify(catalog),state=makeState(),before=JSON.stringify(state);
  for(const p of S.profiles){
    const one=S.rank(catalog,state,p.id,6);
    assert.deepEqual(one,S.rank(catalog,state,p.id,6));
    assert.ok(one.every(x=>x.strategyBonus>=0&&x.strategyBonus<=9));
  }
  assert.equal(JSON.stringify(catalog),c);
  assert.equal(JSON.stringify(state),before);
});
