const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {writeVpk}=require('../tools/vpk');
const {inspect}=require('../tools/doctor.cjs');
function workspace(fn) {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'daa-doctor-'));
  try {
    const root=path.join(tmp,'source'),game=path.join(tmp,'Deadlock'),
      citadel=path.join(game,'game','citadel'),
      cache=path.join(root,'cache'),out=path.join(root,'out');
    for(const p of [citadel,path.join(citadel,'addons'),cache,out,
      path.join(root,'generated')]) fs.mkdirSync(p,{recursive:true});
    const input=(v)=>Buffer.from(v);
    writeVpk(path.join(citadel,'pak01_dir.vpk'),[
      {path:'panorama/layout/hud.vxml_c',data:input('hud')},
      {path:'panorama/styles/hud.vcss_c',data:input('css')},
      {path:'panorama/scripts/async.vts_c',data:input('script')}
    ]);
    fs.writeFileSync(path.join(citadel,'gameinfo.gi'),'SearchPaths\n{\nGame citadel/addons\nGame citadel\nGame core\n}\n');
    fs.writeFileSync(path.join(root,'generated','catalog.json'),JSON.stringify({
      generatedAt:new Date().toISOString(),heroes:[{id:1}],items:Array.from({length:24},(_,i)=>({id:i+1}))
    }));
    return fn({root,game,citadel,cache,out,config:{pakNumber:88}});
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
}
function codes(report) {return report.checks.map(x=>x.code);}
test('missing game yields actionable report without modifying any file',()=>{
  const x=inspect({gamePath:'',config:{pakNumber:88}});
  assert.equal(x.healthy,false);
  assert.ok(codes(x).includes('game-not-found'));
});
test('game resources and fresh catalog inspected read-only',()=>workspace(args=>{
  const before=fs.readFileSync(path.join(args.citadel,'gameinfo.gi'),'utf8');
  const report=inspect(Object.assign({gamePath:args.game},args));
  assert.equal(report.healthy,true);
  assert.ok(codes(report).includes('stock-vpk-index'));
  assert.ok(codes(report).includes('catalog-valid'));
  assert.ok(codes(report).includes('not-installed'));
  assert.equal(fs.readFileSync(path.join(args.citadel,'gameinfo.gi'),'utf8'),before);
}));
test('complete installed VPK and SHA-256 recorded correctly',()=>workspace(args=>{
  const target=path.join(args.citadel,'addons','pak88_dir.vpk');
  writeVpk(target,[
    {path:'panorama/layout/hud.vxml_c',data:Buffer.from('patched')},
    {path:'panorama/styles/deadlock_ai_advisor.vcss_c',data:Buffer.from('css')},
    {path:'panorama/scripts/deadlock_ai_advisor.vts_c',data:Buffer.from('js')}
  ]);
  const sha=crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
  fs.writeFileSync(path.join(args.cache,'installed.json'),JSON.stringify({target,sha256:sha}));
  const report=inspect(Object.assign({gamePath:args.game},args));
  assert.equal(report.healthy,true);
  assert.ok(codes(report).includes('installed-hash-ok'));
  assert.ok(codes(report).includes('addon-resources-present'));
  fs.appendFileSync(target,'x');
  const after=inspect(Object.assign({gamePath:args.game},args));
  assert.equal(after.healthy,false);
  assert.ok(codes(after).includes('installed-hash-mismatch'));
}));
test('unknown foreign VPK slot is never reported as a safe owned installation',()=>workspace(args=>{
  const file=path.join(args.citadel,'addons','pak88_dir.vpk');
  writeVpk(file,[{path:'panorama/layout/hud.vxml_c',data:Buffer.from('other mod')}]);
  const report=inspect(Object.assign({gamePath:args.game},args));
  assert.equal(report.healthy,false);
  assert.ok(codes(report).includes('slot-not-owned'));
}));
test('missing native resources and obsolete catalog are diagnosed',()=>workspace(args=>{
  const stock=path.join(args.citadel,'pak01_dir.vpk');
  writeVpk(stock,[{path:'panorama/layout/hud.vxml_c',data:Buffer.from('hud')}]);
  const cat=path.join(args.root,'generated','catalog.json');
  const data=JSON.parse(fs.readFileSync(cat,'utf8'));
  data.generatedAt='2020-01-01T00:00:00.000Z';
  fs.writeFileSync(cat,JSON.stringify(data));
  const report=inspect(Object.assign({gamePath:args.game},args));
  assert.equal(report.healthy,false);
  assert.ok(codes(report).includes('game-resource-missing'));
  assert.ok(codes(report).includes('script-template-missing'));
  assert.ok(codes(report).includes('catalog-stale'));
}));
