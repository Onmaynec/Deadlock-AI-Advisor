/* Deadlock AI Advisor: in-game Panorama UI.
 * DAA and DAA_CATALOG are prepended by the VPK build script.
 * No browser APIs, injected DLLs, memory scanning or network calls.
 */
(function () {
  'use strict';
  var hud = $.GetContextPanel();
  var heroes = (DAA_CATALOG.heroes || []).slice().sort(function (a, b) {
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  var model = {
    visible: false, pinned: false, heroId: '', manualHero: '',
    souls: 3000, threats: {healing: false, control: false, bullets: false, spirit: false},
    owned: [], last: '', refreshAt: 0, shopOpen: false
  };
  var widget, title, hero, budget, status, threatRow, resultList;
  function valid(p) { try { return !!(p && p.IsValid()); } catch (e) { return false; } }
  function find(id) { try { return hud.FindChildTraverse(id); } catch (e) { return null; } }
  function contains(p, cls) { try { return valid(p) && p.BHasClass(cls); } catch (e) { return false; } }
  function el(type, parent, cls, label) {
    var p = $.CreatePanel(type, parent, '');
    if (cls) cls.split(' ').forEach(function (c) { if (c) p.AddClass(c); });
    if (label !== undefined && type === 'Label') p.text = String(label);
    return p;
  }
  function button(parent, text, cls, handler) {
    var b = el('Button', parent, cls || 'DAAButton');
    el('Label', b, 'DAAButtonLabel', text);
    b.SetPanelEvent('onactivate', handler);
    return b;
  }
  function clear(p) {
    if (!valid(p)) return;
    try { p.RemoveAndDeleteChildren(); } catch (e) {
      var children = p.Children() || [];
      children.forEach(function (c) { c.DeleteAsync(0); });
    }
  }
  function setText(p, value) { if (valid(p)) p.text = String(value); }
  function findHero() {
    // The HUD exposes hero classes; regular game player APIs may be unavailable in this context.
    var shop = find('CitadelHudHeroShop');
    var alive = find('gameplay_hud_alive');
    var cross = alive && alive.FindChildTraverse('crosshair');
    var progress = cross && cross.FindChildTraverse('progress');
    for (var i = 0; i < heroes.length; i++) {
      var cls = String(heroes[i].className || '');
      if (!cls) continue;
      var full = cls.indexOf('hero_') === 0 ? cls : 'hero_' + cls;
      if (contains(shop, full) || contains(progress, full) ||
          contains(shop, full.replace(/^hero_/, '')) ||
          contains(progress, full.replace(/^hero_/, ''))) return String(heroes[i].id);
    }
    return '';
  }
  function currentHero() {
    var id = model.manualHero || model.heroId;
    for (var i = 0; i < heroes.length; i++) if (String(heroes[i].id) === id) return heroes[i];
    return null;
  }
  function stepHero() {
    if (!heroes.length) return;
    var current = currentHero(), idx = heroes.indexOf(current);
    model.manualHero = String(heroes[(idx + 1) % heroes.length].id);
    render();
  }
  function setShown(yes) {
    model.visible = !!yes;
    widget.SetHasClass('DAAOpen', model.visible);
    widget.hittest = model.visible;
    if (model.visible) render();
  }
  function toggle() {
    if (model.visible) { model.pinned = false; setShown(false); }
    else { model.pinned = true; setShown(true); }
  }
  function refresh() {
    var selected = currentHero(), options = DAA.recommend(DAA_CATALOG,
      {heroId: selected ? selected.id : '', souls: model.souls, owned: model.owned, threats: model.threats}, 5);
    setText(hero, selected ? 'Герой: ' + selected.name + (model.manualHero ? ' (вручную)' : '') : 'Герой: не определён');
    setText(budget, 'Души: ' + model.souls + ' (ручной ввод)');
    var hasStats = selected && DAA_CATALOG.heroStats &&
      DAA_CATALOG.heroStats[String(selected.id)];
    setText(status, selected ? (hasStats ?
      'Основа: статистика покупок героя + ручные угрозы' :
      'Базовые советы: статистика героя недоступна') :
      'Выберите героя или откройте магазин');
    clear(resultList);
    if (!options.length) {
      el('Label', resultList, 'DAAEmpty', 'Предметы не загружены. Запустите npm run sync.');
      return;
    }
    options.forEach(function (it, index) {
      var row = el('Panel', resultList, 'DAAItem');
      var line = el('Panel', row, 'DAAItemHeader');
      el('Label', line, 'DAAItemTitle', (index + 1) + '. ' + it.name);
      el('Label', line, it.affordable ? 'DAAPrice' : 'DAAPrice DAACostly',
        String(it.cost) + (it.affordable ? '' : ' (копить)'));
      el('Label', row, 'DAAItemReason', it.reason);
      // An explicit manual purchase mark. Never calls a game shop or purchases automatically.
      button(row, 'Отметить купленным', 'DAAMark', function () {
        model.owned.push(it.id);
        render();
      });
    });
  }
  function render() {
    if (!valid(widget)) return;
    refresh();
    clear(threatRow);
    [
      ['healing', 'Лечение'], ['control', 'Контроль'], ['bullets', 'Пули'], ['spirit', 'Спирит']
    ].forEach(function (tuple) {
      var k = tuple[0];
      var b = button(threatRow, tuple[1], 'DAAThreat', function () {
        model.threats[k] = !model.threats[k];
        render();
      });
      b.SetHasClass('DAAThreatOn', !!model.threats[k]);
    });
  }
  function buildUi() {
    var old = find('DeadlockAIAdvisorRoot');
    if (valid(old)) old.DeleteAsync(0);
    widget = $.CreatePanel('Panel', hud, 'DeadlockAIAdvisorRoot');
    widget.AddClass('DAAWindow');
    var header = el('Panel', widget, 'DAAHeader');
    title = el('Label', header, 'DAATitle', 'DEADLOCK  /  BUILD ADVISOR');
    button(header, '×', 'DAAClose', function () { model.pinned = false; setShown(false); });
    var controls = el('Panel', widget, 'DAARow');
    hero = el('Label', widget, 'DAAHero', '');
    button(controls, 'Другой герой', 'DAAButton', stepHero);
    button(controls, 'Авто', 'DAAButton', function () { model.manualHero = ''; render(); });
    budget = el('Label', widget, 'DAABudget', '');
    var moneyRow = el('Panel', widget, 'DAARow');
    button(moneyRow, '−500', 'DAAButton', function () { model.souls = Math.max(0, model.souls - 500); render(); });
    button(moneyRow, '+500', 'DAAButton', function () { model.souls += 500; render(); });
    button(moneyRow, 'Сброс покупок', 'DAAButton', function () { model.owned = []; render(); });
    el('Label', widget, 'DAASection', 'УГРОЗЫ ПРОТИВНИКА  /  ВРУЧНУЮ');
    threatRow = el('Panel', widget, 'DAAThreats');
    el('Label', widget, 'DAASection', 'РЕКОМЕНДУЕМЫЕ ПРЕДМЕТЫ');
    resultList = el('Panel', widget, 'DAAResults');
    status = el('Label', widget, 'DAAFooter', '');
    setShown(false);
  }
  function update() {
    try {
      var auto = findHero();
      if (auto) model.heroId = auto;
      var listener = find('AbilitiesContainer');
      var shop = contains(listener, 'gShopOpen') || contains(hud, 'gShopOpen');
      if (shop !== model.shopOpen) {
        model.shopOpen = shop;
        if (!model.pinned) setShown(shop && DAA_SETTINGS.autoShowShop !== false);
      }
      // Do not redraw every frame: only while visible and infrequently.
      if (model.visible) {
        var stateKey = model.heroId + '/' + model.manualHero + '/' + model.souls + '/' +
          model.owned.join(',') + '/' + JSON.stringify(model.threats);
        if (stateKey !== model.last) { model.last = stateKey; render(); }
      }
    } catch (e) { $.Msg('[DAA] tick: ' + e); }
    $.Schedule(0.6, update);
  }
  buildUi();
  try { $.RegisterKeyBind('', DAA_SETTINGS.hotkey || 'key_backslash', toggle); }
  catch (e) {
    try { $.RegisterKeyBind(hud, DAA_SETTINGS.hotkey || 'key_backslash', toggle); }
    catch (e2) { $.Msg('[DAA] hotkey unavailable: ' + e2); }
  }
  $.Msg('[DAA] Panorama advisor loaded; manual telemetry v0.1.0');
  $.Schedule(0.5, update);
})();
