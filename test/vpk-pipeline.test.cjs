const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {writeResource,compileXml,compileCss,compileJs} = require('../tools/s2res');
const {writeVpk} = require('../tools/vpk');
const {readVpkIndex,extractVpkFile} = require('../tools/common');

test('compile JS, CSS, XML and verify a self-contained VPK with the reader', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'daa-pack-'));
  try {
    const template = writeResource(1, [
      ['RED2',Buffer.from([0,1,2,3,4,5])],
      ['DATA',Buffer.from('stock')]
    ]);
    const script = compileJs('var DAA_TEST = 42;',template);
    const cssText = fs.readFileSync(path.join(__dirname,'..','src','panorama','advisor.css'),'utf8');
    const css = compileCss(cssText,template);
    const xml = compileXml('<root><styles></styles><CitadelHud/></root>',template);
    const files=[
      {path:'panorama/layout/hud.vxml_c',data:xml},
      {path:'panorama/scripts/deadlock_ai_advisor.vts_c',data:script},
      {path:'panorama/styles/deadlock_ai_advisor.vcss_c',data:css}
    ];
    const dest=path.join(tmp,'pak88_dir.vpk');
    writeVpk(dest,files);
    const indexed=readVpkIndex(dest);
    assert.equal(indexed.size,3);
    for(const f of files) {
      assert.ok(indexed.has(f.path),'missing '+f.path);
      assert.deepEqual(extractVpkFile(dest,f.path),f.data);
    }
    assert.ok(fs.statSync(dest).size > 1000);
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});
