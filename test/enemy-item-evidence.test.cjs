const {test} = require('node:test');
const assert=require('node:assert/strict');
global.DAA_PURCHASES=require('../src/purchase-feed.js');
const E=require('../src/enemy-item-evidence.js');
const catalog={items:[
 {id:1,name:'Healing Nova',shopable:true},
 {id:2,name:'Knockdown',shopable:true},
 {id:3,name:'Boundless Spirit',shopable:true},
 {id:4,name:'Metal Skin',shopable:true}
]};
test('enemy item threat applies only after human mark',()=>{
 const none=E.derive(catalog,[]);
 assert.equal(none.threats.healing,false);
 const a=E.derive(catalog,[1,1,2,3,999]);
 assert.deepEqual(a.threats,{healing:true,control:true,bullets:false,spirit:true});
 assert.deepEqual(a.signals.map(s=>s.id),['1','2','3']);
 assert.equal(a.unknown,0);
 assert.ok(a.signals.every(s=>s.confidence==='heuristic'&&s.source==='user-confirmed-enemy-item'));
});
test('unknown item does not invent a threat',()=>{
 const a=E.derive(catalog,[4]);
 assert.equal(a.unknown,1);
 assert.deepEqual(a.threats,{healing:false,control:false,bullets:false,spirit:false});
});
test('manually toggled threats and curated evidence are merged without clearing either',()=>{
 const x=E.merge({bullets:true},E.derive(catalog,[1]));
 assert.deepEqual(x,{healing:true,control:false,bullets:true,spirit:false});
 assert.deepEqual(E.merge({},E.derive(catalog,[])),
 {healing:false,control:false,bullets:false,spirit:false});
});
test('malformed input and missing catalog fail closed',()=>{
 const x=E.derive(null,['42']);
 assert.equal(x.signals.length,0);
 assert.deepEqual(E.derive(catalog,null).signals,[]);
});
