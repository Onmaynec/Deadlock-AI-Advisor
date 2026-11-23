const {test}=require('node:test');
const assert=require('node:assert/strict');
global.DAA=require('../src/advisor-core.js');
const B=require('../src/build-blueprint.js');
const catalog={
  heroes:[{id:1,name:'Hero'},{id:2,name:'Enemy'},{id:3,name:'Enemy 2'}],
  items:Array.from({length:15},(_,i)=>({
    id:i+101,name:'Item '+(i+1),slot:['weapon','spirit','vitality'][i%3],
    cost:1000+i*200,shopable:true
  }))
};
function state() {
  return {heroId:1,enemyHeroIds:[2,3],owned:[101,102],
    pinned:[103,104],enemyItemIds:[105,106],slots:9,
    threats:{healing:true,control:false,bullets:true,spirit:false},
    strategy:'survival',souls:4500,steamId:'secret-not-to-export'};
}
test('blueprint roundtrips every manual advisory field deterministically',()=>{
  const before=state(), snapshot=JSON.stringify(before);
  const first=B.encode(catalog,before);
  assert.equal(first.ok,true);
  assert.match(first.code,/^DAA1:/);
  const loaded=B.decode(catalog,first.code);
  assert.equal(loaded.ok,true);
  assert.equal(loaded.snapshot.heroId,'1');
  assert.deepEqual(loaded.snapshot.enemyHeroIds,['2','3']);
  assert.deepEqual(loaded.snapshot.owned,['101','102']);
  assert.deepEqual(loaded.snapshot.pinned,['103','104']);
  assert.deepEqual(loaded.snapshot.enemyItemIds,['105','106']);
  assert.equal(loaded.snapshot.slots,9);
  assert.deepEqual(loaded.snapshot.threats,
    {healing:true,control:false,bullets:true,spirit:false});
  assert.equal(loaded.snapshot.strategy,'survival');
  assert.equal(B.encode(catalog,loaded.snapshot).code,first.code);
  assert.equal(JSON.stringify(before),snapshot);
});
test('code contains no souls, account ID, telemetry or local file paths',()=>{
  const s=state();s.souls=987654321;s.accountId='user-private';s.path='C:\\Users\\Private';
  const code=B.encode(catalog,s).code;
  assert.ok(!code.includes('987654321'));
  assert.ok(!code.includes('user-private'));
  assert.ok(!code.includes('Private'));
  assert.ok(!code.includes('{'));
  assert.ok(code.length<200);
});
test('corruption is detected before an import can apply any state',()=>{
  const code=B.encode(catalog,state()).code;
  const altered=code.replace('101','999');
  assert.notEqual(altered,code);
  const result=B.decode(catalog,altered);
  assert.equal(result.ok,false);
  assert.match(result.error,/Контрольная сумма/);
});
test('manually rechecksummed unknown catalog items still fail closed',()=>{
  const old=B.encode(catalog,state()).code;
  const payload=old.split(':')[1].replace('101','999');
  const fake='DAA1:'+payload+':'+B.digest('DAA1:'+payload);
  const result=B.decode(catalog,fake);
  assert.equal(result.ok,false);
  assert.match(result.error,/каталогу/);
});
test('IDs removed by a game patch are never silently remapped by name',()=>{
  const code=B.encode(catalog,state()).code;
  const changed={heroes:catalog.heroes,items:catalog.items.filter(x=>x.id!==101)};
  const result=B.decode(changed,code);
  assert.equal(result.ok,false);
});
test('reject malformed, oversized and unsupported version codes',()=>{
  const code=B.encode(catalog,state()).code;
  for (const bad of [null,undefined,'',{},'DAA2'+code.slice(4),
      'DDA1'+code.slice(4),'x'.repeat(B.maxLength+1)]) {
    const result=B.decode(catalog,bad);
    assert.equal(result.ok,false,String(bad).slice(0,30));
  }
});
test('wrong capacity, duplicate inventory and pinned-owned overlap are rejected',()=>{
  const a=state();a.slots=8;
  assert.throws(()=>B.encode(catalog,a),/slots/);
  a.slots=9;a.owned=[101,101];
  assert.throws(()=>B.encode(catalog,a),/duplicate/);
  a.owned=[101];a.pinned=[101];
  assert.throws(()=>B.encode(catalog,a),/pinned item already owned/);
  a.pinned=[];a.owned=Array.from({length:10},(_,i)=>101+i);
  assert.throws(()=>B.encode(catalog,a),/capacity/);
});
test('reject duplicate enemy heroes, impossible team assignments and pin overflow',()=>{
  const a=state();a.enemyHeroIds=[2,2];
  assert.throws(()=>B.encode(catalog,a),/duplicate/);
  a.enemyHeroIds=[1];
  assert.throws(()=>B.encode(catalog,a),/both teams/);
  a.enemyHeroIds=[2];a.pinned=[103,104,105,106,107,108];
  assert.throws(()=>B.encode(catalog,a),/invalid count/);
});
test('unknown hero, invalid item and invalid strategy are never accepted',()=>{
  const a=state();a.heroId=999;
  assert.throws(()=>B.encode(catalog,a),/unknown ID/);
  a.heroId=1;a.enemyItemIds=[999];
  assert.throws(()=>B.encode(catalog,a),/unknown ID/);
  a.enemyItemIds=[];a.strategy='paid-ai-superpower';
  assert.throws(()=>B.encode(catalog,a),/unknown strategy/);
});
test('all four legitimate strategy names roundtrip',()=>{
  for(const strategy of ['balanced','survival','pressure','budget']) {
    const s=state();s.strategy=strategy;
    assert.equal(B.decode(catalog,B.encode(catalog,s).code).snapshot.strategy,strategy);
  }
});
test('manual heroic choice may be unspecified; balance is never imported',()=>{
  const s=state();s.heroId='';s.enemyHeroIds=[];
  const result=B.decode(catalog,B.encode(catalog,s).code);
  assert.equal(result.ok,true);
  assert.equal(result.snapshot.heroId,'');
  assert.equal(Object.hasOwn(result.snapshot,'souls'),false);
});
test('decode refuses correctly checksummed noncanonical fields',()=>{
  const original=B.encode(catalog,state()).code;
  const payload=original.split(':')[1];
  const invalid=payload.replace('.9.5.1','.09.5.1');
  assert.notEqual(payload,invalid);
  const signed='DAA1:'+invalid+':'+B.digest('DAA1:'+invalid);
  assert.equal(B.decode(catalog,signed).ok,false);
});
test('simple strings and unsupported types cannot be mistaken for numeric IDs',()=>{
  const s=state();
  s.owned=['101 OR 1=1'];
  assert.throws(()=>B.encode(catalog,s),/invalid/);
  s.owned=[101];s.pinned=[true];
  assert.throws(()=>B.encode(catalog,s),/invalid/);
});
