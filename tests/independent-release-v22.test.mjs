import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('./fixtures/independent-release-protected-v22.json',import.meta.url),'utf8'));
const sha=text=>createHash('sha256').update(text).digest('hex');
test('independent release preserves wallet, slot, gameplay, and backend; only approved localization overrides',()=>{
 for(const [file,expected] of Object.entries(manifest.hashes)){
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/\r\n/g,'\n');
  if(file==='assets/js/simab-i18n-v16.js'){
   // A reviewed, exact new loader replaces the previous two-language entry.
   assert.equal(sha(source),'6ec31198b96b6719f6bf35846449b9488dee15ed2d096878303a1fed2ab463be',file);
  }else if(file==='index.html'){
   // Only the home localization loader cache key can differ from PR31's protected baseline.
   const changed='assets/js/simab-i18n-v16.js?v=20261101';
   assert.equal(source.split(changed).length-1,1,'one localization cache update');
   assert.equal(sha(source.replace(changed,'assets/js/simab-i18n-v16.js?v=20')),expected,file);
  }else{
   assert.equal(sha(source),expected,file);
  }
 }
});
