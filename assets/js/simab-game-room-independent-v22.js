/* Fit the actual Telegram viewport, including fullscreen chrome and older iOS. */
(()=>{'use strict';let stage=null,flipped=false;
 function fit(){if(!stage)return;const tg=window.Telegram?.WebApp,vv=window.visualViewport,safe=tg?.safeAreaInset||{},content=tg?.contentSafeAreaInset||{};
 // Re-read both dimensions on every fit, including small resizes and rotations
 // of near-square screens. Do not use pre-rotation cached dimensions.
 const visual=vv&&vv.scale===1,w=Math.min(innerWidth,visual&&vv.width>0?vv.width:Infinity),h=Math.min(innerHeight,visual&&vv.height>0?vv.height:Infinity,tg?.viewportHeight>0?tg.viewportHeight:tg?.viewportStableHeight>0?tg.viewportStableHeight:Infinity);
 const inset=edge=>Math.max(0,Number(safe[edge])||0)+Math.max(0,Number(content[edge])||0);
 const top=Math.max(tg?.isFullscreen?64:0,inset('top')),bottom=inset('bottom'),left=inset('left'),right=inset('right');
 const aw=Math.max(1,w-left-right),ah=Math.max(1,h-top-bottom),portrait=ah>aw;
 stage.style.setProperty('--simab-video-rotation',(portrait?(flipped?-90:90):flipped?-180:0)+'deg');stage.style.width=(portrait?ah:aw)+'px';stage.style.height=(portrait?aw:ah)+'px';stage.style.left=((visual?vv.offsetLeft||0:0)+left+aw/2)+'px';stage.style.top=((visual?vv.offsetTop||0:0)+top+ah/2)+'px';stage.style.transform='translate(-50%,-50%)'+(portrait?' rotate('+(flipped?90:-90)+'deg)':flipped?' rotate(180deg)':'');stage.classList.toggle('compact',Math.min(aw,ah)<360);window.dispatchEvent(new Event('simab-room-fit'));
 }
  async function open(node){stage=node;flipped=false;if(!stage.querySelector('.room-rotate')){const b=document.createElement('button');b.className='room-rotate';b.type='button';b.textContent='↻ چرخش میز';b.setAttribute('aria-label','چرخش میز به جهت دیگر');b.onclick=()=>{flipped=!flipped;fit();};Object.assign(b.style,{position:'absolute',right:'14px',top:'14%',zIndex:'95',fontSize:'12px',padding:'5px 9px',minHeight:'32px'});stage.append(b);}fit();try{const tg=window.Telegram?.WebApp;tg?.expand();}catch{}try{await screen.orientation?.lock?.('landscape');}catch{}fit();}
  function close(){stage=null;try{screen.orientation?.unlock?.();}catch{}}
  addEventListener('resize',fit);addEventListener('orientationchange',fit);window.visualViewport?.addEventListener('resize',fit);window.visualViewport?.addEventListener('scroll',fit);for(const name of ['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'])try{window.Telegram?.WebApp?.onEvent(name,fit);}catch{}
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion: reduce)').matches?0:ms));
 window.SimabGameRoom={open,close,fit,delay};
})();
