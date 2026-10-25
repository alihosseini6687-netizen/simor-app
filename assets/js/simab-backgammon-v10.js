(()=>{'use strict';const $=id=>document.getElementById(id);let session=null,busy=false,selected=null,die=null;
 const moves=()=>session?.state.moves||[];
 function paint(){if(!session?.state)return;const s=session.state;$('bg-lobby').hidden=true;$('bg-game').hidden=false;$('bg-board').replaceChildren();
  const targets=moves().filter(m=>m.from===selected&&(!die||m.die===die));
  for(const i of [...Array.from({length:12},(_,n)=>12+n),...Array.from({length:12},(_,n)=>11-n)]){
   const b=document.createElement('button');b.className='bg-point'+(i<12?' lower':'')+(selected===i?' selected':'')+(targets.some(m=>m.to===i)?' legal':'');b.type='button';b.setAttribute('aria-label','خانه '+(i+1)+'؛ '+Math.abs(s.points[i])+' مهره');
   const label=document.createElement('small');label.textContent=i+1;b.append(label);
   for(let j=0;j<Math.min(5,Math.abs(s.points[i]));j++){const c=document.createElement('span');c.className='checker'+(s.points[i]<0?' black':'');if(j===4&&Math.abs(s.points[i])>5)c.textContent=Math.abs(s.points[i]);b.append(c);}
   b.disabled=busy||s.finished;b.onclick=()=>choose(i);$('bg-board').append(b);
  }
  $('bg-dice').replaceChildren();for(const d of s.dice){const b=document.createElement('button');const positions={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};for(let i=0;i<9;i++){const pip=document.createElement('i');if(positions[d].includes(i))pip.className='pip';b.append(pip);}b.className=d===die?'selected':'';b.disabled=busy||s.finished;b.setAttribute('aria-label','تاس '+d);b.onclick=()=>{die=die===d?null:d;paint();};$('bg-dice').append(b);}
  $('bg-off-user').textContent=s.off[0];$('bg-off-bot').textContent=s.off[1];$('bg-bar').textContent='بار شما: '+s.bar[0]+' • حریف: '+s.bar[1];$('bg-bar').disabled=busy||!s.bar[0]||s.finished;
  $('bg-off').disabled=busy||!targets.some(m=>m.to===-1)||s.finished;$('bg-pass').hidden=!!s.moves.length||s.finished;$('bg-pass').disabled=busy;$('bg-leave').disabled=busy||s.finished;$('bg-next').hidden=!s.finished;
  $('bg-turn').textContent=s.finished?s.result+'؛ تسویه ثبت شد.':s.bar[0]?'اول مهرهٔ روی بار را انتخاب کن.':'مهرهٔ سفید و سپس مقصد سبز را انتخاب کن.';$('bg-log').textContent=s.log.slice(-3).join(' / ');
 }
 function accept(r){if(r?.state?.kind!=='backgammon')return;if(session?.sessionId===r.sessionId&&r.version<session.version)return;session=r;selected=null;die=null;paint();}
 async function load(){const r=await SimabWallet.read('game_state',{game:'backgammon',...(session?.sessionId?{sessionId:session.sessionId}:{})});if(r.state)accept(r);$('bg-start').disabled=!SimabWallet.state||!!SimabWallet.pending;}
 async function send(op,move){if(busy)return;busy=true;paint();try{const r=await SimabWallet.mutate('game',{game:'backgammon',op,sessionId:session.sessionId,version:session.version,...(move?{move}:{})});accept(r);$('bg-message').textContent='';}catch(e){$('bg-message').textContent=e.message;if(e.code==='stale_game')await load().catch(()=>{});}finally{busy=false;paint();}}
 function choose(point){if(busy||!session||session.state.finished)return;const target=moves().find(m=>m.from===selected&&m.to===point&&(!die||m.die===die));if(target){send('move',{from:target.from,die:target.die});return;}
  if(moves().some(m=>m.from===point)){selected=point;paint();}}
 $('bg-bar').onclick=()=>{selected=-1;paint();};$('bg-off').onclick=()=>choose(-1);$('bg-pass').onclick=()=>send('pass');
 $('bg-start').onclick=async()=>{if(busy)return;busy=true;$('bg-start').disabled=true;try{const amount=SimabWallet.integer($('bg-stake').value);accept(await SimabWallet.mutate('game',{game:'backgammon',op:'start',amount}));}catch(e){$('bg-message').textContent=e.message;if(e.code==='active_game_exists')await load().catch(()=>{});}finally{busy=false;$('bg-start').disabled=false;paint();}};
 $('bg-leave').onclick=()=>{if(confirm('با خروج، ورودی این دست مصرف می‌شود. خارج می‌شی؟'))send('leave');};$('bg-next').onclick=()=>{session=null;$('bg-lobby').hidden=false;$('bg-game').hidden=true;};
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!busy&&session&&!session.state.finished)load().catch(()=>{});});window.addEventListener('simab-receipt',e=>accept(e.detail));SimabWallet.ready.then(load).catch(e=>{$('bg-message').textContent=e.message;});
})();
