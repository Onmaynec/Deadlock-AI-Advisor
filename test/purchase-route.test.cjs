const {test} = require('node:test');
const assert = require('node:assert/strict');
global.DAA = require('../src/advisor-core.js');
const route = require('../src/purchase-route.js');
function item(id, name, cost, components=[]) {
  return {id,name,slot:'weapon',cost,shopable:true,components};
}
test('sequence never spends hypothetical future souls; all steps are individually affordable',()=>{
  const catalog={items:[item(1,'Upgrade A',800),item(2,'Upgrade B',600),
    item(3,'Upgrade C',1600),item(4,'Upgrade D',350)]};
  const a=route.run(catalog,{souls:1500,slots:9},3);
  assert.equal(a.status,'ready');
  assert.ok(a.steps.length>=1&&a.steps.length<=3);
  assert.equal(a.steps.reduce((s,p)=>s+p.cost,0),a.spent);
  assert.equal(a.remaining+a.spent,1500);
  assert.ok(a.steps.every(s=>s.remaining>=0));
});
test('three-step route does not reuse purchased IDs or exceed known slots',()=>{
  const catalog={items:Array.from({length:18},(_,i)=>item(i+1,'Item '+(i+1),800))};
  const a=route.run(catalog,{souls:10000,owned:[1],slots:9},3);
  assert.equal(new Set(a.steps.map(p=>p.id)).size,a.steps.length);
  assert.ok(a.steps.length<=3);
  assert.ok(a.spent<=10000);
});
test('component upgrade consumes the owned component even when inventory is full',()=>{
  const items=Array.from({length:9},(_,i)=>item(i+1,'Owned '+i,800));
  items.push(item(20,'Verified Upgrade',3200,[1]));
  const a=route.run({items},{souls:2400,owned:[1,2,3,4,5,6,7,8,9],slots:9},3);
  assert.equal(a.steps.length,1);
  assert.equal(a.steps[0].id,'20');
  assert.equal(a.steps[0].cost,2400);
  assert.equal(a.steps[0].componentId,'1');
  assert.equal(a.remaining,0);
});
test('known-zero and malformed balances do not generate imaginary purchases',()=>{
  const catalog={items:[item(1,'Item A',800)]};
  for(const value of [null,undefined,'not a number',-1,Infinity]) {
    const a=route.run(catalog,{souls:value});
    assert.equal(a.status,'unknown-budget',String(value));
    assert.deepEqual(a.steps,[]);
    assert.equal(a.remaining,null);
  }
  const zero=route.run(catalog,{souls:0});
  assert.equal(zero.status,'ready');
  assert.deepEqual(zero.steps,[]);
  assert.equal(zero.saveFor.shortfall,800);
});
test('pinned unaffordable goal remains a savings target',()=>{
  const catalog={items:[item(1,'Big Goal',3200),item(2,'Small Item',800)]};
  const a=route.run(catalog,{souls:800,pinned:['1'],slots:9},3);
  assert.equal(a.saveFor.id,'1');
  assert.equal(a.saveFor.required,3200);
  assert.equal(a.saveFor.shortfall,2400);
  assert.equal(a.saveFor.pinned,true);
  assert.ok(a.spent<=800);
});
test('route is deterministic given the same snapshot and catalog',()=>{
  const catalog={items:Array.from({length:14},(_,i)=>item(i+1,'Item '+(i+1),800+i*200))};
  const state={souls:3600,slots:9,heroId:3,threats:{control:true}};
  assert.deepEqual(route.run(catalog,state,3),route.run(catalog,state,3));
});
test('catalog IDs not in current shop do not consume imaginary inventory capacity',()=>{
  const catalog={items:[item(1,'One',800),item(2,'Two',800)]};
  const a=global.DAA.plan(catalog,{souls:1600,owned:[1,1,404],slots:9});
  assert.equal(a.usedSlots,1);
  const b=route.run(catalog,{souls:800,owned:[1,1,404]});
  assert.equal(b.ownedCount,1);
  assert.equal(b.steps[0].id,'2');
});
