/* Fit the actual Telegram viewport, including fullscreen chrome and older iOS. */
(()=>{'use strict';let stage=null,stableWidth=0,stableHeight=0,flipped=false;
 function fit(){if(!stage)return;if(!stableWidth||Math.abs(innerWidth-stableWidth)>100){stableWidth=innerWidth;stableHeight=innerHeight;}const tg=window.Telegram?.WebApp,w=stableWidth||innerWidth,h=Math.min(stableHeight||innerHeight,tg?.viewportStableHeight||Infinity),safe=tg?.safeAreaInset||{},content=tg?.contentSafeAreaInset||{};
 const top=Math.max(tg?.isFullscreen?64:0,(safe.top||0)+(content.top||0)),bottom=safe.bottom||0,left=safe.left||0,right=safe.right||0;
 const aw=Math.max(240,w-left-right),ah=Math.max(220,h-top-bottom),portrait=ah>aw;
 stage.style.setProperty('--simab-video-rotation',(portrait?(flipped?-90:90):flipped?-180:0)+'deg');stage.style.width=(portrait?ah:aw)+'px';stage.style.height=(portrait?aw:ah)+'px';stage.style.left=(left+aw/2)+'px';stage.style.top=(top+ah/2)+'px';stage.style.transform='translate(-50%,-50%)'+(portrait?' rotate('+(flipped?90:-90)+'deg)':flipped?' rotate(180deg)':'');stage.classList.toggle('compact',Math.min(aw,ah)<360);window.dispatchEvent(new Event('simab-room-fit'));
 }
 async function open(node){stage=node;flipped=false;if(!stage.querySelector('.room-rotate')){const b=document.createElement('button');b.className='room-rotate';b.type='button';b.textContent='↻ چرخش میز';b.setAttribute('aria-label','چرخش میز به جهت دیگر');b.onclick=()=>{flipped=!flipped;fit();};Object.assign(b.style,{position:'absolute',right:'14px',top:'14%',zIndex:'95',fontSize:'12px',padding:'5px 9px',minHeight:'32px'});stage.append(b);}stableWidth=innerWidth;stableHeight=innerHeight;fit();try{const tg=window.Telegram?.WebApp;tg?.expand();}catch{}try{await screen.orientation?.lock?.('landscape');}catch{}fit();}
 function close(){stage=null;stableWidth=stableHeight=0;try{screen.orientation?.unlock?.();}catch{}}
 addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);for(const name of ['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'])try{window.Telegram?.WebApp?.onEvent(name,()=>{if(stage){stableWidth=innerWidth;stableHeight=innerHeight;}fit();});}catch{}
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion: reduce)').matches?0:ms));
 window.SimabGameRoom={open,close,fit,delay};
})();
