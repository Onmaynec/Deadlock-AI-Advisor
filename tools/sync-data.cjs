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
async function main() {
  const [heroes, items] = await Promise.all([get('heroes'), get('items')]);
  const catalog = transform(heroes, items);
  catalog.generatedAt = new Date().toISOString();
  fs.mkdirSync(DEST, {recursive:true});
  fs.writeFileSync(path.join(DEST,'catalog.json'), JSON.stringify(catalog,null,2) + '\n');
  fs.writeFileSync(path.join(DEST,'catalog.js'), 'var DAA_CATALOG = ' + JSON.stringify(catalog) + ';\n');
  console.log('Synced ' + catalog.heroes.length + ' heroes and ' + catalog.items.length + ' shopable items');
}
if (require.main === module) main().catch(e => {console.error('Sync error:',e.message);process.exitCode=1;});
module.exports = {transform, listResponse};
