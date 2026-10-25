/* Small gesture-unlocked synthesised SFX. No downloads, enabled on user gesture,
 no autoplay, audio gracefully disabled when unsupported. */
(function(root){
"use strict";
let enabled=true,ctx=null;try{enabled=localStorage.getItem('simab_sound_enabled')!=='0';}catch{}
function context(){
 if(!root.AudioContext&&!root.webkitAudioContext)return null;
 if(!ctx)ctx=new (root.AudioContext||root.webkitAudioContext)();
 return ctx;
}
function play(kind="tap"){
 if(!enabled)return;
 try{
  const ac=context();if(!ac)return;ac.resume().catch(()=>{});
  const notes={
   tap:[440],chip:[610,850],fold:[320,220],raise:[540,710],
   deal:[390,515,650],win:[420,530,670,880],dice:[240,490,340],
   roll:[360,520,800]
  }[kind]||[420];
  notes.forEach((freq,i)=>{
   const start=ac.currentTime+i*.075,osc=ac.createOscillator(),gain=ac.createGain();
   osc.type="sine";osc.frequency.setValueAtTime(freq,start);
   gain.gain.setValueAtTime(.0001,start);
   gain.gain.exponentialRampToValueAtTime(.075,start+.015);
   gain.gain.exponentialRampToValueAtTime(.0001,start+.15);
   osc.connect(gain).connect(ac.destination);osc.start(start);osc.stop(start+.17);
  });
 }catch{}
}
function unlock(){try{const ac=context();if(ac?.state==='suspended')ac.resume().catch(()=>{});}catch{}}
function toggle(button){
 enabled=!enabled;try{localStorage.setItem('simab_sound_enabled',enabled?'1':'0');}catch{}unlock();
 if(button){button.setAttribute("aria-pressed",String(enabled));button.textContent=enabled?"🔊 صدا روشن":"🔇 صدا خاموش";}
 if(enabled)play("tap");return enabled;
}
root.SimabSound=Object.freeze({play,toggle,unlock,isEnabled:()=>enabled});
})(typeof window!=="undefined"?window:globalThis);
