// Rules: https://www.pagat.com/whist/hokm.html (2/3/4-player variants).
import {randomInt} from './games.ts';
const suit=(c:number)=>Math.floor(c/13),rank=(c:number)=>c%13+2;
const fail=():never=>{throw Error('invalid_move');};
function deck(n:number){const d=Array.from({length:52},(_,i)=>i).filter(c=>n!==3||c!==0);for(let i=d.length-1;i;i--){const j=randomInt(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;}
const group=(s:any,i:number)=>s.n===4?i%2:i;
function firstHakem(n:number){const d=deck(n);for(let k=0;k<d.length;k++)if(rank(d[k])===14)return k%n;return 0;}
function deal(s:any){s.deck=deck(s.n);s.hands=Array.from({length:s.n},()=>[]);s.hands[s.hakem]=s.deck.splice(-5);s.trump=-1;s.current=s.hakem;s.phase='trump';s.trick=[];s.lastTrick=[];s.tricks=Array(s.n===4?2:s.n).fill(0);s.round=(s.round||0)+1;s.discard=[];s.discardsNeeded=0;delete s.drawOffer;}
export function startVariantH(n:number){if(![2,3,4].includes(n))throw Error('invalid_players');const s:any={kind:'hokm',n,hakem:firstHakem(n),scores:Array(n===4?2:n).fill(0),winner:-1,finished:false,result:'',log:[]};deal(s);return s;}
export function legalVariantH(s:any,player=s.current):number[]{if(s.finished||s.phase!=='play')return[];const h=s.hands[player],lead=s.trick[0];return lead&&h.some((c:number)=>suit(c)===suit(lead.card))?h.filter((c:number)=>suit(c)===suit(lead.card)):h;}
function score(s:any,winner:number,points:number){s.scores[winner]+=points;s.log.push('برندهٔ دور '+(winner+1)+' • '+points+' امتیاز');s.log=s.log.slice(-8);if(s.scores[winner]>=7){s.finished=true;s.winner=winner;s.result='پایان مسابقه';return;}if(group(s,s.hakem)!==winner)s.hakem=(s.hakem+1)%s.n;s.phase='round_end';s.current=s.hakem;}
function resolve(s:any){const lead=suit(s.trick[0].card),value=(c:number)=>(suit(c)===s.trump?100:suit(c)===lead?50:0)+rank(c),winner=s.trick.reduce((a:any,b:any)=>value(b.card)>value(a.card)?b:a).player;s.current=winner;s.tricks[group(s,winner)]++;s.lastTrick=s.trick;s.trick=[];const g=group(s,winner),count=s.tricks[g],taken=s.tricks.reduce((a:number,b:number)=>a+b,0);
 if(count===7&&taken===7){score(s,g,group(s,s.hakem)===g?2:3);return;}
 if(s.n!==3){if(count>=7)score(s,g,1);return;}
 const remaining=17-taken,leadPlayer=s.tricks.findIndex((v:number,i:number)=>s.tricks.every((other:number,j:number)=>i===j||v>other+remaining));
 if(leadPlayer>=0){score(s,leadPlayer,1);return;}
 if(!remaining){const a=s.tricks;if(a[0]===a[1])score(s,2,1);else if(a[0]===a[2])score(s,1,1);else if(a[1]===a[2])score(s,0,1);else score(s,a.indexOf(Math.max(...a)),1);}
}
export function moveVariantH(s:any,player:number,m:any){if(s.finished||player!==s.current)throw Error('invalid_turn');
 if(s.phase==='round_end'){if(m.type!=='next_round')fail();deal(s);return;}
 if(s.phase==='trump'){if(m.type!=='trump'||!Number.isInteger(m.suit)||m.suit<0||m.suit>3)fail();s.trump=m.suit;for(let k=1;k<s.n;k++)s.hands[(s.hakem+k)%s.n]=s.deck.splice(-5);if(s.n===2){s.phase='discard';s.current=s.hakem;s.discardsNeeded=3;}else{for(let r=0;r<(s.n===3?3:2);r++)for(let k=0;k<s.n;k++)s.hands[(s.hakem+k)%s.n].push(...s.deck.splice(-4));s.phase='play';}return;}
 if(s.phase==='discard'){if(m.type!=='discard'||!s.hands[player].includes(m.card))fail();s.hands[player].splice(s.hands[player].indexOf(m.card),1);s.discard.push(m.card);if(--s.discardsNeeded===0){if(player===s.hakem){s.current=1-player;s.discardsNeeded=2;}else{s.phase='draw';s.current=s.hakem;s.drawOffer=s.deck.pop();}}return;}
 if(s.phase==='draw'){if(m.type!=='draw_choice'||typeof m.keep!=='boolean')fail();const second=s.deck.pop();if(second===undefined)fail();s.hands[player].push(m.keep?s.drawOffer:second);s.discard.push(m.keep?second:s.drawOffer);delete s.drawOffer;if(!s.deck.length){s.phase='play';s.current=s.hakem;}else{s.current=1-player;s.drawOffer=s.deck.pop();}return;}
 if(s.phase!=='play'||m.type!=='play'||!legalVariantH(s,player).includes(m.card))fail();s.hands[player].splice(s.hands[player].indexOf(m.card),1);s.trick.push({player,card:m.card});s.current=(player+1)%s.n;if(s.trick.length===s.n)resolve(s);
}
export function timeoutVariantH(s:any){let m:any;if(s.phase==='trump'){const counts=[0,1,2,3].map(i=>s.hands[s.current].filter((c:number)=>suit(c)===i).length);m={type:'trump',suit:counts.indexOf(Math.max(...counts))};}else if(s.phase==='discard')m={type:'discard',card:[...s.hands[s.current]].sort((a,b)=>rank(a)-rank(b))[0]};else if(s.phase==='draw')m={type:'draw_choice',keep:rank(s.drawOffer)>=10||suit(s.drawOffer)===s.trump};else if(s.phase==='round_end')m={type:'next_round'};else m={type:'play',card:legalVariantH(s)[0]};moveVariantH(s,s.current,m);}
export function publicVariantH(s:any,viewer:number){const {deck,hands,discard,drawOffer,...p}=structuredClone(s);return{...p,hand:hands[viewer],counts:hands.map((h:number[])=>h.length),legal:s.current===viewer?legalVariantH(s,viewer):[],drawOffer:s.phase==='draw'&&s.current===viewer?drawOffer:undefined,stockCount:deck.length};}
