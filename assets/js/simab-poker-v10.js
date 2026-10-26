(()=>{'use strict';
 const friends=window.SimabPrivatePoker;const $=id=>document.getElementById(id),fmt=n=>Number(n||0).toLocaleString('fa-IR');let session=null,busy=false,previous=null,clockOffset=0,timeoutVersion=null;
 const palettes=[['#2e7d75','#dcc0a0','#332b2a'],['#3f7295','#bd8f69','#241e20'],['#775483','#e5b58c','#39282b'],['#a47538','#8d5a43','#171c24'],['#985565','#d0a07d','#3c252a'],['#457d65','#d9b99b','#20232e']];
 function avatarArt(index){const [shirt,skin,hair]=palettes[index];return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="32" fill="${shirt}"/><path d="M7 64q0-23 25-23t25 23" fill="${shirt}" stroke="#ffffff33" stroke-width="2"/><path d="M26 37v9q6 5 12 0v-9" fill="${skin}"/><ellipse cx="32" cy="28" rx="13" ry="16" fill="${skin}"/><path d="M18 29V19q2-14 16-12 14 1 13 17l-5 6-1-12q-14 5-20-1v14z" fill="${hair}"/><path d="M25 28h3m8 0h3" stroke="#302729" stroke-width="2" stroke-linecap="round"/><path d="M29 36q3 2 6 0" stroke="#8d5b4a" fill="none" stroke-width="1.5"/><path d="M23 46l9 9 9-9" stroke="#e2d4b4" fill="none" stroke-width="2"/></svg>`; }
 function card(id,hidden=false,placeholder=false){const n=document.createElement('div');n.className='playing-card';
  if(placeholder){n.classList.add('placeholder');return n;}if(hidden){n.classList.add('back');return n;}
  const suits=['♠','♥','♦','♣'],suit=suits[Math.floor(id/13)],value=id%13+2,rank=({11:'J',12:'Q',13:'K',14:'A'})[value]||value;
  if(suit==='♥'||suit==='♦')n.classList.add('red');
  const a=document.createElement('span');a.textContent=rank;const b=document.createElement('span');b.className='center-suit';b.textContent=suit;const c=document.createElement('span');c.className='corner';c.textContent=rank+suit;n.append(a,b,c);n.setAttribute('aria-label',rank+' '+suit);return n;
 }
 async function fullscreen(){await SimabGameRoom.open($('poker-stage'));}
 function showRoom(){document.body.classList.add('in-poker');$('poker-lobby').hidden=true;$('poker-room').hidden=false;SimabGameRoom.fit();}
 function lobby(clear=true){$('raise-keypad').hidden=true;document.body.classList.remove('in-poker');$('poker-lobby').hidden=false;$('poker-room').hidden=true;if(clear)session=null;SimabGameRoom.close();$('poker-start').textContent=session&&!session.state.finished?'▶ ادامهٔ دست جاری':'▶ شروع بازی';SimabWallet.refresh().catch(()=>{});
 }
 function controls(){const s=session?.state,p=s?.players?.[0],active=!!s&&!s.finished&&s.current===0&&!busy&&!SimabWallet.pending;
  $('fold').disabled=!active;$('check-call').disabled=!active;$('raise').disabled=!active||!s?.canRaise||s.minRaiseTo>s.maxRaiseTo;
  $('allin').disabled=!active||(s.toCall===0&&!s.canRaise);$('raise-to').disabled=!active||!s?.canRaise;
  document.querySelectorAll('[data-raise]').forEach(b=>{const target=(s?.highest||0)+Number(b.dataset.raise);b.disabled=!active||!s?.canRaise||target<s.minRaiseTo||target>s.maxRaiseTo;});
  $('leave-table').disabled=busy;$('poker-start').disabled=busy||!SimabWallet.state||!!SimabWallet.pending||!!friends&&!friends.canStart();
  $('room-recover').hidden=!SimabWallet.pending;$('play-next').disabled=busy;$('return-lobby').disabled=busy;
 }
 function render(){if(!session?.state)return;showRoom();const s=session.state;if(s.finished)$('raise-keypad').hidden=true;
  $('poker-pot').textContent=fmt(s.pot);$('street-label').textContent=['PRE-FLOP','FLOP','TURN','RIVER'][s.street]||'';$('hand-info').textContent=s.players.length+' PLAYERS • '+session.sessionId.slice(0,8);
  $('community').replaceChildren(...Array.from({length:5},(_,i)=>{const c=card(s.board[i],false,s.board[i]===undefined);if(s.board[i]!==undefined&&s.board[i]!==previous?.board?.[i])c.classList.add('fresh');c.style.setProperty('--card-index',i);return c;}));
  document.querySelector('.pot-label').classList.toggle('fresh',!!previous&&previous.pot!==s.pot);
  const seats=$('poker-seats');seats.replaceChildren();
  for(const p of s.players){const seat=document.createElement('section');seat.className='poker-seat seat-'+p.id+(p.folded?' folded':'')+(s.current===p.id&&!s.finished?' active':'')+(s.winners.includes(p.id)?' winner':'');
   const avatar=document.createElement('div');avatar.className='seat-avatar';const face=document.createElement('span');face.className='avatar-face';if(p.id===0&&window.SimabProfile?.get()!=='👤')face.textContent=SimabProfile.get();else if(friends&&p.emoji)face.textContent=p.emoji;else face.innerHTML=avatarArt(p.id);avatar.append(face);
   if(s.button===p.id){const d=document.createElement('b');d.className='dealer-button';d.textContent='D';avatar.append(d);}
   const cards=document.createElement('div');cards.className='hole-cards';cards.dir='ltr';cards.append(...(p.cards.length?p.cards.map(c=>card(c)):[card(0,true),card(0,true)]));for(const [i,c] of [...cards.children].entries()){if(!previous||previous.players?.[p.id]?.cards?.[i]!==p.cards[i])c.classList.add('fresh');c.style.setProperty('--card-index',i);}avatar.append(cards);
   const name=document.createElement('div');name.className='seat-name';name.textContent=p.name+(!friends&&p.id?' • BOT':'');const stack=document.createElement('div');stack.className='seat-stack';stack.textContent=fmt(p.stack);
   const action=document.createElement('div');action.className='seat-action';action.textContent=p.folded?'فولد':p.last||'آماده';const bet=document.createElement('div');bet.className='seat-bet'+(previous&&previous.players?.[p.id]?.round!==p.round?' fresh':'');bet.textContent=p.round?fmt(p.round):'';bet.hidden=!p.round||s.finished;seat.append(avatar,name,stack,action,bet);seats.append(seat);
  }
  $('check-call').textContent=s.toCall?'کال '+fmt(s.toCall):'چک';$('raise-to').min=s.minRaiseTo;$('raise-to').max=s.maxRaiseTo;$('raise-to').value=Math.min(s.maxRaiseTo,s.minRaiseTo);
  $('turn-status').textContent=s.finished?s.result:(friends&&s.current!==0?'نوبت '+s.players.find(p=>p.id===s.current)?.name:(busy?'در حال ثبت حرکت…':('نوبت شما • '+(s.toCall?'کال '+fmt(s.toCall)+' ژتون':'می‌تونی چک کنی'))));
  document.querySelector('.poker-controls').hidden=s.finished;document.querySelector('.bet-shortcuts').hidden=s.finished;$('next-hand').hidden=!s.finished;
  $('room-message').textContent=busy?'در حال ثبت حرکت…':s.finished?'تسویه در کیف پول ثبت شد.':'ژتون‌های روی میز جدا از ژتون آزاد هستند.';controls();previous=JSON.parse(JSON.stringify(s));
 }
 function accept(r){if(r?.state?.kind!=='poker')return;if(friends&&session?.sessionId===r.sessionId&&session.version===r.version)return;if(session?.sessionId===r.sessionId&&r.version<session.version)return;session=r;clockOffset=(r.serverNow||r.state.serverNow||Date.now())-Date.now();render();}
 async function animate(r){const frames=r?.state?.timeline||[];for(const frame of frames){const dealt=frame.board.length!==previous?.board?.length;session={...r,state:frame};render();SimabSound.play(frame.finished?'chip':dealt?'deal':'chip');await SimabGameRoom.delay(320);}accept(r);SimabSound.play(r.state.finished&&r.state.players[0].stack>r.state.buyIn?'win':'chip');}
 async function load(open=true){const r=friends?await friends.load():await SimabWallet.read('game_state',{game:'poker',...(session?.sessionId?{sessionId:session.sessionId}:{})});if(r.state){if(open){accept(r);await fullscreen();}else{session=r;lobby(false);$('lobby-status').textContent='دست جاری ذخیره شده؛ بدون ورودی دوباره ادامه بده';controls();}}else{$('lobby-status').textContent='آمادهٔ شروع بازی';controls();}}
 async function action(op,move){if(busy||!session)return;SimabSound.unlock();if(move)SimabSound.play(move.type==='fold'?'fold':move.type==='raise'||move.type==='allin'?'raise':'chip');busy=true;controls();try{const r=friends?await friends.move(op,move):await SimabWallet.mutate('game',{game:'poker',op,sessionId:session.sessionId,version:session.version,...(move?{move}:{})});await animate(r);}
  catch(e){$('room-message').textContent=e.message;if(['stale_game','game_finished'].includes(e.code))await load().catch(()=>{});}finally{busy=false;if(session)render();controls();}}
 async function start(){if(busy)return;SimabSound.unlock();if(session&&!session.state.finished){showRoom();await fullscreen();render();return;}busy=true;controls();try{await fullscreen();const amount=SimabWallet.integer($('buy-in').value);const r=friends?await friends.start():await SimabWallet.mutate('game',{game:'poker',op:'start',amount,seats:Number($('seats').value)});showRoom();await animate(r);}
  catch(e){$('lobby-status').textContent=e.message;if(e.code==='active_game_exists')await load().catch(()=>{});}finally{busy=false;if(session)render();controls();}}
 async function leave(){if(busy)return;if(!session||session.state.finished){lobby();return;}if(!confirm('از دست خارج می‌شی؟ شرط‌های این دست مصرف می‌شوند و ژتون باقی‌ماندهٔ میز برمی‌گردد.'))return;await action('leave');if(session?.state.finished)lobby();}
 $('poker-start').onclick=start;$('play-next').onclick=()=>{lobby();if(!friends)start();};$('return-lobby').onclick=()=>lobby();$('leave-table').onclick=leave;
 $('fold').onclick=()=>action('move',{type:'fold'});$('check-call').onclick=()=>action('move',{type:session.state.toCall?'call':'check'});
 $('raise').onclick=()=>{try{action('move',{type:'raise',amount:SimabWallet.integer($('raise-to').value)});}catch(e){$('room-message').textContent=e.message;}};
 $('allin').onclick=()=>action('move',{type:session.state.maxRaiseTo<=session.state.highest?'call':'allin'});
 document.querySelectorAll('[data-raise]').forEach(b=>b.onclick=()=>{const s=session?.state;if(!s||busy)return;const n=s.highest+Number(b.dataset.raise);if(n<s.minRaiseTo||n>s.maxRaiseTo)return;$('raise-to').value=n;});
 let keypadValue='';
 function closeKeypad(){$('raise-keypad').hidden=true;$('raise-to').focus();}
 function openKeypad(){if($('raise-to').disabled||busy)return;keypadValue=String($('raise-to').value);$('keypad-value').textContent=keypadValue;$('keypad-error').textContent='';$('raise-keypad').hidden=false;$('keypad-keys').querySelector('button').focus();}
 for(const key of ['1','2','3','4','5','6','7','8','9','پاک','0','⌫']){const b=document.createElement('button');b.textContent=key;b.onclick=()=>{keypadValue=key==='پاک'?'':key==='⌫'?keypadValue.slice(0,-1):(keypadValue+key).slice(0,6);$('keypad-value').textContent=keypadValue||'۰';};$('keypad-keys').append(b);}
 $('raise-to').onclick=openKeypad;$('raise-to').onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();openKeypad();}};
 $('keypad-close').onclick=closeKeypad;$('keypad-accept').onclick=()=>{const s=session?.state,n=Number(keypadValue);if(!s||s.finished||busy||n<s.minRaiseTo||n>s.maxRaiseTo){$('keypad-error').textContent='مبلغ مجاز: '+fmt(s?.minRaiseTo)+' تا '+fmt(s?.maxRaiseTo);return;}$('raise-to').value=n;closeKeypad();};
 $('raise-keypad').onkeydown=e=>{if(e.key==='Escape')closeKeypad();if(e.key==='Tab'){const buttons=[...$('raise-keypad').querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
 window.addEventListener('simab-avatar',()=>{if(session)render();});
 function tick(){const s=session?.state,n=$('turn-clock');if(!n)return;n.hidden=!s||s.finished||!s.turnDeadline;if(n.hidden)return;const remaining=Math.max(0,Math.ceil((s.turnDeadline-Date.now()-clockOffset)/1000));n.textContent=fmt(remaining)+' ثانیه';n.classList.toggle('urgent',remaining<=5);if(remaining===0&&s.current===0&&!busy&&!SimabWallet.pending&&timeoutVersion!==session.version){timeoutVersion=session.version;action('move',{type:s.toCall?'fold':'check'});}}
 setInterval(tick,200);
 $('room-recover').onclick=()=>SimabWallet.recover().then(accept).catch(e=>{$('room-message').textContent=e.message;});
 $('sound-toggle').onclick=function(){window.SimabSound?.toggle(this);};$('sound-toggle').textContent=SimabSound.isEnabled()?'صدا روشن':'صدا خاموش';$('sound-toggle').setAttribute('aria-pressed',String(SimabSound.isEnabled()));
 if(friends)friends.subscribe(r=>{if(!busy&&r.state)accept(r);controls();});SimabWallet.subscribe(()=>controls());window.addEventListener('simab-receipt',e=>{if(!busy)accept(e.detail);});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!busy&&session&&!session.state.finished)load().catch(()=>{});});
 try{const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();tg?.BackButton?.show();tg?.BackButton?.onClick(()=>{if(session)leave();else location.href='../../index.html';});}catch{}
 SimabWallet.ready.then(()=>load(false)).catch(e=>{$('lobby-status').textContent=e.message;});
})();
