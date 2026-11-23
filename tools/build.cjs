'use strict';
// Native Panorama compiler/VPK packer; see THIRD_PARTY_NOTICES.md for vendored tooling.
// v0.7: validated resources, end-to-end offline fixture testing and transactional installs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {ROOT,CACHE,OUT,findGamePath,readVpkIndex,extractVpkFile} = require('./common');
const {compileJs,compileCss,compileXml,readBlocks} = require('./s2res');
const {writeVpk} = require('./vpk');
const STOCK_HUD_URL =
  'https://raw.githubusercontent.com/SteamTracking/GameTracking-Deadlock/master/game/citadel/pak01_dir/panorama/layout/hud.xml';
const CONFIG_PATH=path.join(ROOT,'config.json');
const RECORD_PATH=path.join(CACHE,'installed.json');
const SCRIPT_SOURCES=[
  'src/advisor-core.js','src/telemetry.js','src/roster-telemetry.js',
  'src/purchase-feed.js','src/enemy-item-evidence.js','src/inference-guard.js',
  'src/purchase-route.js','src/strategy-engine.js','src/inventory-state.js','src/hud-health.js',
  'src/panorama/advisor.js'
];
function sha256(data){return crypto.createHash('sha256').update(data).digest('hex');}
function config() {
  const defaults={gamePath:'',pakNumber:88,autoShowShop:true,hotkey:'key_backslash'};
  if(!fs.existsSync(CONFIG_PATH)) return defaults;
  const obj=JSON.parse(fs.readFileSync(CONFIG_PATH,'utf8'));
  const c=Object.assign({},defaults,obj);
  if(!Number.isInteger(c.pakNumber)||c.pakNumber<1||c.pakNumber>99)
    throw new Error('pakNumber must be between 1 and 99');
  if(typeof c.hotkey!=='string'||!/^key_[a-z0-9_]{1,48}$/.test(c.hotkey))
    throw new Error('hotkey must use a key_* identifier');
  if(typeof c.autoShowShop!=='boolean')
    throw new Error('autoShowShop must be boolean');
  return c;
}
function filename(pak){
  if(!Number.isInteger(pak)||pak<1||pak>99)
    throw new Error('Invalid VPK slot; expected 1..99');
  return 'pak'+String(pak).padStart(2,'0')+'_dir.vpk';
}
function injectHud(xml,scriptPath) {
  if(typeof xml!=='string'||!/<root(?:\s[^>]*)?>/.test(xml)||
      !/<CitadelHud\b/.test(xml)||!/<\/root>\s*$/.test(xml)||
      !/<styles>/.test(xml)||!/<\/styles>/.test(xml))
    throw new Error('Stock hud.xml no longer matches the expected Panorama layout');
  if((xml.match(/<CitadelHud\b/g)||[]).length!==1 ||
      (xml.match(/<\/styles>/g)||[]).length!==1)
    throw new Error('Unexpected duplicate core HUD elements');
  if(!/^panorama\/scripts\/deadlock_ai_advisor\.v(?:ts|js)_c$/.test(scriptPath))
    throw new Error('Unexpected script path');
  if(xml.includes('deadlock_ai_advisor.'))
    throw new Error('Already patched HUD');
  xml=xml.replace('</styles>',
    '  <include src="s2r://panorama/styles/deadlock_ai_advisor.vcss_c" />\n</styles>');
  const script='<include src="s2r://'+scriptPath+'" />';
  if(xml.includes('</scripts>')) xml=xml.replace('</scripts>','  '+script+'\n</scripts>');
  else xml=xml.replace('</styles>',
    '</styles>\n<scripts>\n  '+script+'\n</scripts>');
  if(!xml.includes(script)||!xml.includes('deadlock_ai_advisor.vcss_c'))
    throw new Error('HUD injection failed');
  return xml;
}
function readRecord(recordPath=RECORD_PATH) {
  if(!fs.existsSync(recordPath)) return null;
  return JSON.parse(fs.readFileSync(recordPath,'utf8'));
}
function patchGameinfo(game,cache=CACHE) {
  const file=path.join(game,'game','citadel','gameinfo.gi');
  const current=fs.readFileSync(file,'utf8');
  if(/^\s*Game\s+citadel\/addons\s*$/m.test(current)){
    if(!/^\s*Mod\s+citadel\s*$/m.test(current))
      throw new Error('Unsafe gameinfo.gi: addons mounted without Mod citadel');
    return false;
  }
  const match=/^([ \t]*)Game[ \t]+citadel[ \t]*\r?\n[ \t]*Game[ \t]+core[ \t]*$/m.exec(current);
  if(!match) throw new Error('Unknown gameinfo.gi search paths; refusing to patch');
  const eol=current.includes('\r\n')?'\r\n':'\n';
  const paths=[['Game','citadel/addons'],['Mod','citadel'],['Write','citadel'],
    ['Game','citadel'],['Mod','core'],['Write','core'],['Game','core']];
  const replacement=paths.map(([k,v])=>match[1]+k.padEnd(20)+v).join(eol);
  const updated=current.slice(0,match.index)+replacement+current.slice(match.index+match[0].length);
  fs.mkdirSync(cache,{recursive:true});
  const backup=path.join(cache,'gameinfo.gi.bak');
  // Never silently replace the one unmodified original backup.
  if(!fs.existsSync(backup)) fs.copyFileSync(file,backup);
  const tmp=file+'.daa-writing';
  try{fs.writeFileSync(tmp,updated);fs.renameSync(tmp,file);}
  finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
  return true;
}
function validateResource(buffer,kind) {
  if(!Buffer.isBuffer(buffer)||buffer.length<32)throw new Error('Missing '+kind+' template');
  const info=readBlocks(buffer);
  if(!info.blocks.DATA||!info.blocks.RED2)
    throw new Error(kind+' template has no DATA/RED2 blocks; game format unsupported');
  return info;
}
function chooseScriptTemplate(vpk,index) {
  const candidates=['panorama/scripts/async.vts_c',
    'panorama/scripts/popups/popup_settings_old.vjs_c'].concat(
      [...index].filter(x=>/^panorama\/scripts\/.+\.v(ts|js)_c$/.test(x)).sort());
  const seen=new Set();
  for(const k of candidates) {
    if(seen.has(k)||!index.has(k))continue;
    seen.add(k);
    try {
      const template=extractVpkFile(vpk,k);
      validateResource(template,'script');
      return {source:k,template,path:'panorama/scripts/deadlock_ai_advisor.'+k.split('.').pop()};
    } catch(e) {}
  }
  throw new Error('Cannot find a stock Panorama script template containing DATA and RED2');
}
function verifyVpk(file,expected) {
  const idx=readVpkIndex(file);
  if(idx.size!==expected.length)throw new Error('VPK contains an unexpected resource count');
  for(const item of expected) {
    if(!idx.has(item.path)||!extractVpkFile(file,item.path).equals(item.data))
      throw new Error('VPK round-trip verification failed: '+item.path);
  }
  return {files:expected.length,sha256:sha256(fs.readFileSync(file))};
}
async function stockHud(game,options={}) {
  if(typeof options.stockHudText==='string')return options.stockHudText;
  const cache=options.cache||CACHE;
  const cacheFile=path.join(cache,'stock_hud.xml');
  const infoFile=path.join(cache,'stock_hud_meta.json');
  const stock=path.join(game,'game','citadel','pak01_dir.vpk');
  const signature=sha256(fs.readFileSync(stock));
  if(fs.existsSync(cacheFile)&&fs.existsSync(infoFile)) {
    try{
      const info=JSON.parse(fs.readFileSync(infoFile,'utf8'));
      if(info.gameVpkSha256===signature&&
        info.source===STOCK_HUD_URL&&info.xmlSha256===sha256(fs.readFileSync(cacheFile)))
        return fs.readFileSync(cacheFile,'utf8');
    }catch(e){}
  }
  if(options.offline)throw new Error(
    'Stock HUD cache was not verified for this game VPK; run a connected build first');
  const request=await fetch(STOCK_HUD_URL,{signal:AbortSignal.timeout(30000)});
  if(!request.ok)throw new Error('Stock HUD download failed: HTTP '+request.status);
  const xml=await request.text();
  if(!/<CitadelHud\b/.test(xml)||!/<\/root>\s*$/.test(xml))
    throw new Error('Downloaded HUD is not valid');
  fs.mkdirSync(cache,{recursive:true});
  const tmp=cacheFile+'.tmp';
  fs.writeFileSync(tmp,xml);
  fs.renameSync(tmp,cacheFile);
  fs.writeFileSync(infoFile,JSON.stringify({
    gameVpkSha256:signature,xmlSha256:sha256(Buffer.from(xml,'utf8')),
    source:STOCK_HUD_URL,downloadedAt:new Date().toISOString()
  },null,2));
  // Caching proves which local VPK was present at download time. It does NOT
  // prove SteamTracking's latest extracted HUD belongs to this exact build.
  return xml;
}
function scriptBundle(root,catalogFile,cfg) {
  const data=fs.readFileSync(catalogFile,'utf8');
  if(!/^\s*var DAA_CATALOG\s*=/.test(data))
    throw new Error('Invalid executable catalog; run npm run sync');
  return data+'\nvar DAA_SETTINGS = '+JSON.stringify({
    autoShowShop:cfg.autoShowShop,hotkey:cfg.hotkey})+';\n'+
    SCRIPT_SOURCES.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
}
function validRecordTarget(record) {
  if(!record||typeof record.target!=='string')return false;
  const target=path.resolve(record.target);
  return /^pak\d{2}_dir\.vpk$/i.test(path.basename(target)) &&
    path.basename(path.dirname(target)).toLowerCase()==='addons' &&
    path.basename(path.dirname(path.dirname(target))).toLowerCase()==='citadel' &&
    path.basename(path.dirname(path.dirname(path.dirname(target)))).toLowerCase()==='game';
}
function writeRecord(recordPath,record) {
  fs.mkdirSync(path.dirname(recordPath),{recursive:true});
  const tmp=recordPath+'.tmp';
  try{fs.writeFileSync(tmp,JSON.stringify(record,null,2));fs.renameSync(tmp,recordPath);}
  finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
}
function install(game,built,filenameValue,options={}) {
  const cache=options.cache||CACHE;
  const recordPath=options.recordPath||path.join(cache,'installed.json');
  const target=path.join(game,'game','citadel','addons',filenameValue);
  const old=readRecord(recordPath);
  if(old&&!validRecordTarget(old))throw new Error('Unsafe installation record; refusing to alter files');
  if(old&&old.target!==target&&fs.existsSync(old.target))
    throw new Error('Another tracked installation exists; uninstall it before changing VPK slot');
  if(fs.existsSync(target)&&!(old&&old.target===target&&old.sha256===sha256(fs.readFileSync(target))))
    throw new Error('VPK slot occupied or modified. Change pakNumber; no files were overwritten');
  const tmp=target+'.daa-next',backup=target+'.daa-previous';
  if(fs.existsSync(tmp)||fs.existsSync(backup))
    throw new Error('Interrupted prior install detected. Remove .daa-* files after inspection');
  // Compiled file verified BEFORE patchGameinfo or any change to game directory.
  verifyVpk(built,[
    {path:'panorama/layout/hud.vxml_c',data:extractVpkFile(built,'panorama/layout/hud.vxml_c')},
    {path:'panorama/styles/deadlock_ai_advisor.vcss_c',
     data:extractVpkFile(built,'panorama/styles/deadlock_ai_advisor.vcss_c')},
    {path:[...readVpkIndex(built)].find(x=>/^panorama\/scripts\/deadlock_ai_advisor\.v(ts|js)_c$/.test(x)),
     data:extractVpkFile(built,[...readVpkIndex(built)].find(x=>/^panorama\/scripts\/deadlock_ai_advisor\.v(ts|js)_c$/.test(x)))}
  ]);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  let movedOld=false,newActive=false,completed=false;
  try {
    fs.copyFileSync(built,tmp);
    const expected=sha256(fs.readFileSync(built));
    if(sha256(fs.readFileSync(tmp))!==expected)throw new Error('Staged VPK hash mismatch');
    // The source VPK and output are both validated, and staged bytes match.
    // Modify gameinfo only after all non-mutating collision checks succeeded.
    patchGameinfo(game,cache);
    if(fs.existsSync(target)){fs.renameSync(target,backup);movedOld=true;}
    fs.renameSync(tmp,target);newActive=true;
    const installedHash=sha256(fs.readFileSync(target));
    if(installedHash!==expected)throw new Error('Installed VPK hash mismatch');
    writeRecord(recordPath,{target,sha256:installedHash,version:7,
      sourceVpkSha256:sha256(fs.readFileSync(path.join(game,'game','citadel','pak01_dir.vpk')))});
    completed=true;
    if(movedOld)fs.unlinkSync(backup);
  } catch(e) {
    if(!completed) {
      if(newActive&&fs.existsSync(target))fs.unlinkSync(target);
      if(movedOld&&fs.existsSync(backup))fs.renameSync(backup,target);
    }
    throw e;
  } finally {
    if(fs.existsSync(tmp))fs.unlinkSync(tmp);
  }
  return target;
}
function uninstall(options={}) {
  const recordPath=options.recordPath||RECORD_PATH;
  const rec=readRecord(recordPath);
  if(!rec)return null;
  if(!validRecordTarget(rec))throw new Error('Unsafe installation record target');
  if(fs.existsSync(rec.target)) {
    if(sha256(fs.readFileSync(rec.target))!==rec.sha256)
      throw new Error('Installed VPK has changed; refusing to delete it');
    fs.unlinkSync(rec.target);
  }
  fs.unlinkSync(recordPath);
  return rec.target;
}
async function build(options={}) {
  const cfg=options.config||config();
  const game=options.game!==undefined?options.game:findGamePath(cfg);
  if(!game)throw new Error('Deadlock not found; set gamePath in config.json');
  const root=options.root||ROOT,out=options.out||OUT;
  const vpk=path.join(game,'game','citadel','pak01_dir.vpk');
  const catalog=options.catalogPath||path.join(root,'generated','catalog.js');
  if(!fs.existsSync(catalog))throw new Error('Missing catalog. Run npm run sync first');
  const idx=readVpkIndex(vpk);
  const compiled=chooseScriptTemplate(vpk,idx);
  const xmlTemplate=extractVpkFile(vpk,'panorama/layout/hud.vxml_c');
  const cssTemplate=extractVpkFile(vpk,'panorama/styles/hud.vcss_c');
  validateResource(xmlTemplate,'HUD layout');
  validateResource(cssTemplate,'HUD styles');
  const markup=injectHud(await stockHud(game,options),compiled.path);
  const script=scriptBundle(root,catalog,cfg);
  const files=[
    {path:'panorama/layout/hud.vxml_c',data:compileXml(markup,xmlTemplate)},
    {path:'panorama/styles/deadlock_ai_advisor.vcss_c',data:compileCss(
      fs.readFileSync(path.join(root,'src/panorama/advisor.css'),'utf8'),cssTemplate)},
    {path:compiled.path,data:compileJs(script,compiled.template)}
  ];
  // Ensure fresh game metadata did not change while compiling.
  const builtName=filename(cfg.pakNumber);
  fs.mkdirSync(out,{recursive:true});
  const result=path.join(out,builtName),tmp=result+'.daa-next';
  if(fs.existsSync(tmp))throw new Error('Temporary output VPK already exists');
  try{
    writeVpk(tmp,files);
    verifyVpk(tmp,files);
    fs.renameSync(tmp,result);
  } finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
  const manifest={
    schemaVersion:1,toolVersion:'0.7.0',buildTime:new Date().toISOString(),
    gameVpkSha256:sha256(fs.readFileSync(vpk)),
    stockHudSha256:sha256(Buffer.from(markup,'utf8')),
    catalogSha256:sha256(fs.readFileSync(catalog)),
    scriptTemplate:compiled.source,addonFile:builtName,
    addonSha256:sha256(fs.readFileSync(result)),
    fileCount:files.length,warning:'Not validated in a running Deadlock client'
  };
  const manifestPath=path.join(out,'build_manifest.json');
  const manifestTmp=manifestPath+'.tmp';
  try {
    fs.writeFileSync(manifestTmp,JSON.stringify(manifest,null,2));
    fs.renameSync(manifestTmp,manifestPath);
  } finally {if(fs.existsSync(manifestTmp))fs.unlinkSync(manifestTmp);}
  let installed=null;
  if(options.install)installed=install(game,result,builtName,options);
  return {built:result,manifest:manifestPath,installed,scriptTemplate:compiled.source,
    verification:'VPK byte-for-byte round trip',files:files.length};
}
async function main() {
  const argv=new Set(process.argv.slice(2));
  if(argv.has('--uninstall')) {
    const removed=uninstall();
    console.log(removed?'Removed '+removed:'No tracked installation.');
    return;
  }
  const result=await build({install:argv.has('--install'),offline:argv.has('--offline')});
  console.log('Verified VPK: '+result.built+' ('+result.files+' resources; '+result.scriptTemplate+')');
  if(result.installed)console.log('Installed in Deadlock: '+result.installed);
  console.log('WARNING: a verified VPK does not prove the installed game executes the mod.');
}
if(require.main===module)main().catch(e=>{console.error('Build error:',e.message);process.exitCode=1;});
module.exports={config,injectHud,patchGameinfo,stockHud,chooseScriptTemplate,
  verifyVpk,validRecordTarget,install,uninstall,build,scriptBundle};
