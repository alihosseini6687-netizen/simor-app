(()=>{'use strict';const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),kind=params.get('game')||'hokm',fmt=n=>Number(n).toLocaleString(window.SimabI18n?.locale||'en-US'),suits=['♠','♥','♦','♣'],colors=['green','red','blue','yellow','purple','orange','pink','cyan'];let practice=false,practiceWaiting=false,practicePaused=false,practiceState=null,practiceTimer=null;let rollTimer=null;let latest=null,code=params.get('code')||'',busy=false,polling=false,selected=-1,offset=0,lastEvent=0,bottleAngle=0,bottleRound=-1,setupMode='friends',loadGeneration=0;
const games={hokm:['حکم',2,4,'چهار نفر، دو تیم روبه‌رو. حاکم از پنج کارت اول حکم را انتخاب می‌کند؛ سپس کارت‌ها ۵-۴-۴ پخش می‌شوند. رعایت خال اجباری؛ حکم بالاتر برنده است. هفت دست یک دور؛ امتیاز معمولی ۱، کت ۲ و حاکم‌کتی ۳. نخستین تیم با ۷ امتیاز برنده؛ پات به‌طور مساوی بین دو هم‌تیمی برنده تقسیم می‌شود.'],blackjack:['۲۱ دوستانه',2,8,'نسخهٔ رقابتی دوستانه: هر نفر کارت می‌گیرد یا می‌ایستد؛ آس ۱ یا ۱۱ و صورت‌ها ۱۰. بالای ۲۱ می‌سوزد. نزدیک‌ترین امتیاز معتبر به ۲۱ پات را می‌برد و مساوی‌ها تقسیم می‌کنند. دیلر نمایشی تا ۱۷ می‌کشد. این میز، پرداخت ۳:۲ یا شرط جداگانه مقابل بانک ندارد؛ آن قوانین در بخش بازی با دیلر هستند.'],ludo:['منچ',2,4,'چهار نفر، هر نفر چهار مهره. ورود از حیاط با ۶؛ خانه‌های ستاره‌دار امن‌اند. زدن مهرهٔ حریف خارج از خانهٔ امن آن را به حیاط می‌فرستد. رسیدن به خانهٔ آخر با عدد دقیق. شش، زدن مهره یا رساندن مهره یک تاس اضافه می‌دهد؛ سومین شش پشت‌سرهم نوبت را می‌سوزاند. اولین نفر با چهار مهره در پایان، کل پات را می‌برد.'],backgammon:['تخته‌نرد',2,2,'هر نفر ۱۵ مهره؛ جهت دو طرف مخالف. هر بازیکن خودش تاس شروع و تاس نوبتش را می‌اندازد؛ نتیجه روی سرور تصادفی است. تاس شروع مساوی دوباره می‌شود. تاس جفت چهار حرکت است؛ استفادهٔ بیشترین تاس ممکن اجباری، در صورت امکان فقط یک حرکت با تاس بزرگ‌تر. مهرهٔ روی بار اول وارد می‌شود. خانهٔ دو مهرهٔ حریف بسته است. اولین نفر با خروج ۱۵ مهره کل پات را می‌برد؛ بدون داو و ضریب مارس در این میز دوستانه.'],snakes:['مار و پله',2,4,'صفحهٔ ۱۰۰خانه با مسیر رفت‌وبرگشتی. هر بازیکن در نوبت خودش یک تاس ۱ تا ۶ می‌اندازد. فرود در پایین نردبان شما را بالا و روی سر مار شما را تا دم پایین می‌برد. عبور از مار یا نردبان اثری ندارد. رسیدن به ۱۰۰ با عدد دقیق؛ عدد بیشتر حرکت نمی‌دهد. شش تاس اضافه ندارد. اولین نفر برندهٔ کل پات است.'],sevens:['۷ خبیث',2,8,'نسخهٔ اعلام‌شدهٔ این میز: ۷ کارت برای هر نفر؛ بیش از پنج بازیکن دو دسته. هم‌خال یا هم‌عدد بازی کن. سرباز تغییر خال آزاد است و نمی‌تواند آخرین کارت باشد. ۷ نفر بعد را دو کارت جریمه می‌کند و ۷ها جمع می‌شوند. ۸ نوبت اضافه، ۱۰ تغییر جهت و آس پرش نفر بعد است. اگر کارت نریزی، یک کارت بردار و نوبت را بده. اعلام تک‌کارت خودکار است. اولین نفر بدون کارت کل پات را می‌برد.'],mill:['۳ به ۳ قطار',2,2,'دوز سه‌مهره‌ای: هر نفر به نوبت سه مهره می‌گذارد. سپس یک مهره را در امتداد خط به خانهٔ خالی متصل حرکت می‌دهد. ردیف سه‌تایی افقی، عمودی یا قطری برد است. سه بار تکرار وضعیت یا ۱۰۰ حرکت مساوی و برگشت ورودی‌ها است.'],bingo:['دبرنا',2,8,'دبرنای ۹۰عددی: کارت هر نفر ۳ ردیف و ۹ ستون دارد؛ هر ردیف ۵ عدد و چهار جای خالی. گردونه عددهای ۱ تا ۹۰ را بدون تکرار بیرون می‌آورد. علامت‌گذاری خودکار و سروری است. یک خط ۲۰٪، دو خط ۳۰٪ و کارت کامل ۵۰٪ پات؛ برندگان همزمان سهم جایزه را تقسیم می‌کنند. سکهٔ باقی‌ماندهٔ تقسیم صحیح به ترتیب صندلی داده می‌شود.'],truth:['جرأت و حقیقت',2,8,'بدون ورودی و بدون جریمهٔ مالی. تاس: عددهای جرأت را قبل از ساخت میز مشخص کن، باقی حقیقت‌اند. نفر بعد از تاس‌انداز سؤال می‌پرسد. بطری: سر بطری پاسخ‌دهنده و دم آن پرسشگر است؛ در تعداد فرد، نزدیک‌ترین جایگاه مقابل انتخاب می‌شود. پرسشگر سؤال تصادفی مودبانه یا متن خودش را می‌فرستد؛ پاسخ‌دهنده در چت جواب می‌دهد یا بدون جریمه رد می‌کند.'],slot:['رول دوستانه',2,8,'مسابقهٔ دوستانهٔ یک دور: هر نفر خودش سه نماد تصادفی می‌چرخاند. سه نماد یکسان بالاتر از جفت و جفت بالاتر از نمادهای متفاوت است. امتیاز برابر پات را تقسیم می‌کند. این میز پرداخت ماشین تک‌نفره ندارد؛ جایزه فقط مجموع ورودی واقعی دوستان است.']};
if(!games[kind]){location.replace('../../index.html?home=1');return;}const [title,min,max,rules]=games[kind];$('game-title').textContent=title;document.title=title+' | سیماب';$('rules').textContent=rules;$('hero').dataset.cover=kind;if(['hokm','ludo','blackjack'].includes(kind))$('hero').style.backgroundImage=`linear-gradient(0deg,#160d28e6,#160d2866),url('../../assets/v15/${kind}-cover.webp')`;$('hero').style.backgroundSize='cover';for(let i=min;i<=max;i++){const o=document.createElement('option');o.value=i;o.textContent=fmt(i)+' نفر';$('seats').append(o);}$('seats').value=String(['hokm','ludo'].includes(kind)?4:2);$('seats').onchange=updateRules;const social=kind==='truth';$('sevens-settings').hidden=kind!=='sevens';if(social){$('amount').value=0;$('amount').disabled=true;$('truth-settings').hidden=false;}$('stake-note').textContent=social?'جرأت و حقیقت رایگان است و جریمهٔ اجباری ندارد.':'۰ تا ۱۰۰۰ ژتون؛ مبلغ صفر برای تمرین رایگان. جایزه فقط از ورودی حاضران تأمین می‌شود.';for(let i=1;i<=6;i++){const l=document.createElement('label'),c=document.createElement('input');c.type='checkbox';c.value=i;c.checked=i%2===1;l.append(c,document.createTextNode(fmt(i)));$('dare-numbers').append(l);}
function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}function button(text,fn,disabled=false,cls=''){const b=node('button',cls,text);if(window.SimabI18n?.bindSource)window.SimabI18n.bindSource(b,text);b.disabled=disabled||busy||!!SimabWallet.pending;b.onclick=fn;return b;}function card(c,fn,legal=true){c=c<0?-1:c%52;const b=node(fn?'button':'div','playcard'+(c<0?' back':[1,2].includes(Math.floor(c/13))?' red':'')+(fn&&legal?' legal':''),c<0?'♠':({11:'J',12:'Q',13:'K',14:'A'}[c%13+2]||c%13+2)+suits[Math.floor(c/13)]);if(fn){b.disabled=!legal||busy||!!SimabWallet.pending;b.onclick=fn;}return b;}
const me=()=>latest?.room?.viewer||0,name=i=>practice?uiText(i?'game.bot':'game.you',i?'BOT '+i:'شما',{number:fmt(i)}):latest.room.members[i]?.name||'بازیکن',active=()=>latest?.room?.status==='playing',mine=()=>active()&&latest.state.current===me();
let soundEpoch=0,landedReceipt='';
function error(e){if(e.code==='sevens_upgrade_required')e.message=uiText('error.sevensUpgrade','برای قانون دوکارتی، سرور و برنامه باید به‌روز باشند؛ میز قدیمی را با قانون خودش ادامه بده.');$('entry-status').textContent=e.message||String(e);$('status').textContent=e.message||String(e);$('room-status').textContent=e.message||String(e);if(['active_room_exists','wrong_room_type'].includes(e.code))load().then(()=>{$('existing-room').scrollIntoView({behavior:'smooth',block:'center'});}).catch(()=>{});else if(e.code==='stale_game')load().catch(()=>{});}
function accept(r){
 if(!r||!Object.hasOwn(r,'room'))return;
 if(r.room&&r.room.game!==kind){showExisting(r.room);return;}
 if(latest?.room?.code===r.room?.code&&Number.isInteger(r.version)&&r.version<latest.version)return;
 if(latest?.room?.code!==r.room?.code){lastEvent=0;selected=-1;lastBoardRoll=null;}
 latest=r;$('mode-choice').hidden=!!r.room;$('hero').hidden=!!r.room;$('rules-panel').hidden=!!r.room;$('balances').hidden=false;$('existing-room').hidden=true;document.body.classList.toggle('at-table',!!r.room);
 if(r.room){
  $('room').dataset.status=r.room.status;code=r.room.code;offset=(r.serverNow||Date.now())-Date.now();$('code').textContent=code;$('room').hidden=false;$('lobby').hidden=true;
   $('pot').textContent=uiText('game.pot','ورودی هر نفر '+fmt(r.room.buyIn)+' • پات '+fmt(r.room.buyIn*r.room.members.length)+' ژتون',{entry:fmt(r.room.buyIn),pot:fmt(r.room.buyIn*r.room.members.length)});
   if(kind==='sevens')$('pot').append(document.createTextNode(' • '+sevensRuleLabel(r.state||r.room.sevensRules)));
  $('start').hidden=!r.room.host||r.room.status!=='waiting';$('start').disabled=busy||!canStartRoom(r.room);$('leave').disabled=busy;$('leave').textContent=['waiting','playing'].includes(r.room.status)?'خروج از میز':'بازگشت به تنظیمات';
  $('roster').replaceChildren();r.room.members.forEach((m,i)=>{
   const p=node('div','player'+(i===me()?' self':'')+(r.state?.current===i?' current':'')),label=node('span','seat-name',name(i));label.dataset.userContent='true';
   p.append(avatar(i),label);if(i===me())p.append(node('small','',uiText('game.you','شما')));$('roster').append(p);
  });
  $('turn-status').dataset.userContent='true';
  const result=r.state?.finished?(window.SimabI18n?.t?.(r.state.result)||r.state.result):'';
  $('turn-status').textContent=r.room.status==='waiting'?uiText('game.waitingPlayers','منتظر دوستان؛ تعداد انتخاب‌شده '+fmt(requiredPlayers(r.room))+' نفر',{number:fmt(requiredPlayers(r.room))}):r.room.status==='cancelled'?uiText('game.cancelled','میز لغو شد؛ ورودی‌ها برگشت'):r.state?.finished?(r.state.winners?.length?uiText('game.finishedWinners',result+' • برنده: '+r.state.winners.map(name).join('، '),{result,names:r.state.winners.map(name).join('، ')}):result):uiText('game.turn','نوبت '+name(r.state.current),{name:name(r.state.current)});
  if(r.state&&r.state.event!==lastEvent){
   if(lastEvent||['hokm','sevens','blackjack'].includes(kind))SimabSound.play(r.state.finished?resultSound(r.state):r.state.lastEvent,(practice?'practice-'+soundEpoch:r.room.code)+':'+r.state.event);
   lastEvent=r.state.event;render();
  }else if(!r.state){$('arena').replaceChildren(node('p','','کد دعوت را برای دوستان بفرست. فقط پس از رسیدن تعداد لازم، میز شروع می‌شود.'));$('hand').replaceChildren();$('controls').replaceChildren();}
  if(!practice){$('start').textContent='شروع با دوستان حاضر';SimabRoomMedia.update(r);}
  const log=$('chat-log'),atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<50;log.replaceChildren();
  for(const m of [...(r.room.messages||[])].reverse()){const b=node('div','chat-message');b.append(node('small','',m.display_name+' • '+({question:'پرسش',answer:'پاسخ',chat:'پیام'}[m.kind]||'')),node('span','',m.body));log.append(b);}if(atBottom)log.scrollTop=log.scrollHeight;
 }else{$('room').hidden=true;code='';lastEvent=0;loadGeneration++;$('lobby').hidden=false;SimabRoomMedia.stop();}
 syncButtons();clock();
}
function requiredPlayers(room){return Number(room?.maxPlayers||$('seats').value);}
function canStartRoom(room){return !!room&&room.host&&room.status==='waiting'&&room.members.length===requiredPlayers(room);}
function resultSound(s){const winners=s.winners||[];return !winners.length||winners.length===s.n?'draw':winners.includes(me())?'win':'fold';}
function showExisting(room){
 const box=$('existing-room');$('entry-status').textContent='برای ساخت میز جدید، ابتدا میز قبلی را ادامه بده یا ببند.';box.hidden=false;box.replaceChildren(node('p','','یک میز باز داری: '+(games[room.game]?.[0]||'پوکر')+'؛ رفتن به آن با انتخاب خودت انجام می‌شود.'));
 const link=node('a','primary','ادامهٔ میز قبلی');link.href=room.game?'?game='+encodeURIComponent(room.game)+'&code='+encodeURIComponent(room.code):'../poker/friends.html?code='+encodeURIComponent(room.code);box.append(link,button('خروج یا لغو میز قبلی',()=>closeExisting(room)));box.append(button('بستن میز قبلی و ساخت میز '+title,()=>closeExisting(room,true)));box.setAttribute('role','alert');
}
async function showWrongInvite(requested){try{const r=await SimabWallet.read('game_room',{op:'preview',code:requested});showExisting({game:r.preview.game,code:r.preview.code});}catch(e){if(e.code!=='wrong_room_type')throw e;const r=await SimabWallet.read('room',{op:'preview',code:requested});showExisting({code:r.preview.code});}}
async function closeExisting(room,createAfter=false){if(busy)return;busy=true;let closed=false;try{const action=room.game?'game_room':'room',r=await SimabWallet.read(action,{op:'state',code:room.code});if(!r.room)return;if(!confirm(r.room.status==='waiting'?uiText('confirm.closeWaitingRoom','از میز قبلی خارج شوی؟ ورودی‌ها طبق قوانین همان میز برمی‌گردند.'):uiText('confirm.closePlayingRoom','بازی قبلی شروع شده؛ خروج ممکن است سهم ورودی را واگذار کند. ادامه؟')))return;await SimabWallet.mutate(action,{op:'leave',code:room.code,version:r.version});resetRoom();closed=true;$('entry-status').textContent=uiText('game.previousRoomClosed','میز قبلی بسته شد؛ اکنون می‌توانی میز جدید بسازی.');}catch(e){error(e);}finally{busy=false;syncButtons();}if(closed&&createAfter)await createJoin('create');}
function syncButtons(){document.querySelectorAll('#existing-room button').forEach(b=>b.disabled=busy||!!SimabWallet.pending);$('start').disabled=busy||!!SimabWallet.pending||!canStartRoom(latest?.room);$('leave').disabled=busy||!!SimabWallet.pending;$('join').disabled=busy||!!SimabWallet.pending;$('create').disabled=$('practice-enter').disabled=busy||!!SimabWallet.pending;}
function resetRoom(){cancelLocalSpin();botGeneration++;lastBoardRoll=null;clearTimeout(rollTimer);rollTimer=null;document.body.classList.remove('local-table-mode');$('local-panel').hidden=true;loadGeneration++;practice=false;practiceWaiting=false;practicePaused=false;clearTimeout(practiceTimer);$('practice-pause').hidden=true;$('bot-status').textContent='';practiceState=null;latest=null;code='';lastEvent=0;bottleRound=-1;bottleAngle=0;selected=-1;history.replaceState(null,'','?game='+encodeURIComponent(kind));accept({room:null});$('copy').hidden=$('share').hidden=$('call-panel').hidden=$('chat-panel').hidden=false;}
function avatar(i){const m=latest.room.members[i],a=node('span','seat-media-avatar',m.emoji||'👤');a.dataset.mediaSubject=m.subject;a.dataset.userContent='true';a.setAttribute('aria-label',m.name);return a;}
const reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion:reduce)').matches;
const uiText=(key,fallback,values={})=>window.SimabI18n?.key?window.SimabI18n.key(key,values):fallback;
function bindUI(el,key,fallback,values={}){if(window.SimabI18n?.bind)SimabI18n.bind(el,key,values);else el.textContent=fallback;return el;}
function sevensRuleLabel(s){const key=s?.sevensRulesVersion===2?'sevens.twoOption':!s||s.twoTarget===undefined?'sevens.legacyRoom':s.twoTarget?s.twoGift?'sevens.legacyGift':'sevens.legacyDraw':'sevens.legacyPlain';return uiText(key,key);}
const sevensClient=()=>kind==='sevens'?{sevensProtocol:2}:{};
function soundButton(){const b=$('sound-toggle'),on=SimabSound.isEnabled();b.setAttribute('aria-pressed',String(on));bindUI(b,on?'sound.on':'sound.off',on?'🔊 صدا روشن':'🔇 صدا خاموش');}
soundButton();
function sevensDrawButton(s,move,disabled){
 const id=s.penalty?'sevens.drawPenalty':'cards.draw',values=s.penalty?{number:s.penalty}:{};
 const b=button(uiText(id,'کارت بردار'+(s.penalty?' ('+fmt(s.penalty)+')':''),values),()=>move({type:'draw'}),disabled);
 window.SimabI18n?.bind?.(b,id,values);return b;
}
function truthAnswerControls(s,move,disabled){
 const answer=node('textarea');answer.placeholder='پاسخ یا نتیجهٔ انجام جرأت';
 const submit=button(s.category==='dare'?uiText('truth.completeDare','انجام جرأت را تأیید کن'):'ارسال پاسخ',()=>{
  const text=answer.value.trim();if(!text&&s.category!=='dare'){error(Error(uiText('truth.answerRequired','پاسخ را وارد کن؛ دور هنوز تمام نشده است.')));answer.focus();return;}
  move({type:'answer',text:text||'انجام شد'});
 },disabled,'primary');return [answer,submit];
}
function renderSevens(s,a,h,c,move,disabled){
  const modern=s.sevensRulesVersion===2,transfer=modern||s.twoTarget&&s.twoGift,needed=Math.min(modern?2:transfer?1:0,s.hand.length-1);
  a.append(node('p','badge sevens-rule-contract',sevensRuleLabel(s)));
 const table=node('div','sevens-seats');for(let pos=1;pos<s.n;pos++){const i=(me()+pos)%s.n,p=node('div','table-seat'),angle=pos*2*Math.PI/s.n;p.style.left=50-Math.sin(angle)*41+'%';p.style.top=50+Math.cos(angle)*38+'%';const label=node('b','',name(i)+' • '+fmt(s.counts[i])+' کارت');label.dataset.userContent='true';p.append(avatar(i),label,card(-1));table.append(p);}
 a.append(table,bindUI(node('p','badge'),s.penalty?'sevens.suitPenalty':'sevens.suit','خال: '+suits[s.suit],{suit:suits[s.suit],direction:s.direction===1?'↻':'↺',number:s.penalty}),card(s.top));
 const target=node('select');target.setAttribute('aria-label','بازیکن هدف کارت ۲');target.disabled=disabled;
 latest.room.members.forEach((m,i)=>{if(i!==me()){const o=node('option','',m.name);o.dataset.userContent='true';o.value=i;target.append(o);}});target.value=(me()+s.direction+s.n)%s.n;
  const gift=node('select');gift.multiple=modern;gift.size=modern?Math.min(4,s.hand.length):1;gift.disabled=disabled;gift.setAttribute('aria-label',uiText('sevens.transferCards','کارت‌های انتقالی از دست شما'));
  if(!modern){const o=node('option','','—');o.value='';gift.append(o);}
 for(const v of s.hand){const o=node('option','',({11:'J',12:'Q',13:'K',14:'A'}[v%13+2]||v%13+2)+suits[Math.floor(v%52/13)]);o.value=v;gift.append(o);}
  if((modern||s.twoTarget)&&mine()&&s.hand.some(v=>v%13+2===2)){c.append(target);if(transfer)c.append(bindUI(node('label'),'sevens.transferCards','کارت‌های انتقالی از دست شما'),gift);}
 const choose=node('select');suits.forEach((v,i)=>{const o=node('option','',v);o.value=i;choose.append(o);});choose.setAttribute('aria-label','خال بعد از سرباز');choose.disabled=disabled;
 if(mine()&&s.hand.some(v=>v%13+2===11))c.append(node('label','','خال بعد از سرباز'),choose);
 for(const v of s.hand)h.append(card(v,()=>{
   const gifts=v%13+2===2&&transfer?[...(gift.selectedOptions||[])].filter(o=>o.value!=='').map(o=>Number(o.value)):[];
   if(v%13+2===2&&transfer&&(gifts.length!==needed||gifts.includes(v))){error(Error(uiText(modern?'error.twoTransfer':'error.oneTransfer',modern?'دو کارت دیگر را برای انتقال انتخاب کن؛ اگر کمتر داری، همهٔ کارت‌های باقی‌مانده را انتخاب کن.':'یک کارت دیگر از دستت انتخاب کن.')));gift.focus();return;}
   move({type:'play',card:v,suit:Number(choose.value),target:Number(target.value),...(modern?{gifts}:{gift:gifts[0]??null})});
 },!disabled&&s.legal.includes(v)&&!(v%13+2===11&&s.hand.length===1)));
 c.append(sevensDrawButton(s,move,disabled));if(s.hand.length===1)a.append(node('p','badge','تک کارت!'));
}
addEventListener('simab-language-ready',()=>{
 // Relabel presentation without restarting practice, rescheduling a bot, or
 // losing an unsubmitted question/answer and its current selection.
 const inputs=[...$('controls').querySelectorAll('textarea,select')],drafts=inputs.map(el=>({value:el.value,focused:el===document.activeElement,start:el.selectionStart,end:el.selectionEnd}));
  updateRules();
  chooseMode(setupMode);
 if(practice&&practiceState)paintPractice();else if(latest?.room)accept(latest);
 if(latest?.state)render();
  if(practice&&practiceState&&!practicePaused&&!practiceState.finished&&practiceState.current!==0)$('bot-status').textContent=uiText('bot.thinking','BOT '+practiceState.current+' در حال فکر کردن…',{number:fmt(practiceState.current)});
  if(practice)bindUI($('practice-pause'),practicePaused?'action.resume':'action.pause',practicePaused?'ادامهٔ تمرین':'توقف تمرین');
  soundButton();
 [...$('controls').querySelectorAll('textarea,select')].forEach((el,i)=>{const draft=drafts[i];if(!draft)return;el.value=draft.value;if(draft.focused){el.focus();if(typeof draft.start==='number')el.setSelectionRange(draft.start,draft.end);}});
});
let localSpinTimer=null,localEpoch=0,lastBoardRoll=null;
function cancelLocalSpin(){localEpoch++;clearTimeout(localSpinTimer);localSpinTimer=null;}
function promptList(category){return window.SimabI18n?.prompts?.[category]||(window.SimabI18n?.lang==='fa'?SimabTruthBank:SimabTruthBankEn)[category];}
async function load(){if(practice)return;const generation=loadGeneration,requested=code;
 try{const r=await SimabWallet.read('game_room',{op:'state',game:kind,code:requested,after:window.SimabRoomMedia?.after||0});if(practice||generation!==loadGeneration)return;if(r.activeRoom){showExisting(r.activeRoom);return;}if(!requested&&r.room){showExisting(r.room);return;}accept(r);}
 catch(e){if(generation!==loadGeneration||practice)return;
  if(requested&&e.code==='room_forbidden'){const r=await SimabWallet.read('game_room',{op:'preview',code:requested});if(generation!==loadGeneration)return;if(r.preview.game!==kind){$('status').textContent='این کد مربوط به '+(games[r.preview.game]?.[0]||'بازی دیگر')+' است.';showExisting({game:r.preview.game,code:requested});return;}$('join-code').value=requested;$('status').textContent=r.preview.status!=='waiting'||r.preview.count>=r.preview.maxPlayers?'میز پر است یا دعوت دیگر برای ورود باز نیست.':'دعوت '+title+' • ورودی '+fmt(r.preview.buyIn)+' ژتون؛ برای پیوستن ورود با کد را بزن.';}
  else if(e.code==='wrong_room_type')await showWrongInvite(requested);
   else if(e.code==='room_not_found'&&!latest?.room){code='';history.replaceState(null,'','?game='+encodeURIComponent(kind));$('status').textContent=uiText('error.inviteUnavailable','دعوت پیدا نشد یا دیگر در دسترس نیست؛ کد دیگری وارد کن.');}
  else throw e;
 }
}
async function act(op,move){$('room-status').textContent=$('entry-status').textContent=$('status').textContent='';SimabSound.unlock();if(practice){if(op==='leave'){stopPractice();return;}if(op==='move'&&!practiceWaiting&&!practicePaused&&practiceState.current===0&&!practiceState.finished){try{SimabPracticeRules.stepParty(practiceState,0,move);paintPractice();scheduleBot();}catch(e){error(e);}}return;}if(busy)return;busy=true;syncButtons();SimabSound.unlock();try{let r;for(let attempt=0;attempt<2;attempt++){try{r=await SimabWallet.mutate('game_room',{op,game:kind,code,version:latest?.version,...sevensClient(),...(move?{move}:{})});break;}catch(e){if(attempt===0&&e.code==='stale_game'&&['start','leave'].includes(op)){await load();continue;}throw e;}}if(op==='leave')resetRoom();else accept(r);}catch(e){error(e);}finally{busy=false;syncButtons();if(latest?.state)render();}}
async function createJoin(op){if(busy)return;loadGeneration++;busy=true;syncButtons();SimabSound.unlock();try{let extra;if(op==='create'){if(kind==='sevens'){const r=await SimabWallet.read('game_room',{op:'capabilities'});if(!r.capabilities?.sevensRulesVersions?.includes(2)){const e=Error('sevens_upgrade_required');e.code='sevens_upgrade_required';throw e;}}const amount=Number($('amount').value);extra={game:kind,amount,maxPlayers:Number($('seats').value),options:{twoGift:true,twoTarget:$('two-target').checked,...(kind==='sevens'?{sevensRulesVersion:2}:{}),mode:$('truth-mode').value,dareNumbers:[...document.querySelectorAll('#dare-numbers input:checked')].map(n=>Number(n.value))}};}else{const c=$('join-code').value.trim().toUpperCase(),r=await SimabWallet.read('game_room',{op:'preview',code:c});if(r.preview.game!==kind){showExisting({game:r.preview.game,code:c});throw Error('کد دعوت مربوط به این بازی نیست؛ بازی انتخاب‌شده تغییر نکرد.');}if(r.preview.status!=='waiting'||r.preview.count>=r.preview.maxPlayers)throw Error('میز پر است یا دعوت دیگر برای ورود باز نیست.');if(!confirm('ورود به '+(games[r.preview.game]?.[0]||'بازی')+' با '+r.preview.buyIn+' ژتون؟'+(kind==='sevens'?' • '+sevensRuleLabel(r.preview.sevensRules):'')))return;extra={game:kind,code:c,amount:r.preview.buyIn};}lastEvent=0;accept(await SimabWallet.mutate('game_room',{op,...extra,...sevensClient(),consent:true,emoji:window.SimabProfile?.get()||'👤'}));}catch(e){error(e);}finally{busy=false;syncButtons();if(latest?.state)render();}}
$('create').onclick=()=>createJoin('create');$('join').onclick=()=>createJoin('join');$('start').onclick=()=>{if(practice&&practiceWaiting)startPracticeGame();else act('start');};$('leave').onclick=()=>{if(latest?.room&&!['waiting','playing'].includes(latest.room.status)){resetRoom();return;}if(practice){stopPractice();return;}if(confirm(active()?'خروج پس از شروع، سهم ورودی تو را به دیگران واگذار می‌کند. ادامه؟':'خروج و برگشت ورودی؟'))act('leave');};$('recover').onclick=()=>SimabWallet.recover().then(accept).catch(error);$('copy').onclick=()=>navigator.clipboard?.writeText(code).then(()=>{$('status').textContent='کد کپی شد.';}).catch(()=>{$('status').textContent=code;});$('share').onclick=()=>{const url='https://t.me/share/url?url='+encodeURIComponent('https://t.me/SimorApp_bot?startapp=g_'+kind+'_'+code)+'&text='+encodeURIComponent(title+'؛ بیا با هم بازی کنیم');try{Telegram.WebApp.openTelegramLink(url);}catch{window.open(url,'_blank','noopener');}};$('sound-toggle').onclick=function(){SimabSound.toggle(this);};$('join-code').value=code;
$('chat-form').onsubmit=async e=>{e.preventDefault();const input=$('chat-text'),text=input.value.trim();if(!text||!latest?.room)return;try{const r=await SimabWallet.read('game_room',{op:'chat',code,text,messageId:SimabWallet.requestId()});input.value='';accept(r);}catch(e){error(e);}};
function clock(){const s=latest?.state;if(practice){$('clock').textContent=practiceWaiting?'':'بدون محدودیت زمان';return;}$('clock').textContent=s&&!s.finished&&s.deadline?fmt(Math.max(0,Math.ceil((s.deadline-Date.now()-offset)/1000)))+' ثانیه':'';}
function render(){const s=latest?.state;if(!s)return;const a=$('arena'),h=$('hand'),c=$('controls'),previousBottle=a.querySelector('.bottle-disc');a.replaceChildren();h.replaceChildren();c.replaceChildren();c.dataset.phase=s.kind==='hokm'?s.table.phase:'';a.className='game-arena '+s.kind;h.className='my-hand'+(['shuffle','deal'].includes(s.lastEvent)?' hand-deal':'');const move=m=>act('move',m),disabled=!mine()||s.finished||(practice&&practicePaused);
 if(s.kind==='hokm'){const t=s.table,n=s.n,status=node('div','badge',uiText('hokm.status','حاکم: '+name(t.hakem),{name:name(t.hakem),suit:t.trump<0?uiText('hokm.waiting','منتظر انتخاب حاکم'):suits[t.trump]}));status.dataset.userContent='true';a.append(status);
 const score=node('p','',n===4?uiText('hokm.score','امتیاز تیم شما',{number:fmt(t.scores[me()%2]),other:fmt(t.scores[1-me()%2])}):t.scores.map((v,i)=>name(i)+': '+fmt(v)).join(' • '));score.dataset.userContent='true';a.append(score);
 const phase=node('p','hokm-phase',t.phase==='trump'?uiText('hokm.fiveCards','پخش متوقف است؛ فقط پنج کارت حاکم داده شده. منتظر اعلام حکم '+name(t.hakem),{name:name(t.hakem)}):t.phase==='discard'?uiText('hokm.discard','کنارگذاشتن کارت، نه بازی روی زمین: '+name(s.current)+' باید '+fmt(t.discardsNeeded)+' کارت کنار بگذارد.',{name:name(s.current),number:fmt(t.discardsNeeded)}):t.phase==='draw'?uiText('hokm.draw','دونفره: '+name(s.current)+' کارت اول را نگه دارد یا کارت دوم را بگیرد.',{name:name(s.current)}):t.phase==='round_end'?uiText('hokm.roundEnd','این دور تمام شد؛ حاکم بعدی با دکمهٔ شروع دور بعد ادامه می‌دهد.'):uiText('hokm.tricks','دست‌های این دور: '+t.tricks.map(fmt).join(' / '),{number:t.tricks.map(fmt).join(' / ')}));phase.dataset.userContent='true';a.append(phase);
 const table=node('div',n===4?'table-four':'hokm-variable seats-'+n);for(let pos=0;pos<n;pos++){const i=(me()+pos)%n,seat=node('div','table-seat seat-'+pos+(i===s.current&&!s.finished?' current':''));seat.append(avatar(i),node('b','',name(i)+(i===t.hakem?' 👑':'')));const backs=node('div','backs');for(let j=0;j<Math.min(t.counts[i],5);j++)backs.append(node('span','card-back'));seat.append(backs,node('span','',fmt(t.counts[i])+' کارت'));table.append(seat);}const trick=node('div','trick-center');for(const play of t.trick.length?t.trick:t.lastTrick){const box=node('div');box.append(node('small','',name(play.player)),card(play.card));trick.append(box);}if(t.phase==='discard'||t.phase==='draw'){const pile=node('div','discard-pile');pile.append(node('span','card-back'),node('small','',fmt(t.discardCount||0)+' کارت کنار گذاشته‌شده؛ رو به پایین'));table.append(pile);}table.append(trick);a.append(table);
 for(const v of [...t.hand].sort((x,y)=>x-y))h.append(card(v,()=>move(t.phase==='discard'?{type:'discard',card:v}:{type:'play',card:v}),!disabled&&(t.phase==='discard'||t.phase==='play'&&t.legal.includes(v))));
 if(t.phase==='trump')suits.forEach((v,i)=>c.append(button(v,()=>move({type:'trump',suit:i}),disabled)));
 if(t.phase==='draw'&&mine()){a.append(card(t.drawOffer));c.append(button('کارت اول را نگه می‌دارم',()=>move({type:'draw_choice',keep:true}),disabled),button('کارت اول رد؛ کارت دوم را می‌گیرم',()=>move({type:'draw_choice',keep:false}),disabled));}
  if(t.phase==='round_end'){
   const next=node('section','hokm-round-action');next.setAttribute('role','status');next.setAttribute('aria-live','polite');
   next.append(bindUI(node('strong'),'hokm.roundComplete','دور حکم به پایان رسید'));
   next.append(bindUI(node('span'),'hokm.roundWinner','دست قبلی روی تخته فقط برای مرور نتیجه باقی است.'));
   if(mine())next.append(button(uiText('hokm.nextRound','شروع دور بعد'),()=>move({type:'next_round'}),disabled,'primary'));
   else next.append(bindUI(node('span','hokm-round-wait'),'hokm.waitingHakem','حاکم بعدی دور را شروع می‌کند؛ منتظر بمانید.'));
   a.append(next);
  }
 }
 else if(s.kind==='ludo'){a.append(ludo(s.table,move));const die=button(s.table.die?['','⚀','⚁','⚂','⚃','⚄','⚅'][s.table.die]:'🎲',()=>roll(move),disabled||!!s.table.die,'dice3d');a.append(die);const last=s.table.lastRoll;if(last){const history=node('p','badge dice-history',uiText('dice.last',name(last.player)+' • آخرین تاس: '+fmt(last.value),{name:name(last.player),number:fmt(last.value)}));history.dataset.userContent='true';a.append(history);}s.table.pieces[me()].forEach((v,i)=>c.append(button(uiText('board.pawn','مهره '+fmt(i+1),{number:fmt(i+1)})+(v<0?' · '+uiText('board.yard','حیاط'):v===57?' · '+uiText('board.home','خانه'):''),()=>move({type:'piece',index:i}),disabled||!s.table.legal.includes(i))));}
 else if(s.kind==='snakes'){a.append(snakeBoard(s));a.append(button(s.die?['','⚀','⚁','⚂','⚃','⚄','⚅'][s.die]:'🎲',()=>roll(move),disabled,'dice3d'));if(s.lastMove)a.append(node('p','',name(s.lastMove.player)+' از '+fmt(s.lastMove.from)+' به '+fmt(s.lastMove.to)));}
 else if(s.kind==='sevens')renderSevens(s,a,h,c,move,disabled);
  else if(s.kind==='mill'){
   const board=node('div','mill-board'),placing=s.placed[me()]<3;
   s.board.forEach((v,i)=>{
    const legal=v<0&&(placing||selected>=0&&SimabPracticeRules.adjacent(selected,i)),selectable=!placing&&v===me();
    const b=button('',()=>{if(placing)move({type:'place',to:i});else if(v===me()){selected=i;render();}else if(legal)move({type:'move',from:selected,to:i});},disabled||!legal&&!selectable,'mill-cell');
    b.classList.toggle('legal',!disabled&&legal);b.classList.toggle('selected',i===selected);
    b.dataset.userContent='true';b.setAttribute('aria-label',uiText('board.cell','خانه '+fmt(i+1),{number:fmt(i+1)})+' • '+(v<0?uiText('board.empty','خالی'):name(v)));
    if(v>=0)b.append(node('span','mill-piece'+(v===me()?'':' opponent')));
    board.append(b);
   });a.append(board,node('p','',placing?uiText('board.place','مهره را در خانهٔ خالی بگذار'):uiText('board.move','مهرهٔ خودت را انتخاب کن، سپس خانهٔ متصل خالی را بزن')));
  }
 else if(s.kind==='blackjack'){a.append(node('h3','','دیلر'));const row=node('div','my-hand');s.dealer.forEach(v=>row.append(card(v)));a.append(row);s.hands.forEach((list,i)=>{const box=node('section');box.append(node('b','',name(i)+(i===me()?' • شما':'')),node('div','my-hand'));list.forEach(v=>box.lastChild.append(card(v)));a.append(box);});c.append(button('کارت بگیر',()=>move({type:'hit'}),disabled),button('ایست',()=>move({type:'stand'}),disabled));}
 else if(s.kind==='backgammon'){const d=s.table.dice||[];if(s.lastEvent==='dice'&&d.length&&lastBoardRoll?.event!==s.event)lastBoardRoll={event:s.event,dice:[...d]};a.append(backgammon(s.table,move));a.append(node('p','badge',uiText('dice.remaining','تاس‌های باقی‌مانده: '+(d.map(fmt).join(' • ')||'منتظر تاس بازیکن'),{number:d.map(fmt).join(' • ')||uiText('dice.waiting','منتظر تاس بازیکن')})));if(lastBoardRoll)a.append(node('p','badge dice-history',uiText('dice.lastPair','آخرین تاس: '+lastBoardRoll.dice.map(fmt).join(' / '),{number:lastBoardRoll.dice.map(fmt).join(' / ')})));c.append(button(s.table.opening?'تاس شروع من':'تاس بریز',()=>roll(move),disabled||!s.table.opening&&d.length>0,'primary'));if(s.table.opening)a.append(node('p','','تاس شروع: '+s.table.opening.map(fmt).join(' / ')));}
 else if(s.kind==='bingo'){const drum=node('div','bingo-drum',s.called.length?fmt(s.called.at(-1)):'🎱');a.append(drum);const ticket=node('div','bingo-ticket');s.ticket.flat().forEach(v=>ticket.append(node('div',!v?'empty':s.called.includes(v)?'marked':'',v?fmt(v):'')));a.append(ticket,node('p','called','عددهای خوانده‌شده: '+s.called.map(fmt).join('، ')));c.append(button('چرخاندن گردونهٔ عددها',()=>roll(move),disabled,'primary'));s.awards.forEach((ws,i)=>a.append(node('p','',fmt(i+1)+' خط: '+(ws.length?ws.map(name).join('، '):'هنوز برنده ندارد'))));}
  else if(s.kind==='truth'){if(s.mode==='bottle')a.append(s.round===bottleRound&&previousBottle?previousBottle:bottle(s.n,s.angle||0,null,s.round));else a.append(node('div','dice3d',s.die?['','⚀','⚁','⚂','⚃','⚄','⚅'][s.die]:'🎲'));if(s.phase==='roll')c.append(button(s.mode==='bottle'?'بطری را بچرخان':'تاس من',()=>roll(move),disabled,'primary'));else{const who=node('p','badge',uiText('truth.asker',name(s.asker)+' می‌پرسد ← '+name(s.target)+' پاسخ می‌دهد',{asker:name(s.asker),target:name(s.target)}));who.dataset.userContent='true';a.append(who,questionCard(s.question,name(s.asker)));if(s.phase==='question'){const cat=node('select');for(const [v,label] of [['truth','حقیقت'],['dare','جرأت']]){const o=node('option','',label);o.value=v;cat.append(o);}cat.value=s.category==='dare'?'dare':'truth';cat.disabled=s.mode==='dice';const text=node('textarea');text.maxLength=500;text.placeholder='پرسش یا جرأت شخصی (با رضایت طرف مقابل)';c.append(cat,button('انتخاب تصادفی',()=>{const bank=promptList(cat.value);text.value=bank[secure(bank.length)];},disabled),text,button('ارسال پرسش',()=>move({type:'question',category:cat.value,text:text.value.trim()}),disabled,'primary'));}else c.append(...truthAnswerControls(s,move,disabled));}}
 else if(s.kind==='slot'){for(let i=0;i<s.n;i++){const row=node('p','',name(i)+' '+(s.reels[i]?.map(x=>['🍒','💎','⭐','🔔','🍋','۷'][x]).join(' ')||'منتظر چرخش'));if(s.reels[i]?.length)row.dataset.userContent='true';a.append(row);}c.append(button('بچرخان',()=>roll(move),disabled,'primary'));}
 if(!['hokm','sevens'].includes(s.kind)){
  const seats=node('div','arena-seats');seats.style.gridTemplateColumns='repeat('+Math.min(s.n||2,4)+',minmax(0,1fr))';
  s.n&&latest.room.members.forEach((m,i)=>{
   const current=i===s.current&&!s.finished,seat=node('div','table-seat'+(current?' current':'')),label=node('small','seat-name',name(i));label.dataset.userContent='true';seat.setAttribute('aria-current',String(current));
   const side=s.kind==='ludo'?(s.table.seatColors?.[i]??i):i;if(s.kind==='ludo')seat.classList.add(colors[side]);
   seat.append(avatar(i),label,node('small','seat-turn',current?uiText('game.yourTurn','نوبت بازی'):''));
   // The active badge belongs to the actual player; never call a bot "your" turn.
   if(current)seat.lastChild.textContent=uiText('game.active','نوبت بازی');
   seats.append(seat);
  });a.prepend(seats);
 }
  if(!s.finished){$('turn-status').textContent=uiText('game.turn','نوبت '+name(s.current),{name:name(s.current)});$('turn-status').setAttribute('role','status');$('turn-status').dataset.userContent='true';}
   if(s.kind==='hokm'){
    a.dataset.phase=s.table.phase;
    if(s.table.phase==='round_end'){
     h.replaceChildren();bindUI(a.querySelector('.hokm-phase'),'hokm.roundEnd','این دور تمام شد؛ حاکم بعدی با دکمهٔ شروع دور بعد ادامه می‌دهد.');
      const next=a.querySelector('.hokm-round-action button');if(next)next.id='hokm-next-round';
    }else if(!s.table.trick.length&&s.table.lastTrick.length){const label=bindUI(node('small','last-trick-label'),'hokm.lastTrick','دست قبلی');a.querySelector('.trick-center')?.prepend(label);}
   a.querySelectorAll('.table-seat').forEach((seat,pos)=>{
 const i=(me()+pos)%s.n,partner=s.n===4&&i!==me()&&i%2===me()%2;
    seat.classList.toggle('teammate',partner);
    seat.append(node('small','seat-role',i===s.table.hakem?uiText('hokm.trumpPicker','حاکم'):partner?uiText('hokm.teammate','هم‌تیمی'):''));
   });
  }
  SimabRoomMedia?.refreshAvatars?.();
  if(s.kind==='truth'&&previousBottle&&a.contains(previousBottle))previousBottle.querySelectorAll('.bottle-name').forEach((label,i)=>{label.textContent=fmt(i+1)+' · '+name(i);});
  decorateDice(s.kind==='ludo'?(s.table.die||s.table.lastRoll?.value):s.die);
 if(s.finished){c.replaceChildren();c.append(button('میز تازه و دعوت دوباره',()=>{resetRoom();}));}}
function dieFace(value){const valid=Number.isInteger(value)&&value>=1&&value<=6,patterns={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]},face=node('span','die-result');face.setAttribute('aria-hidden','true');face.dataset.unrolled=String(!valid);for(let i=0;i<9;i++)face.append(node(valid&&patterns[value].includes(i)?'i':'span'));return face;}
function decorateDice(value){const receipt=soundEpoch+':'+latest?.state?.event,landed=latest?.state?.lastEvent==='dice'&&landedReceipt!==receipt;document.querySelectorAll('.dice3d').forEach(b=>{b.replaceChildren();const valid=Number.isInteger(value)&&value>=1&&value<=6;b.setAttribute('aria-label',valid?uiText('dice.result','نتیجهٔ تاس: '+fmt(value),{number:fmt(value)}):uiText('dice.unknown','هنوز تاس نریخته'));b.dataset.value=valid?value:'';b.classList.toggle('landed',!!valid&&landed);b.append(dieFace(value),node('span','die-number',valid?uiText('dice.number','تاس '+fmt(value),{number:fmt(value)}):uiText('dice.roll','تاس بریز')));});if(landed)landedReceipt=receipt;}
function questionCard(question,asker){const q=node('div','q-card',question||'منتظر پرسش '+asker);if(question)q.dataset.userContent='true';return q;}
function roll(move){
 if(rollTimer||busy||!mine())return;
 const room=latest?.room,state=practiceState,event=latest?.state?.event,generation=loadGeneration;
 SimabSound.unlock();document.querySelectorAll('.dice3d,.bingo-drum').forEach(n=>n.classList.add(n.classList.contains('bingo-drum')?'spinning':'rolling'));
 rollTimer=setTimeout(()=>{
  rollTimer=null;
  document.querySelectorAll('.rolling,.spinning').forEach(n=>n.classList.remove('rolling','spinning'));
  if(generation===loadGeneration&&event===latest?.state?.event&&latest?.room?.code===room?.code&&(!practice||practiceState===state)&&mine())move({type:'roll'});
 },reducedMotion()?0:300);
}
function secure(n){const a=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%n;}
function ludo(t,move){const n=node('div','ludo-grid'),cells=[];for(let r=0;r<15;r++)for(let c=0;c<15;c++){const x=node('div','ludo-cell');if((r<6||r>8)&&(c<6||c>8))x.classList.add('yard',r<6?c<6?'green':'red':c<6?'yellow':'blue');cells.push(x);n.append(x);}for(const color of colors.slice(0,4))n.append(node('div','ludo-home '+color));n.append(node('div','ludo-center'));const path=[[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]];path.forEach(([r,c],i)=>{cells[r*15+c].classList.add('track');if([0,8,13,21,26,34,39,47].includes(i))cells[r*15+c].classList.add('safe');});t.pieces.forEach((pieces,player)=>{const side=t.seatColors?.[player]??player;const home=Array.from({length:6},(_,i)=>side===0?[7,i+1]:side===1?[i+1,7]:side===2?[7,13-i]:[13-i,7]);home.forEach(([r,c])=>cells[r*15+c].classList.add('lane',colors[side]));pieces.forEach((p,i)=>{const yard=side===0?[2+Math.floor(i/2)*2,2+i%2*2]:side===1?[2+Math.floor(i/2)*2,10+i%2*2]:side===2?[10+Math.floor(i/2)*2,10+i%2*2]:[10+Math.floor(i/2)*2,2+i%2*2];const [r,c]=p<0?yard:p===57?[7,7]:p>=51?home[p-51]:path[(side*13+p)%52],b=button('',()=>move({type:'piece',index:i}),player!==me()||!mine()||!t.legal.includes(i),'pawn '+colors[side]+(player===me()?' self':''));b.textContent=fmt(i+1);b.classList.toggle('playable',!b.disabled);b.title=name(player)+' • مهره '+fmt(i+1);b.setAttribute('aria-label',b.title);cells[r*15+c].append(b);});});n.querySelectorAll('.ludo-cell').forEach(cell=>{const count=cell.querySelectorAll('.pawn').length;if(count>1){cell.classList.add('stacked');cell.style.setProperty('--stack-cols',Math.ceil(Math.sqrt(count)));}});return n;}
function snakeBoard(s){const legend=node('div','snake-legend');s.positions.forEach((p,i)=>{const item=node('span','snake-player '+colors[i],fmt(i+1)+' • '+name(i)+' • '+(p===0?'بیرون صفحه':fmt(p)));legend.append(item);});const b=node('div','snakes-board');for(let y=9;y>=0;y--)for(let x=0;x<10;x++){const no=y*10+(y%2?10-x:x+1),cell=node('div','snakes-cell',fmt(no));s.positions.forEach((p,i)=>{if(p===no){const token=node('span','pawn '+colors[i]);token.style.right=3+(i%4)*8+'px';token.style.bottom=3+Math.floor(i/4)*8+'px';token.title=name(i)+' • '+fmt(i+1);token.textContent=fmt(i+1);cell.append(token);}});b.append(cell);}const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 100');svg.classList.add('snakes-art');const xy=n=>{const row=Math.floor((n-1)/10),col=(n-1)%10;return[row%2?95-col*10:5+col*10,95-row*10];};function line(x1,y1,x2,y2,color,w){const l=document.createElementNS(ns,'line');for(const[k,v]of Object.entries({x1,y1,x2,y2,stroke:color,'stroke-width':w,'stroke-linecap':'round'}))l.setAttribute(k,v);svg.append(l);}const ladders={4:14,9:31,20:38,28:84,40:59,51:67,63:81,71:91};for(const[from,to]of Object.entries(ladders)){const[x1,y1]=xy(+from),[x2,y2]=xy(to),len=Math.hypot(x2-x1,y2-y1),px=-(y2-y1)/len*1.4,py=(x2-x1)/len*1.4;line(x1+px,y1+py,x2+px,y2+py,'#eee3b4',.9);line(x1-px,y1-py,x2-px,y2-py,'#eee3b4',.9);for(let k=1;k<len/3;k++){const z=k*3/len;line(x1+(x2-x1)*z+px,y1+(y2-y1)*z+py,x1+(x2-x1)*z-px,y1+(y2-y1)*z-py,'#f5ebbf',.8);}}const snakes={17:7,54:34,62:19,64:60,87:24,93:73,95:75,99:78};let j=0;for(const[from,to]of Object.entries(snakes)){const[x1,y1]=xy(+from),[x2,y2]=xy(to),p=document.createElementNS(ns,'path'),d=`M ${x1} ${y1} C ${x1+12} ${y1+15}, ${x2-12} ${y2-12}, ${x2} ${y2}`,color=['#35b86b','#30b6df','#e7c545','#e45f64'][j++%4];p.setAttribute('d',d);p.setAttribute('fill','none');p.setAttribute('stroke',color);p.setAttribute('stroke-width','2.8');p.setAttribute('stroke-linecap','round');svg.append(p);const stripe=p.cloneNode();stripe.setAttribute('stroke','#203c44');stripe.setAttribute('stroke-width','2.9');stripe.setAttribute('stroke-dasharray','1 3');svg.append(stripe);const head=document.createElementNS(ns,'ellipse');for(const[k,v]of Object.entries({cx:x1,cy:y1,rx:2.3,ry:2.8,fill:color,stroke:'#263e40','stroke-width':.3}))head.setAttribute(k,v);svg.append(head);for(const dx of[-.8,.8]){const eye=document.createElementNS(ns,'circle');eye.setAttribute('cx',x1+dx);eye.setAttribute('cy',y1-.8);eye.setAttribute('r','.45');eye.setAttribute('fill','white');svg.append(eye);}}b.append(svg);const out=node('div');out.append(legend,b);return out;}
function backgammon(t,move){
 const board=node('div','bg-human bg-table-v20');
 if(t.moves.some(m=>m.from===-1))selected=-1;
 for(let row=0;row<2;row++)for(let col=0;col<12;col++){
  let point=row===0?12+col:11-col;if(me()===1)point=23-point;
  const count=t.points[point],own=me()===0?count>0:count<0,target=t.moves.find(m=>m.from===selected&&m.to===point);
  const b=button('',()=>{if(target)move({type:'move',from:target.from,die:target.die});else{selected=point;render();}},!mine()||!target&&(!own||!t.moves.some(m=>m.from===point)),'bg-point '+(row===0?'upper':'lower')+(col%2?' dark':' light'));
  b.classList.toggle('legal',!!target&&mine());b.classList.toggle('selected',selected===point);b.setAttribute('aria-pressed',String(selected===point));
  b.style.gridRow=row+1;b.style.gridColumn=col+1+(col>=6?1:0);b.setAttribute('aria-label',uiText('board.cell','خانه '+fmt(point+1),{number:fmt(point+1)}));b.append(node('small','point-number',fmt(point+1)));
  for(let k=0;k<Math.min(Math.abs(count),5);k++)b.append(node('span','bg-checker '+(count>0?'ivory':'ebony')));
  if(Math.abs(count)>5)b.append(node('b','',fmt(Math.abs(count))));board.append(b);
 }
 const bar=button('',()=>{selected=-1;render();},!mine()||!t.moves.some(m=>m.from===-1),'bg-bar');bar.setAttribute('aria-label','بار وسط تخته');bar.append(node('small','','بار'));
 for(let side=0;side<2;side++){const group=node('div');for(let i=0;i<Math.min(t.bar[side],6);i++)group.append(node('span','bg-checker '+(side===0?'ivory':'ebony')));group.append(node('small','',fmt(t.bar[side])));bar.append(group);}board.append(bar);
 const out=node('div'),dice=node('div','bg-dice');
 for(const value of t.opening||t.dice||[]){const face=node('span','bg-die');face.dataset.value=value||'';face.setAttribute('aria-label',value?uiText('dice.result','نتیجهٔ تاس: '+fmt(value),{number:fmt(value)}):uiText('dice.unknown','هنوز تاس نریخته'));face.append(dieFace(value),node('span','die-number',value?fmt(value):'—'));dice.append(face);}
 out.append(dice,board,node('p','badge','بار: '+t.bar.map(fmt).join(' / ')+' • خارج‌شده: '+t.off.map(fmt).join(' / ')));
  const actions=node('div','controls');for(const m of t.moves.filter(m=>m.from===selected)){
   const values={source:m.from<0?uiText('board.bar','ورود از بار'):fmt(m.from+1),destination:m.to<0?uiText('board.off','خروج'):fmt(m.to+1),number:fmt(m.die)};
   const b=button(uiText('backgammon.moveAction',values.source+' ← '+values.destination+' • تاس '+values.number,values),()=>move({type:'move',from:m.from,die:m.die}),!mine());
   window.SimabI18n?.bind?.(b,'backgammon.moveAction',values);actions.append(b);
  }out.append(actions);return out;
}
function bottle(n,angle,names,round){
 const d=node('div','bottle-disc'),b=node('div','bottle'),spin=round>0&&round!==bottleRound,old=bottleAngle;
 const target=spin?old+(reducedMotion()?0:1080)+(angle-old%360+360)%360:old;
 d.dataset.players=n>10?'dense':String(n);d.dataset.targetAngle=String(angle);b.setAttribute('aria-hidden','true');
 b.style.transform='rotate('+(reducedMotion()?target:old)+'deg)';d.append(b);
 if(spin){bottleRound=round;bottleAngle=target;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(b.isConnected)b.style.transform='rotate('+target+'deg)';}));}
 for(let i=0;i<n;i++){const t=(i*360/n)*Math.PI/180,radius=n>10?(i%2?29:43):n>7?40:38,nameTag=node('span','bottle-name',fmt(i+1)+' · '+(names?.[i]||name(i)));nameTag.dataset.userContent='true';nameTag.title=names?.[i]||name(i);nameTag.style.left=50+Math.sin(t)*radius+'%';nameTag.style.top=50-Math.cos(t)*radius+'%';d.append(nameTag);}return d;
}
$('local-bottle').onclick=()=>{
 if(latest?.room){error(Error('ابتدا از میز فعلی خارج شو.'));return;}
 cancelLocalSpin();loadGeneration++;code='';document.body.classList.add('local-table-mode');const p=$('local-panel');p.hidden=false;p.replaceChildren(node('h2','','بطری حضوری با یک گوشی'));
 const close=button('بازگشت به تنظیمات',()=>{cancelLocalSpin();resetRoom();});close.id='local-close';
 const names=node('textarea');names.placeholder='نام هر نفر در یک خط؛ ۲ تا ۲۰ نفر';names.rows=2;
 const countLabel=bindUI(node('label'),'truth.participants','تعداد شرکت‌کنندگان'),count=node('input');count.id='local-count';count.type='number';count.min=2;count.max=20;count.value='2';
 const nameGrid=node('div','local-name-grid');nameGrid.id='local-name-grid';let drafts=[];
 function rebuild(){for(const [i,input]of [...nameGrid.querySelectorAll('input')].entries())drafts[i]=input.value;const n=Math.max(2,Math.min(20,Number(count.value)||2));count.value=n;if(nameGrid.querySelectorAll('input').length===n){validate();return;}nameGrid.replaceChildren();for(let i=0;i<n;i++){const l=node('label'),input=node('input');input.maxLength=60;input.value=drafts[i]||'';input.id='local-name-'+i;l.append(bindUI(node('span'),'truth.participant','شرکت‌کننده '+(i+1),{number:i+1}),input);input.oninput=()=>{drafts[i]=input.value;names.value=[...nameGrid.querySelectorAll('input')].map(x=>x.value).join('\n');validate();};nameGrid.append(l);}names.value=Array.from({length:n},(_,i)=>drafts[i]||'').join('\n');validate();}
 const countRow=node('div','local-count-row');countRow.append(countLabel,button('−',()=>{count.value=Math.max(2,Number(count.value)-1);rebuild();}),count,button('+',()=>{count.value=Math.min(20,Number(count.value)+1);rebuild();}));count.onchange=rebuild;
 const out=node('div'),cat=node('select');for(const[v,t]of[['truth','حقیقت'],['dare','جرأت']]){const o=node('option','',t);o.value=v;cat.append(o);}
 const q=bindUI(node('div','q-card'),'truth.polite','پرسش آماده را انتخاب کن یا پاسخ بده؛ دکمهٔ رد آزاد وجود ندارد.'),who=node('p','badge');let localNames=[],angle=0,promptIndex=null,promptCategory='truth';
 const validNames=()=>{const values=[...nameGrid.querySelectorAll('input')].map(x=>x.value.trim());return values.length===Number(count.value)&&values.every(Boolean)&&new Set(values.map(x=>x.normalize('NFC').toLocaleLowerCase())).size===values.length;};
 function validate(){if(typeof prepare==='undefined')return;prepare.disabled=!validNames();if(prepare.disabled)bindUI(hint,'truth.namesRequired','برای هر شرکت‌کننده نام متفاوت وارد کن.');}
 const hint=node('p','muted','ابتدا نام حداقل دو نفر را وارد کن.'),prepare=button('آماده‌سازی جمع',()=>{
  if(!validNames()){bindUI(hint,'truth.namesRequired','برای هر شرکت‌کننده نام متفاوت وارد کن.');return;}
  localNames=[...nameGrid.querySelectorAll('input')].map(x=>x.value.trim());out.replaceChildren(bottle(localNames.length,0,localNames));names.hidden=nameGrid.hidden=countRow.hidden=true;prepare.hidden=true;spin.disabled=false;edit.hidden=false;bindUI(hint,'truth.ready',fmt(localNames.length)+' بازیکن آماده‌اند.',{number:localNames.length});
 },true),edit=button(uiText('truth.edit','ویرایش بازیکنان'),()=>{cancelLocalSpin();names.hidden=nameGrid.hidden=countRow.hidden=false;prepare.hidden=false;spin.disabled=true;edit.hidden=true;localNames=[];out.replaceChildren();});
 prepare.id='local-prepare';edit.id='local-edit';edit.hidden=true;names.oninput=()=>{drafts=names.value.split(/\n|،|,/).map(v=>v.trim()).slice(0,20);count.value=Math.max(2,drafts.length);nameGrid.replaceChildren();rebuild();};
 const spin=button('بطری را بچرخان',()=>{
  if(localNames.length<2||localSpinTimer)return;SimabSound.unlock();
  const target=secure(localNames.length),asker=(target+Math.floor(localNames.length/2))%localNames.length,epoch=++localEpoch;
  angle+=(reducedMotion()?0:1080)+(target*360/localNames.length-angle%360+360)%360;
  out.querySelector('.bottle').style.transform='rotate('+angle+'deg)';spin.disabled=edit.disabled=true;out.querySelectorAll('.bottle-name').forEach(x=>x.classList.remove('selected'));
  const settle=()=>{localSpinTimer=null;if(epoch!==localEpoch||!q.isConnected)return;bindUI(who,'truth.asker',localNames[asker]+' از '+localNames[target]+' می‌پرسد؛ سر بطری پاسخ‌دهنده است.',{asker:localNames[asker],target:localNames[target]});const disc=out.querySelector('.bottle-disc');disc.dataset.selected=target;disc.querySelectorAll('.bottle-name').forEach((x,i)=>{x.classList.toggle('selected',i===target);x.setAttribute('aria-current',String(i===target));});spin.disabled=edit.disabled=false;SimabSound.play('roll');};
  if(reducedMotion())settle();else localSpinTimer=setTimeout(settle,1950);
 },true);
 spin.id='local-spin';const random=button('پرسش تصادفی',()=>{promptCategory=cat.value;promptIndex=secure(promptCategory==='truth'?300:200);delete q.dataset.i18n;q.dataset.userContent='true';q.textContent=promptList(promptCategory)[promptIndex];});random.id='local-random';
 const relabel=()=>{if(!p.isConnected||p.hidden){removeEventListener('simab-language-ready',relabel);return;}if(promptIndex!==null)q.textContent=promptList(promptCategory)[promptIndex];};addEventListener('simab-language-ready',relabel);
 rebuild();p.append(close,countRow,nameGrid,bindUI(node('label'),'truth.bulkNames','چسباندن نام‌ها، هر نام یک خط (اختیاری)'),names,hint,prepare,edit,out,spin,who,cat,random,q,bindUI(node('p','muted'),'privacy.localBottle','نام‌ها و پرسش این حالت در حافظهٔ همین صفحه‌اند؛ با بارگذاری دوباره حذف می‌شوند. این مسیر آن‌ها را به سرور نمی‌فرستد و پاسخی ضبط نمی‌کند.'));p.scrollIntoView({behavior:'smooth'});
};
addEventListener('pagehide',()=>{cancelLocalSpin();clearTimeout(practiceTimer);botGeneration++;clearTimeout(rollTimer);rollTimer=null;loadGeneration++;});
addEventListener('pageshow',()=>{if(practice&&practiceState&&!practiceWaiting&&!practicePaused)scheduleBot();});


function paintPractice(){
 const n=practiceState.n;
  accept({serverNow:Date.now(),version:0,room:{game:kind,code:'PRACTICE',viewer:0,status:practiceState.finished?'finished':'playing',host:true,buyIn:0,members:Array.from({length:n},(_,i)=>({subject:'practice-'+i,name:uiText(i?'game.bot':'game.you',i?'BOT '+i:'You',{number:fmt(i)}),emoji:i?'🤖':window.SimabProfile?.get()||'👤'})),messages:[],signals:[]},state:SimabPracticeRules.publicParty(practiceState,0)});
  code='';$('code').textContent=uiText('game.practice','FREE PRACTICE');
 $('copy').hidden=$('share').hidden=$('call-panel').hidden=$('chat-panel').hidden=true;
  $('pot').textContent=uiText('game.practiceNote','Bot practice • No entry or rewards • Wallet unchanged');
 $('leave').disabled=false;
}
function stopPractice(){resetRoom();}
function practiceRoom(state){const n=Number($('seats').value);return{serverNow:Date.now(),version:0,room:{game:kind,code:'PRACTICE',viewer:0,status:state?'playing':'waiting',host:true,buyIn:0,maxPlayers:n,members:Array.from({length:n},(_,i)=>({subject:'practice-'+i,name:i?'BOT '+i:'شما',emoji:i?'🤖':window.SimabProfile?.get()||'👤'})),messages:[],signals:[]},state};}
$('practice-enter').onclick=()=>{
 if(latest?.room&&['waiting','playing'].includes(latest.room.status)){error(Error('ابتدا از میز دوستانه خارج شو.'));return;}
 loadGeneration++;SimabRoomMedia.stop();clearTimeout(practiceTimer);practice=true;practiceWaiting=true;practicePaused=false;practiceState=null;lastEvent=0;accept(practiceRoom(null));code='';$('code').textContent='میز تمرینی';$('start').textContent='شروع مسابقه با ربات‌ها';$('start').disabled=false;$('arena').textContent='بازیکنان آماده‌اند. تا دکمهٔ شروع مسابقه را نزنی، کارت و تاسی پخش نمی‌شود.';$('copy').hidden=$('share').hidden=$('call-panel').hidden=$('chat-panel').hidden=true;$('bot-status').textContent='میز آماده؛ منتظر شروع شما';
};
function startPracticeGame(){SimabSound.unlock();soundEpoch++;practiceWaiting=false;practiceState=SimabPracticeRules.startParty(kind,Number($('seats').value),0,{twoGift:true,twoTarget:$('two-target').checked,mode:$('truth-mode').value,dareNumbers:[...document.querySelectorAll('#dare-numbers input:checked')].map(c=>Number(c.value))});$('practice-pause').hidden=false;paintPractice();scheduleBot();}
let botGeneration=0;
function scheduleBot(){
 clearTimeout(practiceTimer);const ticket=++botGeneration,expected=practiceState;
 if(!practice||practiceWaiting||!practiceState||practiceState.finished||practicePaused){$('bot-status').textContent=practicePaused?'تمرین متوقف است':'';return;}
  if(practiceState.current===0){bindUI($('bot-status'),'practice.waitHuman','نوبت شما؛ ربات‌ها منتظر حرکت شما هستند.');return;}
 $('bot-status').textContent=uiText('bot.thinking','BOT '+practiceState.current+' در حال فکر کردن…',{number:fmt(practiceState.current)});
 const delay=SimabPracticeAI.actionDelay?.(practiceState,SimabPracticeRules)??SimabPracticeAI.delay(practiceState,SimabPracticeRules);
 practiceTimer=setTimeout(()=>{
  if(ticket!==botGeneration||expected!==practiceState||!practice||practicePaused)return;
  if(document.visibilityState==='hidden'){scheduleBot();return;}
  try{const move=SimabPracticeAI.choose(practiceState,SimabPracticeRules);SimabPracticeRules.stepParty(practiceState,practiceState.current,move);paintPractice();scheduleBot();}catch(e){error(e);}
 },delay);
}
$('practice-pause').onclick=()=>{practicePaused=!practicePaused;bindUI($('practice-pause'),practicePaused?'action.resume':'action.pause',practicePaused?'ادامهٔ تمرین':'توقف تمرین');scheduleBot();if(latest?.state)render();};

function updateRules(){const n=Number($('seats').value);let text=rules;
 if(kind==='hokm')text=n===2?'حکم دونفره، بدون تیم: حاکم با نخستین آس تعیین می‌شود. ابتدا پنج کارت حاکم؛ بعد از اعلام حکم، پنج کارت نفر دیگر. حاکم سه کارت و نفر دیگر دو کارت کنار می‌گذارند. سپس نوبتی از دستهٔ وسط کارت اول را می‌پذیرند یا رد می‌کنند و کارت دوم را اجباری می‌گیرند، تا هر نفر ۱۳ کارت داشته باشد. رعایت خال الزامی؛ هفت دست، برد دور. کت ۲ و حاکم‌کتی ۳ امتیاز؛ مسابقه تا ۷ امتیاز.':n===3?'حکم سه‌نفره، بدون تیم: یک کارت ۲ حذف می‌شود. پنج کارت حاکم پیش از اعلام حکم؛ سپس کارت‌های همه به صورت ۵-۴-۴-۴ تکمیل می‌شود (۱۷ کارت). رعایت خال الزامی. برد هفت دست اول: کت ۲ یا حاکم‌کتی ۳. در غیر این صورت وقتی نفرات دیگر دیگر نتوانند به تعداد دست برنده برسند، دور تمام می‌شود. اگر دو نفر در پایان تعداد دست برابر داشته باشند، نفر سوم برنده است. مسابقه تا ۷ امتیاز.':rules;
  if(kind==='sevens'){text=uiText('rules.sevensPhase4',rules);$('two-target').checked=true;$('two-target').disabled=true;}
  if(kind==='ludo')text=uiText('rules.ludoVariant',n+' نفر، چهار مهره برای هر نفر؛ رنگ‌ها جدا هستند. نسخهٔ ستاره‌دار سیماب: خروج از حیاط با ۶ به خانهٔ شروع؛ شش، زدن یا پایان مهره یک تاس اضافه می‌دهد. سومین شش نوبت را می‌سوزاند. خانهٔ ستاره‌دار امن است؛ خانهٔ پایان با عدد دقیق. این‌ها قواعد همین نسخه‌اند و با بعضی نسخه‌های منچ تفاوت دارند.',{number:fmt(n)});
  if(kind==='snakes')text=uiText('rules.snakesVariant','۲ تا ۴ نفر، پیش‌فرض ۲ نفر؛ هر نفر یک مهره با رنگ و شمارهٔ مجزا. شروع بیرون صفحه است. هر نوبت یک تاس؛ عدد ۶ نوبت اضافه ندارد. فقط فرود روی پای نردبان یا سر مار اثر دارد. رسیدن به ۱۰۰ با عدد دقیق؛ ردشدن از آن حرکت نمی‌دهد.');
 const sources={hokm:'https://www.pagat.com/whist/hokm.html',backgammon:'https://www.bkgm.com/rules.html',ludo:'https://www.mastersofgames.com/rules/ludo-rules-instructions-guide.htm',snakes:'https://instructions.hasbro.com/en-us/instruction/chutes-and-ladders-game-retro-series-1978-edition',sevens:'https://paamizi.ir/games/haft-khabis',mill:'https://www.nps.gov/morr/learn/kidsyouth/3-men-s-morris.htm',bingo:'https://support.betfair.com/app/answers/detail/241-bingo-what-are-the-different-game-types/',blackjack:'https://bicyclecards.com/how-to-play/blackjack',truth:'https://truthordaregame.net/how-to-play'};$('rules-source').href=sources[kind]||'#';$('rules-source').hidden=!sources[kind];$('rules').textContent=text;$('setup-rules').textContent=text;syncButtons();
}

$('two-target').onchange=updateRules;function truthMode(){const bottle=$('truth-mode').value==='bottle';$('dare-numbers').hidden=bottle;$('dare-help').textContent=bottle?'جایگاه‌ها دور بطری شماره دارند؛ سر بطری پاسخ‌دهنده و دم آن پرسشگر است. نوع پرسش بعد از چرخش انتخاب می‌شود.':'عددهای جرأت را تیک بزن؛ باقی عددها حقیقت‌اند.';} $('truth-mode').onchange=truthMode;truthMode();
let storeNoteSource;
function chooseMode(mode){setupMode=mode;$('lobby').dataset.mode=mode;$('practice-enter').hidden=mode!=='practice';$('friends-choice').setAttribute('aria-pressed',String(mode==='friends'));$('practice-start').setAttribute('aria-pressed',String(mode==='practice'));bindUI($('setup-title'),mode==='practice'?'setup.practiceSettings':'setup.friendsSettings',mode==='practice'?'تنظیمات تمرین با ربات':'تنظیمات میز دوستانه');const note=document.querySelector('.store-note');if(note){storeNoteSource??=note.textContent;if(mode==='practice')bindUI(note,'privacy.practice','تمرین در حافظهٔ این صفحه است؛ بارگذاری دوباره دور را پاک می‌کند.');else if(window.SimabI18n?.bindSource)SimabI18n.bindSource(note,storeNoteSource);else note.textContent=storeNoteSource;}}
$('practice-start').onclick=()=>chooseMode('practice');$('friends-choice').onclick=()=>chooseMode('friends');chooseMode('friends');updateRules();

SimabWallet.subscribe(()=>{$('wallet-retry').hidden=!!SimabWallet.state;$('wallet-state').textContent=SimabWallet.state?'موجودی سروری به‌روز است':'موجودی دریافت نشد؛ دوباره تلاش کن';$('recover').hidden=!SimabWallet.pending;syncButtons();});addEventListener('simab-receipt',e=>{if(!busy&&!practice&&e.detail.room){if(code&&e.detail.room.code===code&&e.detail.room.game===kind)accept(e.detail);else showExisting(e.detail.room);}});setInterval(clock,250);setInterval(()=>{if(!busy&&!polling&&code&&document.visibilityState==='visible'&&!SimabWallet.pending&&['waiting','playing'].includes(latest?.room?.status)){polling=true;load().catch(error).finally(()=>{polling=false;});}},1500);SimabWallet.ready.then(()=>{$('wallet-state').textContent=SimabWallet.state?'موجودی سروری به‌روز است':'موجودی دریافت نشد؛ دکمهٔ تلاش دوباره را بزن.';if(!practice)load().catch(error);});$('wallet-retry').onclick=()=>{SimabWallet.refresh().then(()=>{$('wallet-state').textContent='موجودی سروری به‌روز است';}).catch(e=>{$('wallet-state').textContent=e.message;});};addEventListener('pagehide',()=>SimabRoomMedia.stop());window.SimabBackHandler=()=>{if(document.body.classList.contains('local-table-mode')){resetRoom();return;}if(latest?.room){$('leave').click();return;}location.href='../../index.html?home=1';};})();
