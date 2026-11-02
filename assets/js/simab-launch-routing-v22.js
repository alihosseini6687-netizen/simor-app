/* Untrusted launch data selects a screen only. Joining still needs preview,
   confirmation, signed identity and an authoritative server transaction. */
(()=>{'use strict';
 if(window.simabLaunchRouted)return;
 const params=new URLSearchParams(location.search),tg=window.Telegram?.WebApp;
 const explicit=params.get('tgWebAppStartParam')||params.get('startapp')||params.get('start');
 const start=explicit||tg?.initDataUnsafe?.start_param||'';
 const stamp=start+':'+new URLSearchParams(tg?.initData||'').get('auth_date');
 const key='simab_routed_launch_v22';
 try{
  if(params.has('home')){sessionStorage.setItem(key,stamp);return;}
  if(!explicit&&sessionStorage.getItem(key)===stamp)return;
 }catch{}
 let path='';
 if(/^g_(hokm|blackjack|ludo|backgammon|sevens|truth|mill|bingo|snakes|slot)_[A-Z2-9]{10}$/.test(start)){
  const [,game,code]=start.split('_');path='games/room/index.html?game='+game+'&code='+code;
 }else if(/^p_[A-Z2-9]{10}$/.test(start))path='games/poker/friends.html?code='+start.slice(2);
 else if(/^o_[a-f0-9]{32}$/.test(start))path='offers/index.html?code='+start.slice(2);
 if(!path)return;
 window.simabLaunchRouted=true;
 try{sessionStorage.setItem(key,stamp);}catch{}
 location.replace(path);
})();
