const {test} = require('node:test');
const assert = require('node:assert/strict');
const {injectHud} = require('../tools/build.cjs');
test('HUD injection adds only CSS and script includes', ()=>{
  const source = '<root><styles></styles><scripts></scripts><CitadelHud id="A"/></root>';
  const result = injectHud(source,'panorama/scripts/deadlock_ai_advisor.vts_c');
  assert.match(result,/styles\/deadlock_ai_advisor.vcss_c/);
  assert.match(result,/scripts\/deadlock_ai_advisor.vts_c/);
  assert.match(result,/<CitadelHud id="A"\/>/);
});
test('fails closed if stock HUD changed', ()=>{
  assert.throws(()=>injectHud('<root/>','panorama/scripts/deadlock_ai_advisor.vts_c'),
    /Stock hud.xml/);
});
test('will not patch HUD twice', ()=>{
  const once = injectHud('<root><styles></styles><CitadelHud/></root>',
    'panorama/scripts/deadlock_ai_advisor.vts_c');
  assert.throws(()=>injectHud(once,'panorama/scripts/deadlock_ai_advisor.vts_c'),/Already patched/);
});
