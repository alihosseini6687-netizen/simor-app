import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('Mill bot has time for the visible pause check without changing other game pacing',()=>{
 const window={};
 vm.runInNewContext(readFileSync('assets/js/simab-practice-ai-v20.js','utf8'),{window});
 const ai=window.SimabPracticeAI;
 const low={randomInt:()=>0},high={randomInt:max=>max-1};
 assert.equal(ai.actionDelay({kind:'mill'},low),900);
 assert.equal(ai.actionDelay({kind:'mill'},high),1300);
 assert.equal(ai.actionDelay({kind:'ludo'},low),450);
 assert.equal(ai.actionDelay({kind:'ludo'},high),850);
});
