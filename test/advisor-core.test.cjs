const {test} = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/advisor-core.js');
const catalog = {items: [
  {id: 1, name: 'Healbane', slot: 'spirit', cost: 1200, shopable: true},
  {id: 2, name: 'Debuff Remover', slot: 'vitality', cost: 2500, shopable: true},
  {id: 3, name: 'Metal Skin', slot: 'vitality', cost: 3000, shopable: true},
  {id: 4, name: 'Ordinary Gun Upgrade', slot: 'weapon', cost: 600, shopable: true},
  {id: 5, name: 'Not For Sale', slot: 'weapon', cost: 600, shopable: false},
  {id: 6, name: 'No Price', slot: 'weapon', cost: 0, shopable: true}
]};
test('only real shopable items with a price are recommended', () => {
  const ids = core.recommend(catalog, {souls: 4000}, 20).map(x => x.id);
  assert.deepEqual(ids.sort(), ['1', '2', '3', '4']);
});
test('owned items never reappear', () => {
  const result = core.recommend(catalog, {souls: 4000, owned: [1, '2']});
  assert.ok(result.every(x => !['1', '2'].includes(x.id)));
});
test('anti-healing recommendation depends on declared threat', () => {
  const withThreat = core.recommend(catalog, {souls: 2500, threats: {healing: true}});
  assert.equal(withThreat[0].name, 'Healbane');
  assert.match(withThreat[0].reason, /здоровья/);
});
test('control threat selects a counter item', () => {
  const result = core.recommend(catalog, {souls: 3000, threats: {control: true}});
  assert.equal(result[0].name, 'Debuff Remover');
});
test('gun threat selects a defensive counter item', () => {
  const result = core.recommend(catalog, {souls: 3000, threats: {bullets: true}});
  assert.equal(result[0].name, 'Metal Skin');
});
test('unaffordable items are visibly flagged, not recommended as affordable', () => {
  const result = core.recommend(catalog, {souls: 100, threats: {control: true}});
  assert.ok(result.length > 0);
  assert.equal(result[0].affordable, false);
  assert.match(result[0].reason, /Недостаёт/);
});
test('malformed and empty snapshots do not throw', () => {
  assert.deepEqual(core.recommend(null, {}), []);
  assert.deepEqual(core.recommend({items: []}, {}), []);
  assert.equal(core.money(-5), 0);
});
test('deterministic ordering', () => {
  const state = {souls: 3000, threats: {bullets: true}};
  assert.deepEqual(core.recommend(catalog, state), core.recommend(catalog, state));
});

test('hero-specific public purchase priors change candidate order', () => {
  const withPriors = {items:catalog.items, heroStats:{
    '15':{'1':2000,'4':100},
    '16':{'4':2000,'1':100}
  }};
  const a = core.recommend(withPriors,{heroId:15,souls:2000},4);
  const b = core.recommend(withPriors,{heroId:16,souls:2000},4);
  assert.equal(a[0].id,'1');
  assert.equal(b[0].id,'4');
  assert.match(a[0].reason,/выбранного героя/);
});

test('unknown balance never produces a fake affordability claim', () => {
  const recs = core.recommend(catalog, {souls: null, threats:{control:true}});
  assert.ok(recs.length);
  assert.ok(recs.every(x => x.affordable === null));
  assert.ok(recs.every(x => x.reason.includes('Баланс неизвестен')));
  assert.ok(recs.every(x => !x.reason.includes('Недостаёт')));
});
test('known zero balance still produces exact insufficient-souls amount', () => {
  const recs = core.recommend(catalog, {souls:0, threats:{healing:true}});
  assert.equal(recs[0].affordable,false);
  assert.ok(recs[0].reason.includes('Недостаёт '+recs[0].cost+' душ'));
});

test('component upgrade costs only the difference and consumes a mapped owned component', () => {
  const items=[
    {id:11,name:'Small Part',slot:'weapon',cost:800,shopable:true},
    {id:12,name:'Large Upgrade',slot:'weapon',cost:3200,shopable:true,components:[11]}
  ];
  const choices=core.recommend({items}, {souls:2400,owned:[11],slots:9});
  const upgraded=choices.find(x=>x.id==='12');
  assert.ok(upgraded);
  assert.equal(upgraded.cost,2400);
  assert.equal(upgraded.fullCost,3200);
  assert.equal(upgraded.componentId,'11');
  assert.equal(upgraded.affordable,true);
  assert.match(upgraded.reason,/зачтена стоимость компонента/);
});
test('a full universal inventory blocks new items but not a valid upgrade',()=>{
  const items=[];
  for(let i=1;i<=10;i++) items.push({id:i,name:'Item '+i,slot:'weapon',cost:800,shopable:true});
  items.push({id:20,name:'Upgrade from Item 1',slot:'spirit',cost:3200,shopable:true,components:[1]});
  const owned=Array.from({length:9},(_,i)=>i+1);
  const result=core.plan({items},{souls:10000,slots:9,owned},10);
  assert.equal(result.freeSlots,0);
  assert.deepEqual(result.items.map(x=>x.id),['20']);
  assert.equal(result.items[0].cost,2400);
  const withSpace=core.plan({items},{souls:10000,slots:10,owned},10);
  assert.ok(withSpace.items.some(x=>x.id==='10'));
});
test('pinned next purchase does not get displaced by new threats',()=>{
  const a=core.recommend(catalog,{souls:3500,pinned:['4'],threats:{control:true}});
  assert.equal(a[0].id,'4');
  assert.equal(a[0].pinned,true);
  assert.match(a[0].reason,/Закреплено/);
});
test('matchup priors affect only explicitly selected enemy heroes',()=>{
  const sample={items:[
    {id:1,name:'First',slot:'weapon',cost:800,shopable:true},
    {id:2,name:'Second',slot:'weapon',cost:800,shopable:true}
  ],heroMatchups:{'5':{'7':{'1':100,'2':2000}}}};
  const baseline=core.recommend(sample,{heroId:5,souls:800,enemyHeroIds:[]});
  const against=core.recommend(sample,{heroId:5,souls:800,enemyHeroIds:[7]});
  assert.equal(baseline[0].id,'1');
  assert.equal(against[0].id,'2');
  assert.match(against[0].reason,/Исторические покупки/);
  const missing=core.recommend(sample,{heroId:5,souls:800,enemyHeroIds:[8]});
  assert.equal(missing[0].id,'1');
  assert.ok(missing.every(x=>!x.reason.includes('Исторические покупки')));
});
test('plan keeps budget unknown and clamps user-input slot limits',()=>{
  const r=core.plan(catalog,{souls:null,slots:100,owned:[1]});
  assert.equal(r.available,null);
  assert.equal(r.slotLimit,12);
  assert.ok(r.items.every(x=>x.affordable===null));
});
