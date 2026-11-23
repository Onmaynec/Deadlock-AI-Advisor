const {test}=require('node:test');
const assert=require('node:assert/strict');
global.DAA=require('../src/advisor-core.js');
const M=require('../src/inventory-state.js');
function item(id,name,cost=800,components=[]) {
  return {id,name,cost,components,slot:'weapon',shopable:true};
}
const catalog={items:[item(1,'Base'),item(2,'Other'),item(3,'Upgrade',3200,[1]),
  ...Array.from({length:8},(_,i)=>item(10+i,'Extra '+i))]};
test('manually mark a real item; never make a game purchase',()=>{
  const x=M.mark(catalog,[],1,9);
  assert.equal(x.ok,true);
  assert.deepEqual(x.owned,['1']);
  assert.deepEqual(x.previous,[]);
  assert.equal(x.payment,800);
  assert.equal(M.mark(catalog,x.owned,1,9).error,'already-owned');
  assert.equal(M.mark(catalog,x.owned,999,9).error,'unknown-item');
});
test('component upgrade consumes prior owned item and pays verified difference',()=>{
  const x=M.mark(catalog,[1,2],3,9);
  assert.equal(x.ok,true);
  assert.deepEqual(x.owned,['2','3']);
  assert.equal(x.consumed,'1');
  assert.equal(x.payment,2400);
});
test('capacity 9 to 12 rejects independent purchases at full occupancy',()=>{
  const owned=[1,2,10,11,12,13,14,15,16];
  assert.equal(M.mark(catalog,owned,17,9).error,'full-inventory');
  const x=M.mark(catalog,owned,3,9);
  assert.equal(x.ok,true);
  assert.equal(x.owned.length,9);
  assert.equal(M.capacity(999),12);
  assert.equal(M.capacity(-2),9);
  assert.equal(M.mark(catalog,owned,17,12).ok,true);
});
test('history undo restores original inventory over multiple changes',()=>{
  let owned=[],history=[];
  const a=M.mark(catalog,owned,1,9);
  history=M.push(history,a.previous);owned=a.owned;
  const b=M.mark(catalog,owned,3,9);
  history=M.push(history,b.previous);owned=b.owned;
  const c=M.remove(catalog,owned,3);
  history=M.push(history,c.previous);owned=c.owned;
  const once=M.undo(catalog,history,owned);
  assert.deepEqual(once.owned,['3']);
  const twice=M.undo(catalog,once.history,once.owned);
  assert.deepEqual(twice.owned,['1']);
  const thrice=M.undo(catalog,twice.history,twice.owned);
  assert.deepEqual(thrice.owned,[]);
});
test('invalid or duplicated inventory entries never consume phantom slots',()=>{
  assert.deepEqual(M.clean(catalog,[1,'1',999,2,null]),['1','2']);
  assert.equal(M.mark(catalog,[1,1,999],3,9).payment,2400);
});
test('undo stack is bounded to ten snapshots',()=>{
  let h=[];
  for(let i=0;i<25;i++)h=M.push(h,[i]);
  assert.equal(h.length,10);
  assert.deepEqual(h[0],[15]);
});
