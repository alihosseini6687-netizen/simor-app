import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('./fixtures/independent-release-protected-v22.json',import.meta.url),'utf8'));
test('independent release preserves Sevens shared dependencies, home, wallet and all backend/schema bytes',()=>{
 for(const [file,expected] of Object.entries(manifest.hashes)){
  const text=readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/\r\n/g,'\n');
  assert.equal(createHash('sha256').update(text).digest('hex'),expected,file);
 }
});
