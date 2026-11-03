import {randomInt} from './games.ts';
const fail=(s='invalid_move'):never=>{throw Error(s);};
const suit=(c:number)=>Math.floor(c/13), rank=(c:number)=>c%13+2;
function deck(){const d=Array.from({length:52},(_,i)=>i);for(let i=51;i;i--){const j=randomInt(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;}
function stake(n:number,even=false){if(!Number.isSafeInteger(n)||n<2||n>10000||even&&n%2)fail('invalid_buyin');}

// Blackjack table: S17, 3:2 natural, one split, no insurance or surrender.
export const total=(cards:number[])=>{let n=cards.reduce((a,c)=>a+Math.min(rank(c),10),0),aces=cards.filter(c=>rank(c)===14).length;n-=aces*9;while(aces--&&n+10<=21)n+=10;return n;};
export type BJ={kind:'blackjack';deck:number[];dealer:number[];hands:{cards:number[];bet:number;done:boolean;split:boolean}[];current:number;stake:number;finished:boolean;payout:number;result:string;};
function finishBJ(s:BJ){while(total(s.dealer)<17)s.dealer.push(s.deck.pop()!);const d=total(s.dealer),natural=s.dealer.length===2&&d===21;s.payout=0;
 for(const h of s.hands){const t=total(h.cards),bj=!h.split&&h.cards.length===2&&t===21;if(t<=21){if(bj&&!natural)s.payout+=h.bet*2.5;else if(t===d&&(!natural||bj))s.payout+=h.bet;else if(!natural&&(d>21||t>d))s.payout+=h.bet*2;}}
 s.finished=true;s.result='بازگشت به کیف پول: '+s.payout+' ژتون';
}
export function startBJ(amount:number):BJ{stake(amount,true);const d=deck(),s:BJ={kind:'blackjack',deck:d,dealer:[d.pop()!,d.pop()!],hands:[{cards:[d.pop()!,d.pop()!],bet:amount,done:false,split:false}],current:0,stake:amount,finished:false,payout:0,result:''};if(total(s.dealer)===21||total(s.hands[0].cards)===21)finishBJ(s);return s;}
export function moveBJ(s:BJ,type:string):number{if(s.finished)fail();const h=s.hands[s.current];let debit=0;
 if(type==='split'){if(s.hands.length!==1||h.cards.length!==2||rank(h.cards[0])!==rank(h.cards[1]))fail();debit=h.bet;const c=h.cards.pop()!;h.split=true;h.cards.push(s.deck.pop()!);const other={cards:[c,s.deck.pop()!],bet:h.bet,done:false,split:true};s.hands.push(other);if(rank(c)===14){h.done=other.done=true;}else if(total(h.cards)===21)h.done=true;}
 else if(type==='double'){if(h.cards.length!==2||h.done)fail();debit=h.bet;h.bet*=2;h.cards.push(s.deck.pop()!);h.done=true;}
 else if(type==='hit'){if(h.done)fail();h.cards.push(s.deck.pop()!);h.done=total(h.cards)>=21;}
 else if(type==='stand')h.done=true;else fail();
 while(s.current<s.hands.length&&(s.hands[s.current].done||total(s.hands[s.current].cards)>=21)){s.hands[s.current].done=true;s.current++;}
 if(s.current===s.hands.length)finishBJ(s);return debit;
}
export function publicBJ(s:BJ){const h=s.hands[s.current];return {kind:s.kind,dealer:s.finished?s.dealer:[s.dealer[0],-1],dealerTotal:s.finished?total(s.dealer):null,hands:s.hands.map(h=>({...h,total:total(h.cards)})),current:s.current,finished:s.finished,payout:s.payout,result:s.result,canDouble:!!h&&h.cards.length===2,canSplit:!!h&&s.hands.length===1&&h.cards.length===2&&rank(h.cards[0])===rank(h.cards[1])};}

// Four-seat partnership Hokm, opposite partners; first to seven match points.
export type Hokm={kind:'hokm';hands:number[][];deck:number[];hakem:number;trump:number;current:number;trick:{player:number;card:number}[];lastTrick:{player:number;card:number}[];tricks:number[];scores:number[];phase:string;stake:number;finished:boolean;winner:number;result:string;log:string[];};
function dealH(s:Hokm){s.deck=deck();s.hands=[[],[],[],[]];s.trump=-1;s.tricks=[0,0];s.trick=[];s.lastTrick=[];s.current=s.hakem;s.phase='trump';s.hands[s.hakem]=s.deck.splice(-5);}
function trumpH(s:Hokm,trump:number){if(!Number.isInteger(trump)||trump<0||trump>3)fail();s.trump=trump;for(let k=1;k<4;k++)s.hands[(s.hakem+k)%4].push(...s.deck.splice(-5));for(let r=0;r<2;r++)for(let k=0;k<4;k++)s.hands[(s.hakem+k)%4].push(...s.deck.splice(-4));s.phase='play';}
export function legalH(s:Hokm,player=s.current):number[]{if(s.finished||s.phase!=='play')return[];const h=s.hands[player],lead=s.trick[0];return lead&&h.some(c=>suit(c)===suit(lead.card))?h.filter(c=>suit(c)===suit(lead.card)):h;}
function playH(s:Hokm,c:number){if(!legalH(s).includes(c))fail();const h=s.hands[s.current];h.splice(h.indexOf(c),1);s.trick.push({player:s.current,card:c});s.current=(s.current+1)%4;
 if(s.trick.length===4){const lead=suit(s.trick[0].card),value=(c:number)=>(suit(c)===s.trump?100:suit(c)===lead?50:0)+rank(c);const win=s.trick.reduce((a,b)=>value(b.card)>value(a.card)?b:a).player;s.current=win;s.tricks[win%2]++;s.lastTrick=s.trick;s.trick=[];
 if(s.tricks[win%2]===7){const team=win%2,points=s.tricks[1-team]===0?(s.hakem%2===team?2:3):1;s.scores[team]+=points;s.log.push((team===0?'تیم شما':'تیم حریف')+' +'+points);s.log=s.log.slice(-6);if(s.scores[team]>=7){s.finished=true;s.winner=team;s.result=team===0?'تیم شما برنده شد':'تیم حریف برنده شد';}else{if(s.hakem%2!==team)s.hakem=(s.hakem+1)%4;dealH(s);}}
 }}
function botsH(s:Hokm){let guard=0;while(!s.finished&&s.current!==0){if(++guard>100)fail('game_progress_failed');if(s.phase==='trump'){const h=s.hands[s.hakem];let best=0;for(let i=1;i<4;i++)if(h.filter(c=>suit(c)===i).length>h.filter(c=>suit(c)===best).length)best=i;trumpH(s,best);}else{const moves=legalH(s);playH(s,moves[randomInt(moves.length)]);}}}
export function startH(amount:number):Hokm{stake(amount);const s:Hokm={kind:'hokm',hands:[],deck:[],hakem:randomInt(4),trump:-1,current:0,trick:[],lastTrick:[],tricks:[0,0],scores:[0,0],phase:'trump',stake:amount,finished:false,winner:-1,result:'',log:[]};dealH(s);botsH(s);return s;}
export function moveH(s:Hokm,m:any){if(s.finished||s.current!==0)fail();if(s.phase==='trump'){if(m.type!=='trump')fail();trumpH(s,m.suit);}else{if(m.type!=='play')fail();playH(s,m.card);}botsH(s);}
export function publicH(s:Hokm){const {deck,hands,...p}=s;return {...p,hand:hands[0],counts:hands.map(h=>h.length),legal:legalH(s,0)};}

// Ludo table variant: 52 shared cells, 6 home cells, safe stars, exact finish,
// one extra roll for six/capture/finish; third consecutive six forfeits the roll.
export type Ludo={kind:'ludo';pieces:number[][];current:number;die:number;sixes:number;stake:number;finished:boolean;winner:number;result:string;log:string[];seatColors?:number[];lastRoll?:{player:number;value:number};};
const safe=new Set([0,8,13,21,26,34,39,47]);
export function legalL(s:Ludo):number[]{if(!s.die||s.finished)return[];return s.pieces[s.current].map((p,i)=>p<0?s.die===6?i:-1:p<57&&p+s.die<=57?i:-1).filter(i=>i>=0);}
function nextL(s:Ludo){s.current=(s.current+1)%s.pieces.length;s.sixes=0;s.die=0;}
function rollL(s:Ludo){if(s.die)fail();s.die=randomInt(6)+1;s.lastRoll={player:s.current,value:s.die};s.sixes=s.die===6?s.sixes+1:0;s.log.push(['شما','قرمز','آبی','زرد'][s.current]+': تاس '+s.die);s.log=s.log.slice(-8);if(s.sixes===3){nextL(s);return;}if(!legalL(s).length){const extra=s.die===6;s.die=0;if(!extra)nextL(s);}}
function stepL(s:Ludo,index:number){if(!legalL(s).includes(index))fail();const p=s.pieces[s.current],pos=p[index]<0?0:p[index]+s.die;p[index]=pos;let capture=false;
 if(pos<51){const cell=((s.seatColors?.[s.current]??s.current)*13+pos)%52;if(!safe.has(cell))for(let side=0;side<s.pieces.length;side++)if(side!==s.current)for(let i=0;i<4;i++)if(s.pieces[side][i]>=0&&s.pieces[side][i]<51&&((s.seatColors?.[side]??side)*13+s.pieces[side][i])%52===cell){s.pieces[side][i]=-1;capture=true;}}
 if(p.every(v=>v===57)){s.finished=true;s.winner=s.current;s.result=s.current===0?'شما برنده شدید':'بازیکن '+s.current+' برنده شد';return;}
 const extra=s.die===6||capture||pos===57;s.die=0;if(!extra)nextL(s);
}
function botsL(s:Ludo){let guard=0;while(!s.finished&&s.current!==0){if(++guard>200)fail('game_progress_failed');if(!s.die)rollL(s);else{const moves=legalL(s);stepL(s,moves[randomInt(moves.length)]);}}}
export function startL(amount:number,n=4):Ludo{stake(amount);if(![2,3,4].includes(n))fail('invalid_players');return{kind:'ludo',pieces:Array.from({length:n},()=>[-1,-1,-1,-1]),seatColors:n===2?[0,2]:Array.from({length:n},(_,i)=>i),current:0,die:0,sixes:0,stake:amount,finished:false,winner:-1,result:'',log:[]};}
export function moveL(s:Ludo,m:any){if(s.finished||s.current!==0)fail();if(m.type==='roll')rollL(s);else if(m.type==='piece')stepL(s,m.index);else fail();botsL(s);}
export function publicL(s:Ludo){return {...s,legal:legalL(s)};}

// Human tables keep each action visible; bots never advance these states.
export function startHumanH(amount:number){const s=startH(amount);s.scores=[0,0];s.hakem=randomInt(4);dealH(s);return s;}
export function moveHumanH(s:Hokm,player:number,m:any){if(s.finished||s.current!==player)fail('invalid_turn');if(s.phase==='trump'){if(m.type!=='trump')fail();trumpH(s,m.suit);}else{if(m.type!=='play')fail();playH(s,m.card);}}
export function moveHumanL(s:Ludo,player:number,m:any){if(s.finished||s.current!==player)fail('invalid_turn');if(m.type==='roll')rollL(s);else if(m.type==='piece')stepL(s,m.index);else fail();}
