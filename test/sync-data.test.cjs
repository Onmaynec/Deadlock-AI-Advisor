const {test} = require('node:test');
const assert = require('node:assert/strict');
const {transform, normaliseStats} = require('../tools/sync-data.cjs');
test('normalizes public assets into an unambiguous catalog', () => {
  const heroes = [{id:1,name:'Hero',class_name:'hero_hero'}];
  const items = Array.from({length:25}, (_, i) => ({id: i+1,name:'Item'+i,cost:500,
    item_slot_type: i % 2 ? 'spirit' : 'vitality',shopable:true}));
  const data = transform(heroes,items);
  assert.equal(data.heroes[0].className,'hero_hero');
  assert.equal(data.items.length,25);
});
test('rejects insufficient or malformed source data, never creates an empty release', () => {
  assert.throws(()=>transform([],[]), /Insufficient/);
  assert.throws(()=>transform({},[]), /not a list/);
});

test('matches analytic buckets only to known heroes and current shopable item IDs', () => {
  const data = {heroes:[{id:5}], items:[{id:10}]};
  const rows = [
    {bucket:5,item_id:10,matches:500},
    {bucket:5,item_id:11,matches:5000},
    {bucket:6,item_id:10,matches:5000},
    {bucket:5,item_id:10,matches:20}
  ];
  assert.deepEqual(normaliseStats(rows,data), {'5':{'10':500}});
});

test('resolves only known, cheaper component class names from the public item catalog',()=>{
  const heroes=[{id:5,name:'Hero'}];
  const items=Array.from({length:25},(_,i)=>({
    id:i+1,name:'Item '+i, class_name:'upgrade_thing_'+(i+1),
    item_slot_type:'weapon',cost:i===0?800:3200,shopable:true,
    component_items:i===1?['upgrade_thing_1','upgrade_bogus',
      'upgrade_thing_3','upgrade_thing_1']:undefined
  }));
  const parsed=transform(heroes,items);
  assert.deepEqual(parsed.items.find(x=>x.id===2).components,[1]);
  assert.deepEqual(parsed.items.find(x=>x.id===1).components,[]);
});

test('filters disabled and tier-5 item variants from normal-match shop snapshot',()=>{
 const heroes=[{id:5,name:'Hero'}];
 const items=Array.from({length:25},(_,i)=>({
   id:i+1,name:'Item '+i, class_name:'upgrade_'+i,
   type:'upgrade',item_slot_type:'weapon',item_tier:1,cost:800,shopable:true
 }));
 items.push({id:88,name:'Legendary Test',type:'upgrade',item_slot_type:'weapon',
   item_tier:5,cost:9999,shopable:true});
 items.push({id:89,name:'Hidden Test',type:'upgrade',item_slot_type:'weapon',
   item_tier:1,cost:800,shopable:true,disabled:true});
 items.push({id:90,name:'Ability Test',type:'ability',item_slot_type:'spirit',
   item_tier:1,cost:800,shopable:true});
 const out=transform(heroes,items);
 assert.equal(out.items.length,25);
 assert.ok(out.items.every(x=>x.id<80));
});
