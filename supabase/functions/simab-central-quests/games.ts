// Authoritative game rules. No client cards, dice, winner or payout are accepted.
export type Player = {id:number;name:string;cards:number[];stack:number;bet:number;round:number;folded:boolean;acted:boolean;lastFaced:number;last:string};
export function randomInt(max:number):number {
  const range=0x100000000, limit=range-range%max;
  const a=new Uint32Array(1); do {crypto.getRandomValues(a);} while(a[0]>=limit);
  return a[0]%max;
}
const fail=(s:string):never=>{throw Error(s);};
// Animation snapshots are sanitized, transient and never part of private persisted state.
const playback=new WeakMap<object,any[]>();
function trace(s:Poker|BG){const frames=playback.get(s)||[];if(frames.length<48)frames.push(structuredClone(s.kind==='poker'?publicPoker(s):publicBG(s)));playback.set(s,frames);}
export const gameFrames=(s:object)=>playback.get(s)||[];

export const cardValue=(c:number)=>c%13+2;
function score5(cards:number[]):number[] {
  const vals=cards.map(cardValue).sort((a,b)=>b-a), unique=[...new Set(vals)];
  const flush=cards.every(c=>Math.floor(c/13)===Math.floor(cards[0]/13));
  if(unique[0]===14)unique.push(1);
  let straight=0;
  for(let i=0;i<=unique.length-5;i++) if(unique[i]-unique[i+4]===4){straight=unique[i];break;}
  const groups=[...new Set(vals)].map(v=>({v,n:vals.filter(x=>x===v).length})).sort((a,b)=>b.n-a.n||b.v-a.v);
  if(flush&&straight)return[8,straight];
  if(groups[0].n===4)return[7,groups[0].v,groups[1].v];
  if(groups[0].n===3&&groups[1].n===2)return[6,groups[0].v,groups[1].v];
  if(flush)return[5,...vals]; if(straight)return[4,straight];
  if(groups[0].n===3)return[3,groups[0].v,...groups.slice(1).map(g=>g.v)];
  if(groups[0].n===2&&groups[1].n===2)return[2,Math.max(groups[0].v,groups[1].v),Math.min(groups[0].v,groups[1].v),groups[2].v];
  if(groups[0].n===2)return[1,groups[0].v,...groups.slice(1).map(g=>g.v)];
  return[0,...vals];
}
export function compare(a:number[],b:number[]):number {for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}return 0;}
export function evaluate(cards:number[]):number[]{
  if(cards.length<5)return[0,...cards.map(cardValue).sort((a,b)=>b-a)];
  let best:number[]=[];
  for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){
    const s=score5([cards[a],cards[b],cards[c],cards[d],cards[e]]);if(compare(s,best)>0)best=s;
  }return best;
}
export type Poker={turnDeadline?:number;kind:'poker';players:Player[];deck:number[];board:number[];street:number;current:number;highest:number;minRaise:number;pending:number[];button:number;finished:boolean;result:string;winners:number[];buyIn:number;log:string[];};
const names=['شما','آریا','سارا','نیما','رها','کاوه'];
function pay(p:Player,n:number){const v=Math.min(p.stack,Math.max(0,n));p.stack-=v;p.bet+=v;p.round+=v;return v;}
function log(s:Poker,p:Player,text:string){p.last=text;s.log.push(p.name+': '+text);s.log=s.log.slice(-10);}
function live(s:Poker){return s.players.filter(p=>!p.folded);}
export function settlePoker(s:Poker){
  const alive=live(s),tiers=[...new Set(s.players.map(p=>p.bet).filter(n=>n>0))].sort((a,b)=>a-b);
  let previous=0;const awards=new Map<number,number>();
  for(const level of tiers){
    const participants=s.players.filter(p=>p.bet>=level),pot=(level-previous)*participants.length;previous=level;
    let eligible=participants.filter(p=>!p.folded);
    if(!eligible.length){for(const p of participants)p.stack+=(level-(tiers[tiers.indexOf(level)-1]||0));continue;}
    if(alive.length!==1){let best:number[]=[];let winners:Player[]=[];
      for(const p of eligible){const hand=evaluate([...p.cards,...s.board]);const cmp=compare(hand,best);if(cmp>0){best=hand;winners=[p];}else if(cmp===0)winners.push(p);}eligible=winners;
    }
    eligible.sort((a,b)=>((a.id-s.button-1+s.players.length)%s.players.length)-((b.id-s.button-1+s.players.length)%s.players.length));
    const share=Math.floor(pot/eligible.length);let remainder=pot%eligible.length;
    for(const p of eligible){const win=share+(remainder-->0?1:0);p.stack+=win;awards.set(p.id,(awards.get(p.id)||0)+win);}
  }
  s.winners=[...awards.keys()];s.finished=true;s.pending=[];s.current=-1;
  const hero=s.players[0];s.result=(hero.stack>s.buyIn?'برد':hero.stack===s.buyIn?'مساوی':'پایان دست')+' • تغییر ژتون: '+String(hero.stack-s.buyIn);
}
function advance(s:Poker,after:number){
  if(live(s).length===1){settlePoker(s);return;}
  s.pending=s.pending.filter(i=>!s.players[i].folded&&s.players[i].stack>0);
  // No betting into an empty side pot: a lone funded player may only answer an outstanding bet.
  const funded=live(s).filter(p=>p.stack>0);
  if(funded.length===1&&funded[0].round>=s.highest)s.pending=[];
  if(s.pending.length){for(let n=1;n<=s.players.length;n++){const i=(after+n)%s.players.length;if(s.pending.includes(i)){s.current=i;return;}}}
  const canBet=live(s).filter(p=>p.stack>0);
  if(s.street===3||canBet.length<=1){while(s.board.length<5)s.board.push(s.deck.pop()!);s.street=3;settlePoker(s);return;}
  s.street++; const count=s.street===1?3:1; s.deck.pop();for(let i=0;i<count;i++)s.board.push(s.deck.pop()!);
  s.highest=0;s.minRaise=2;s.players.forEach(p=>{p.round=0;p.acted=false;p.lastFaced=0;});
  s.pending=canBet.map(p=>p.id);advance(s,s.button);
}
function actPoker(s:Poker,index:number,action:string,amount=0){
  const p=s.players[index]; if(s.finished||s.current!==index||p.folded||p.stack<=0)fail('invalid_turn');
  const toCall=Math.max(0,s.highest-p.round); let raised=false,full=false;
  if(action==='fold'){p.folded=true;log(s,p,'فولد');}
  else if(action==='check'){if(toCall)fail('cannot_check');log(s,p,'چک');}
  else if(action==='call'){const n=pay(p,toCall);log(s,p,p.stack===0?'آل‌این '+n:'کال '+n);}
  else if(action==='raise'||action==='allin'){
    if(!live(s).some(x=>x.id!==index&&x.stack>0))fail('invalid_raise');
    if(p.acted&&s.highest-p.lastFaced<s.minRaise)fail('raise_not_reopened');
    const target=action==='allin'?p.round+p.stack:amount;
    if(!Number.isSafeInteger(target)||target<=s.highest||target>p.round+p.stack)fail('invalid_raise');
    const increment=target-s.highest;full=increment>=s.minRaise;
    if(!full&&target!==p.round+p.stack)fail('raise_too_small');
    pay(p,target-p.round);raised=true;s.highest=target;
    if(full){s.minRaise=increment;s.players.forEach(x=>{x.acted=false;});}
    log(s,p,p.stack===0?'آل‌این '+target:'افزایش تا '+target);
  }else fail('invalid_move');
  p.acted=true;p.lastFaced=s.highest;s.pending=s.pending.filter(i=>i!==index);
  if(raised){const owing=live(s).filter(x=>x.id!==index&&x.stack>0&&x.round<s.highest).map(x=>x.id);s.pending=full?owing:[...new Set([...s.pending,...owing])];}
  advance(s,index);trace(s);
}
function bots(s:Poker){
  let guard=0;
  while(!s.finished&&s.current!==0){
    if(++guard>150)fail('game_progress_failed');
    const p=s.players[s.current],call=Math.max(0,s.highest-p.round);
    const strength=s.board.length?evaluate([...p.cards,...s.board])[0]/8:
      (p.cards[0]%13===p.cards[1]%13?.65:.12)+(cardValue(p.cards[0])+cardValue(p.cards[1]))/65;
    const r=randomInt(100),price=call/Math.max(1,p.stack+call),aggression=12+p.id*3;
    if(call>0&&price>.18&&strength<.35&&r<55)actPoker(s,p.id,'fold');
    else if(live(s).some(x=>x.id!==p.id&&x.stack>0)&&(!p.acted||s.highest-p.lastFaced>=s.minRaise)&&r<aggression&&p.stack>call+s.minRaise*2){
      const target=Math.min(p.round+p.stack,s.highest+s.minRaise*(1+randomInt(2)));
      actPoker(s,p.id,'raise',target);
    }else actPoker(s,p.id,call?'call':'check');
  }
}
export function startPoker(buyIn:number,seats:number,human=false):Poker {
  if(!Number.isSafeInteger(buyIn)||buyIn<20||buyIn>10000||(human?(!Number.isInteger(seats)||seats<2||seats>6):![2,4,6].includes(seats)))fail('invalid_buyin');
  const deck=Array.from({length:52},(_,i)=>i);for(let i=51;i>0;i--){const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
  const s:Poker={kind:'poker',players:[],deck,board:[],street:0,current:0,highest:2,minRaise:2,pending:[],button:randomInt(seats),finished:false,result:'',winners:[],buyIn,log:[]};
  for(let i=0;i<seats;i++)s.players.push({id:i,name:names[i],cards:[deck.pop()!,deck.pop()!],stack:buyIn,bet:0,round:0,folded:false,acted:false,lastFaced:0,last:''});
  const small=seats===2?s.button:(s.button+1)%seats,big=(small+1)%seats;
  pay(s.players[small],1);pay(s.players[big],2);s.players[small].last='اسمال بلایند ۱';s.players[big].last='بیگ بلایند ۲';
  s.pending=s.players.map(p=>p.id);advance(s,big);trace(s);if(!human)bots(s);s.turnDeadline=s.finished?0:Date.now()+20000;return s;
}
export function movePoker(s:Poker,action:string,amount:number):Poker {playback.delete(s);if(s.turnDeadline&&Date.now()>=s.turnDeadline)action=s.highest>s.players[0].round?'fold':'check';actPoker(s,0,action,amount);bots(s);s.turnDeadline=s.finished?0:Date.now()+20000;return s;}
export function publicPoker(s:Poker){
  const hero=s.players[0],call=Math.max(0,s.highest-hero.round);
  return {kind:'poker',turnDeadline:s.turnDeadline||0,serverNow:Date.now(),turnSeconds:20,players:s.players.map(p=>({...p,cards:p.id===0||s.finished&&!p.folded?p.cards:[],acted:undefined})),board:s.board,
    street:s.street,current:s.current,pot:s.players.reduce((a,p)=>a+p.bet,0),button:s.button,finished:s.finished,result:s.result,winners:s.winners,
    buyIn:s.buyIn,log:s.log,toCall:Math.min(call,hero.stack),minRaiseTo:s.highest+s.minRaise,maxRaiseTo:hero.round+hero.stack,
    canRaise:live(s).some(x=>x.id!==0&&x.stack>0)&&(!hero.acted||s.highest-hero.lastFaced>=s.minRaise)&&hero.round+hero.stack>s.highest,highest:s.highest};
}

// Backgammon: positive checkers move 23 -> 0; negative checkers move 0 -> 23.
export type BG={kind:'backgammon';points:number[];bar:number[];off:number[];dice:number[];turn:number;finished:boolean;winner:number;stake:number;log:string[];};
export type Move={from:number;to:number;die:number};
function oneMoves(s:BG,die:number):Move[]{
 const sign=s.turn===0?1:-1, moves:Move[]=[];const bar=s.bar[s.turn];
 const home=s.points.every((n,i)=>n*sign<=0||(s.turn===0?i<6:i>17))&&bar===0;
 const sources=bar?[-1]:s.points.map((n,i)=>n*sign>0?i:-2).filter(i=>i>=0);
 for(const from of sources){
  const to=from===-1?(s.turn===0?24-die:die-1):from-sign*die;
  if(to>=0&&to<24){if(s.points[to]*sign>=-1)moves.push({from,to,die});}
  else if(home){const distance=s.turn===0?from+1:24-from;
   const farther=s.points.some((n,i)=>n*sign>0&&(s.turn===0?i>from:i<from));
   if(die===distance||(die>distance&&!farther))moves.push({from,to:-1,die});
  }
 }return moves;
}
function applyBG(s:BG,m:Move){const sign=s.turn===0?1:-1;if(m.from===-1)s.bar[s.turn]--;else s.points[m.from]-=sign;
 if(m.to===-1)s.off[s.turn]++;else{if(s.points[m.to]===-sign){s.points[m.to]=0;s.bar[1-s.turn]++;}s.points[m.to]+=sign;}
 s.dice.splice(s.dice.indexOf(m.die),1);
 s.log.push((s.turn===0?'شما':'حریف')+': '+(m.from===-1?'بار':m.from+1)+' ← '+(m.to===-1?'خروج':m.to+1));s.log=s.log.slice(-8);
 if(s.off[s.turn]===15){s.finished=true;s.winner=s.turn;}
}
export function legalBG(s:BG):Move[]{
 if(s.finished||!s.dice.length)return[];
 const memo=new Map<string,number>();
 function max(s:BG):number{if(!s.dice.length||s.finished)return 0;const key=JSON.stringify([s.points,s.bar,s.off,s.dice]);if(memo.has(key))return memo.get(key)!;
 let best=0;for(const d of new Set(s.dice))for(const m of oneMoves(s,d)){const copy=structuredClone(s);applyBG(copy,m);best=Math.max(best,1+max(copy));}memo.set(key,best);return best;}
 let best=0,result:Move[]=[];
 for(const d of new Set(s.dice))for(const m of oneMoves(s,d)){const copy=structuredClone(s);applyBG(copy,m);const count=1+max(copy);if(count>best){best=count;result=[m];}else if(count===best)result.push(m);}
 if(best===1&&s.dice.length===2&&s.dice[0]!==s.dice[1]&&result.length){const higher=Math.max(...result.map(m=>m.die));result=result.filter(m=>m.die===higher);}
 return result;
}
function rollBG(s:BG){const a=1+randomInt(6),b=1+randomInt(6);s.dice=a===b?[a,a,a,a]:[a,b];s.log.push((s.turn===0?'شما':'حریف')+' • تاس '+a+' و '+b);s.log=s.log.slice(-8);}
function bgBots(s:BG){let turns=0;
 while(!s.finished){let moves=legalBG(s);
  if(s.turn===0&&moves.length)return;
  if(s.turn===1&&moves.length){moves.sort((a,b)=>{
    const score=(m:Move)=>m.to===-1?100:s.points[m.to]===1?65:s.points[m.to]===-1?30:0;
    return score(b)-score(a);
   });applyBG(s,moves[0]);trace(s);continue;}
  if(++turns>10){s.dice=[];s.turn=0;return;} // next request can roll if both sides were blocked
  s.turn=1-s.turn;rollBG(s);trace(s);
 }
}
export function startBG(stake:number):BG{
 if(!Number.isSafeInteger(stake)||stake<1||stake>10000)fail('invalid_buyin');
 const points=Array(24).fill(0);points[23]=2;points[12]=5;points[7]=3;points[5]=5;points[0]=-2;points[11]=-5;points[16]=-3;points[18]=-5;
 const s:BG={kind:'backgammon',points,bar:[0,0],off:[0,0],dice:[],turn:0,finished:false,winner:-1,stake,log:[]};
 let a=0,b=0;do{a=1+randomInt(6);b=1+randomInt(6);}while(a===b);s.turn=a>b?0:1;s.dice=[a,b];s.log.push('تاس شروع: شما '+a+' • حریف '+b+'؛ '+(s.turn===0?'شما':'حریف')+' شروع می‌کند');trace(s);bgBots(s);return s;
}
export function moveBG(s:BG,from:number,die:number):BG{
 playback.delete(s);if(s.finished||s.turn!==0)fail('invalid_turn');
 const move=legalBG(s).find(m=>m.from===from&&m.die===die);if(!move)fail('invalid_move');applyBG(s,move);trace(s);bgBots(s);return s;
}
export function passBG(s:BG):BG{playback.delete(s);if(s.turn!==0||legalBG(s).length)fail('invalid_move');s.turn=1;rollBG(s);bgBots(s);return s;}
export function publicBG(s:BG){
 const loser=1-s.winner,sign=s.winner===0?1:-1;
 const level=!s.finished?0:s.off[loser]>0?1:s.bar[loser]>0||s.points.some((n,i)=>n*sign<0&&(s.winner===0?i<6:i>17))?3:2;
 return{...s,moves:legalBG(s),winType:level,result:s.finished?(s.winner===0?'شما برنده شدید':'حریف برنده شد')+(level===3?' • مارس سیاه':level===2?' • مارس':''):''};
}
export function spinSlot(amount:number,multiplier:number){
 const bases=[2,5,25,100,500];if(!Number.isSafeInteger(multiplier)||multiplier<1||multiplier>50||!bases.includes(amount/multiplier))fail('invalid_bet');
 const reels=[randomInt(9),randomInt(9),randomInt(9)],factors=[50,30,20,10,0,5,0,0,0];let payout=0;
 if(reels[0]===reels[1]&&reels[1]===reels[2])payout=reels[0]===4?20*multiplier:amount*factors[reels[0]];
 else if([[0,1],[0,2],[1,2]].some(([a,b])=>reels[a]===reels[b]&&reels[a]<6))payout=amount*2;
 // A spin can lose only its displayed stake; no extra bomb penalty.
 return {kind:'slot',reels,payout,bet:amount,finished:true};
}

// Shared tables have no bot decisions; each authenticated seat acts independently.
export function moveHumanPoker(s:Poker,index:number,action:string,amount=0,now=Date.now()){
 playback.delete(s);actPoker(s,index,action,amount);s.turnDeadline=s.finished?0:now+20000;return s;
}
export function foldHumanPoker(s:Poker,index:number){
 if(s.finished||s.players[index].folded)return s;
 if(s.current===index)return moveHumanPoker(s,index,'fold');
 s.players[index].folded=true;s.players[index].last='فولد و خروج';s.pending=s.pending.filter(i=>i!==index);advance(s,(s.current-1+s.players.length)%s.players.length);return s;
}
export function publicHumanPoker(s:Poker,viewer:number){
 const hero=s.players[viewer],base=publicPoker(s),map=(i:number)=>i<0?i:(i-viewer+s.players.length)%s.players.length;
 return {...base,players:s.players.map(p=>({...p,id:map(p.id),cards:p.id===viewer||s.finished&&!p.folded?p.cards:[],acted:undefined})).sort((a,b)=>a.id-b.id),current:map(s.current),button:map(s.button),winners:s.winners.map(map),toCall:Math.min(Math.max(0,s.highest-hero.round),hero.stack),maxRaiseTo:hero.round+hero.stack,canRaise:live(s).some(p=>p.id!==viewer&&p.stack>0)&&(!hero.acted||s.highest-hero.lastFaced>=s.minRaise)&&hero.round+hero.stack>s.highest,result:s.finished?'پایان دست • تغییر ژتون شما: '+(hero.stack-s.buyIn):''};
}
