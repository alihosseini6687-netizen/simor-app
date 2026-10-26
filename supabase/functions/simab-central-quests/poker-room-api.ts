import {startPoker,moveHumanPoker,foldHumanPoker,publicHumanPoker,randomInt} from './games.ts';
const codeOK=(s:any)=>typeof s==='string'&&/^[A-Z2-9]{10}$/.test(s);
const uuid=(s:any)=>typeof s==='string'&&/^[a-f0-9-]{36}$/i.test(s);
const bad=(s:string):never=>{throw Error(s);};
const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode=()=>Array.from({length:10},()=>chars[randomInt(chars.length)]).join('');
const payouts=(s:any)=>s.members.map((m:any,i:number)=>({subject:m.subject,delta:s.poker.players[i].stack}));
export async function pokerRoomAPI(db:any,subject:string,p:any,identity:any={}){
 try{
 const op=p.op||'state';let code=p.code;const wallet=await db.rpc('simab_secure_wallet_action',{p_subject:subject,p_action:'state',p_amount:0,p_request_id:null});if(wallet.error)bad('wallet_unavailable');
 if(op==='signal'){if(!codeOK(code)||!['ready','offer','answer','candidate','bye'].includes(p.signal?.type))bad('invalid_request');const r=await db.rpc('simab_poker_signal',{p_subject:subject,p_code:code,p_recipient:p.to,p_payload:p.signal});if(r.error)bad('invalid_request');return{status:200,data:{ok:true}};}
 if(op==='chat'){if(!codeOK(code))bad('room_not_found');const r=await db.rpc('simab_room_message',{p_subject:subject,p_code:code,p_name:identity.displayName||'بازیکن',p_kind:'chat',p_body:p.text,p_id:p.messageId});if(r.error)bad('invalid_request');return await response(code);}
 const signature=JSON.stringify(['poker_room',op,code||null,p.version??null,p.amount??null,p.maxPlayers??null,p.move??null,p.name??null,p.emoji??null]);
 if(signature.length>1000)bad('invalid_request');
 if(!['state','preview'].includes(op)){
  if(!uuid(p.requestId))bad('invalid_request_id');const r=await db.from('simab_financial_requests').select('operation_key,result').eq('telegram_subject',subject).eq('request_id',p.requestId).maybeSingle();if(r.error)bad('game_unavailable');if(r.data){if(r.data.operation_key!==signature)bad('request_conflict');code=r.data.result.roomCode;return await response(code,true);}
 }
 if(op==='create'){
  if(!Number.isSafeInteger(p.amount)||p.amount<20||p.amount>10000||!Number.isInteger(p.maxPlayers)||p.maxPlayers<2||p.maxPlayers>6)bad('invalid_buyin');
  code=makeCode();const state={host:subject,buyIn:p.amount,maxPlayers:p.maxPlayers,members:[member()],poker:null};await commit(-1,state,'waiting',[{subject,delta:-p.amount}],p.requestId,signature);return await response(code);
 }
 if(!code){const active=await db.from('simab_poker_members').select('room_code').eq('telegram_subject',subject).maybeSingle();code=active.data?.room_code;if(!code)return{status:200,data:{state:null,room:null,wallet:wallet.data}};}
 if(!codeOK(code))bad('room_not_found');
 let row=await get(code),s=row.state,index=s.members.findIndex((m:any)=>m.subject===subject);
 if(s.gameKind)bad('wrong_room_type');
 if(op==='preview')return{status:200,data:{preview:{code,buyIn:s.buyIn,maxPlayers:s.maxPlayers,count:s.members.length,status:row.status},wallet:wallet.data}};
 if(op==='join'){if(p.amount!==undefined&&p.amount!==s.buyIn)bad('invalid_buyin');
  if(index>=0)return await response(code);if(row.status!=='waiting'||s.members.length>=s.maxPlayers)bad('room_full');
  s.members.push(member());await commit(row.version,s,'waiting',[{subject,delta:-s.buyIn}],p.requestId,signature);return await response(code);
 }
 if(index<0)bad('room_forbidden');
 // Any signed participant can advance an expired turn; a late action never extends it.
 if(row.status==='playing'&&s.poker.turnDeadline&&Date.now()>=s.poker.turnDeadline){
  for(let n=0;n<100&&!s.poker.finished&&Date.now()>=s.poker.turnDeadline;n++){const game=s.poker,who=game.current;moveHumanPoker(game,who,game.highest>game.players[who].round?'fold':'check',0,game.turnDeadline);}
  await commit(row.version,s,s.poker.finished?'finished':'playing',s.poker.finished?payouts(s):[],crypto.randomUUID(),'timeout:'+code+':'+row.version);row=await get(code);s=row.state;index=s.members.findIndex((m:any)=>m.subject===subject);if(op!=='state')return{status:409,data:{error:'stale_game'}};
 }
 if(op==='state')return await response(code);
 if(!Number.isInteger(p.version)||p.version!==row.version)bad('stale_game');
 if(op==='start'){
  if(row.status!=='waiting'||s.host!==subject||s.members.length<2)bad('invalid_move');s.poker=startPoker(s.buyIn,s.members.length,true);s.poker.players.forEach((x:any,i:number)=>x.name=s.members[i].name);await commit(row.version,s,'playing',[],p.requestId,signature);
 }else if(op==='move'){
  if(row.status!=='playing'||!['fold','check','call','raise','allin'].includes(p.move?.type))bad('invalid_move');moveHumanPoker(s.poker,index,p.move.type,p.move.amount);await commit(row.version,s,s.poker.finished?'finished':'playing',s.poker.finished?payouts(s):[],p.requestId,signature);
 }else if(op==='leave'){
  if(row.status==='waiting'){
   if(s.host===subject){const changes=s.members.map((m:any)=>({subject:m.subject,delta:s.buyIn}));await commit(row.version,s,'cancelled',changes,p.requestId,signature);}
   else{s.members.splice(index,1);await commit(row.version,s,'waiting',[{subject,delta:s.buyIn}],p.requestId,signature);return{status:200,data:{room:null,state:null,wallet:(await db.rpc('simab_secure_wallet_action',{p_subject:subject,p_action:'state',p_amount:0,p_request_id:null})).data}};}
  }else if(row.status==='playing'){foldHumanPoker(s.poker,index);await commit(row.version,s,s.poker.finished?'finished':'playing',s.poker.finished?payouts(s):[],p.requestId,signature);}else bad('game_finished');
 }else bad('invalid_move');
 return await response(code);
 function member(){return{subject,archiveConsent:p.consent===true,name:identity.displayName||(typeof p.name==='string'?p.name.slice(0,30):'بازیکن'),emoji:typeof p.emoji==='string'?Array.from(p.emoji).slice(0,4).join(''):'👤'};}
 async function get(c:string){const r=await db.from('simab_poker_rooms').select('code,version,status,state').eq('code',c).maybeSingle();if(r.error)bad('game_unavailable');if(!r.data)bad('room_not_found');return r.data;}
 async function commit(expected:number,state:any,status:string,changes:any[],id:string,sig:string){const r=await db.rpc('simab_poker_room_commit',{p_subject:subject,p_code:code,p_expected:expected,p_state:state,p_status:status,p_changes:changes,p_request:id,p_signature:sig});if(r.error)bad(r.error.message);}
 async function response(c:string,duplicate=false){const r=await get(c),s=r.state,i=s.members.findIndex((m:any)=>m.subject===subject);if(i<0){if(!duplicate)bad('room_forbidden');return{status:200,data:{room:null,state:null,wallet:(await db.rpc('simab_secure_wallet_action',{p_subject:subject,p_action:'state',p_amount:0,p_request_id:null})).data}};}
  const inbox=await db.from('simab_poker_signals').select('id,sender,payload').eq('room_code',c).eq('recipient',subject).gt('id',Number.isSafeInteger(p.after)?p.after:0).order('id',{ascending:true}).limit(100);if(inbox.error)bad('game_unavailable');
  const messages=await db.from('simab_room_messages').select('id,subject,display_name,body,created_at').eq('room_code',c).order('id',{ascending:false}).limit(30);
  const w=await db.rpc('simab_secure_wallet_action',{p_subject:subject,p_action:'state',p_amount:0,p_request_id:null});
  return{status:200,data:{sessionId:c,version:r.version,duplicate,serverNow:Date.now(),wallet:w.data,room:{code:c,status:r.status,host:s.host===subject,viewer:i,buyIn:s.buyIn,maxPlayers:s.maxPlayers,members:s.members,signals:inbox.data||[],messages:messages.data||[],iceServers:[{urls:'stun:stun.l.google.com:19302'}]},state:s.poker?{...publicHumanPoker(s.poker,i),players:publicHumanPoker(s.poker,i).players.map((player:any)=>({...player,emoji:s.members[(player.id+i)%s.members.length].emoji}))}:null}};
 }
 }catch(e){const msg=(e as Error).message,known=['wrong_room_type','invalid_move','invalid_turn','invalid_request','invalid_request_id','invalid_buyin','room_not_found','room_full','room_forbidden','stale_game','game_finished','active_room_exists','insufficient_chips','request_conflict','cannot_check','invalid_raise','raise_too_small','raise_not_reopened'];return{status:known.includes(msg)?409:503,data:{error:known.includes(msg)?msg:'game_unavailable'}};}
}
