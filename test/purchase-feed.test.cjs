const {test} = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/purchase-feed.js');
function node(id,classes=[],text='',children=[]) {
  return {
    id, classes, text, children,
    IsValid(){return true;},
    BHasClass(cls){return this.classes.includes(cls);},
    Children(){return this.children;},
    FindChildTraverse(name){
      for(const c of this.children) {
        if(c.id===name) return c;
        const found=c.FindChildTraverse(name);
        if(found) return found;
      }
      return null;
    },
    FindChildrenWithClassTraverse(cls){
      return this.children.flatMap(c=>[...(c.BHasClass(cls)?[c]:[]),...c.FindChildrenWithClassTraverse(cls)]);
    }
  };
}
const catalog={items:[
  {id:10,name:'Healing Nova',shopable:true},
  {id:20,name:'Leech',shopable:true},
  {id:21,name:'leech',shopable:true},
  {id:30,name:'Metal Skin',shopable:true}
]};
function hud(entries) {
  const rows=entries.map(e=>node('',['recentPurchase'],'',[
    node('',['recentModPurchaseName'],e[0]),
    node('',['recentTimePurchased'],e[1]||'')
  ]));
  return node('Hud',[],'',[
    // An unrelated element with the same class is never considered.
    node('fake',['recentPurchase'],'',[
      node('',['recentModPurchaseName'],'Decoy')
    ]),
    node('CitadelHudHeroShop',[],'',[
      node('RecentPurchasesContainer',[],'',rows)
    ])
  ]);
}
test('scoped vanilla shop rows map exact current item names without attribution',()=>{
  const p=P.probe(hud([['Healing Nova','12:34'],['Metal Skin','13:02']]),catalog);
  assert.equal(p.status,'observed');
  assert.deepEqual(p.entries.map(e=>e.id),['10','30']);
  assert.ok(p.entries.every(e=>e.attributed===false));
  assert.ok(p.source.includes('RecentPurchasesContainer'));
});
test('ambiguous/unrecognized items are visible but never given fake catalog IDs',()=>{
  const p=P.probe(hud([['Leech','03:15'],['Some New Item','03:16']]),catalog);
  assert.equal(p.status,'observed');
  assert.deepEqual(p.entries.map(e=>e.id),[null,null]);
});
test('unresolved localization tokens and missing shop fail closed; long lists remain bounded',()=>{
  assert.equal(P.probe(hud([['{s:recent_mod_name}','0:01']]),catalog).status,'unreliable');
  assert.equal(P.probe(hud(Array.from({length:11},()=>['Healing Nova','0:01'])),catalog).entries.length,10);
  assert.equal(P.probe(node('hud'),catalog).status,'missing');
  assert.equal(P.probe(hud([]),catalog).status,'empty');
});
test('feed requires two matching snapshots; never carries events after disappearance',()=>{
  const tracker=P.createTracker(catalog), first=hud([['Healing Nova','1:03']]);
  assert.equal(tracker.observe(first,0).status,'confirming');
  assert.equal(tracker.observe(first,0.6).status,'live');
  assert.equal(tracker.current(4).entries,null);
  assert.equal(tracker.observe(hud([['Metal Skin','1:05']]),4.1).entries,null);
  assert.equal(tracker.observe(hud([['Metal Skin','1:05']]),4.7).entries[0].id,'30');
  assert.equal(tracker.observe(node('hud'),5).status,'missing');
  assert.equal(tracker.current(5.1).entries,null);
  tracker.reset();
  assert.equal(tracker.current(6).status,'missing');
});
test('fallback tree walk works on a minimal compatible Panorama panel',()=>{
  const h=hud([['Healing Nova','1:03']]);
  const list=h.FindChildTraverse('RecentPurchasesContainer');
  list.FindChildrenWithClassTraverse=null;
  assert.equal(P.probe(h,catalog).entries[0].id,'10');
});

test('recognized Russian aliases map to the same real item, with collisions rejected',()=>{
  const translated={items:[
    {id:1,name:'Healing Nova',aliases:['Исцеляющая нова']},
    {id:2,name:'Metal Skin',aliases:['Металлическая кожа']}
  ]};
  assert.equal(P.probe(hud([['Исцеляющая нова','1:01']]),translated).entries[0].id,'1');
  translated.items[1].aliases.push('Исцеляющая нова');
  assert.equal(P.probe(hud([['Исцеляющая нова','1:01']]),translated).entries[0].id,null);
});
