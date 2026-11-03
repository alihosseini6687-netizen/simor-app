import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const server=readFileSync(new URL('../supabase/functions/simab-central-quests/index.ts',import.meta.url),'utf8');
const party=readFileSync(new URL('../assets/js/simab-party-v16.js',import.meta.url),'utf8');
const poker=readFileSync(new URL('../assets/js/simab-private-poker-v14.js',import.meta.url),'utf8');
function rateLimiter(){
 const start=server.indexOf('const requestWindows');
 const stop=server.indexOf('async function hmac',start);
 assert.ok(start>=0&&stop>start,'signed-identity limiter is present');
 return vm.runInNewContext(stripTypeScriptTypes(server.slice(start,stop))+';({requestLimit,requestWindows})');
}
test('rate limit is keyed to verified subject, not forged actor or room id',()=>{
 const {requestLimit:limit}=rateLimiter();
 for(let i=0;i<120;i++)assert.equal(limit('100',{action:'wallet',walletAction:'wheel',actorId:String(i),code:String(i)},0),0);
 assert.equal(limit('100',{action:'wallet',walletAction:'wheel',actorId:'different'},1),60);
 assert.equal(limit('200',{action:'wallet',walletAction:'wheel'},1),0);
 assert.equal(limit('100',{action:'wallet',walletAction:'wheel'},60001),0);
 assert.ok(server.indexOf('const retryAfterSeconds=requestLimit(subject,payload)')>server.indexOf('subject = verified.telegramUserId'));
 assert.match(server,/status===429\?\{'retry-after'/);
});
test('separate read and signal budgets preserve ordinary room polling',()=>{
 const {requestLimit:limit}=rateLimiter();
 for(let i=0;i<240;i++)assert.equal(limit('300',{action:'game_room',op:i%2?'preview':'state'},0),0);
 assert.equal(limit('300',{action:'game_room',op:'state'},0),60);
 for(let i=0;i<1200;i++)assert.equal(limit('300',{action:'room',op:'signal'},0),0);
 assert.equal(limit('300',{action:'room',op:'signal'},0),60);
});
test('bounded limiter never evicts a live quota on overflow',()=>{
 const {requestLimit:limit,requestWindows:windows}=rateLimiter();
 for(let i=0;i<10001;i++)limit(String(i),{action:'game'},0);
 assert.equal(windows.size,10000);
 assert.equal(limit('overflow',{action:'game'},1),60);
 assert.equal(limit('overflow',{action:'game'},60001),0);
});
test('multiplayer invitation explains explicit joining and chosen seat capacity',()=>{
 assert.match(party,/r\.preview\.count\)+' از '\+fmt\(r\.preview\.maxPlayers\)/);
 assert.match(party,/برای عضویت در میز دکمه/);
 assert.match(party,/شروع پس از تکمیل ظرفیت امکان‌پذیر است/);
 assert.match(party,/r\.room\.members\.length===requiredPlayers\(r\.room\)/);
 assert.match(poker,/میز پوکر: '\+r\.room\.members\.length\+' از '\+r\.room\.maxPlayers/);
});
