const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {writeVpk}=require('../tools/vpk');
const {writeResource,readBlocks}=require('../tools/s2res');
const {readVpkIndex,extractVpkFile,ROOT}=require('../tools/common');
const {build,verifyVpk,stockHud,uninstall,validRecordTarget}=require('../tools/build.cjs');
const HUD='<root><styles><include src="s2r://panorama/styles/hud.vcss" /></styles>'+
  '<CitadelHud class="WindowRoot" hittest="false"><Panel id="AbilitiesContainer"/></CitadelHud></root>';
function fakeResource(kind){
  return writeResource(1,[['RED2',Buffer.from('header:'+kind)],
    ['DATA',Buffer.from('stock resource: '+kind)]]);
}
function fixture(run){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'daa-v070-'));
  const game=path.join(base,'Deadlock'),
    citadel=path.join(game,'game','citadel'),out=path.join(base,'out'),
    cache=path.join(base,'cache'),generated=path.join(base,'generated');
  fs.mkdirSync(citadel,{recursive:true});fs.mkdirSync(generated,{recursive:true});
  const stock=path.join(citadel,'pak01_dir.vpk');
  writeVpk(stock,[
    {path:'panorama/layout/hud.vxml_c',data:fakeResource('xml')},
    {path:'panorama/styles/hud.vcss_c',data:fakeResource('css')},
    {path:'panorama/scripts/async.vts_c',data:fakeResource('script')}
  ]);
  const gameinfo=path.join(citadel,'gameinfo.gi');
  fs.writeFileSync(gameinfo,'SearchPaths\n{\n    Game citadel\n    Game core\n}\n');
  const catalog=path.join(generated,'catalog.js');
  fs.writeFileSync(catalog,'var DAA_CATALOG = '+JSON.stringify({
    heroes:[{id:1,name:'Test'}],
    items:[{id:2,name:'Healbane',slot:'spirit',cost:800,shopable:true}]
  })+';\n');
  const args={game,root:ROOT,out,cache,catalogPath:catalog,stockHudText:HUD,
    config:{gamePath:game,pakNumber:88,autoShowShop:true,hotkey:'key_backslash'}};
  return Promise.resolve().then(()=>run({...args,base,stock,citadel,gameinfo}))
    .finally(()=>fs.rmSync(base,{recursive:true,force:true}));
}
test('end-to-end: native Panorama bundle compiles, packages, extracts unchanged',()=>fixture(async a=>{
  const result=await build(a);
  assert.equal(result.installed,null);
  assert.equal(result.files,3);
  const manifest=JSON.parse(fs.readFileSync(result.manifest,'utf8'));
  assert.equal(manifest.toolVersion,'0.7.0');
  assert.equal(manifest.fileCount,3);
  assert.equal(manifest.addonSha256,
    crypto.createHash('sha256').update(fs.readFileSync(result.built)).digest('hex'));
  assert.ok(!JSON.stringify(manifest).includes(a.game),'manifest must not reveal local game path');
  assert.equal(result.scriptTemplate,'panorama/scripts/async.vts_c');
  const idx=readVpkIndex(result.built);
  assert.deepEqual([...idx].sort(),[
    'panorama/layout/hud.vxml_c',
    'panorama/scripts/deadlock_ai_advisor.vts_c',
    'panorama/styles/deadlock_ai_advisor.vcss_c'
  ]);
  const xml=readBlocks(extractVpkFile(result.built,'panorama/layout/hud.vxml_c'))
    .blocks.DATA.toString('utf8');
  assert.match(xml,/deadlock_ai_advisor\.vts_c/);
  assert.match(xml,/deadlock_ai_advisor\.vcss_c/);
  const js=readBlocks(extractVpkFile(result.built,'panorama/scripts/deadlock_ai_advisor.vts_c'))
    .blocks.DATA.toString('utf8');
  for(const key of ['DAA_PURCHASES','DAA_TELEMETRY','DAA_ROSTER','DAA_ROUTE','DAA_BLUEPRINT','DAA_SETTINGS'])
    assert.ok(js.includes(key),'missing script section '+key);
  assert.equal(fs.existsSync(path.join(a.citadel,'addons','pak88_dir.vpk')),false);
  assert.equal(fs.readFileSync(a.gameinfo,'utf8').includes('citadel/addons'),false);
}));
test('end-to-end: own VPK can be installed, replaced and uninstalled by SHA-256',()=>fixture(async a=>{
  const first=await build({...a,install:true});
  const installed=first.installed;
  assert.ok(fs.existsSync(installed));
  assert.match(fs.readFileSync(a.gameinfo,'utf8'),/Game\s+citadel\/addons/);
  assert.ok(fs.existsSync(path.join(a.cache,'gameinfo.gi.bak')));
  const record=JSON.parse(fs.readFileSync(path.join(a.cache,'installed.json'),'utf8'));
  assert.equal(record.target,installed);
  assert.equal(record.sha256,crypto.createHash('sha256').update(fs.readFileSync(installed)).digest('hex'));
  const second=await build({...a,install:true});
  assert.equal(second.installed,first.installed);
  assert.ok(fs.existsSync(installed));
  assert.equal(uninstall({recordPath:path.join(a.cache,'installed.json')}),installed);
  assert.equal(fs.existsSync(installed),false);
  assert.ok(fs.existsSync(path.join(a.cache,'gameinfo.gi.bak')));
}));
test('foreign VPK conflict refuses to replace and does not edit gameinfo',()=>fixture(async a=>{
  const dest=path.join(a.citadel,'addons','pak88_dir.vpk');
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,'FOREIGN MOD');
  const original=fs.readFileSync(a.gameinfo,'utf8');
  await assert.rejects(()=>build({...a,install:true}),/occupied or modified/);
  assert.equal(fs.readFileSync(dest,'utf8'),'FOREIGN MOD');
  assert.equal(fs.readFileSync(a.gameinfo,'utf8'),original);
}));
test('bad HUD layout refuses compile with no game changes',()=>fixture(async a=>{
  const original=fs.readFileSync(a.gameinfo,'utf8');
  await assert.rejects(()=>build({...a,stockHudText:'<root></root>',install:true}),/Stock hud.xml/);
  assert.equal(fs.readFileSync(a.gameinfo,'utf8'),original);
  assert.equal(fs.existsSync(path.join(a.citadel,'addons','pak88_dir.vpk')),false);
}));
test('offline source cache is tied to the exact stock directory VPK digest',()=>fixture(async a=>{
  await assert.rejects(()=>stockHud(a.game,{cache:a.cache,offline:true}),/not verified/);
  fs.mkdirSync(a.cache,{recursive:true});
  fs.writeFileSync(path.join(a.cache,'stock_hud.xml'),HUD);
  const digest=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
  fs.writeFileSync(path.join(a.cache,'stock_hud_meta.json'),JSON.stringify({
    gameVpkSha256:digest(fs.readFileSync(a.stock)),xmlSha256:digest(Buffer.from(HUD)),
    source:'https://raw.githubusercontent.com/SteamTracking/GameTracking-Deadlock/master/game/citadel/pak01_dir/panorama/layout/hud.xml'
  }));
  assert.equal(await stockHud(a.game,{cache:a.cache,offline:true}),HUD);
  fs.appendFileSync(a.stock,'changed');
  await assert.rejects(()=>stockHud(a.game,{cache:a.cache,offline:true}),/not verified/);
}));
test('tampered VPK is rejected and uninstall refuses modified addon',()=>fixture(async a=>{
  const result=await build({...a,install:true});
  const file=result.installed;
  fs.appendFileSync(file,'EXTRA');
  assert.throws(()=>uninstall({recordPath:path.join(a.cache,'installed.json')}),/changed/);
  assert.ok(fs.existsSync(file));
  assert.throws(()=>verifyVpk(result.built,[{path:'panorama/layout/hud.vxml_c',
    data:Buffer.from('fake')}]),/unexpected resource count/);
}));
test('uninstall will never follow a malicious installation record to another file',()=>fixture(async a=>{
  const other=path.join(a.base,'notes.txt');
  fs.writeFileSync(other,'do not delete');
  const record=path.join(a.cache,'installed.json');
  fs.mkdirSync(a.cache,{recursive:true});
  fs.writeFileSync(record,JSON.stringify({target:other,sha256:'bad'}));
  assert.equal(validRecordTarget({target:other}),false);
  assert.throws(()=>uninstall({recordPath:record}),/Unsafe/);
  assert.equal(fs.readFileSync(other,'utf8'),'do not delete');
}));
