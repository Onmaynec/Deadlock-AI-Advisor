const {test} = require('node:test');
const assert = require('node:assert/strict');
const {transform} = require('../tools/sync-data.cjs');
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
