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
