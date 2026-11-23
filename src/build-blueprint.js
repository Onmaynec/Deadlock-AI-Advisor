/* Deadlock AI Advisor v1.0.0 — portable offline build blueprints.
 * The code carries MANUAL advisory annotations only. It never stores player
 * identity, currency, match history, hidden telemetry or API credentials.
 * Checksum detects accidental corruption; it is NOT authentication.
 * Dependency-free, ES5-compatible and suitable for native Panorama.
 */
var DAA_BLUEPRINT = (function () {
  'use strict';
  var VERSION='DAA1', MAX_LENGTH=1536, MAX_ID_DIGITS=15;
  var FIELDS=['healing','control','bullets','spirit'];
  var STRATEGIES=['balanced','survival','pressure','budget'];
  function token(value) {
    var s=String(value);
    return /^[1-9][0-9]{0,14}$/.test(s)?s:null;
  }
  function validHeroes(catalog) {
    var known={};
    (catalog&&Array.isArray(catalog.heroes)?catalog.heroes:[]).forEach(function(h){
      if(h){var id=token(h.id);if(id)known[id]=true;}
    });
    return known;
  }
  function validItems(catalog) {
    var known={};
    DAA.normalise(catalog).forEach(function(it){
      var id=token(it.id);
      if(id)known[id]=true;
    });
    return known;
  }
  function checkedList(raw,known,limit,label) {
    if(!Array.isArray(raw)||raw.length>limit)
      throw new Error(label+': invalid count');
    var ids=[],seen={};
    raw.forEach(function(value){
      var id=token(value);
      if(!id||!known[id]||seen[id])throw new Error(label+': invalid, duplicate or unknown ID');
      ids.push(id);seen[id]=true;
    });
    return ids;
  }
  function list(raw,known,limit,label) {
    if(raw==='-')return [];
    if(typeof raw!=='string'||!raw.length)throw new Error(label+': invalid field');
    return checkedList(raw.split(','),known,limit,label);
  }
  function normalized(catalog,input) {
    var v=input||{},heroes=validHeroes(catalog),items=validItems(catalog);
    var heroId=v.heroId==null||v.heroId===''?'':token(v.heroId);
    if(heroId===null||(heroId&&!heroes[heroId]))
      throw new Error('hero: unknown ID');
    var slots=Number(v.slots);
    if(!isFinite(slots)||Math.floor(slots)!==slots||slots<9||slots>12)
      throw new Error('slots: expected 9..12');
    var enemyHeroIds=checkedList(v.enemyHeroIds||[],heroes,6,'enemy heroes');
    if(heroId&&enemyHeroIds.indexOf(heroId)!==-1)
      throw new Error('hero cannot be on both teams');
    var owned=checkedList(v.owned||[],items,12,'owned items');
    if(owned.length>slots)throw new Error('inventory exceeds slot capacity');
    var pinned=checkedList(v.pinned||[],items,5,'pinned items');
    if(pinned.some(function(id){return owned.indexOf(id)>=0;}))
      throw new Error('pinned item already owned');
    var enemyItemIds=checkedList(v.enemyItemIds||[],items,12,'enemy items');
    var threats={},flags=0;
    FIELDS.forEach(function(name,i){
      var raw=v.threats&&v.threats[name];
      if(raw!==undefined && typeof raw!=='boolean')
        throw new Error('invalid threat '+name);
      threats[name]=raw===true;
      if(raw===true)flags|=(1<<i);
    });
    var strategy=String(v.strategy||'balanced');
    if(STRATEGIES.indexOf(strategy)<0)throw new Error('unknown strategy');
    return {heroId:heroId,enemyHeroIds:enemyHeroIds,
      owned:owned,pinned:pinned,enemyItemIds:enemyItemIds,slots:slots,
      threats:threats,strategy:strategy,flags:flags};
  }
  function digest(s) {
    // Stable 31-bit rolling check for typing/paste corruption, not a MAC.
    var hash=5381;
    for(var i=0;i<s.length;i++)
      hash=(hash*33+s.charCodeAt(i))%2147483647;
    return Math.floor(hash).toString(36).toUpperCase();
  }
  function fmt(ids){return ids.length?ids.join(','):'-';}
  function encode(catalog,input) {
    var s=normalized(catalog,input);
    var fields=[s.heroId||'-',fmt(s.enemyHeroIds),fmt(s.owned),
      fmt(s.pinned),fmt(s.enemyItemIds),String(s.slots),
      String(s.flags),String(STRATEGIES.indexOf(s.strategy))];
    var payload=fields.join('.');
    var code=VERSION+':'+payload+':'+digest(VERSION+':'+payload);
    if(code.length>MAX_LENGTH)throw new Error('code too long');
    return {ok:true,code:code,snapshot:s};
  }
  function decode(catalog,raw) {
    if(typeof raw!=='string')return {ok:false,error:'Код должен быть текстом'};
    var code=raw.trim();
    if(code.length>MAX_LENGTH || code.length<18)
      return {ok:false,error:'Недопустимая длина кода'};
    var match=/^DAA1:([0-9.,-]+):([A-Z0-9]{1,8})$/.exec(code);
    if(!match)return {ok:false,error:'Формат кода неизвестен или повреждён'};
    if(digest(VERSION+':'+match[1])!==match[2])
      return {ok:false,error:'Контрольная сумма не совпадает'};
    var p=match[1].split('.');
    if(p.length!==8)return {ok:false,error:'Неверное количество полей'};
    try {
      var heroes=validHeroes(catalog),items=validItems(catalog);
      var id=p[0]==='-'?'':p[0];
      if(id&&(!token(id)||!heroes[id]))throw new Error('hero not in catalog');
      var enemyHeroIds=list(p[1],heroes,6,'enemy heroes'),
        owned=list(p[2],items,12,'owned items'),
        pinned=list(p[3],items,5,'pinned items'),
        enemyItemIds=list(p[4],items,12,'enemy items');
      if(!/^(?:9|10|11|12)$/.test(p[5]))throw new Error('invalid capacity');
      if(!/^(?:[0-9]|1[0-5])$/.test(p[6]))throw new Error('invalid threats');
      if(!/^[0-3]$/.test(p[7]))throw new Error('invalid strategy');
      var flags=Number(p[6]),threats={};
      FIELDS.forEach(function(name,i){threats[name]=(flags&(1<<i))!==0;});
      // Do not let a handmade code bypass normalization, catalog checks or caps.
      var s=normalized(catalog,{heroId:id,enemyHeroIds:enemyHeroIds,
        owned:owned,pinned:pinned,enemyItemIds:enemyItemIds,
        slots:Number(p[5]),threats:threats,strategy:STRATEGIES[Number(p[7])]});
      if(encode(catalog,s).code!==code)
        return {ok:false,error:'Код не является каноническим'};
      return {ok:true,snapshot:s,code:code};
    } catch(e) {
      return {ok:false,error:'Код не подходит к каталогу или содержит недопустимые предметы'};
    }
  }
  return {encode:encode,decode:decode,normalize:normalized,digest:digest,
    version:VERSION,maxLength:MAX_LENGTH};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=DAA_BLUEPRINT;
