const {test} = require('node:test');
const assert = require('node:assert/strict');
const {normalize,parseIds} = require('../tools/sync-matchups.cjs');
const catalog = {
  heroes:[{id:5,name:'Our Hero'},{id:7,name:'Enemy Hero'}],
  items:[{id:10,name:'Item A'},{id:11,name:'Item B'}]
};
test('CLI validates precompute scope and deduplicates hero IDs',()=>{
  assert.deepEqual(parseIds(['--heroes','5,7,5']),[5,7]);
  assert.deepEqual(parseIds(['--heroes=5']),[5]);
  assert.throws(()=>parseIds([]),/Use --heroes/);
  assert.throws(()=>parseIds(['--heroes','5,7,8,9,10,11,12,13,14']),/Use --heroes/);
  assert.throws(()=>parseIds(['--heroes','abc']),/Use --heroes/);
});
test('matchup samples use only real heroes and shop items, never guessed stats',()=>{
  const rows=[
    {bucket:7,item_id:10,matches:500,wins:300},
    {bucket:7,item_id:11,matches:99,wins:90},
    {bucket:7,item_id:12,matches:10000},
    {bucket:99,item_id:10,matches:10000},
    {bucket:5,item_id:10,matches:10000},
    {bucket:7,item_id:10,matches:180}
  ];
  assert.deepEqual(normalize(rows,5,catalog),{'7':{'10':500}});
});
test('unexpected upstream shapes fail closed',()=>{
  assert.throws(()=>normalize({rows:[]},5,catalog),/Expected array/);
  assert.deepEqual(normalize([{bucket:7,item_id:10,matches:-100}],5,catalog),{});
});
