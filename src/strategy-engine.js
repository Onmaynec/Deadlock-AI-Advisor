/* Deadlock AI Advisor v0.9.0 — offline, inspectable strategy profiles.
 * These are explicit preferences over existing catalog candidates, NOT win-rate
 * predictions, model inference, automatic purchases or game-derived item power.
 * ES5-compatible for Panorama.
 */
var DAA_STRATEGY = (function() {
  'use strict';
  var PROFILES=[
    {id:'balanced',name:'Баланс',description:'Исходные рекомендации по угрозам, бюджету и доступной статистике'},
    {id:'survival',name:'Выживание',description:'Дополнительный приоритет жизнеспособности (vitality)'},
    {id:'pressure',name:'Натиск',description:'Дополнительный приоритет оружейных и спирит-предметов'},
    {id:'budget',name:'Экономия',description:'Дополнительный приоритет относительно дешёвых предметов'}
  ];
  function profile(id) {
    var key=String(id||'balanced');
    for(var i=0;i<PROFILES.length;i++)
      if(PROFILES[i].id===key)return PROFILES[i];
    return PROFILES[0];
  }
  function knownSouls(value) {
    if(value==null||value===''||typeof value==='boolean'||
      !isFinite(Number(value))||Number(value)<0||Number(value)>99999999)
      return null;
    return Math.floor(Number(value));
  }
  function boost(row,mode,state) {
    var notes=[],delta=0, budget=knownSouls(state.souls);
    if(mode==='survival') {
      if(row.slot==='vitality') {
        delta+=9;
        notes.push('профиль повышает приоритет vitality');
      }
    } else if(mode==='pressure') {
      if(row.slot==='weapon') {
        delta+=9;
        notes.push('профиль повышает приоритет weapon');
      } else if(row.slot==='spirit') {
        delta+=5;
        notes.push('профиль повышает приоритет spirit');
      }
    } else if(mode==='budget') {
      // Price is a real catalog attribute, but not a measure of item efficiency.
      var price=Math.max(1,Number(row.cost)||1);
      delta=Math.round(Math.max(0,12-Math.min(12,price/250))*100)/100;
      if(delta>0)notes.push('профиль отдаёт предпочтение меньшей цене');
      if(budget===null)notes.push('доступность не подтверждена: баланс неизвестен');
    }
    return {value:delta,why:notes.join('; ')};
  }
  function rank(catalog,input,id,limit) {
    var state=input||{}, selected=profile(id);
    var rows=DAA.recommend(catalog,state,80);
    var mapped=rows.map(function(row) {
      var extra=boost(row,selected.id,state);
      var output={},k;
      for(k in row) if(Object.prototype.hasOwnProperty.call(row,k))
        output[k]=row[k];
      output.baseScore=row.score;
      output.strategyBonus=extra.value;
      output.strategy=selected.id;
      output.score=Math.round((row.score+extra.value)*100)/100;
      output.strategyReason=extra.why;
      // Never remove original provenance or affordability warnings.
      output.reason=row.reason+(extra.why ? '. '+extra.why : '');
      return output;
    });
    mapped.sort(function(a,b) {
      return b.score-a.score ||
        Number(b.affordable===true)-Number(a.affordable===true) ||
        a.cost-b.cost ||
        (a.name<b.name?-1:a.name>b.name?1:0) ||
        (a.id<b.id?-1:a.id>b.id?1:0);
    });
    var n=limit===undefined||limit===null?6:Number(limit);
    if(!isFinite(n)||n<0)n=0;
    return mapped.slice(0,Math.min(80,Math.floor(n)));
  }
  function audit(catalog,input) {
    var s=input||{}, heroes=(catalog&&Array.isArray(catalog.heroes)?catalog.heroes:[]),
      heroId=String(s.heroId==null?'':s.heroId),
      heroKnown=heroes.some(function(h){return String(h.id)===heroId;}),
      allEnemies=Array.isArray(s.enemyHeroIds)?s.enemyHeroIds.slice(0,6):[],
      enemies=[],seen={};
    allEnemies.forEach(function(id){
      var k=String(id);
      if(!seen[k] && heroes.some(function(h){return String(h.id)===k;})) {
        seen[k]=true; enemies.push(k);
      }
    });
    var stats=catalog&&catalog.heroStats&&catalog.heroStats[heroId],
      matched=catalog&&catalog.heroMatchups&&catalog.heroMatchups[heroId],
      available=0;
    enemies.forEach(function(id){
      if(matched&&matched[id]&&Object.keys(matched[id]).length>0)available++;
    });
    var warnings=[];
    if(!heroKnown)warnings.push('Герой не подтверждён каталогом');
    if(knownSouls(s.souls)===null)warnings.push('Баланс неизвестен: доступность не подтверждена');
    if(!stats||!Object.keys(stats).length)
      warnings.push('Нет офлайн-статистики выбранного героя');
    if(enemies.length && available<enemies.length)
      warnings.push('Нет статистики для части выбранных противников');
    return {heroKnown:heroKnown,budgetKnown:knownSouls(s.souls)!==null,
      enemyCount:enemies.length,matchupsCovered:available,
      historicalHeroData:!!stats&&Object.keys(stats).length>0,
      ownItemsAnnotated:Array.isArray(s.owned)?s.owned.length:0,
      warnings:warnings};
  }
  function compare(catalog,input) {
    var state=input||{}, data=[];
    PROFILES.forEach(function(p){
      var rows=rank(catalog,state,p.id,80);
      var affordable=null,first=rows.length?rows[0]:null;
      for(var i=0;i<rows.length;i++)
        if(rows[i].affordable===true){affordable=rows[i];break;}
      data.push({id:p.id,name:p.name,description:p.description,
        first:first,affordable:affordable,
        candidateCount:rows.length,source:'offline-rules'});
    });
    return {profiles:data,evidence:audit(catalog,state)};
  }
  return {profiles:PROFILES,profile:profile,rank:rank,compare:compare,
    audit:audit,knownSouls:knownSouls};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=DAA_STRATEGY;
