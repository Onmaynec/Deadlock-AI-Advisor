/* Deadlock AI Advisor v0.4.0: native, in-game Panorama UI.
 * Runtime imports DAA, DAA_TELEMETRY and DAA_CATALOG from VPK build.
 * No browser, external overlay, DLL, process memory reading or hidden-game-data access.
 */
(function () {
  'use strict';
  var hud = $.GetContextPanel();
  var heroes = (DAA_CATALOG.heroes || []).slice().sort(function (a, b) {
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  var tracker = DAA_TELEMETRY.createTracker();
  var rosterTracker = DAA_ROSTER.createTracker(heroes);
  var model = {
    visible: false, pinned: false, heroId: '', manualHero: '',
    heroLostAt: -1, seconds: 0,
    soulsMode: 'auto', manualSouls: null, evidence: null,
    threats: {healing:false, control:false, bullets:false, spirit:false},
    owned: [], planPins: [], enemyHeroIds: [], slots: 9,
    rosterMode: 'auto', rosterEvidence: null,
    pickerOpen: false, pickerPage: 0, lastPurchase: null,
    last:'', shopOpen:false, debug:false
  };
  var widget, hero, budget, status, threatRow, resultList, evidenceLabel, debugLabel, modeButton;
  var roster, rosterPicker, plannerStatus, slotButton, inventoryRow;

  function valid(p) { try { return !!(p && p.IsValid && p.IsValid()); } catch (e) {return false;} }
  function find(id) { try {return hud.FindChildTraverse(id);} catch (e) {return null;} }
  function has(p, cls) {try {return valid(p) && p.BHasClass(cls);} catch (e) {return false;} }
  function text(p, value) {if (valid(p)) p.text = String(value);}
  function el(type, parent, cls, label) {
    var p = $.CreatePanel(type, parent, '');
    if (cls) cls.split(' ').forEach(function (c) {if (c) p.AddClass(c);});
    if (label !== undefined && type === 'Label') p.text = String(label);
    return p;
  }
  function button(parent, caption, cls, action) {
    var b = el('Button', parent, cls || 'DAAButton');
    el('Label', b, 'DAAButtonLabel', caption);
    b.SetPanelEvent('onactivate', action);
    return b;
  }
  function labelOfButton(b) {
    try {return b.Children()[0];} catch (e) {return null;}
  }
  function clear(p) {
    if (!valid(p)) return;
    try {p.RemoveAndDeleteChildren();}
    catch(e) {
      var children = p.Children() || [];
      children.forEach(function(c) {c.DeleteAsync(0);});
    }
  }
  function resetAnnotations() {
    // Never reuse manually marked enemy threats or "purchased" items for another hero.
    model.threats = {healing:false,control:false,bullets:false,spirit:false};
    model.owned = [];
    model.planPins = [];
    model.enemyHeroIds = [];
    model.rosterMode = 'auto';
    model.rosterEvidence = null;
    rosterTracker.reset();
    model.pickerOpen = false;
    model.pickerPage = 0;
    model.slots = 9;
    model.lastPurchase = null;
    model.manualSouls = null;
    model.soulsMode = 'auto';
    tracker.reset();
    model.evidence = null;
    model.last = '';
  }
  function detectGameHero() {
    var shop = find('CitadelHudHeroShop');
    var alive = find('gameplay_hud_alive');
    var cross = alive && alive.FindChildTraverse('crosshair');
    var progress = cross && cross.FindChildTraverse('progress');
    for (var i = 0; i < heroes.length; i++) {
      var cls = String(heroes[i].className || '');
      if (!cls) continue;
      var full = cls.indexOf('hero_') === 0 ? cls : 'hero_' + cls;
      if (has(shop, full) || has(progress, full) ||
          has(shop, full.replace(/^hero_/, '')) || has(progress, full.replace(/^hero_/, '')))
        return String(heroes[i].id);
    }
    return '';
  }
  function pollHero() {
    var next = detectGameHero();
    if (next) {
      var hadGap = model.heroLostAt >= 0 && model.seconds - model.heroLostAt >= 8;
      model.heroLostAt = -1;
      if ((model.heroId && next !== model.heroId) || hadGap) {
        resetAnnotations();
        model.manualHero = '';
      }
      model.heroId = next;
    } else {
      if (model.heroId && model.heroLostAt < 0) model.heroLostAt = model.seconds;
      if (model.heroId && model.seconds - model.heroLostAt >= 8) {
        model.heroId = '';
        model.manualHero = '';
        resetAnnotations();
      }
    }
  }
  function heroById(id) {
    for (var i=0;i<heroes.length;i++)
      if(String(heroes[i].id)===String(id)) return heroes[i];
    return null;
  }
  function currentHero() {
    var id = model.manualHero || model.heroId;
    for (var i = 0; i < heroes.length; i++)
      if (String(heroes[i].id) === id) return heroes[i];
    return null;
  }
  function stepHero() {
    if (!heroes.length) return;
    var selected = currentHero();
    var index = heroes.indexOf(selected);
    var next = String(heroes[(index + 1) % heroes.length].id);
    if (next !== (selected && String(selected.id))) resetAnnotations();
    model.manualHero = next;
    render();
  }
  function setShown(yes) {
    model.visible = !!yes;
    widget.SetHasClass('DAAOpen', model.visible);
    widget.hittest = model.visible;
    if (model.visible) render();
  }
  function toggle() {
    if (model.visible) {model.pinned = false;setShown(false);}
    else {model.pinned = true;setShown(true);}
  }
  function activeEnemyIds() {
    if (model.rosterMode === 'manual') return model.enemyHeroIds.slice();
    var evidence = model.rosterEvidence;
    return evidence && Array.isArray(evidence.ids) ? evidence.ids.slice() : [];
  }
  function enemySource() {
    if (model.rosterMode === 'manual') return 'вручную';
    return model.rosterEvidence && model.rosterEvidence.status === 'live' ?
      'HUD, проверено дважды' : 'HUD, нет подтверждённых данных';
  }
  function budgetState() {
    var e = model.evidence || tracker.current(model.seconds);
    if (model.soulsMode === 'manual')
      return {value:model.manualSouls, status:'manual', source:'Вручную', ageSeconds:null};
    return {value:e.value, status:e.status, source:e.source, ageSeconds:e.ageSeconds};
  }
  function editSouls(delta) {
    var amount = budgetState().value;
    if (amount === null || amount === undefined) amount = 0;
    model.manualSouls = Math.max(0, Math.min(99999999, Number(amount) + delta));
    model.soulsMode = 'manual';
    render();
  }
  function toggleSoulsMode() {
    if (model.soulsMode === 'auto') {
      model.manualSouls = budgetState().value;
      model.soulsMode = 'manual';
    } else {
      model.soulsMode = 'auto';
    }
    render();
  }
  function restartMatch() {
    model.heroId = '';
    model.manualHero = '';
    model.heroLostAt = -1;
    resetAnnotations();
    render();
  }
  function displayBudget() {
    var b = budgetState();
    text(budget, b.value === null || b.value === undefined ?
      'Души: ? — баланс недоступен' :
      'Души: ' + b.value + (b.status === 'manual' ? ' [вручную]' : ' [HUD]'));
    text(labelOfButton(modeButton), model.soulsMode === 'auto' ? 'Перейти на ручной' : 'Вернуть авто');
    var e = model.evidence || tracker.current(model.seconds);
    var stateWords = {live:'проверено дважды',confirming:'ожидание 2-го чтения',
      missing:'метка не найдена',unreadable:'нечисловое значение',manual:'ручной режим'};
    text(evidenceLabel, 'Телеметрия душ: ' + (stateWords[e.status] || 'нет данных') +
      (model.soulsMode === 'manual' ? ' · авто не используется' : '') +
      (e.ageSeconds !== null && e.ageSeconds !== undefined ?
        ' · возраст ' + Math.round(e.ageSeconds * 10) / 10 + ' с' : ''));
  }
  function updateDiagnostic() {
    if (!model.debug) {
      text(debugLabel, '');
      return;
    }
    var d = DAA_TELEMETRY.diagnostics(hud);
    var rosterProbe = DAA_ROSTER.probe(hud, heroes);
    text(debugLabel, 'HUD: золото ' + (d.soulsLabel ? 'есть' : 'нет') +
      ' / панель магазина ' + (d.playerShop ? 'есть' : 'нет') +
      ' / инвентарь ' + (d.inventorySurface ? 'обнаружен контейнер' : 'не подтверждён') +
      ' / таблица ' + (d.scoreboardSurface ? 'есть' : 'не подтверждена') +
      ' · вражеские герои: ' + rosterProbe.status +
      '. Наличие контейнера НЕ означает доступ к предметам.');
  }
  function refresh() {
    var selected = currentHero();
    var budgetNow = budgetState().value;
    var snapshot = {
      heroId:selected ? selected.id : '', souls:budgetNow,
      owned:model.owned, threats:model.threats,
      pinned:model.planPins, enemyHeroIds:activeEnemyIds(), slots:model.slots
    };
    var plan = DAA.plan(DAA_CATALOG,snapshot,6);
    // No neural provider is connected in v0.4: always use the validated
    // offline plan. Future model replies must pass DAA_INFERENCE.validate.
    var decision = DAA_INFERENCE.fallback(DAA_CATALOG,snapshot,'no-model',plan);
    var options = decision.items;
    text(labelOfButton(slotButton), 'Слоты ' + plan.usedSlots + '/' + plan.slotLimit);
    text(plannerStatus, 'План: ' + model.planPins.length + ' закреплено · ' +
      plan.freeSlots + ' свободных слотов · враги: ' + enemySource() +
      (activeEnemyIds().length ? (plan.hasMatchupData ?
        ' · статистика противников доступна' :
        ' · статистика противников не загружена') : ''));
    text(hero, selected ? 'Герой: ' + selected.name +
      (model.manualHero ? ' (выбран вручную)' : ' (HUD)') : 'Герой: не определён');
    displayBudget();
    var heroStats = selected && DAA_CATALOG.heroStats &&
      DAA_CATALOG.heroStats[String(selected.id)];
    text(status, 'AI: офлайн-статистика (LLM не подключена) · предметы: вручную · состав: ' +
      enemySource() +
      (heroStats ? ' · статистика героя: да' : ' · статистика героя: нет'));
    clear(resultList);
    if (!options.length) {
      el('Label',resultList,'DAAEmpty',plan.freeSlots === 0 ?
        'Все слоты заняты. Отметьте улучшение или освободите слот.' :
        'Нет актуальных предметов в каталоге.');
      return;
    }
    options.forEach(function(it,index) {
      var row=el('Panel',resultList,'DAAItem');
      var line=el('Panel',row,'DAAItemHeader');
      el('Label',line,'DAAItemTitle',(index+1)+'. '+it.name);
      el('Label',line,it.affordable===true ? 'DAAPrice' : 'DAAPrice DAACostly',
        String(it.cost) +
          (it.componentId ? ' (доплата, полная ' + it.fullCost + ')' : '') +
          (it.affordable===true ? ' · доступно' :
           it.affordable===null ? ' · ?' : ' · накопить'));
      el('Label',row,'DAAItemReason',it.reason);
      var actions = el('Panel',row,'DAARow');
      button(actions,'Куплено','DAAMark',function() {
        if (model.owned.indexOf(it.id)>=0) return;
        var component = it.componentId;
        if (component && model.owned.indexOf(component)>=0)
          model.owned.splice(model.owned.indexOf(component),1);
        model.owned.push(it.id);
        model.lastPurchase = {id:it.id, componentId:component};
        model.planPins = model.planPins.filter(function(id) {return id!==it.id;});
        render();
      });
      if (it.pinned || model.planPins.length < 5) {
        button(actions,it.pinned ? 'Убрать из плана' : 'В план','DAAButton',function() {
          if (it.pinned) model.planPins=model.planPins.filter(function(id){return id!==it.id;});
          else model.planPins.push(it.id);
          render();
        });
      } else {
        el('Label', actions, 'DAAEvidence', 'План заполнен (5)');
      }
    });
    updateDiagnostic();
  }
  function displayInventory() {
    clear(inventoryRow);
    if(!model.owned.length) {
      el('Label',inventoryRow,'DAAEvidence','Покупки не отмечены');
      return;
    }
    model.owned.forEach(function(id) {
      var found = DAA_CATALOG.items.filter(function(x){return String(x.id)===id;})[0];
      button(inventoryRow,'− '+(found ? found.name : id),'DAAEnemyRemove',function() {
        model.owned=model.owned.filter(function(v){return v!==id;});
        model.lastPurchase=null;
        render();
      });
    });
  }
  function displayRoster() {
    clear(roster);
    var own = currentHero();
    var enemyNames = [];
    activeEnemyIds().forEach(function(id) {
      var match=heroById(id);
      if(match) enemyNames.push(match.name);
    });
    el('Label',roster,'DAAEvidence','Враги: ' +
      (enemyNames.length ? enemyNames.join(', ') :
        (model.rosterMode === 'auto' ? 'HUD не определил состав' : 'не выбраны')) +
      ' ('+enemyNames.length+'/6) · ' + enemySource());
    var controls=el('Panel',roster,'DAARow');
    button(controls,model.pickerOpen ? 'Закрыть выбор' : 'Выбрать врагов',
      'DAAButton',function() {
        if (model.rosterMode === 'auto') {
          model.rosterMode = 'manual';
          model.enemyHeroIds = [];
          model.pickerOpen = true;
        } else model.pickerOpen = !model.pickerOpen;
        render();
      });
    if (model.rosterMode === 'manual')
      button(controls,'Вернуть автосостав','DAAButton',function() {
        model.rosterMode = 'auto';
        model.pickerOpen = false;
        render();
      });
    if(model.rosterMode === 'manual' && model.enemyHeroIds.length)
      button(controls,'Очистить врагов','DAAButton',function() {
        model.enemyHeroIds=[];render();
      });
    clear(rosterPicker);
    if (!model.pickerOpen || model.rosterMode !== 'manual') return;
    var choices = heroes.filter(function(h) {
      return (!own || String(own.id)!==String(h.id)) &&
        model.enemyHeroIds.indexOf(String(h.id))<0;
    });
    var pages = Math.max(1,Math.ceil(choices.length/6));
    model.pickerPage = Math.min(model.pickerPage,pages-1);
    var pagesRow=el('Panel',rosterPicker,'DAARow');
    button(pagesRow,'◀','DAAButton',function(){
      model.pickerPage=(model.pickerPage+pages-1)%pages;render();
    });
    el('Label',pagesRow,'DAAEvidence','Страница '+(model.pickerPage+1)+'/'+pages);
    button(pagesRow,'▶','DAAButton',function(){
      model.pickerPage=(model.pickerPage+1)%pages;render();
    });
    choices.slice(model.pickerPage*6,model.pickerPage*6+6).forEach(function(h){
      button(rosterPicker,'+ '+h.name,'DAAHeroChoice',function(){
        if(model.enemyHeroIds.length>=6) return;
        model.enemyHeroIds.push(String(h.id));
        render();
      });
    });
    model.enemyHeroIds.forEach(function(id) {
      var selected = heroById(id);
      if(selected) button(rosterPicker,'− '+selected.name,'DAAEnemyRemove',function(){
        model.enemyHeroIds=model.enemyHeroIds.filter(function(v){return v!==id;});
        render();
      });
    });
  }
  function render() {
    if(!valid(widget)) return;
    refresh();
    displayInventory();
    displayRoster();
    clear(threatRow);
    [
      ['healing','Лечение'],['control','Контроль'],
      ['bullets','Пули'],['spirit','Спирит']
    ].forEach(function(pair) {
      var k=pair[0];
      var b=button(threatRow,pair[1],'DAAThreat',function() {
        model.threats[k]=!model.threats[k];
        render();
      });
      b.SetHasClass('DAAThreatOn',!!model.threats[k]);
    });
  }
  function buildUi() {
    var old=find('DeadlockAIAdvisorRoot');
    if(valid(old)) old.DeleteAsync(0);
    widget=$.CreatePanel('Panel',hud,'DeadlockAIAdvisorRoot');
    widget.AddClass('DAAWindow');
    var head=el('Panel',widget,'DAAHeader');
    el('Label',head,'DAATitle','DEADLOCK  /  BUILD ADVISOR  0.4');
    button(head,'×','DAAClose',function(){model.pinned=false;setShown(false);});
    hero=el('Label',widget,'DAAHero','');
    var controls=el('Panel',widget,'DAARow');
    button(controls,'Другой герой','DAAButton',stepHero);
    button(controls,'Авто-герой','DAAButton',function() {model.manualHero='';render();});
    budget=el('Label',widget,'DAABudget','');
    var moneyRow=el('Panel',widget,'DAARow');
    modeButton=button(moneyRow,'Перейти на ручной','DAAButton',toggleSoulsMode);
    button(moneyRow,'−500','DAAButton',function(){editSouls(-500);});
    button(moneyRow,'+500','DAAButton',function(){editSouls(500);});
    evidenceLabel=el('Label',widget,'DAAEvidence','');
    el('Label',widget,'DAASection','СОСТАВ ПРОТИВНИКОВ · HUD / РУЧНОЙ РЕЖИМ');
    roster=el('Panel',widget,'DAARoster');
    rosterPicker=el('Panel',widget,'DAAPicker');
    el('Label',widget,'DAASection','УГРОЗЫ ПРОТИВНИКОВ · РУЧНОЙ ВВОД');
    threatRow=el('Panel',widget,'DAAThreats');
    var plannerTools=el('Panel',widget,'DAARow');
    slotButton=button(plannerTools,'Слоты 0/9','DAAButton',function() {
      model.slots = model.slots===12 ? 9 : model.slots+1;
      render();
    });
    button(plannerTools,'Отменить покупку','DAAButton',function() {
      if (!model.lastPurchase) return;
      var last=model.lastPurchase;
      model.owned=model.owned.filter(function(x){return x!==last.id;});
      if(last.componentId && model.owned.indexOf(last.componentId)<0)
        model.owned.push(last.componentId);
      model.lastPurchase=null;
      render();
    });
    plannerStatus=el('Label',widget,'DAAEvidence','');
    el('Label',widget,'DAASection','МОИ ПОКУПКИ · РУЧНЫЕ ОТМЕТКИ');
    inventoryRow=el('Panel',widget,'DAAInventory');
    el('Label',widget,'DAASection','СЛЕДУЮЩИЕ ПОКУПКИ');
    resultList=el('Panel',widget,'DAAResults');
    status=el('Label',widget,'DAAFooter','');
    var footer=el('Panel',widget,'DAARow');
    button(footer,'Новый матч','DAAButton',restartMatch);
    button(footer,'Сбросить покупки','DAAButton',function(){model.owned=[];model.lastPurchase=null;render();});
    button(footer,'Диагностика HUD','DAAButton',function(){model.debug=!model.debug;render();});
    debugLabel=el('Label',widget,'DAADebug','');
    setShown(false);
  }
  function update() {
    model.seconds += 0.6;
    try {
      pollHero();
      model.evidence = tracker.observe(hud, model.seconds);
      model.rosterEvidence = rosterTracker.observe(hud, model.seconds);
      var listener = find('AbilitiesContainer');
      var shop=has(listener,'gShopOpen')||has(hud,'gShopOpen');
      if(shop!==model.shopOpen) {
        model.shopOpen=shop;
        if(!model.pinned) setShown(shop && DAA_SETTINGS.autoShowShop!==false);
      }
      if(model.visible) {
        var effective=budgetState();
        var stateKey=model.heroId+'/'+model.manualHero+'/'+
          model.soulsMode+'/'+String(effective.value)+'/'+effective.status+'/' +
          model.owned.join(',')+'/'+JSON.stringify(model.threats)+'/'+model.debug+'/'+
          model.planPins.join(',')+'/'+model.rosterMode+'/'+activeEnemyIds().join(',')+
          '/'+(model.rosterEvidence ? model.rosterEvidence.status : '?')+'/'+model.slots;
        if(stateKey!==model.last) {model.last=stateKey;render();}
      }
    } catch(e) {
      $.Msg('[DAA] HUD read failed: ' + e);
      // Safely ignore telemetry failures; do not read other game resources.
    }
    $.Schedule(0.6,update);
  }
  buildUi();
  try {$.RegisterKeyBind('',DAA_SETTINGS.hotkey||'key_backslash',toggle);}
  catch(e) {
    try {$.RegisterKeyBind(hud,DAA_SETTINGS.hotkey||'key_backslash',toggle);}
    catch(e2) {$.Msg('[DAA] keybind unavailable: '+e2);}
  }
  $.Msg('[DAA] Panorama v0.4.0 loaded; passive enemy HUD probe and offline advisor active');
  $.Schedule(0.5,update);
})();
