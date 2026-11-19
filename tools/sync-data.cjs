'use strict';
// Downloads current public Deadlock item and hero metadata at BUILD time, not at game runtime.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, 'generated');
const API = 'https://api.deadlock-api.com/v1/assets/';
function listResponse(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.data)) return json.data;
  if (json && Array.isArray(json.items)) return json.items;
  if (json && Array.isArray(json.heroes)) return json.heroes;
  throw new Error('API payload is not a list. Schema may have changed.');
}
function transform(heroes, items) {
  const heroList = listResponse(heroes).filter(h => h && Number.isFinite(Number(h.id)) &&
      typeof h.name === 'string' && h.name.trim()).map(h => ({
        id: Number(h.id), name: h.name, className: String(h.class_name || '').toLowerCase()
      }));
  const itemList = listResponse(items).filter(i => i && Number.isFinite(Number(i.id)) &&
      typeof i.name === 'string' && Number.isFinite(Number(i.cost)) && Number(i.cost) > 0 &&
      ['weapon','vitality','spirit'].includes(String(i.item_slot_type || '').toLowerCase()) &&
      i.shopable === true).map(i => ({
        id: Number(i.id), name: i.name, cost: Math.floor(Number(i.cost)),
        slot: i.item_slot_type.toLowerCase(), shopable: true
      }));
  if (!heroList.length || itemList.length < 20) {
    throw new Error('Insufficient metadata: ' + heroList.length + ' heroes, ' + itemList.length +
      ' items. Refusing to produce a misleading build.');
  }
  heroList.sort((a,b) => a.name.localeCompare(b.name));
  itemList.sort((a,b) => a.name.localeCompare(b.name));
  return {heroes: heroList, items: itemList};
}
async function get(name) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const r = await fetch(API + name + '?language=english', {
      headers: {'User-Agent':'Deadlock-AI-Advisor/0.1.0'}, signal: controller.signal
    });
    if (!r.ok) throw new Error(name + ' HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(timeout); }
}
function normaliseStats(rows, catalog) {
  const heroIds = new Set(catalog.heroes.map(h => String(h.id)));
  const itemIds = new Set(catalog.items.map(i => String(i.id)));
  const stats = {};
  listResponse(rows).forEach(row => {
    if (!row) return;
    const hero = String(row.bucket), item = String(row.item_id);
    const count = Math.floor(Number(row.matches));
    if (!heroIds.has(hero) || !itemIds.has(item) || !Number.isFinite(count) || count < 100) return;
    if (!stats[hero]) stats[hero] = {};
    stats[hero][item] = Math.max(stats[hero][item] || 0, count);
  });
  return stats;
}
async function getStats() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch('https://api.deadlock-api.com/v1/analytics/item-stats?bucket=hero&min_matches=100',
      {headers: {'User-Agent':'Deadlock-AI-Advisor/0.1.0'}, signal:controller.signal});
    if (!response.ok) throw new Error('analytics HTTP ' + response.status);
    return await response.json();
  } finally { clearTimeout(timer); }
}
async function main() {
  const [heroes, items] = await Promise.all([get('heroes'), get('items')]);
  const catalog = transform(heroes, items);
  try {
    catalog.heroStats = normaliseStats(await getStats(), catalog);
    console.log('Loaded hero-specific purchase priors for ' +
      Object.keys(catalog.heroStats).length + ' heroes');
  } catch (e) {
    catalog.heroStats = {};
    console.warn('Hero analytics unavailable; using baseline/counter scoring:', e.message);
  }
  catalog.generatedAt = new Date().toISOString();
  fs.mkdirSync(DEST, {recursive:true});
  fs.writeFileSync(path.join(DEST,'catalog.json'), JSON.stringify(catalog,null,2) + '\n');
  fs.writeFileSync(path.join(DEST,'catalog.js'), 'var DAA_CATALOG = ' + JSON.stringify(catalog) + ';\n');
  console.log('Synced ' + catalog.heroes.length + ' heroes and ' + catalog.items.length + ' shopable items');
}
if (require.main === module) main().catch(e => {console.error('Sync error:',e.message);process.exitCode=1;});
module.exports = {transform, listResponse, normaliseStats};
