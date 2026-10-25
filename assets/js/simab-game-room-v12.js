/* Fit the actual Telegram viewport, including fullscreen chrome and older iOS. */
(()=>{'use strict';let stage=null;
 function fit(){if(!stage)return;const tg=window.Telegram?.WebApp,w=innerWidth,h=Math.min(innerHeight,window.visualViewport?.height||innerHeight),safe=tg?.safeAreaInset||{},content=tg?.contentSafeAreaInset||{};
 const top=tg?.isFullscreen?Math.max(52,(safe.top||0)+(content.top||0)):0,bottom=safe.bottom||0,left=safe.left||0,right=safe.right||0;
 const aw=Math.max(240,w-left-right),ah=Math.max(220,h-top-bottom),portrait=ah>aw;
 stage.style.width=(portrait?ah:aw)+'px';stage.style.height=(portrait?aw:ah)+'px';stage.style.left=(left+aw/2)+'px';stage.style.top=(top+ah/2)+'px';stage.style.transform='translate(-50%,-50%)'+(portrait?' rotate(90deg)':'');stage.classList.toggle('compact',Math.min(aw,ah)<360);window.dispatchEvent(new Event('simab-room-fit'));
 }
 async function open(node){stage=node;fit();try{const tg=window.Telegram?.WebApp;tg?.expand();if(tg?.isVersionAtLeast?.('8.0')&&!tg.isFullscreen)tg.requestFullscreen();}catch{}try{await screen.orientation?.lock?.('landscape');}catch{}fit();}
 function close(){stage=null;try{screen.orientation?.unlock?.();}catch{}}
 addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);for(const name of ['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'])try{window.Telegram?.WebApp?.onEvent(name,fit);}catch{}
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion: reduce)').matches?0:ms));
 window.SimabGameRoom={open,close,fit,delay};
})();
