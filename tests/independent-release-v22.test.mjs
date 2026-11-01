import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('./fixtures/independent-release-protected-v22.json',import.meta.url),'utf8'));
const sha=text=>createHash('sha256').update(text).digest('hex');
const homeCSS='<link rel="stylesheet" href="assets/css/simab-phase3-v22.css?v=20261101">';
const roomCSS='<link rel="stylesheet" href="../../assets/css/simab-phase3-v22.css?v=20261101"><link rel="stylesheet" href="../../assets/css/simab-phase4-v22.css?v=20261101">';
test('preserve protected games, wallet, backend while whitelisting exact vetted UI link-only changes',()=>{
 for(const [file,expected] of Object.entries(manifest.hashes)){
  let source=readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/\r\n/g,'\n');
  if(file==='index.html'){
   assert.equal(source.split(homeCSS).length-1,1,'only one home Phase3 stylesheet');
   source=source.replace(homeCSS,'');
   // The separate localization release may or may not have landed first.
   source=source.replace('assets/js/simab-i18n-v16.js?v=20261101','assets/js/simab-i18n-v16.js?v=20');
  }else if(file==='games/room/index.html'){
   assert.equal(source.split(roomCSS).length-1,1,'only one shared-room Phase3/4 stylesheet pair');
   source=source.replace(roomCSS,'');
  }else if(file==='assets/js/simab-i18n-v16.js' && sha(source)!==expected){
   assert.equal(sha(source),'6ec31198b96b6719f6bf35846449b9488dee15ed2d096878303a1fed2ab463be','approved seven-language entry');
   continue;
  }
  assert.equal(sha(source),expected,file);
 }
});
