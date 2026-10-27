import {startVariantH,moveVariantH,timeoutVariantH,publicVariantH} from './hokm-variants.ts';
import {randomInt,startHumanBG,moveHumanBG,legalBG} from './games.ts';
import {startHumanH,moveHumanH,legalH,startL,moveHumanL,legalL,total} from './table-games.ts';
const fail=(s='invalid_move'):never=>{throw Error(s);};
export const gameSizes:any={hokm:[2,4],ludo:[2,4],blackjack:[2,8],backgammon:[2,2],snakes:[2,4],sevens:[2,8],mill:[2,2],bingo:[2,8],truth:[2,8],slot:[2,8]};
const shuffle=(d:number[])=>{for(let i=d.length-1;i>0;i--){const j=randomInt(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;};
const pack=(n=1)=>shuffle(Array.from({length:52*n},(_,i)=>i));
const rank=(c:number)=>c%13+2,suit=(c:number)=>Math.floor(c%52/13);
export const snakes:any={17:7,54:34,62:19,64:60,87:24,93:73,95:75,99:78};
export const ladders:any={4:14,9:31,20:38,28:84,40:59,51:67,63:81,71:91};
const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export const adjacent=(a:number,b:number)=>a!==b&&lines.some(l=>l.includes(a)&&l.includes(b)&&Math.abs(l.indexOf(a)-l.indexOf(b))===1);
function ticket(){for(let tries=0;tries<1000;tries++){const a=Array.from({length:3},()=>shuffle([0,1,2,3,4,5,6,7,8]).slice(0,5)),cols=Array.from({length:9},(_,i)=>a.map((r,j)=>r.includes(i)?j:-1).filter(j=>j>=0));if(cols.some(c=>!c.length))continue;const t=Array.from({length:3},()=>Array(9).fill(0));cols.forEach((rows,c)=>{const low=c===0?1:c*10,high=c===8?90:c*10+9,nums=shuffle(Array.from({length:high-low+1},(_,i)=>low+i)).slice(0,rows.length).sort((a,b)=>a-b);rows.forEach((r,i)=>t[r][c]=nums[i]);});return t;}fail('game_unavailable');}
export function startParty(kind:string,n:number,buyIn:number,options:any={}){const size=gameSizes[kind];if(!size||!Number.isInteger(n)||n<size[0]||n>size[1])fail('invalid_players');const s:any={kind,n,current:0,finished:false,winners:[],result:'',event:1,lastEvent:'shuffle',deadline:Date.now()+20000,log:[]};
 if(kind==='hokm'){s.table=startVariantH(n);s.current=s.table.current;}
 if(kind==='ludo')s.table=startL(Math.max(2,buyIn),n);
 if(kind==='backgammon')s.table=startHumanBG(buyIn);
 if(kind==='snakes'){s.positions=Array(n).fill(0);s.die=0;}
 if(kind==='mill'){s.board=Array(9).fill(-1);s.placed=[0,0];s.moves=0;s.repetitions={};}
 if(kind==='sevens'){s.deck=pack(n>5?2:1);s.hands=Array.from({length:n},()=>s.deck.splice(-7));s.discard=[];let c=s.deck.pop();while([7,8,10,11,14].includes(rank(c))){s.deck.unshift(c);c=s.deck.pop();}s.discard=[c];s.suit=suit(c);s.direction=1;s.penalty=0;s.twoTarget=options.twoTarget!==false;}
 if(kind==='blackjack'){s.deck=pack(4);s.dealer=[s.deck.pop(),s.deck.pop()];s.hands=Array.from({length:n},()=>[s.deck.pop(),s.deck.pop()]);s.done=Array(n).fill(false);s.results=[];}
 if(kind==='bingo'){s.tickets=Array.from({length:n},ticket);s.bag=shuffle(Array.from({length:90},(_,i)=>i+1));s.called=[];s.awards=[[],[],[]];}
 if(kind==='truth'){s.mode=options.mode==='bottle'?'bottle':'dice';s.dareNumbers=Array.isArray(options.dareNumbers)?[...new Set(options.dareNumbers.filter((x:any)=>Number.isInteger(x)&&x>=1&&x<=6))]:[1,3,5];s.phase='roll';s.target=0;s.asker=1;s.round=0;s.die=0;s.question='';s.category='truth';s.deadline=0;}
 if(kind==='slot'){s.scores=Array(n).fill(-1);s.reels=Array.from({length:n},()=>[]);}
 return s;
}
function next(s:any,steps=1){s.current=(s.current+steps+s.n)%s.n;}
function win(s:any,indices:number[],result='بازی تمام شد'){s.finished=true;s.winners=indices;s.result=result;}
function draw(s:any,n:number){const out=[];while(out.length<n){if(!s.deck.length){if(s.discard.length<2)break;const top=s.discard.pop();s.deck=shuffle(s.discard);s.discard=[top];}out.push(s.deck.pop());}return out;}
export function legalSevens(s:any,i:number){return s.hands[i].filter((c:number)=>s.penalty?rank(c)===7:rank(c)===11||suit(c)===s.suit||rank(c)===rank(s.discard.at(-1)));}
export function stepParty(s:any,i:number,m:any,now=Date.now()){
 if(s.finished||s.current!==i)fail('invalid_turn');s.lastEvent='move';
 if(s.kind==='hokm'){s.table.n??=4;moveVariantH(s.table,i,m);s.current=s.table.current;s.lastEvent=m.type==='trump'?'deal':m.type==='next_round'?'shuffle':'card';if(s.table.finished)win(s,s.n===4?[s.table.winner,s.table.winner+2]:[s.table.winner],'برندهٔ مسابقه مشخص شد');}
 else if(s.kind==='ludo'){moveHumanL(s.table,i,m);s.current=s.table.current;s.lastEvent=m.type==='roll'?'dice':'piece';if(s.table.finished)win(s,[s.table.winner]);}
 else if(s.kind==='backgammon'){moveHumanBG(s.table,i,m);s.current=s.table.turn;s.lastEvent=m.type==='roll'?'dice':'checker';if(s.table.finished)win(s,[s.table.winner]);}
 else if(s.kind==='snakes'){if(m.type!=='roll')fail();s.die=randomInt(6)+1;const from=s.positions[i],land=from+s.die;s.positions[i]=land>100?from:snakes[land]||ladders[land]||land;s.lastMove={player:i,from,land:Math.min(land,100),to:s.positions[i]};s.lastEvent='dice';if(s.positions[i]===100)win(s,[i]);else next(s);}
 else if(s.kind==='mill'){const to=m.to;if(!Number.isInteger(to)||to<0||to>8||s.board[to]!==-1)fail();if(s.placed[i]<3){if(m.type!=='place')fail();s.board[to]=i;s.placed[i]++;}else{if(m.type!=='move'||s.board[m.from]!==i||!adjacent(m.from,to))fail();s.board[m.from]=-1;s.board[to]=i;}s.moves++;s.lastEvent='checker';if(lines.some(l=>l.every(c=>s.board[c]===i)))win(s,[i]);else{next(s);const key=s.board.join(',')+':'+s.current;s.repetitions[key]=(s.repetitions[key]||0)+1;if(s.repetitions[key]===3||s.moves>=100)win(s,[],'مساوی؛ ورودی‌ها برگشت');}}
 else if(s.kind==='sevens'){if(m.type==='draw'){const got=draw(s,s.penalty||1);s.hands[i].push(...got);s.penalty=0;next(s,s.direction);s.lastEvent='deal';}else{const c=m.card;if(m.type!=='play'||!legalSevens(s,i).includes(c))fail();if(rank(c)===11&&(!Number.isInteger(m.suit)||m.suit<0||m.suit>3))fail();if(rank(c)===11&&s.hands[i].length===1)fail('cannot_finish_jack');if(rank(c)===2&&s.twoTarget){const target=m.target??((i+s.direction+s.n)%s.n);if(!Number.isInteger(target)||target<0||target>=s.n||target===i)fail();s.hands[target].push(...draw(s,1));}s.hands[i].splice(s.hands[i].indexOf(c),1);s.discard.push(c);s.suit=rank(c)===11?m.suit:suit(c);if(!s.hands[i].length)win(s,[i]);else{const r=rank(c);if(r===7)s.penalty+=2;if(r===10)s.direction*=-1;if(r!==8)next(s,s.direction*(r===14?2:1));}s.lastEvent='card';}}
 else if(s.kind==='blackjack'){if(!['hit','stand'].includes(m.type))fail();if(m.type==='hit')s.hands[i].push(s.deck.pop());if(m.type==='stand'||total(s.hands[i].map((c:number)=>c%52))>=21){s.done[i]=true;next(s);if(s.done.every(Boolean)){while(total(s.dealer.map((c:number)=>c%52))<17)s.dealer.push(s.deck.pop());const dt=total(s.dealer.map((c:number)=>c%52));s.results=s.hands.map((h:number[])=>{const t=total(h.map(c=>c%52));return t>21?-1:dt>21||t>dt?1:t===dt?0:-1;});const best=Math.max(...s.hands.map((h:number[])=>{const t=total(h.map(c=>c%52));return t<=21?t:0;}));win(s,s.hands.map((h:number[],j:number)=>total(h.map(c=>c%52))===best&&best>0?j:-1).filter((j:number)=>j>=0),'میز دوستانه: نزدیک‌ترین امتیاز به ۲۱ برندهٔ پات است');}}s.lastEvent=m.type==='hit'?'card':'tap';}
 else if(s.kind==='bingo'){if(m.type!=='roll')fail();s.called.push(s.bag.pop());const counts=s.tickets.map((t:number[][])=>t.filter(row=>row.filter(Boolean).every(v=>s.called.includes(v))).length);for(let level=1;level<=3;level++)if(!s.awards[level-1].length){const ws=counts.map((v:number,j:number)=>v>=level?j:-1).filter((j:number)=>j>=0);if(ws.length)s.awards[level-1]=ws;}if(s.awards[2].length)win(s,s.awards[2],'فول‌هاوس؛ جایزهٔ یک خط، دو خط و کارت کامل تقسیم شد');else next(s);s.lastEvent='roll';}
 else if(s.kind==='slot'){if(m.type!=='roll')fail();const r=Array.from({length:3},()=>randomInt(6));s.reels[i]=r;s.scores[i]=new Set(r).size===1?100+r[0]:new Set(r).size===2?20+Math.max(...r):r.reduce((a,b)=>a+b,0);if(s.scores.every((v:number)=>v>=0)){const max=Math.max(...s.scores);win(s,s.scores.map((v:number,j:number)=>v===max?j:-1).filter((j:number)=>j>=0));}else next(s);s.lastEvent='roll';}
 else if(s.kind==='truth'){if(m.type==='roll'){if(s.phase!=='roll')fail();s.round++;s.die=randomInt(6)+1;s.target=s.mode==='dice'?i:randomInt(s.n);s.angle=s.target*360/s.n;s.asker=s.mode==='dice'?(i+1)%s.n:(s.target+Math.floor(s.n/2))%s.n;s.category=s.mode==='dice'?(s.dareNumbers.includes(s.die)?'dare':'truth'):'choose';s.current=s.asker;s.phase='question';s.question='';s.lastEvent=s.mode==='dice'?'dice':'roll';}else if(m.type==='question'){if(s.phase!=='question'||typeof m.text!=='string'||m.text.length<2||m.text.length>500)fail();s.question=m.text;if(s.mode==='bottle')s.category=m.category==='dare'?'dare':'truth';s.phase='answer';s.current=s.target;}else if(m.type==='answer'||m.type==='skip'){if(s.phase!=='answer')fail();s.phase='roll';s.question='';s.current=(s.target+1)%s.n;}else fail();}
 s.event++;s.deadline=s.kind==='truth'||s.kind==='hokm'&&s.table.phase==='round_end'?0:now+20000;
}
export function timeoutParty(s:any){const i=s.current;let m:any;
 if(s.kind==='hokm'){s.table.n??=4;timeoutVariantH(s.table);s.current=s.table.current;s.event++;s.lastEvent=s.table.phase==='trump'?'shuffle':'card';if(s.table.finished)win(s,s.n===4?[s.table.winner,s.table.winner+2]:[s.table.winner]);s.deadline=Date.now()+20000;return;}
 else if(s.kind==='ludo')m=s.table.die?{type:'piece',index:legalL(s.table)[0]}:{type:'roll'};
 else if(s.kind==='backgammon')m=s.table.opening||!s.table.dice.length?{type:'roll'}:{type:'move',...legalBG(s.table)[0]};
 else if(s.kind==='sevens')m={type:'draw'};
 else if(s.kind==='blackjack')m={type:'stand'};
 else if(s.kind==='mill'){const to=s.board.findIndex((v:number)=>v<0);if(s.placed[i]<3)m={type:'place',to};else{outer:for(let a=0;a<9;a++)if(s.board[a]===i)for(let b=0;b<9;b++)if(s.board[b]<0&&adjacent(a,b)){m={type:'move',from:a,to:b};break outer;}}if(!m){win(s,[1-i]);return;}}
 else m={type:'roll'};
 stepParty(s,i,m,s.deadline);
}
export function partyPayout(s:any,amount:number){const pot=amount*s.n,out=Array(s.n).fill(0);function split(sum:number,ws:number[]){if(!ws.length)return;ws.forEach((i,j)=>out[i]+=Math.floor(sum/ws.length)+(j<sum%ws.length?1:0));}
 if(s.kind==='bingo'&&!s.forfeit){const a=Math.floor(pot*.2),b=Math.floor(pot*.3);split(a,s.awards[0]);split(b,s.awards[1]);split(pot-a-b,s.awards[2]);}else split(pot,s.winners.length?s.winners:Array.from({length:s.n},(_,i)=>i));return out;
}
export function publicParty(s:any,viewer:number){const p=structuredClone(s);delete p.deck;delete p.bag;delete p.repetitions;
 if(s.kind==='hokm')p.table=publicVariantH({...s.table,n:s.table.n??4},viewer);
 if(s.kind==='ludo')p.table.legal=s.current===viewer?legalL(s.table):[];
 if(s.kind==='backgammon')p.table.moves=s.current===viewer?legalBG(s.table):[];
 if(s.kind==='sevens'){p.hand=s.hands[viewer];p.counts=s.hands.map((h:any)=>h.length);delete p.hands;p.legal=s.current===viewer?legalSevens(s,viewer):[];p.top=s.discard.at(-1);delete p.discard;}
 if(s.kind==='blackjack'){p.hands=s.hands.map((h:any,i:number)=>s.finished||i===viewer?h:h.map(()=>-1));p.dealer=s.finished?s.dealer:[s.dealer[0],-1];}
 if(s.kind==='bingo'){p.ticket=s.tickets[viewer];delete p.tickets;}
 return p;
}
