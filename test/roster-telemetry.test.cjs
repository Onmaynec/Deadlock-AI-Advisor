const {test} = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/roster-telemetry.js');
const heroes=[
  {id:101,name:'Lady Geist'}, {id:102,name:'Warden'},
  {id:103,name:'Kelvin'}, {id:104,name:'Seven'}
];
function panel(id, classes=[], text='', children=[]) {
  return {
    id,classes,text,children,
    IsValid(){return true;},
    BHasClass(k){return this.classes.includes(k);},
    Children(){return this.children;},
    FindChildTraverse(name) {
      for(const ch of this.children) {
        if(ch.id===name) return ch;
        const nested=ch.FindChildTraverse(name);
        if(nested) return nested;
      }
      return null;
    },
    FindChildrenWithClassTraverse(name) {
      let out=[];
      for(const ch of this.children) {
        if(ch.BHasClass(name)) out.push(ch);
        out=out.concat(ch.FindChildrenWithClassTraverse(name));
      }
      return out;
    }
  };
}
function hud(enemyNames, friendlyNames=['Seven']) {
  const player=(name)=>panel('Name', ['HeroName'],name);
  const top=panel('TopBar',[], '', [
    panel('TeamsContainer',[], '',[
      panel('TeamFriendly',[], '',friendlyNames.map(player)),
      panel('TeamEnemy',[], '',enemyNames.map(player))
    ])
  ]);
  return panel('HUD',[],'',[top]);
}
test('read exclusively visible enemy hero labels, never friendly team',()=>{
  const p=R.probe(hud(['Lady Geist','Warden','Kelvin']),heroes);
  assert.deepEqual(p.ids,['101','102','103']);
  assert.equal(p.status,'observed');
  assert.ok(p.source.includes('TeamEnemy'));
});
test('reject unknown, duplicate, unresolved or missing hero labels',()=>{
  assert.equal(R.probe(hud(['Unknown']),heroes).status,'unmapped');
  assert.equal(R.probe(hud(['{s:hero_name}']),heroes).status,'unmapped');
  assert.equal(R.probe(hud(['Warden','Warden']),heroes).status,'unmapped');
  assert.equal(R.probe(hud(['']),heroes).status,'unmapped');
  assert.equal(R.probe(hud([]),heroes).status,'missing');
  assert.equal(R.probe(null,heroes).status,'missing');
  assert.equal(R.probe(hud(['Lady Geist','Warden','Kelvin','Seven',
    'Lady Geist','Warden','Kelvin']),heroes).status,'missing');
});
test('requires two identical roster sets; team order changes do not reset',()=>{
  const tracker=R.createTracker(heroes);
  const a=hud(['Kelvin','Warden']);
  const b=hud(['Warden','Kelvin']);
  assert.equal(tracker.observe(a,0).status,'confirming');
  const second=tracker.observe(b,0.6);
  assert.equal(second.status,'live');
  assert.deepEqual(second.ids,['102','103']);
  assert.equal(second.confidence,'confirmed-twice');
  assert.equal(tracker.current(4).ids,null);
  assert.equal(tracker.current(4).status,'confirming');
});
test('change, unknown label or empty panel invalidates roster immediately',()=>{
  const tracker=R.createTracker(heroes);
  tracker.observe(hud(['Warden','Kelvin']),0);
  assert.deepEqual(tracker.observe(hud(['Warden','Kelvin']),0.6).ids,['102','103']);
  assert.equal(tracker.observe(hud(['Warden','Seven']),1.2).ids,null);
  assert.deepEqual(tracker.observe(hud(['Warden','Seven']),1.8).ids,['102','104']);
  assert.equal(tracker.observe(hud(['Warden','???']),2.4).status,'unmapped');
  assert.equal(tracker.current(2.5).ids,null);
  tracker.reset();
  assert.equal(tracker.current(2.6).status,'missing');
});
test('hero name localization or ambiguous catalog names fail closed',()=>{
  const duplicated=[{id:1,name:'Test'},{id:2,name:'test'}];
  assert.equal(R.probe(hud(['Test']),duplicated).status,'unmapped');
  assert.equal(R.probe(hud(['Страж']),heroes).status,'unmapped');
});
test('fallback to bounded Children traversal if class search is unavailable',()=>{
  const root=hud(['Warden']);
  const enemy=root.children[0].children[0].children[1];
  enemy.FindChildrenWithClassTraverse=null;
  assert.deepEqual(R.probe(root,heroes).ids,['102']);
});
