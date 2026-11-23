'use strict';
// Read-only installation doctor. Does not download, edit, install or remove anything.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {ROOT,CACHE,OUT,findGamePath,readVpkIndex} = require('./common');
function hash(file) {return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function inspect(args={}) {
  const root=args.root||ROOT, cache=args.cache||CACHE, out=args.out||OUT;
  const cfg=args.config||{};
  const results=[];
  const add=(level,code,message)=>results.push({level,code,message});
  const pak=Number(cfg.pakNumber==null?88:cfg.pakNumber);
  if(!Number.isInteger(pak)||pak<1||pak>99) {
    add('error','invalid-slot','pakNumber должен быть целым числом от 1 до 99');
    return {healthy:false,checks:results,gameFound:false};
  }
  const filename='pak'+String(pak).padStart(2,'0')+'_dir.vpk';
  const game=args.gamePath!==undefined?args.gamePath:findGamePath(cfg);
  if(!game) {
    add('error','game-not-found','Deadlock не найдена: укажи gamePath в config.json');
    return {healthy:false,checks:results,gameFound:false};
  }
  const citadel=path.join(game,'game','citadel');
  const stock=path.join(citadel,'pak01_dir.vpk');
  const gi=path.join(citadel,'gameinfo.gi');
  const target=path.join(citadel,'addons',filename);
  const built=path.join(out,filename);
  const recordFile=path.join(cache,'installed.json');
  const catalogFile=path.join(root,'generated','catalog.json');
  if(!fs.existsSync(stock)) add('error','stock-vpk-missing','Нет базового pak01_dir.vpk');
  else {
    try {
      const idx=readVpkIndex(stock);
      const essentials=['panorama/layout/hud.vxml_c','panorama/styles/hud.vcss_c'];
      essentials.forEach(k=>{
        if(!idx.has(k)) add('error','game-resource-missing','Базовый ресурс отсутствует: '+k);
      });
      if(!Array.from(idx).some(k=>/^panorama\/scripts\/.+\.v(ts|js)_c$/.test(k)))
        add('error','script-template-missing','Не найден совместимый шаблон Panorama-скрипта');
      else add('ok','stock-vpk-index','Стандартные ресурсы Panorama обнаружены');
    } catch(e){add('error','invalid-stock-vpk','Базовый VPK невозможно прочитать: '+e.message);}
  }
  if(!fs.existsSync(gi)) add('error','gameinfo-missing','Не найден gameinfo.gi');
  else {
    const source=fs.readFileSync(gi,'utf8');
    if(/^\s*Game\s+citadel\/addons\s*$/m.test(source))
      add('ok','addons-mounted','Дополнения включены в SearchPaths');
    else add('warn','addons-not-mounted','SearchPaths не содержит citadel/addons: installer добавит его при установке');
  }
  if(!fs.existsSync(catalogFile)) add('error','catalog-missing','Нет generated/catalog.json: npm run sync');
  else {
    try {
      const cat=JSON.parse(fs.readFileSync(catalogFile,'utf8'));
      if(!Array.isArray(cat.heroes)||!cat.heroes.length||
          !Array.isArray(cat.items)||cat.items.length<20)
        add('error','catalog-incomplete','Каталог не прошёл проверку минимального состава');
      else {
        add('ok','catalog-valid','Каталог: '+cat.heroes.length+' героев, '+cat.items.length+' предметов');
        const age=Date.now()-Date.parse(cat.generatedAt);
        if(!Number.isFinite(age)) add('warn','catalog-date-unknown','Не установлена дата обновления каталога');
        else if(age>14*86400*1000) add('warn','catalog-stale','Каталог старше 14 дней; обнови через npm run sync');
      }
    } catch(e){add('error','catalog-invalid','Повреждён generated/catalog.json: '+e.message);}
  }
  if(!fs.existsSync(built)) add('warn','no-built-vpk','Нет готового VPK в out; команда npm run build создаст его');
  else add('ok','built-vpk','Собранный VPK присутствует');
  let record=null;
  if(fs.existsSync(recordFile)){
    try{record=JSON.parse(fs.readFileSync(recordFile,'utf8'));}
    catch(e){add('error','install-record-invalid','Не удаётся прочитать cache/installed.json');}
  }
  if(!fs.existsSync(target)) add('warn','not-installed','Мод отсутствует в выбранном слоте: npm run install-mod');
  else {
    if(!record||record.target!==target)
      add('error','slot-not-owned','Слот VPK занят, но не принадлежит этой установке: не перезаписывай');
    else if(typeof record.sha256!=='string'||hash(target)!==record.sha256)
      add('error','installed-hash-mismatch','VPK изменён после установки; автоматическое удаление небезопасно');
    else add('ok','installed-hash-ok','Установленный VPK совпадает с контролем целостности');
    try {
      const idx=readVpkIndex(target);
      if(!idx.has('panorama/layout/hud.vxml_c') ||
          !idx.has('panorama/styles/deadlock_ai_advisor.vcss_c') ||
          !Array.from(idx).some(k=>/^panorama\/scripts\/deadlock_ai_advisor\.v(ts|js)_c$/.test(k)))
        add('error','addon-resources-incomplete','VPK не содержит всех трёх ресурсов мода');
      else add('ok','addon-resources-present','Внутриигровые layout, style и script найдены');
    }catch(e){add('error','addon-vpk-invalid','VPK мода не читается: '+e.message);}
    if(fs.existsSync(stock)&&fs.statSync(target).mtimeMs < fs.statSync(stock).mtimeMs)
      add('warn','game-newer-than-mod','Файлы игры обновлены после установки мода; пересобери VPK');
  }
  return {healthy:!results.some(x=>x.level==='error'),gameFound:true,
    checks:results,version:'0.6.0'};
}
function main() {
  const configPath=path.join(ROOT,'config.json');
  const cfg=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,'utf8')):{};
  const report=inspect({config:cfg});
  if(process.argv.includes('--json')) console.log(JSON.stringify(report,null,2));
  else {
    console.log('Deadlock AI Advisor — проверка установки (без изменений файлов)');
    report.checks.forEach(c=>console.log('['+c.level.toUpperCase()+'] '+c.message));
    console.log(report.healthy?'Диагностика: критических ошибок не обнаружено':
      'Диагностика: обнаружены проблемы, проверь сообщения выше');
  }
  if(!report.healthy) process.exitCode=1;
}
if(require.main===module) {
  try{main();}catch(e){console.error('Doctor failed:',e.message);process.exitCode=1;}
}
module.exports={inspect};
