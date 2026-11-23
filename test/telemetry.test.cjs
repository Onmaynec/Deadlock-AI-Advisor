const {test} = require('node:test');
const assert = require('node:assert/strict');
const {parseSouls,probe,createTracker,diagnostics} = require('../src/telemetry.js');
function panel(id, text, children) {
  return {
    id, text, children:children||[],
    IsValid(){return true;},
    FindChildTraverse(name) {
      for(const child of this.children) {
        if(child.id === name) return child;
        const sub = child.FindChildTraverse(name);
        if(sub) return sub;
      }
      return null;
    }
  };
}
function hudWithCurrency(amount) {
  const currency=panel('hudCurGoldLabel',amount);
  const correct=panel('CurrentGoldAmount',null,[currency]);
  const itemValue=panel('hudItemGoldContainer',null,[panel('hudCurGoldLabel','99999999')]);
  return {root:panel('HUD',null,[itemValue,correct]),currency,correct,itemValue};
}
test('only unambiguous integer groups parse; zero is known',()=>{
  assert.equal(parseSouls('0'),0);
  assert.equal(parseSouls('1,250'),1250);
  assert.equal(parseSouls('12 000'),12000);
  assert.equal(parseSouls('1\u202f234'),1234);
  assert.equal(parseSouls('1.234'),1234);
  ['','—','12k','1.2k','1,25','-100','{i:hud_cur_gold}',
    '#Citadel_Hero_Stats_Souls','Infinity','100.20','12x',null].forEach(v=>
      assert.equal(parseSouls(v),null,String(v)));
});
test('reads scoped current currency label, not the duplicated item-value label',()=>{
  const x=hudWithCurrency('1,500');
  assert.equal(probe(x.root).value,1500);
  x.root.children.shift();
  assert.equal(probe(x.root).value,1500);
  x.root.children=[];
  assert.equal(probe(x.root).value,null);
});
test('two consistent readings establish budget confidence',()=>{
  const h=hudWithCurrency('3,500');
  const t=createTracker();
  const first = t.observe(h.root,0);
  assert.equal(first.status,'confirming');
  assert.equal(first.value,null);
  const yes=t.observe(h.root,0.6);
  assert.equal(yes.status,'live');
  assert.equal(yes.value,3500);
  assert.equal(yes.confidence,'confirmed-twice');
  assert.equal(t.current(3.2).value,null); // >= max age expires
});
test('changed, unavailable or invalid HUD never reuses a stale budget',()=>{
  const h=hudWithCurrency('2,500'), t=createTracker();
  t.observe(h.root,0);
  assert.equal(t.observe(h.root,0.6).value,2500);
  h.currency.text='2,300';
  assert.equal(t.observe(h.root,1.2).value,null);
  assert.equal(t.observe(h.root,1.8).value,2300);
  h.currency.text='{i:hud_cur_gold}';
  assert.equal(t.observe(h.root,2.4).status,'unreadable');
  assert.equal(t.current(2.5).value,null);
  h.currency.text='0';
  assert.equal(t.observe(h.root,3.0).status,'confirming');
  assert.equal(t.observe(h.root,3.6).value,0);
  t.reset();
  assert.equal(t.current(3.7).value,null);
});
test('diagnostics reads only whitelisted panel existence',()=>{
  const h=hudWithCurrency('900');
  assert.deepEqual(diagnostics(h.root),{
    soulsContainer:true,soulsLabel:true,
    playerShop:false,abilities:false,playerHud:false,
    inventorySurface:false,scoreboardSurface:false
  });
});

test('current stock HUD containers are detected only by their real panel IDs',()=>{
  const h=hudWithCurrency('900').root;
  h.children.push(panel('TopBar',null,[]));
  h.children.push(panel('ModPurchasedPanelUniversal',null,[]));
  const current=diagnostics(h);
  assert.equal(current.scoreboardSurface,true);
  assert.equal(current.inventorySurface,true);
  // Container presence is NOT an item ID, price or even a verified own inventory.
  h.children=h.children.filter(x=>x.id!=='ModPurchasedPanelUniversal');
  h.children.push(panel('PlayerModsContainer',null,[]));
  assert.equal(diagnostics(h).inventorySurface,false);
});
