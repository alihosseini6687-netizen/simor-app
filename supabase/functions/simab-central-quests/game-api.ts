import {startPoker,movePoker,publicPoker,startBG,moveBG,passBG,publicBG,spinSlot} from './games.ts';
import type {Poker,BG} from './games.ts';
const uuid=(x:unknown)=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const expose=(s:any)=>s.kind==='poker'?publicPoker(s):s.kind==='backgammon'?publicBG(s):s;
export async function gameAPI(db:any,subject:string,p:Record<string,any>){
 const game=p.game;if(!['poker','backgammon','slot'].includes(game))return {status:400,data:{error:'invalid_game'}};
 if(p.action==='game_state'){
  let q=db.from('simab_game_sessions').select('id,version,state,finished').eq('telegram_subject',subject).eq('game',game);
  if(p.sessionId){if(!uuid(p.sessionId))return {status:400,data:{error:'invalid_request'}};q=q.eq('id',p.sessionId);}else q=q.eq('finished',false);
  const {data,error}=await q.maybeSingle();if(error)return{status:503,data:{error:'game_unavailable'}};
  const w=await db.rpc('simab_secure_wallet_action',{p_subject:subject,p_action:'state',p_amount:0,p_request_id:null});
  if(w.error)return{status:503,data:{error:'wallet_unavailable'}};
  return {status:200,data:{sessionId:data?.id||null,version:data?.version||0,state:data?expose(data.state):null,wallet:w.data}};
 }
 if(!uuid(p.requestId))return {status:400,data:{error:'invalid_request_id'}};
 const op=p.op;if(!['start','move','leave','pass'].includes(op))return{status:400,data:{error:'invalid_move'}};
 const signature=JSON.stringify([game,op,p.sessionId||null,p.version??null,p.amount??null,p.seats??null,p.move??null,p.multiplier??null]);
 if(signature.length>1000)return{status:400,data:{error:'invalid_request'}};
 const replay=await db.from('simab_financial_requests').select('operation_key,result').eq('telegram_subject',subject).eq('request_id',p.requestId).maybeSingle();
 if(replay.error)return{status:503,data:{error:'game_unavailable'}};
 if(replay.data){
  if(replay.data.operation_key!==signature)return{status:409,data:{error:'request_conflict'}};
  const w=await db.rpc('simab_secure_wallet_action',{p_subject:subject,p_action:'state',p_amount:0,p_request_id:null});
  if(w.error)return{status:503,data:{error:'wallet_unavailable'}};
  return{status:200,data:{...replay.data.result,wallet:w.data,duplicate:true}};
 }
 let state:any,id='',expected=-1,debit=0,credit=0;
 try{
  if(op==='start'){
   id=crypto.randomUUID();debit=p.amount;
   if(game==='poker')state=startPoker(p.amount,p.seats||6);
   else if(game==='backgammon')state=startBG(p.amount);
   else{state=spinSlot(p.amount,p.multiplier);credit=state.payout;}
  }else{
   if(!uuid(p.sessionId)||!Number.isInteger(p.version))throw Error('invalid_request');
   const r=await db.from('simab_game_sessions').select('id,version,state,finished').eq('telegram_subject',subject).eq('game',game).eq('id',p.sessionId).maybeSingle();
   if(r.error)return{status:503,data:{error:'game_unavailable'}};
   if(!r.data)throw Error('game_not_found');if(r.data.finished)throw Error('game_finished');
   if(r.data.version!==p.version)throw Error('stale_game');
   id=r.data.id;expected=r.data.version;state=r.data.state;
   if(op==='leave'){
    state.finished=true;state.result='از میز خارج شدید؛ ژتون‌های باقی‌مانده آزاد شد.';
    if(game==='poker'){state.players[0].folded=true;state.current=-1;state.pending=[];}
    else{state.winner=1;state.result='از بازی خارج شدید؛ ورودی این دست مصرف شد.';}
   }else if(game==='poker'){
    if(!p.move||!['fold','check','call','raise','allin'].includes(p.move.type))throw Error('invalid_move');
    movePoker(state as Poker,p.move.type,p.move.amount);
   }else if(game==='backgammon'){
    if(op==='pass')passBG(state as BG);
    else{if(!p.move||!Number.isInteger(p.move.from)||!Number.isInteger(p.move.die))throw Error('invalid_move');moveBG(state as BG,p.move.from,p.move.die);}
   }else throw Error('invalid_move');
  }
  if(game==='poker'&&state.finished)credit=state.players[0].stack;
  if(game==='backgammon'&&state.finished&&state.winner===0)credit=state.stake*2;
  const r=await db.rpc('simab_game_commit',{p_subject:subject,p_game:game,p_request_id:p.requestId,p_operation_key:signature,p_id:id,p_expected_version:expected,
    p_state:state,p_public:expose(state),p_debit:debit,p_credit:credit,p_finished:state.finished});
  if(r.error)throw Error(r.error.message);if(!r.data?.wallet?.serverWallet)throw Error('game_unavailable');
  return{status:200,data:r.data};
 }catch(e){const code=(e as Error).message;const known=['invalid_turn','cannot_check','raise_not_reopened','invalid_raise','raise_too_small','invalid_move','invalid_request','invalid_buyin','invalid_bet','insufficient_chips','wallet_limit','active_game_exists','slot_cooldown','game_not_found','stale_game','game_finished','request_conflict'];
  return{status:known.includes(code)?409:503,data:{error:known.includes(code)?code:'game_unavailable'}};
 }
}
