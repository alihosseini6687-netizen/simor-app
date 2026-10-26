import test from 'node:test';import assert from 'node:assert/strict';import {startPoker,moveHumanPoker,publicHumanPoker,foldHumanPoker} from '../supabase/functions/simab-central-quests/games.ts';
test('2–6 human seats take distinct turns, keep private cards and conserve all escrow',()=>{
for(let n=2;n<=6;n++)for(let round=0;round<15;round++){
 const s=startPoker(100,n,true);assert.ok(!s.finished);let count=0;
 while(!s.finished){const who=s.current;for(let viewer=0;viewer<n;viewer++){const p=publicHumanPoker(s,viewer);assert.equal(p.deck,undefined);assert.deepEqual(p.players[0].cards,s.players[viewer].cards);assert.ok(p.players.slice(1).every(x=>x.cards.length===0));assert.equal(p.current,(who-viewer+n)%n);}
 const p=publicHumanPoker(s,who);moveHumanPoker(s,who,round%4===0&&p.canRaise?'allin':p.toCall?'call':'check');assert.ok(++count<100);}
 assert.equal(s.players.reduce((sum,p)=>sum+p.stack,0),100*n);
}
});
test('out-of-turn departure folds only that seat and preserves the active turn deadline',()=>{const s=startPoker(100,4,true),current=s.current,leaving=(current+1)%4,deadline=s.turnDeadline;foldHumanPoker(s,leaving);assert.ok(s.players[leaving].folded);assert.equal(s.current,current);assert.equal(s.turnDeadline,deadline);});
