// New table games: server CSPRNG, private decks/hands, explicit table variants.
import {randomInt} from './games.ts';
const bad=():never=>{throw Error('invalid_move');};
function stake(n:number,even=false){if(!Number.isSafeInteger(n)||n<(even?2:1)||n>10000||even&&n%2)throw Error('invalid_buyin');}
function pack(){const d=Array.from({length:52},(_,i)=>i);for(let i=51;i;i--){const j=randomInt(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;}
const suit=(c:number)=>Math.floor(c/13),rank=(c:number)=>c%13+2;
const playback=new WeakMap<object,any[]>();
export const tableFrames=(s:object)=>playback.get(s)||[];
function trace(s:Table){const a=playback.get(s)||[];if(a.length<48)a.push(structuredClone(publicTable(s)));playback.set(s,a);}
const note=(s:{log:string[]},text:string)=>{s.log.push(text);s.log=s.log.slice(-12);};

// Blackjack: single shuffled deck, S17, peek, 3:2 natural, DAS, up to 4 hands.
export type BJHand={cards:number[];bet:number;done:boolean;split:boolean;splitAce:boolean;result:string;payout:number};
export type BJ={kind:'blackjack';deck:number[];dealer:number[];hands:BJHand[];active:number;stake:number;committed:number;payout:number;finished:boolean;result:string;log:string[]};
export function bjValue(cards:number[]){let total=0,aces=0;for(const c of cards){if(rank(c)===14){aces++;total+=11;}else total+=Math.min(10,rank(c));}while(total>21&&aces>0){total-=10;aces--;}return{total,soft:aces>0};}
const natural=(h:BJHand)=>!h.split&&h.cards.length===2&&bjValue(h.cards).total===21;
const newHand=(cards:number[],bet:number,split=false,splitAce=false):BJHand=>({cards,bet,split,splitAce,done:false,result:'',payout:0});
function finishBJ(s:BJ){
 const dbj=s.dealer.length===2&&bjValue(s.dealer).total===21;
 if(!dbj&&s.hands.some(h=>h.result!=='surrender'&&bjValue(h.cards).total<=21&&!natural(h))){while(bjValue(s.dealer).total<17)s.dealer.push(s.deck.pop()!);}
 const dealer=bjValue(s.dealer).total;
 for(const h of s.hands){const v=bjValue(h.cards).total;
  if(h.result==='surrender')h.payout=h.bet/2;
  else if(v>21){h.result='bust';h.payout=0;}
  else if(dbj){h.result=natural(h)?'push':'lose';h.payout=natural(h)?h.bet:0;}
  else if(natural(h)){h.result='blackjack';h.payout=h.bet*5/2;}
  else if(dealer>21||v>dealer){h.result='win';h.payout=h.bet*2;}
  else if(v===dealer){h.result='push';h.payout=h.bet;}
  else{h.result='lose';h.payout=0;}h.done=true;
 }
 s.payout=s.hands.reduce((a,h)=>a+h.payout,0);s.finished=true;s.active=-1;s.result='تغییر ژتون: '+(s.payout-s.committed);note(s,'دست تمام شد؛ تسویه ثبت می‌شود.');
}
function advanceBJ(s:BJ){while(s.active<s.hands.length&&s.hands[s.active].done)s.active++;if(s.active>=s.hands.length)finishBJ(s);trace(s);}
export function startBJ(n:number):BJ{stake(n,true);const d=pack(),s:BJ={kind:'blackjack',deck:d,dealer:[],hands:[],active:0,stake:n,committed:n,payout:0,finished:false,result:'',log:[]};const a=d.pop()!,b=d.pop()!,c=d.pop()!,e=d.pop()!;s.hands=[newHand([a,c],n)];s.dealer=[b,e];if(natural(s.hands[0])||bjValue(s.dealer).total===21)finishBJ(s);trace(s);return s;}
export function moveBJ(s:BJ,type:string){if(s.finished)bad();playback.delete(s);const h=s.hands[s.active];if(!h||h.done)bad();let debit=0;
 if(type==='hit'){if(h.splitAce)bad();h.cards.push(s.deck.pop()!);note(s,'یک کارت گرفتید.');if(bjValue(h.cards).total>=21)h.done=true;}
 else if(type==='stand'){h.done=true;note(s,'ایستادید.');}
 else if(type==='double'){if(h.cards.length!==2||h.splitAce)bad();debit=h.bet;s.committed+=debit;h.bet*=2;h.cards.push(s.deck.pop()!);h.done=true;note(s,'دابل؛ یک کارت و پایان نوبت.');}
 else if(type==='split'){if(h.cards.length!==2||rank(h.cards[0])!==rank(h.cards[1])||s.hands.length>=4||h.splitAce)bad();debit=h.bet;s.committed+=debit;const ace=rank(h.cards[0])===14;
  const left=newHand([h.cards[0],s.deck.pop()!],h.bet,true,ace),right=newHand([h.cards[1],s.deck.pop()!],h.bet,true,ace);left.done=ace||bjValue(left.cards).total===21;right.done=ace||bjValue(right.cards).total===21;s.hands.splice(s.active,1,left,right);note(s,'جفت به دو دست تقسیم شد.');
 }else if(type==='surrender'){if(h.split||h.cards.length!==2||s.hands.length!==1)bad();h.result='surrender';h.done=true;note(s,'انصراف؛ نصف ورودی برمی‌گردد.');}else bad();
 advanceBJ(s);return debit;
}
function publicBJ(s:BJ){const h=s.hands[s.active],active=!!h&&!s.finished;return{kind:s.kind,dealer:s.finished?s.dealer:[s.dealer[0]],dealerHidden:!s.finished,dealerValue:s.finished?bjValue(s.dealer).total:bjValue([s.dealer[0]]).total,hands:s.hands.map(h=>({...h,value:bjValue(h.cards).total,soft:bjValue(h.cards).soft})),active:s.active,stake:s.stake,committed:s.committed,payout:s.payout,finished:s.finished,result:s.result,log:s.log,
 actions:active?['stand',...(!h.splitAce?['hit']:[]),...(h.cards.length===2&&!h.splitAce?['double']:[]),...(h.cards.length===2&&!h.splitAce&&s.hands.length<4&&rank(h.cards[0])===rank(h.cards[1])?['split']:[]),...(!h.split&&h.cards.length===2&&s.hands.length===1?['surrender']:[])]:[]};}

// Hokm: fixed opposite partnerships, anticlockwise indices, match to 7 points.
export type TrickCard={player:number;card:number};
export type Hokm={kind:'hokm';deck:number[];hands:number[][];trump:number;hakem:number;turn:number;phase:'trump'|'play'|'round_end';trick:TrickCard[];lastTrick:TrickCard[];tricks:number[];scores:number[];round:number;stake:number;finished:boolean;winner:number;result:string;log:string[]};
export function legalHokm(s:Hokm,player=s.turn){if(s.phase!=='play'||s.finished)return[];const lead=s.trick.length?suit(s.trick[0].card):-1,hand=s.hands[player];const follow=hand.filter(c=>suit(c)===lead);return follow.length?follow:hand.slice();}
export function hokmTrickWinner(trick:TrickCard[],trump:number){const lead=suit(trick[0].card);return trick.reduce((a,b)=>{const score=(x:TrickCard)=>(suit(x.card)===trump?100:suit(x.card)===lead?50:0)+rank(x.card);return score(b)>score(a)?b:a;}).player;}
function prepareHokm(s:Hokm){s.deck=pack();s.hands=[[],[],[],[]];s.trump=-1;s.trick=[];s.lastTrick=[];s.tricks=[0,0];s.phase='trump';s.turn=s.hakem;for(let i=0;i<5;i++)s.hands[s.hakem].push(s.deck.pop()!);note(s,'دست '+s.round+'؛ حاکم: '+['شما','آریا','یار شما','رها'][s.hakem]);}
function chooseTrump(s:Hokm,n:number){if(s.phase!=='trump'||!Number.isInteger(n)||n<0||n>3)bad();s.trump=n;
 for(let p=1;p<4;p++)for(let i=0;i<5;i++)s.hands[(s.hakem+p)%4].push(s.deck.pop()!);
 for(let round=0;round<2;round++)for(let p=0;p<4;p++)for(let i=0;i<4;i++)s.hands[(s.hakem+p)%4].push(s.deck.pop()!);
 s.phase='play';s.turn=s.hakem;note(s,'حکم: '+['پیک','دل','خشت','گشنیز'][n]);trace(s);
}
function playHokm(s:Hokm,card:number){if(!legalHokm(s).includes(card))bad();s.hands[s.turn].splice(s.hands[s.turn].indexOf(card),1);s.trick.push({player:s.turn,card});s.turn=(s.turn+1)%4;
 if(s.trick.length===4){const winner=hokmTrickWinner(s.trick,s.trump),team=winner%2;s.tricks[team]++;s.lastTrick=s.trick;s.trick=[];s.turn=winner;note(s,'بُر برای '+(team===0?'تیم شما':'تیم حریف')+'؛ '+s.tricks.join(' / '));
  if(s.tricks[team]===7){const points=s.tricks[1-team]===0?(team===s.hakem%2?2:3):1;s.scores[team]+=points;s.phase='round_end';note(s,'پایان دست؛ '+points+' امتیاز برای '+(team===0?'شما':'حریف'));
   if(s.scores[team]>=7){s.finished=true;s.winner=team;s.result=team===0?'تیم شما برندهٔ مسابقه شد':'تیم حریف برندهٔ مسابقه شد';}else if(team!==s.hakem%2)s.hakem=(s.hakem+1)%4;
  }
 }trace(s);
}
function hokmBots(s:Hokm){let guard=0;while(!s.finished&&s.phase!=='round_end'&&s.turn!==0){if(++guard>60)throw Error('game_progress_failed');if(s.phase==='trump'){const counts=[0,1,2,3].map(n=>s.hands[s.hakem].filter(c=>suit(c)===n).reduce((a,c)=>a+20+rank(c),0));chooseTrump(s,counts.indexOf(Math.max(...counts)));}
 else{const cards=legalHokm(s).sort((a,b)=>rank(a)-rank(b));const leader=s.trick.length?hokmTrickWinner(s.trick,s.trump):-1;
  const winning=cards.filter(c=>hokmTrickWinner([...s.trick,{player:s.turn,card:c}],s.trump)===s.turn);const choice=leader>=0&&leader%2===s.turn%2?cards[0]:winning[0]??cards[0];playHokm(s,choice);}}
}
export function startHokm(n:number):Hokm{stake(n);const selection=pack(),first=selection.findIndex(c=>rank(c)===14),hakem=first%4;const s:Hokm={kind:'hokm',deck:[],hands:[],trump:-1,hakem,turn:hakem,phase:'trump',trick:[],lastTrick:[],tricks:[0,0],scores:[0,0],round:1,stake:n,finished:false,winner:-1,result:'',log:[]};prepareHokm(s);trace(s);hokmBots(s);return s;}
export function moveHokm(s:Hokm,m:{type:string;card?:number;suit?:number}){if(s.finished)bad();playback.delete(s);if(m.type==='next'){if(s.phase!=='round_end')bad();s.round++;prepareHokm(s);trace(s);}else{if(s.turn!==0)bad();if(m.type==='trump')chooseTrump(s,m.suit!);else if(m.type==='card')playHokm(s,m.card!);else bad();}hokmBots(s);}
function publicHokm(s:Hokm){return{kind:s.kind,hand:s.hands[0].slice().sort((a,b)=>suit(a)-suit(b)||rank(a)-rank(b)),counts:s.hands.map(h=>h.length),trump:s.trump,hakem:s.hakem,turn:s.turn,phase:s.phase,trick:s.trick,lastTrick:s.lastTrick,tricks:s.tricks,scores:s.scores,round:s.round,stake:s.stake,finished:s.finished,winner:s.winner,result:s.result,log:s.log,legal:s.turn===0?legalHokm(s):[]};}

// Ludo table variant: enter on six, extra turn only for six, no safe track squares,
// opposing 2+ stacks are impassable, exact finish. Home lanes are private.
export type Ludo={kind:'ludo';tokens:number[][];turn:number;die:number;stake:number;finished:boolean;winner:number;result:string;log:string[];opening:number[];lastRoll?:{player:number;value:number}};
const position=(player:number,progress:number)=>(player*13+progress)%52;
function blocked(s:Ludo,player:number,progress:number){if(progress>=51)return false;const cell=position(player,progress);return s.tokens.some((a,p)=>p!==player&&a.filter(x=>x>=0&&x<51&&position(p,x)===cell).length>=2);}
export function legalLudo(s:Ludo){if(s.finished||!s.die)return[];const options:number[]=[];
 s.tokens[s.turn].forEach((x,i)=>{if(x===56||x<0&&s.die!==6)return;const end=x<0?0:x+s.die;if(end>56)return;for(let step=x<0?0:x+1;step<=end;step++)if(blocked(s,s.turn,step))return;options.push(i);});return options;
}
function rollLudo(s:Ludo){if(s.die)bad();s.die=randomInt(6)+1;s.lastRoll={player:s.turn,value:s.die};note(s,['شما','زرد','آبی','قرمز'][s.turn]+' • تاس '+s.die);trace(s);if(!legalLudo(s).length){const six=s.die===6;s.die=0;if(!six)s.turn=(s.turn+1)%4;trace(s);}}
function playLudo(s:Ludo,token:number){if(!legalLudo(s).includes(token))bad();const p=s.turn,old=s.tokens[p][token],next=old<0?0:old+s.die;s.tokens[p][token]=next;
 if(next<51){const cell=position(p,next);s.tokens.forEach((a,other)=>{if(other!==p)a.forEach((v,i)=>{if(v>=0&&v<51&&position(other,v)===cell){a[i]=-1;note(s,'یک مهره به خانه برگشت.');}});});}
 const six=s.die===6;s.die=0;if(s.tokens[p].every(x=>x===56)){s.finished=true;s.winner=p;s.result=p===0?'شما برندهٔ منچ شدید':'حریف برندهٔ منچ شد';}else if(!six)s.turn=(p+1)%4;trace(s);
}
function ludoBots(s:Ludo){let guard=0;while(!s.finished&&s.turn!==0){if(++guard>256)throw Error('game_progress_failed');if(!s.die){rollLudo(s);if(!s.die)continue;}
 const legal=legalLudo(s),p=s.turn;const score=(i:number)=>{const x=s.tokens[p][i],end=x<0?0:x+s.die;return end===56?1000:end<51&&s.tokens.some((a,q)=>q!==p&&a.some(t=>t>=0&&t<51&&position(q,t)===position(p,end)))?500:x<0?100:end;};legal.sort((a,b)=>score(b)-score(a));playLudo(s,legal[0]);}}
export function startLudo(n:number):Ludo{stake(n);let opening=Array.from({length:4},()=>randomInt(6)+1),candidates=[0,1,2,3];while(candidates.length>1){const best=Math.max(...candidates.map(i=>opening[i]));candidates=candidates.filter(i=>opening[i]===best);if(candidates.length>1)for(const i of candidates)opening[i]=randomInt(6)+1;}
 const s:Ludo={kind:'ludo',tokens:Array.from({length:4},()=>[-1,-1,-1,-1]),turn:candidates[0],die:0,stake:n,finished:false,winner:-1,result:'',opening,log:['بالاترین تاس، آغازکننده را تعیین کرد.']};trace(s);ludoBots(s);return s;}
export function moveLudo(s:Ludo,m:{type:string;token?:number}){if(s.finished||s.turn!==0)bad();playback.delete(s);if(m.type==='roll')rollLudo(s);else if(m.type==='token'&&Number.isInteger(m.token))playLudo(s,m.token!);else bad();ludoBots(s);}
function publicLudo(s:Ludo){return{...s,legal:legalLudo(s)};}
export type Table=BJ|Hokm|Ludo;
export function publicTable(s:Table):any{return s.kind==='blackjack'?publicBJ(s):s.kind==='hokm'?publicHokm(s):publicLudo(s);}
