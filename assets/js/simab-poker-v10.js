(()=>{'use strict';
 const $=id=>document.getElementById(id),fmt=n=>Number(n||0).toLocaleString('fa-IR');let session=null,busy=false;
 const palettes=[['#2e7d75','#dcc0a0','#332b2a'],['#3f7295','#bd8f69','#241e20'],['#775483','#e5b58c','#39282b'],['#a47538','#8d5a43','#171c24'],['#985565','#d0a07d','#3c252a'],['#457d65','#d9b99b','#20232e']];
 function avatarArt(index){const [shirt,skin,hair]=palettes[index];return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="32" fill="${shirt}"/><path d="M7 64q0-23 25-23t25 23" fill="${shirt}" stroke="#ffffff33" stroke-width="2"/><path d="M26 37v9q6 5 12 0v-9" fill="${skin}"/><ellipse cx="32" cy="28" rx="13" ry="16" fill="${skin}"/><path d="M18 29V19q2-14 16-12 14 1 13 17l-5 6-1-12q-14 5-20-1v14z" fill="${hair}"/><path d="M25 28h3m8 0h3" stroke="#302729" stroke-width="2" stroke-linecap="round"/><path d="M29 36q3 2 6 0" stroke="#8d5b4a" fill="none" stroke-width="1.5"/><path d="M23 46l9 9 9-9" stroke="#e2d4b4" fill="none" stroke-width="2"/></svg>`; }
 function card(id,hidden=false,placeholder=false){const n=document.createElement('div');n.className='playing-card';
  if(placeholder){n.classList.add('placeholder');return n;}if(hidden){n.classList.add('back');return n;}
  const suits=['♠','♥','♦','♣'],suit=suits[Math.floor(id/13)],value=id%13+2,rank=({11:'J',12:'Q',13:'K',14:'A'})[value]||value;
  if(suit==='♥'||suit==='♦')n.classList.add('red');
  const a=document.createElement('span');a.textContent=rank;const b=document.createElement('span');b.className='center-suit';b.textContent=suit;const c=document.createElement('span');c.className='corner';c.textContent=rank+suit;n.append(a,b,c);n.setAttribute('aria-label',rank+' '+suit);return n;
 }
 async function fullscreen(){try{const tg=window.Telegram?.WebApp;if(tg?.isVersionAtLeast?.('8.0')&&!tg.isFullscreen)tg.requestFullscreen();}catch{}
  try{await screen.orientation?.lock?.('landscape');}catch{} // CSS rotates the table when native rotation is unavailable.
 }
 function showRoom(){document.body.classList.add('in-poker');$('poker-lobby').hidden=true;$('poker-room').hidden=false;}
 function lobby(){document.body.classList.remove('in-poker');$('poker-lobby').hidden=false;$('poker-room').hidden=true;session=null;
  try{screen.orientation?.unlock?.();}catch{}SimabWallet.refresh().catch(()=>{});
 }
 function controls(){const s=session?.state,p=s?.players?.[0],active=!!s&&!s.finished&&s.current===0&&!busy&&!SimabWallet.pending;
  $('fold').disabled=!active;$('check-call').disabled=!active;$('raise').disabled=!active||!s?.canRaise||s.minRaiseTo>s.maxRaiseTo;
  $('allin').disabled=!active||(s.toCall===0&&!s.canRaise);$('raise-to').disabled=!active;
  document.querySelectorAll('[data-raise]').forEach(b=>b.disabled=!active||!s?.canRaise);
  $('leave-table').disabled=busy;$('poker-start').disabled=busy||!SimabWallet.state||!!SimabWallet.pending;
  $('room-recover').hidden=!SimabWallet.pending;
 }
 function render(){if(!session?.state)return;showRoom();const s=session.state;
  $('poker-pot').textContent=fmt(s.pot);$('street-label').textContent=['PRE-FLOP','FLOP','TURN','RIVER'][s.street]||'';$('hand-info').textContent=s.players.length+' PLAYERS • '+session.sessionId.slice(0,8);
  $('community').replaceChildren(...Array.from({length:5},(_,i)=>card(s.board[i],false,s.board[i]===undefined)));
  const seats=$('poker-seats');seats.replaceChildren();
  for(const p of s.players){const seat=document.createElement('section');seat.className='poker-seat seat-'+p.id+(p.folded?' folded':'')+(s.current===p.id&&!s.finished?' active':'')+(s.winners.includes(p.id)?' winner':'');
   const avatar=document.createElement('div');avatar.className='seat-avatar';const face=document.createElement('span');face.className='avatar-face';face.innerHTML=avatarArt(p.id);avatar.append(face);
   if(s.button===p.id){const d=document.createElement('b');d.className='dealer-button';d.textContent='D';avatar.append(d);}
   const cards=document.createElement('div');cards.className='hole-cards';cards.dir='ltr';cards.append(...(p.cards.length?p.cards.map(c=>card(c)):[card(0,true),card(0,true)]));avatar.append(cards);
   const name=document.createElement('div');name.className='seat-name';name.textContent=p.name+(p.id?' • BOT':'');const stack=document.createElement('div');stack.className='seat-stack';stack.textContent=fmt(p.stack);
   const action=document.createElement('div');action.className='seat-action';action.textContent=p.folded?'فولد':p.last||'آماده';seat.append(avatar,name,stack,action);seats.append(seat);
  }
  $('check-call').textContent=s.toCall?'کال '+fmt(s.toCall):'چک';$('raise-to').min=s.minRaiseTo;$('raise-to').max=s.maxRaiseTo;$('raise-to').value=Math.min(s.maxRaiseTo,s.minRaiseTo);
  $('turn-status').textContent=s.finished?s.result:('نوبت شما • '+(s.toCall?'کال '+fmt(s.toCall)+' ژتون':'می‌تونی چک کنی'));
  document.querySelector('.poker-controls').hidden=s.finished;document.querySelector('.bet-shortcuts').hidden=s.finished;$('next-hand').hidden=!s.finished;
  $('room-message').textContent=busy?'در حال ثبت حرکت…':s.finished?'تسویه در کیف پول ثبت شد.':'ژتون‌های روی میز جدا از ژتون آزاد هستند.';controls();
 }
 function accept(r){if(r?.state?.kind!=='poker')return;if(session?.sessionId===r.sessionId&&r.version<session.version)return;session=r;render();}
 async function load(){const r=await SimabWallet.read('game_state',{game:'poker',...(session?.sessionId?{sessionId:session.sessionId}:{})});if(r.state)accept(r);else{$('lobby-status').textContent='آمادهٔ ورود به میز';controls();}}
 async function action(op,move){if(busy||!session)return;busy=true;controls();try{const r=await SimabWallet.mutate('game',{game:'poker',op,sessionId:session.sessionId,version:session.version,...(move?{move}:{})});accept(r);try{window.SimabSound?.play(r.state.finished?'win':'chip');}catch{}}
  catch(e){$('room-message').textContent=e.message;if(['stale_game','game_finished'].includes(e.code))await load().catch(()=>{});}finally{busy=false;controls();}}
 async function start(){if(busy)return;busy=true;controls();try{await fullscreen();const amount=SimabWallet.integer($('buy-in').value);const r=await SimabWallet.mutate('game',{game:'poker',op:'start',amount,seats:Number($('seats').value)});accept(r);window.SimabSound?.play('deal');}
  catch(e){$('lobby-status').textContent=e.message;if(e.code==='active_game_exists')await load().catch(()=>{});}finally{busy=false;controls();}}
 async function leave(){if(busy)return;if(!session||session.state.finished){lobby();return;}if(!confirm('از دست خارج می‌شی؟ شرط‌های این دست مصرف می‌شوند و ژتون باقی‌ماندهٔ میز برمی‌گردد.'))return;await action('leave');if(session?.state.finished)lobby();}
 $('poker-start').onclick=start;$('play-next').onclick=()=>{lobby();start();};$('return-lobby').onclick=lobby;$('leave-table').onclick=leave;
 $('fold').onclick=()=>action('move',{type:'fold'});$('check-call').onclick=()=>action('move',{type:session.state.toCall?'call':'check'});
 $('raise').onclick=()=>{try{action('move',{type:'raise',amount:SimabWallet.integer($('raise-to').value)});}catch(e){$('room-message').textContent=e.message;}};
 $('allin').onclick=()=>action('move',{type:session.state.maxRaiseTo<=session.state.highest?'call':'allin'});
 document.querySelectorAll('[data-raise]').forEach(b=>b.onclick=()=>{const s=session.state;let n=s.minRaiseTo;if(b.dataset.raise!=='min')n=s.highest+Math.max(s.minRaiseTo-s.highest,Math.floor(s.pot*(b.dataset.raise==='half'?.5:1)));$('raise-to').value=Math.min(n,s.maxRaiseTo);});
 $('room-recover').onclick=()=>SimabWallet.recover().then(accept).catch(e=>{$('room-message').textContent=e.message;});
 $('sound-toggle').onclick=function(){window.SimabSound?.toggle(this);};
 SimabWallet.subscribe(()=>controls());window.addEventListener('simab-receipt',e=>accept(e.detail));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!busy&&session&&!session.state.finished)load().catch(()=>{});});
 try{const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();tg?.BackButton?.show();tg?.BackButton?.onClick(()=>{if(session)leave();else location.href='../../index.html';});}catch{}
 SimabWallet.ready.then(()=>load()).catch(e=>{$('lobby-status').textContent=e.message;});
})();
