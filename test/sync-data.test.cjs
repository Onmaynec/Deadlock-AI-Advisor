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
