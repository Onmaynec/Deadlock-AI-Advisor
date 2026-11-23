/* Deadlock AI Advisor v0.9.0: native, in-game Panorama UI.
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
  var purchaseTracker = DAA_PURCHASES.createTracker(DAA_CATALOG);
  var healthMonitor = DAA_HUD_HEALTH.createMonitor({
    souls:tracker,roster:rosterTracker,purchases:purchaseTracker
  });
  var model = {
    visible: false, pinned: false, heroId: '', manualHero: '',
    heroLostAt: -1, seconds: 0, sessionEpoch: 0,
    soulsMode: 'auto', manualSouls: null, evidence: null,
    threats: {healing:false, control:false, bullets:false, spirit:false},
    owned: [], inventoryHistory: [], inventorySearchOpen:false,
    inventoryQuery:'', inventoryNotice:'', showSourceHealth:false,
    planPins: [], enemyHeroIds: [], enemyItemIds: [], slots: 9,
    purchaseEvidence: null, showPurchases: false, showRoute: false,
    strategy: 'balanced', comparisonOpen: false,
    itemSearchOpen: false, itemSearchQuery: '',
    rosterMode: 'auto', rosterEvidence: null,
    pickerOpen: false, pickerPage: 0, lastPurchase: null,
    last:'', shopOpen:false, debug:false
  };
  var widget, hero, budget, status, threatRow, resultList, evidenceLabel, debugLabel, modeButton;
  var roster, rosterPicker, plannerStatus, slotButton, inventoryRow;
  var recentPurchases, enemyItemsRow, purchaseFeedHeader, searchBox, searchResults;
  var routeStatus, routeList;
  var strategyButton, strategyEvidence, comparisonPanel;
  var inventorySearchBox, inventorySearchResults, inventoryNoticeLabel, sourceHealthPanel;

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
    model.sessionEpoch++;
    // Never reuse manually marked enemy threats or "purchased" items for another hero.
    model.threats = {healing:false,control:false,bullets:false,spirit:false};
    model.owned = [];
    model.inventoryHistory = [];
    model.inventorySearchOpen = false;
    model.inventoryQuery = '';
    model.inventoryNotice = '';
    model.planPins = [];
    model.enemyHeroIds = [];
    model.enemyItemIds = [];
    model.purchaseEvidence = null;
    model.showPurchases = false;
    model.itemSearchOpen = false;
    model.itemSearchQuery = '';
    purchaseTracker.reset();
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
    healthMonitor.reset();
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
  function enemyItemEvidence() {
    return DAA_ENEMY_EVIDENCE.derive(DAA_CATALOG,model.enemyItemIds);
  }
  function currentThreats() {
    return DAA_ENEMY_EVIDENCE.merge(model.threats,enemyItemEvidence());
  }
  function markEnemyItem(id) {
    var item=null;
    for (var i=0;i<DAA_CATALOG.items.length;i++) {
      if (String(DAA_CATALOG.items[i].id)===String(id) &&
          DAA_CATALOG.items[i].shopable !== false) {
        item=DAA_CATALOG.items[i];break;
      }
    }
    if (!item || model.enemyItemIds.indexOf(String(id))>=0 ||
        model.enemyItemIds.length>=12) return;
    model.enemyItemIds.push(String(id));
    render();
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
      owned:model.owned, threats:currentThreats(),
      pinned:model.planPins, enemyHeroIds:activeEnemyIds(), slots:model.slots,
      enemyItemIds:model.enemyItemIds, sessionEpoch:model.sessionEpoch,
      strategy:model.strategy
    };
    var plan = DAA.plan(DAA_CATALOG,snapshot,6);
    // No neural provider is connected in v0.4: always use the validated
    // offline plan. Future model replies must pass DAA_INFERENCE.validate.
    var decision = DAA_INFERENCE.fallback(DAA_CATALOG,snapshot,'no-model',plan);
    var options = model.strategy === 'balanced' ? decision.items :
      DAA_STRATEGY.rank(DAA_CATALOG,snapshot,model.strategy,6);
    var profile=DAA_STRATEGY.profile(model.strategy);
    var audit=DAA_STRATEGY.audit(DAA_CATALOG,snapshot);
    text(labelOfButton(strategyButton),'Профиль: '+profile.name);
    text(strategyEvidence,'Локальный профиль (без LLM): '+profile.description+
      ' · герой: '+(audit.heroKnown ? 'из каталога':'не подтверждён')+
      ' · статистика врагов: '+audit.matchupsCovered+'/'+audit.enemyCount);
    displayComparison(snapshot);
    if (model.showRoute) displayRoute(DAA_ROUTE.run(DAA_CATALOG,snapshot,3,
      function(cat,s,limit){return DAA_STRATEGY.rank(cat,s,model.strategy,limit);}));
    else text(routeStatus,'');
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
    var inferred = enemyItemEvidence();
    text(status, 'AI: офлайн-статистика (LLM нет) · покупатель в ленте неизвестен · враги: ' +
      enemySource() + ' · подтверждено предметов: ' + model.enemyItemIds.length +
      (inferred.signals.length ? ' · эвристик угроз: ' + inferred.signals.length : '') +
      (heroStats ? ' · статистика героя: да' : ' · статистика героя: нет'));
    text(inventoryNoticeLabel,model.inventoryNotice);
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
      button(actions,'Куплено','DAAMark',function() {markOwned(it.id);});
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
  function displayComparison(snapshot) {
    if(!valid(comparisonPanel))return;
    comparisonPanel.SetHasClass('DAACompareOpen',model.comparisonOpen);
    clear(comparisonPanel);
    if(!model.comparisonOpen)return;
    var comparison=DAA_STRATEGY.compare(DAA_CATALOG,snapshot);
    comparison.profiles.forEach(function(p) {
      var row=el('Panel',comparisonPanel,'DAACompareRow');
      row.SetHasClass('DAACompareSelected',p.id===model.strategy);
      var candidate=p.affordable||p.first;
      el('Label',row,'DAACompareName',p.name+(p.id===model.strategy?' · выбран':''));
      el('Label',row,'DAACompareCaption',
        candidate ? (candidate.name+' · '+candidate.cost+' душ'+
          (candidate.affordable===true?' · подтверждённо доступно':
           candidate.affordable===null?' · баланс неизвестен':' · накопить')) :
          'Нет кандидатов в текущем каталоге');
      if(p.id!==model.strategy)
        button(row,'Выбрать '+p.name,'DAAButton',function(){
          model.strategy=p.id;render();
        });
    });
    if(comparison.evidence.warnings.length)
      el('Label',comparisonPanel,'DAAEvidence',
        'Ограничения: '+comparison.evidence.warnings.join(' · '));
    el('Label',comparisonPanel,'DAAEvidence',
      'Это сравнение правил приоритета, а не прогноз винрейта или действий игроков.');
  }
  function displayRoute(route) {
    clear(routeList);
    if (route.status === 'unknown-budget') {
      text(routeStatus,'Сейчас нельзя рассчитать закупку: баланс неизвестен. Введите души вручную или дождитесь HUD.');
      return;
    }
    text(routeStatus,'Маршрут ('+DAA_STRATEGY.profile(model.strategy).name+') на текущие ' + route.balance +
      ' душ · расход ' + route.spent + ' · остаток ' + route.remaining +
      ' · без прогноза будущих доходов');
    if (!route.steps.length) {
      el('Label',routeList,'DAAEvidence','На этот баланс не нашлось подтверждённо доступных покупок.');
    }
    route.steps.forEach(function(it, i) {
      var row=el('Panel',routeList,'DAARouteStep');
      el('Label',row,'DAARouteStepTitle',
        (i+1)+'. '+it.name+' · '+it.cost+' душ'+
        (it.componentId ? ' (улучшение)' : ''));
      el('Label',row,'DAAEvidence','Останется: '+it.remaining);
    });
    if (route.saveFor) {
      el('Label',routeList,'DAASavingTarget','Альтернатива: накопить ещё ' +
        route.saveFor.shortfall + ' на '+route.saveFor.name+
        (route.saveFor.pinned ? ' · закреплено' : ''));
    }
  }
  function markOwned(id) {
    var result=DAA_INVENTORY.mark(DAA_CATALOG,model.owned,id,model.slots);
    if(!result.ok) {
      model.inventoryNotice = result.error==='full-inventory' ?
        'Инвентарь заполнен: освободите слот или улучшите компонент.' :
        result.error==='already-owned' ? 'Предмет уже отмечен как купленный.' :
        'Предмет отсутствует в актуальном каталоге.';
      render();return;
    }
    model.inventoryHistory=DAA_INVENTORY.push(model.inventoryHistory,result.previous);
    model.owned=result.owned;
    model.lastPurchase={id:String(id),componentId:result.consumed};
    model.planPins=model.planPins.filter(function(x){return x!==String(id);});
    model.inventoryNotice=result.consumed ?
      'Улучшение: компонент заменён; расчётная доплата '+result.payment+' душ.' :
      'Предмет добавлен в ручной инвентарь. Покупка в игре не выполнялась.';
    render();
  }
  function removeOwned(id) {
    var result=DAA_INVENTORY.remove(DAA_CATALOG,model.owned,id);
    if(!result.ok)return;
    model.inventoryHistory=DAA_INVENTORY.push(model.inventoryHistory,result.previous);
    model.owned=result.owned;
    model.lastPurchase=null;
    model.inventoryNotice='Отметка предмета удалена. В игре ничего не продано.';
    render();
  }
  function undoOwned() {
    var result=DAA_INVENTORY.undo(DAA_CATALOG,model.inventoryHistory,model.owned);
    if(!result.ok)return;
    model.owned=result.owned;
    model.inventoryHistory=result.history;
    model.lastPurchase=null;
    model.inventoryNotice='Последнее изменение ручного инвентаря отменено.';
    render();
  }
  function displayInventorySearch() {
    if(!valid(inventorySearchBox))return;
    inventorySearchBox.SetHasClass('DAASearchOpen',model.inventorySearchOpen);
    clear(inventorySearchResults);
    if(!model.inventorySearchOpen)return;
    var needle=DAA_PURCHASES.canonical(model.inventoryQuery);
    if(needle.length<2) {
      el('Label',inventorySearchResults,'DAAEvidence','Введите минимум 2 символа.');
      return;
    }
    var found=DAA_CATALOG.items.filter(function(it) {
      if(!it || it.shopable===false || model.owned.indexOf(String(it.id))>=0)return false;
      var names=[it.name].concat(Array.isArray(it.aliases)?it.aliases:[]);
      return names.some(function(x){return DAA_PURCHASES.canonical(x).indexOf(needle)>=0;});
    });
    found.slice(0,7).forEach(function(it){
      button(inventorySearchResults,'Куплен: '+it.name,'DAAButton DAAResultButton',function(){
        markOwned(it.id);
      });
    });
    if(!found.length)el('Label',inventorySearchResults,'DAAEvidence','Предмет не найден в каталоге.');
  }
  function displaySourceHealth() {
    if(!valid(sourceHealthPanel))return;
    sourceHealthPanel.SetHasClass('DAASourceOpen',model.showSourceHealth);
    clear(sourceHealthPanel);
    if(!model.showSourceHealth)return;
    var names={souls:'Души',roster:'Враги',purchases:'Лента магазина'};
    healthMonitor.report().forEach(function(r){
      el('Label',sourceHealthPanel,'DAAEvidence',
        names[r.source]+': '+r.status+' · '+r.confidence+
        ' · ошибок: '+r.errors+(r.lastConfirmedAt===null?'':' · последний live: '+
          Math.round(r.lastConfirmedAt)+' с'));
    });
    el('Label',sourceHealthPanel,'DAAEvidence',
      'Вся телеметрия экспериментальна. Нет автоматического чтения инвентаря или владельцев покупок.');
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
        removeOwned(id);
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
  function displayPurchaseFeed() {
    clear(recentPurchases);
    var evidence=model.purchaseEvidence, entries=evidence && evidence.entries;
    text(purchaseFeedHeader,'Лента магазина: ' +
      (evidence ? evidence.status : 'missing') +
      ' · БЕЗ определения покупателя' +
      (model.showPurchases ? ' · просмотр' : ' · свернуто'));
    if(!model.showPurchases) return;
    if (!entries || !entries.length) {
      el('Label',recentPurchases,'DAAEvidence',
        'Нет проверенных строк магазина. Можно найти предмет вручную.');
      return;
    }
    entries.slice(0,7).forEach(function(x) {
      var row=el('Panel',recentPurchases,'DAARow');
      el('Label',row,'DAAPurchaseEntry',
        x.name+(x.time ? ' · '+x.time : '') +
        (x.id ? '' : ' · нет в каталоге'));
      if(x.id && model.enemyItemIds.indexOf(x.id)<0 &&
          model.enemyItemIds.length<12)
        button(row,'Подтвердить у врага','DAAButton',function(){
          markEnemyItem(x.id);
        });
    });
  }
  function displayEnemyItems() {
    clear(enemyItemsRow);
    var hint=enemyItemEvidence();
    el('Label',enemyItemsRow,'DAAEvidence',
      'У врагов (вручную): '+model.enemyItemIds.length+
      (hint.signals.length ? ' · сигналы: '+hint.signals.map(function(x){
        return x.category;
      }).join(', ') : ' · сигналы угроз не подтверждены'));
    model.enemyItemIds.forEach(function(id){
      var item=null;
      for(var i=0;i<DAA_CATALOG.items.length;i++)
        if(String(DAA_CATALOG.items[i].id)===id){item=DAA_CATALOG.items[i];break;}
      var row=el('Panel',enemyItemsRow,'DAARow');
      el('Label',row,'DAAPurchaseEntry',item ? item.name : id);
      button(row,'Убрать','DAAButton',function(){
        model.enemyItemIds=model.enemyItemIds.filter(function(v){return v!==id;});
        render();
      });
    });
  }
  function displayItemSearchResults() {
    if (!valid(searchBox)) return;
    searchBox.SetHasClass('DAASearchOpen',model.itemSearchOpen);
    clear(searchResults);
    if(!model.itemSearchOpen) return;
    var term=DAA_PURCHASES.canonical(model.itemSearchQuery);
    if(term.length<2) {
      el('Label',searchResults,'DAAEvidence','Введите от 2 символов названия предмета');
      return;
    }
    var found=DAA_CATALOG.items.filter(function(it){
      if (!it || it.shopable===false) return false;
      var names=[it.name].concat(Array.isArray(it.aliases)?it.aliases:[]);
      return names.some(function(name){return DAA_PURCHASES.canonical(name).indexOf(term)>=0;}) &&
        model.enemyItemIds.indexOf(String(it.id))<0;
    });
    found.slice(0,7).forEach(function(it){
      button(searchResults,'Отметить у врага: '+it.name,
        'DAAButton DAAResultButton',function(){markEnemyItem(it.id);});
    });
    if(!found.length) el('Label',searchResults,'DAAEvidence',
      'В текущем каталоге совпадений нет');
  }
  function render() {
    if(!valid(widget)) return;
    refresh();
    displayInventory();
    displayInventorySearch();
    displaySourceHealth();
    displayRoster();
    displayPurchaseFeed();
    displayEnemyItems();
    displayItemSearchResults();
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
    el('Label',head,'DAATitle','DEADLOCK  /  BUILD ADVISOR  0.9');
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
    el('Label',widget,'DAASection','ПОКУПКИ · ИСТОЧНИК / ПОДТВЕРЖДЕНИЕ');
    var purchaseTools=el('Panel',widget,'DAARow');
    button(purchaseTools,'Последние покупки','DAAButton',function(){
      model.showPurchases=!model.showPurchases;render();
    });
    button(purchaseTools,'Найти предмет','DAAButton',function(){
      model.itemSearchOpen=!model.itemSearchOpen;render();
    });
    purchaseFeedHeader=el('Label',widget,'DAAEvidence','');
    recentPurchases=el('Panel',widget,'DAARecentPurchases');
    enemyItemsRow=el('Panel',widget,'DAAEnemyItems');
    searchBox=el('Panel',widget,'DAASearchBox');
    var searchEntry=el('TextEntry',searchBox,'DAASearchInput');
    searchEntry.SetPanelEvent('ontextentrychange',function(){
      model.itemSearchQuery=String(searchEntry.text||'').slice(0,48);
      displayItemSearchResults();
    });
    try {searchEntry.SetMaxChars(48);} catch(e) {}
    searchResults=el('Panel',searchBox,'DAASearchResults');
    el('Label',widget,'DAASection','УГРОЗЫ ПРОТИВНИКОВ · РУЧНЫЕ + ОТМЕЧЕННЫЕ ПРЕДМЕТЫ');
    threatRow=el('Panel',widget,'DAAThreats');
    var plannerTools=el('Panel',widget,'DAARow');
    slotButton=button(plannerTools,'Слоты 0/9','DAAButton',function() {
      model.slots = model.slots===12 ? 9 : model.slots+1;
      render();
    });
    button(plannerTools,'Отменить покупку','DAAButton',undoOwned);
    plannerStatus=el('Label',widget,'DAAEvidence','');
    el('Label',widget,'DAASection','МОИ ПОКУПКИ · РУЧНЫЕ ОТМЕТКИ');
    inventoryRow=el('Panel',widget,'DAAInventory');
    var inventoryTools=el('Panel',widget,'DAARow');
    button(inventoryTools,'Найти мой предмет','DAAButton',function(){
      model.inventorySearchOpen=!model.inventorySearchOpen;render();
    });
    inventoryNoticeLabel=el('Label',widget,'DAAEvidence','');
    inventorySearchBox=el('Panel',widget,'DAAInventorySearchBox');
    var input=el('TextEntry',inventorySearchBox,'DAAInventorySearchInput');
    input.SetPanelEvent('ontextentrychange',function(){
      model.inventoryQuery=String(input.text||'').slice(0,48);
      displayInventorySearch();
    });
    try{input.SetMaxChars(48);}catch(e){}
    inventorySearchResults=el('Panel',inventorySearchBox,'DAAInventorySearchResults');
    el('Label',widget,'DAASection','СТРАТЕГИЯ БИЛДА · ОФЛАЙН');
    var strategyTools=el('Panel',widget,'DAARow');
    strategyButton=button(strategyTools,'Профиль: Баланс','DAAButton',function(){
      var profiles=DAA_STRATEGY.profiles,at=0;
      for(var i=0;i<profiles.length;i++)
        if(profiles[i].id===model.strategy)at=i;
      model.strategy=profiles[(at+1)%profiles.length].id;
      render();
    });
    button(strategyTools,'Сравнить стратегии','DAAButton',function(){
      model.comparisonOpen=!model.comparisonOpen;render();
    });
    strategyEvidence=el('Label',widget,'DAAEvidence','');
    comparisonPanel=el('Panel',widget,'DAAComparison');
    var routeTools=el('Panel',widget,'DAARow');
    button(routeTools,'План на эти души','DAAButton',function(){
      model.showRoute=!model.showRoute;
      routeList.SetHasClass('DAARouteOpen',model.showRoute);
      render();
    });
    routeStatus=el('Label',widget,'DAAEvidence','');
    routeList=el('Panel',widget,'DAARouteList');
    el('Label',widget,'DAASection','СЛЕДУЮЩИЕ ПОКУПКИ');
    resultList=el('Panel',widget,'DAAResults');
    status=el('Label',widget,'DAAFooter','');
    var footer=el('Panel',widget,'DAARow');
    button(footer,'Новый матч','DAAButton',restartMatch);
    button(footer,'Сбросить покупки','DAAButton',function(){
      if(model.owned.length)
        model.inventoryHistory=DAA_INVENTORY.push(model.inventoryHistory,model.owned);
      model.owned=[];model.lastPurchase=null;
      model.inventoryNotice='Все ручные отметки сняты; игровая экипировка не изменена.';
      render();
    });
    button(footer,'Диагностика HUD','DAAButton',function(){model.debug=!model.debug;render();});
    debugLabel=el('Label',widget,'DAADebug','');
    button(footer,'Источники HUD','DAAButton',function(){
      model.showSourceHealth=!model.showSourceHealth;render();
    });
    sourceHealthPanel=el('Panel',widget,'DAASourceHealth');
    setShown(false);
  }
  function update() {
    model.seconds += 0.6;
    try {
      // One failing HUD adapter must not block the other read-only adapters.
      try {pollHero();} catch(e) {$.Msg('[DAA] hero probe unavailable');}
      var samples = healthMonitor.sample(hud,model.seconds);
      model.evidence = samples.souls;
      model.rosterEvidence = samples.roster;
      model.purchaseEvidence = samples.purchases;
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
          model.planPins.join(',')+'/'+model.enemyItemIds.join(',')+'/'+
          (model.purchaseEvidence ? JSON.stringify(model.purchaseEvidence.entries) : '?')+
          '/'+model.rosterMode+'/'+activeEnemyIds().join(',')+
          '/'+(model.rosterEvidence ? model.rosterEvidence.status : '?')+'/'+model.slots+
          '/'+healthMonitor.report().map(function(r){return r.status;}).join(',');
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
  $.Msg('[DAA] Panorama v0.9.0 loaded; deterministic strategy compare and offline route active');
  $.Schedule(0.5,update);
})();
