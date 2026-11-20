'use strict';
// Native Panorama compiler/VPK packer; see THIRD_PARTY_NOTICES.md for vendored tooling.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {ROOT, CACHE, OUT, findGamePath, readVpkIndex, extractVpkFile} = require('./common');
const {compileJs, compileCss, compileXml} = require('./s2res');
const {writeVpk} = require('./vpk');
const STOCK_HUD_URL =
  'https://raw.githubusercontent.com/SteamTracking/GameTracking-Deadlock/master/game/citadel/pak01_dir/panorama/layout/hud.xml';
const CONFIG_PATH = path.join(ROOT,'config.json');
const RECORD_PATH = path.join(CACHE,'installed.json');
const ARGS = new Set(process.argv.slice(2));
function config() {
  const defaults = {gamePath:'',pakNumber:88,autoShowShop:true,hotkey:'key_backslash'};
  if (!fs.existsSync(CONFIG_PATH)) return defaults;
  const cfg = Object.assign({},defaults,JSON.parse(fs.readFileSync(CONFIG_PATH,'utf8')));
  if (!Number.isInteger(cfg.pakNumber) || cfg.pakNumber < 1 || cfg.pakNumber > 99)
    throw new Error('pakNumber must be between 1 and 99');
  return cfg;
}
function injectHud(xml, scriptPath) {
  if (!/<CitadelHud\b/.test(xml) || !xml.includes('</styles>'))
    throw new Error('Stock hud.xml no longer matches the expected Panorama layout');
  if (!/panorama\/scripts\/deadlock_ai_advisor\./.test(scriptPath))
    throw new Error('Unexpected script path');
  if (xml.includes('deadlock_ai_advisor.vcss_c')) throw new Error('Already patched HUD');
  xml = xml.replace('</styles>', '<include src="s2r://panorama/styles/deadlock_ai_advisor.vcss_c" />\n</styles>');
  const include = '<include src="s2r://' + scriptPath + '" />';
  if (xml.includes('</scripts>')) xml = xml.replace('</scripts>', include + '\n</scripts>');
  else xml = xml.replace('</styles>', '</styles>\n<scripts>\n' + include + '\n</scripts>');
  return xml;
}
function hash(buf) {return crypto.createHash('sha256').update(buf).digest('hex');}
function record() {
  if (!fs.existsSync(RECORD_PATH)) return null;
  return JSON.parse(fs.readFileSync(RECORD_PATH,'utf8'));
}
function patchGameinfo(game) {
  const file = path.join(game,'game','citadel','gameinfo.gi');
  const current = fs.readFileSync(file,'utf8');
  if (/^\s*Game\s+citadel\/addons\s*$/m.test(current)) {
    if (!/^\s*Mod\s+citadel\s*$/m.test(current)) throw new Error('Unsafe gameinfo.gi mod paths; not modifying');
    return;
  }
  const match = /^([ \t]*)Game[ \t]+citadel[ \t]*\r?\n[ \t]*Game[ \t]+core[ \t]*$/m.exec(current);
  if (!match) throw new Error('Unknown gameinfo.gi search paths; not modifying');
  const eol = current.includes('\r\n') ? '\r\n' : '\n';
  const paths = [['Game','citadel/addons'],['Mod','citadel'],['Write','citadel'],
    ['Game','citadel'],['Mod','core'],['Write','core'],['Game','core']];
  const replacement = paths.map(([k,v])=> match[1] + k.padEnd(20) + v).join(eol);
  fs.mkdirSync(CACHE,{recursive:true});
  const backup = path.join(CACHE,'gameinfo.gi.bak');
  if (!fs.existsSync(backup)) fs.copyFileSync(file,backup);
  fs.writeFileSync(file,current.slice(0,match.index) + replacement + current.slice(match.index+match[0].length));
  console.log('Addon search path configured. Backup: ' + backup);
}
function uninstall() {
  const r = record();
  if (!r) return console.log('No tracked installation.');
  if (fs.existsSync(r.target)) {
    if (hash(fs.readFileSync(r.target)) !== r.sha256)
      throw new Error('Installed VPK changed since our install. Refusing to delete it.');
    fs.unlinkSync(r.target);
  }
  fs.unlinkSync(RECORD_PATH);
  console.log('Removed ' + r.target + '. Kept shared addon mount in gameinfo.gi.');
}
async function stockHud(game) {
  const cacheFile = path.join(CACHE,'stock_hud.xml');
  const local = path.join(game,'game','citadel','pak01_dir.vpk');
  const stale = !fs.existsSync(cacheFile) || fs.statSync(cacheFile).mtimeMs < fs.statSync(local).mtimeMs;
  if (stale) {
    if (ARGS.has('--offline')) throw new Error('Stock HUD cache is missing or older than game files.');
    const res = await fetch(STOCK_HUD_URL);
    if (!res.ok) throw new Error('Stock HUD download failed: HTTP ' + res.status);
    const xml = await res.text();
    if (!/<CitadelHud\b/.test(xml)) throw new Error('Downloaded HUD is not valid');
    fs.mkdirSync(CACHE,{recursive:true});
    fs.writeFileSync(cacheFile,xml);
  }
  return fs.readFileSync(cacheFile,'utf8');
}
async function main() {
  if (ARGS.has('--uninstall')) return uninstall();
  const cfg = config();
  const game = findGamePath(cfg);
  if (!game) throw new Error('Deadlock not found; set "gamePath" in config.json');
  const indexFile = path.join(game,'game','citadel','pak01_dir.vpk');
  const dataFile = path.join(ROOT,'generated','catalog.js');
  if (!fs.existsSync(dataFile)) throw new Error('Missing catalog. Run npm run sync first.');
  const idx = readVpkIndex(indexFile);
  const scriptTemplate = ['panorama/scripts/async.vts_c',
    'panorama/scripts/popups/popup_settings_old.vjs_c'].find(s=>idx.has(s)) ||
    [...idx].find(s=>/^panorama\/scripts\/.+\.v(ts|js)_c$/.test(s));
  if (!scriptTemplate) throw new Error('Cannot locate a Panorama script template in game VPK');
  const scriptPath = 'panorama/scripts/deadlock_ai_advisor.' + scriptTemplate.split('.').pop();
  const settings = {autoShowShop:cfg.autoShowShop,hotkey:cfg.hotkey};
  const script = fs.readFileSync(dataFile,'utf8') + '\nvar DAA_SETTINGS = ' +
    JSON.stringify(settings) + ';\n' + fs.readFileSync(path.join(ROOT,'src/advisor-core.js'),'utf8') +
    '\n' + fs.readFileSync(path.join(ROOT,'src/telemetry.js'),'utf8') +
    '\n' + fs.readFileSync(path.join(ROOT,'src/panorama/advisor.js'),'utf8');
  const files = [
    {path:'panorama/layout/hud.vxml_c',data:compileXml(injectHud(await stockHud(game),scriptPath),
      extractVpkFile(indexFile,'panorama/layout/hud.vxml_c'))},
    {path:'panorama/styles/deadlock_ai_advisor.vcss_c',data:compileCss(
      fs.readFileSync(path.join(ROOT,'src/panorama/advisor.css'),'utf8'),
      extractVpkFile(indexFile,'panorama/styles/hud.vcss_c'))},
    {path:scriptPath,data:compileJs(script,extractVpkFile(indexFile,scriptTemplate))}
  ];
  fs.mkdirSync(OUT,{recursive:true});
  const filename = 'pak' + String(cfg.pakNumber).padStart(2,'0') + '_dir.vpk';
  const built = path.join(OUT,filename);
  writeVpk(built,files);
  console.log('Built ' + built + ' (' + files.length + ' compiled resources)');
  if (ARGS.has('--install')) {
    const target = path.join(game,'game','citadel','addons',filename);
    const prev = record();
    if (fs.existsSync(target) && !(prev && prev.target === target &&
      hash(fs.readFileSync(target)) === prev.sha256)) {
      throw new Error('VPK slot occupied by another mod. Change pakNumber in config.json.');
    }
    // Verify gameinfo.gi before placing the mod; never delete files belonging to other mods.
    patchGameinfo(game);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(built,target);
    fs.mkdirSync(CACHE,{recursive:true});
    fs.writeFileSync(RECORD_PATH,JSON.stringify({target:target,sha256:hash(fs.readFileSync(target))},null,2));
    console.log('Installed in Deadlock: ' + target);
  }
}
if (require.main === module) main().catch(e=>{console.error('Build error:',e.message);process.exitCode=1;});
module.exports = {injectHud,patchGameinfo};
