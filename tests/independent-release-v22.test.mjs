import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('./fixtures/independent-release-protected-v22.json',import.meta.url),'utf8'));
const sha=text=>createHash('sha256').update(text).digest('hex');
const homeCSS='<link rel="stylesheet" href="assets/css/simab-phase3-v22.css?v=20261101">';
const roomCSS='<link rel="stylesheet" href="../../assets/css/simab-phase3-v22.css?v=20261101"><link rel="stylesheet" href="../../assets/css/simab-phase4-v22.css?v=20261101">';
test('preserve original protected code while allowing exact reviewed UI/i18n modifications',()=>{
 for(const [file,expected] of Object.entries(manifest.hashes)){
  let source=readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/\r\n/g,'\n');
  if(file==='assets/js/simab-i18n-v16.js'){
   assert.equal(sha(source),'6ec31198b96b6719f6bf35846449b9488dee15ed2d096878303a1fed2ab463be',file);
   continue;
  }
  if(file==='index.html'){
   // Both exact link-only UI CSS release and the new language-loader cache key are approved.
   if(source.includes(homeCSS)){
    assert.equal(source.split(homeCSS).length-1,1,'only one home Phase3 link');
    source=source.replace(homeCSS,'');
   }
   const changed='assets/js/simab-i18n-v16.js?v=20261101';
   assert.equal(source.split(changed).length-1,1,'only one localized loader cache key');
   source=source.replace(changed,'assets/js/simab-i18n-v16.js?v=20');
  }
  if(file==='games/room/index.html'&&source.includes(roomCSS)){
   assert.equal(source.split(roomCSS).length-1,1,'only one shared-room Phase3/4 link pair');
   source=source.replace(roomCSS,'');
  }
  assert.equal(sha(source),expected,file);
 }
});
