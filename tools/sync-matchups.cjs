'use strict';
// Optional BUILD-TIME matchup samples. No in-game HTTP, user ID, API key or daemon.
// Usage: npm run sync:matchups -- --heroes 15,16
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const CATALOG = path.join(ROOT,'generated','catalog.json');
const TIMEOUT = 45000;
function parseIds(args) {
  const arg = args.find(x=>x.startsWith('--heroes='));
  const token = arg ? arg.slice('--heroes='.length) :
    (args[args.indexOf('--heroes') + 1] || '');
  if (!/^[0-9]+(?:,[0-9]+){0,7}$/.test(token))
    throw new Error('Use --heroes 15,16 (1 to 8 own hero IDs per run).');
  return [...new Set(token.split(',').map(Number))];
}
function normalize(rows, ownHero, catalog) {
  if (!Array.isArray(rows)) throw new Error('Expected array from item-stats API');
  const heroSet = new Set(catalog.heroes.map(h=>String(h.id)));
  const itemSet = new Set(catalog.items.map(i=>String(i.id)));
  const groups = {};
  for (const row of rows) {
    if (!row || !Number.isInteger(Number(row.bucket)) ||
        !heroSet.has(String(row.bucket)) || String(row.bucket)===String(ownHero)) continue;
    const item = String(row.item_id);
    const matches = Number(row.matches);
    if (!itemSet.has(item) || !Number.isInteger(matches) || matches < 100 ||
        matches > 1000000000) continue;
    const enemy = String(row.bucket);
    if (!groups[enemy]) groups[enemy] = {};
    groups[enemy][item] = Math.max(groups[enemy][item] || 0, matches);
  }
  // Bound size of VPK data and keep highest-sample purchase frequencies.
  for (const enemy of Object.keys(groups)) {
    groups[enemy] = Object.fromEntries(
      Object.entries(groups[enemy])
        .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
        .slice(0,60));
  }
  return groups;
}
async function getMatchups(id) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT);
  try {
    const url='https://api.deadlock-api.com/v1/analytics/item-stats?' +
      new URLSearchParams({bucket:'enemy_hero',hero_id:String(id),min_matches:'100',
        game_mode:'normal'}).toString();
    const response=await fetch(url,{signal:controller.signal,
      headers:{'User-Agent':'Deadlock-AI-Advisor/0.3.0'}});
    if (!response.ok) throw new Error('Matchup stats for hero '+id+': HTTP '+response.status);
    const len=Number(response.headers.get('content-length'));
    if (len && len > 16*1024*1024) throw new Error('Matchup response too large');
    const bytes=await response.arrayBuffer();
    if (bytes.byteLength > 16*1024*1024) throw new Error('Matchup response too large');
    return JSON.parse(Buffer.from(bytes).toString('utf8'));
  } finally {clearTimeout(timer);}
}
function saveCatalog(catalog) {
  // Rebuild both JSON and executable-safe JS snapshots. Never splice external code.
  const json=JSON.stringify(catalog,null,2)+'\n';
  const js='var DAA_CATALOG = '+JSON.stringify(catalog).replace(/</g,'\\u003c')+';\n';
  const tmp=CATALOG+'.tmp';
  fs.writeFileSync(tmp,json);
  fs.renameSync(tmp,CATALOG);
  fs.writeFileSync(path.join(ROOT,'generated','catalog.js'),js);
}
async function main() {
  const ids=parseIds(process.argv.slice(2));
  if (!fs.existsSync(CATALOG)) throw new Error('Missing generated/catalog.json: run npm run sync first');
  const catalog=JSON.parse(fs.readFileSync(CATALOG,'utf8'));
  if (!Array.isArray(catalog.heroes) || !Array.isArray(catalog.items))
    throw new Error('Invalid source catalog');
  const known=new Set(catalog.heroes.map(h=>Number(h.id)));
  for (const id of ids) if (!known.has(id)) throw new Error('Unknown own hero ID: '+id);
  const updated=Object.assign({},catalog.heroMatchups || {});
  // Sequential requests, never burst free API rate limits.
  for (const id of ids) {
    updated[String(id)]=normalize(await getMatchups(id),id,catalog);
    console.log('Hero '+id+': '+Object.keys(updated[String(id)]).length+' enemy groups');
  }
  catalog.heroMatchups=updated;
  catalog.matchupGeneratedAt=new Date().toISOString();
  saveCatalog(catalog);
  console.log('Bundled matchup samples for '+ids.length+' hero(es). No runtime API required.');
}
if (require.main===module) main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parseIds,normalize,saveCatalog};
