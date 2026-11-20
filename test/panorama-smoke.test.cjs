const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
class Panel {
  constructor(type, parent, id) {
    this.type=type; this.parent=parent; this.id=id||'';
    this.children=[]; this.classes=new Set(); this.events={}; this.text='';
    this.valid=true;
    if (parent) parent.children.push(this);
  }
  IsValid() {return this.valid;}
  AddClass(k) {this.classes.add(k);}
  SetHasClass(k, val) {if(val)this.classes.add(k);else this.classes.delete(k);}
  BHasClass(k) {return this.classes.has(k);}
  SetPanelEvent(name,cb) {this.events[name]=cb;}
  Children() {return this.children;}
  FindChildTraverse(id) {
    for (const c of this.children) {
      if(c.id===id) return c;
      const deeper=c.FindChildTraverse(id);
      if(deeper) return deeper;
    }
    return null;
  }
  DeleteAsync() {
    this.valid=false;
    if(this.parent) this.parent.children=this.parent.children.filter(c=>c!==this);
  }
  RemoveAndDeleteChildren() {
    for(const c of this.children) c.valid=false;
    this.children=[];
  }
}
function descendants(p) {return [p,...p.children.flatMap(descendants)];}
test('real Panorama script creates a native panel and all controls without a browser',()=>{
  const root = new Panel('Panel',null,'Hud');
  const bindings={};
  const scheduled=[];
  const currentGold = new Panel('Panel',root,'CurrentGoldAmount');
  const goldLabel = new Panel('Label',currentGold,'hudCurGoldLabel');
  goldLabel.text='2,400';
  const $={
    GetContextPanel:()=>root,
    CreatePanel:(type,parent,id)=>new Panel(type,parent,id),
    RegisterKeyBind:(_panel,key,fn)=>{bindings[key]=fn;},
    Schedule:(_delay,fn)=>{scheduled.push(fn);},
    Msg:()=>{}
  };
  const context=vm.createContext({
    $, DAA_CATALOG:{
      heroes:[{id:1,name:'TestHero',className:'hero_testhero'},{id:2,name:'TestEnemy',className:'hero_enemy'}],
      heroMatchups:{'1':{'2':{'1':500}}},
      items:[
        {id:1,name:'Healbane',slot:'spirit',cost:1200,shopable:true},
        {id:2,name:'Metal Skin',slot:'vitality',cost:3000,shopable:true},
        {id:3,name:'Plain Gun',slot:'weapon',cost:1500,shopable:true}
      ]
    },
    DAA_SETTINGS:{autoShowShop:true,hotkey:'key_backslash'}
  });
  const core=fs.readFileSync(path.join(__dirname,'..','src','advisor-core.js'),'utf8');
  const telemetry=fs.readFileSync(path.join(__dirname,'..','src','telemetry.js'),'utf8');
  const hud=fs.readFileSync(path.join(__dirname,'..','src','panorama','advisor.js'),'utf8');
  vm.runInContext(core+'\n'+telemetry+'\n'+hud,context,{timeout:2000});
  const widget=root.FindChildTraverse('DeadlockAIAdvisorRoot');
  assert.ok(widget,'HUD widget exists');
  assert.equal(widget.BHasClass('DAAOpen'),false);
  scheduled.shift()(); // gold observation 1
  scheduled.shift()(); // gold observation 2
  bindings.key_backslash();
  assert.equal(widget.BHasClass('DAAOpen'),true);
  function press(label) {
    const button=descendants(widget).find(p=>
      p.type==='Button' && p.children.some(c=>c.type==='Label'&&c.text===label));
    assert.ok(button,'button missing: '+label);
    button.events.onactivate();
  }
  press('Лечение');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('восстановления здоровья')));
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('2400')&&p.text.includes('[HUD]')));
  press('+500');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('2900')&&p.text.includes('[вручную]')));
  press('Вернуть авто');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('2400')&&p.text.includes('[HUD]')));
  press('Диагностика HUD');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('золото есть')));
  press('Выбрать врагов');
  press('+ TestEnemy');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('TestEnemy')&&p.text.includes('(1/6)')));
  press('Закрыть выбор');
  press('В план');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text==='Убрать из плана'));
  press('Куплено');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('Слоты 1/9')));
  press('Отменить покупку');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('Слоты 0/9')));
  press('Слоты 0/9');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('Слоты 0/10')));
  press('Новый матч');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('Враги: не выбраны')));
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('СЛЕДУЮЩИЕ ПОКУПКИ')));
});
