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
  FindChildrenWithClassTraverse(k) {
    return this.children.flatMap(c=>[...(c.BHasClass(k)?[c]:[]),
      ...c.FindChildrenWithClassTraverse(k)]);
  }
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
  const top=new Panel('Panel',root,'TopBar');
  const teams=new Panel('Panel',top,'TeamsContainer');
  const friendly=new Panel('Panel',teams,'TeamFriendly');
  const ally=new Panel('Label',friendly,'');
  ally.AddClass('HeroName'); ally.text='TestHero';
  const enemyTeam=new Panel('Panel',teams,'TeamEnemy');
  const enemyLabel=new Panel('Label',enemyTeam,'');
  enemyLabel.AddClass('HeroName'); enemyLabel.text='TestEnemy';
  const shop=new Panel('Panel',root,'CitadelHudHeroShop');
  const purchases=new Panel('Panel',shop,'RecentPurchasesContainer');
  const purchase=new Panel('Panel',purchases,'');
  purchase.AddClass('recentPurchase');
  const purchaseItem=new Panel('Label',purchase,'');
  purchaseItem.AddClass('recentModPurchaseName');purchaseItem.text='Healing Nova';
  const purchaseTime=new Panel('Label',purchase,'');
  purchaseTime.AddClass('recentTimePurchased');purchaseTime.text='12:35';
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
        {id:2,name:'Metal Skin',slot:'vitality',cost:3000,shopable:true,aliases:['Металлическая кожа']},
        {id:3,name:'Plain Gun',slot:'weapon',cost:1500,shopable:true},
        {id:4,name:'Healing Nova',slot:'vitality',cost:900,shopable:true}
      ]
    },
    DAA_SETTINGS:{autoShowShop:true,hotkey:'key_backslash'}
  });
  const core=fs.readFileSync(path.join(__dirname,'..','src','advisor-core.js'),'utf8');
  const telemetry=fs.readFileSync(path.join(__dirname,'..','src','telemetry.js'),'utf8');
  const roster=fs.readFileSync(path.join(__dirname,'..','src','roster-telemetry.js'),'utf8');
  const guard=fs.readFileSync(path.join(__dirname,'..','src','inference-guard.js'),'utf8');
  const feed=fs.readFileSync(path.join(__dirname,'..','src','purchase-feed.js'),'utf8');
  const evidence=fs.readFileSync(path.join(__dirname,'..','src','enemy-item-evidence.js'),'utf8');
  const route=fs.readFileSync(path.join(__dirname,'..','src','purchase-route.js'),'utf8');
  const inventory=fs.readFileSync(path.join(__dirname,'..','src','inventory-state.js'),'utf8');
  const health=fs.readFileSync(path.join(__dirname,'..','src','hud-health.js'),'utf8');
  const hud=fs.readFileSync(path.join(__dirname,'..','src','panorama','advisor.js'),'utf8');
  vm.runInContext(core+'\n'+telemetry+'\n'+roster+'\n'+feed+'\n'+evidence+'\n'+guard+'\n'+route+'\n'+inventory+'\n'+health+'\n'+hud,context,{timeout:2000});
  const widget=root.FindChildTraverse('DeadlockAIAdvisorRoot');
  assert.ok(widget,'HUD widget exists');
  assert.equal(widget.BHasClass('DAAOpen'),false);
  scheduled.shift()(); // gold observation 1
  scheduled.shift()(); // gold observation 2
  bindings.key_backslash();
  assert.ok(descendants(root).some(p=>p.type==='Label' &&
    p.text.includes('Враги: TestEnemy') && p.text.includes('HUD')));
  assert.equal(widget.BHasClass('DAAOpen'),true);
  function press(label) {
    const button=descendants(widget).find(p=>
      p.type==='Button' && p.children.some(c=>c.type==='Label'&&c.text===label));
    assert.ok(button,'button missing: '+label);
    button.events.onactivate();
  }
  press('Последние покупки');
  assert.ok(descendants(widget).some(p=>p.type==='Label' && p.text.includes('Healing Nova')));
  press('Подтвердить у врага');
  assert.ok(descendants(widget).some(p=>p.type==='Label' &&
    p.text.includes('У врагов (вручную): 1') && p.text.includes('healing')));
  press('Найти предмет');
  const search=descendants(widget).find(p=>p.type==='TextEntry');
  assert.ok(search);
  search.text='Металлическая';
  search.events.ontextentrychange();
  press('Отметить у врага: Metal Skin');
  assert.ok(descendants(widget).some(p=>p.type==='Label' && p.text.includes('У врагов (вручную): 2')));
  press('План на эти души');
  assert.ok(descendants(widget).some(p=>p.type==='Label' &&
    p.text.includes('План на текущие 2400 душ')));
  assert.ok(descendants(widget).some(p=>p.type==='Label' &&
    p.text.includes('Останется:')));
  press('Найти мой предмет');
  const mySearch=descendants(widget).find(p=>p.type==='TextEntry' && p.BHasClass('DAAInventorySearchInput'));
  assert.ok(mySearch,'full catalog own-item search exists');
  mySearch.text='Plain';
  mySearch.events.ontextentrychange();
  press('Куплен: Plain Gun');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('Слоты 1/9')));
  press('Отменить покупку');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('Слоты 0/9')));
  press('Источники HUD');
  assert.ok(descendants(widget).some(p=>p.type==='Label' && p.text.includes('Души: live')));
  assert.ok(descendants(widget).some(p=>p.type==='Label' && p.text.includes('Лента магазина: live')));
  press('Лечение');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('восстановления здоровья')));
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('2400')&&p.text.includes('[HUD]')));
  press('+500');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('2900')&&p.text.includes('[вручную]')));
  press('Вернуть авто');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('2400')&&p.text.includes('[HUD]')));
  press('Диагностика HUD');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('золото есть')));
  enemyLabel.text = '{s:hero_name}'; // stale/unresolved HUD binding
  scheduled.shift()();
  assert.ok(descendants(widget).some(p=>p.type==='Label' &&
    p.text.includes('Враги: HUD не определил состав')));
  enemyLabel.text = 'TestEnemy';
  scheduled.shift()(); // reconfirmation 1
  scheduled.shift()(); // reconfirmation 2
  assert.ok(descendants(widget).some(p=>p.type==='Label' &&
    p.text.includes('Враги: TestEnemy') && p.text.includes('HUD')));
  press('Выбрать врагов');
  press('+ TestEnemy');
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('TestEnemy')&&p.text.includes('(1/6)')));
  press('Закрыть выбор');
  press('Вернуть автосостав');
  assert.ok(descendants(widget).some(p=>p.type==='Label' &&
    p.text.includes('Враги: TestEnemy') && p.text.includes('HUD')));
  press('Выбрать врагов');
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
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('Враги: HUD не определил состав')));
  assert.ok(descendants(widget).some(p=>p.type==='Label'&&p.text.includes('СЛЕДУЮЩИЕ ПОКУПКИ')));
});
