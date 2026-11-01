/* Local procedural Foley. No recordings, remote assets or gameplay authority. */
(function(root){'use strict';
 let enabled=true,pageActive=true,ctx,until=0;const active=new Set(),receipts=new Set();
 try{enabled=localStorage.getItem('simab_sound_enabled')!=='0';}catch{}
 function context(){const Audio=root.AudioContext||root.webkitAudioContext;return Audio?(ctx||(ctx=new Audio())):null;}
 function track(source){active.add(source);source.onended=()=>active.delete(source);return source;}
 function stop(){for(const source of active){try{source.stop();}catch{}}active.clear();until=0;}
 function tone(ac,at,frequency,length,volume){
  const source=track(ac.createOscillator()),gain=ac.createGain();source.type='sine';
  source.frequency.setValueAtTime(frequency,at);source.frequency.exponentialRampToValueAtTime(frequency*.62,at+length);
  gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(volume,at+.003);gain.gain.exponentialRampToValueAtTime(.0001,at+length);
  source.connect(gain).connect(ac.destination);source.start(at);source.stop(at+length+.01);
 }
 function wood(ac,at,volume=.035){tone(ac,at,380,.065,volume);tone(ac,at+.002,790,.035,volume*.35);}
 function paper(ac,at){
  const length=.13,buffer=ac.createBuffer(1,Math.ceil(ac.sampleRate*length),ac.sampleRate),samples=buffer.getChannelData(0);let smooth=0;
  for(let i=0;i<samples.length;i++){smooth=.86*smooth+.14*(Math.random()*2-1);samples[i]=smooth*Math.sin(Math.PI*i/samples.length);}
  const source=track(ac.createBufferSource()),filter=ac.createBiquadFilter(),gain=ac.createGain();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=1350;filter.Q.value=.5;
  gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(.18,at+.025);gain.gain.exponentialRampToValueAtTime(.0001,at+length);
  source.connect(filter).connect(gain).connect(ac.destination);source.start(at);source.stop(at+length+.01);
 }
 function play(kind='tap',receipt){
  if(!enabled||!pageActive||root.document?.visibilityState==='hidden')return;
  if(receipt!==undefined){const key=kind+':'+receipt;if(receipts.has(key))return;receipts.add(key);if(receipts.size>256)receipts.delete(receipts.values().next().value);}
  try{
   const ac=context();if(!ac)return;ac.resume().catch(()=>{});
   // Serialize cues. If input outruns playback, discard presentation backlog,
   // never financial/game requests. Muting also cancels already scheduled nodes.
   if(until-ac.currentTime>.8)stop();
   const at=Math.max(ac.currentTime,until);let duration=.09;
   if(kind==='dice'){
    const hits=[0,.065,.15,.255,.39,.55];
    hits.forEach((t,i)=>wood(ac,at+t,.032*(1-i*.12)));duration=.64;
   }else if(['checker','piece','chip','tap'].includes(kind)){wood(ac,at,kind==='tap'?.018:.035);}
   else if(['card','deal','shuffle'].includes(kind)){
    const count=kind==='shuffle'?4:kind==='deal'?2:1;for(let i=0;i<count;i++)paper(ac,at+i*.065);duration=.13+(count-1)*.065;
   }else{
    const notes={fold:[330,294],raise:[440,554],win:[523,659,784],draw:[440,523],roll:[294,392]}[kind]||[440];
    notes.forEach((f,i)=>tone(ac,at+i*.1,f,.16,.026));duration=notes.length*.1+.16;
   }
   until=at+duration;
  }catch{/* Audio is optional; it must never block a move or settlement. */}
 }
 function unlock(){try{context()?.resume().catch(()=>{});}catch{}}
 function toggle(button){enabled=!enabled;try{localStorage.setItem('simab_sound_enabled',enabled?'1':'0');}catch{}if(!enabled)stop();else unlock();if(button){button.setAttribute('aria-pressed',String(enabled));button.textContent=root.SimabI18n?.key?root.SimabI18n.key(enabled?'sound.on':'sound.off'):(enabled?'🔊 صدا روشن':'🔇 صدا خاموش');}return enabled;}
 root.addEventListener?.('pagehide',()=>{pageActive=false;stop();});
 root.addEventListener?.('pageshow',()=>{pageActive=true;});
 root.document?.addEventListener('visibilitychange',()=>{if(root.document.visibilityState==='hidden')stop();});
 root.SimabSound=Object.freeze({play,toggle,unlock,stop,isEnabled:()=>enabled});
})(typeof window!=='undefined'?window:globalThis);
