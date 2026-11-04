/* Visible-name compatibility adapter. Never rewrites API actions, game IDs or payment metadata. */
(()=>{
 'use strict';
 const boot=()=>{
   document.title=document.title.replace(/SIMAB|Simor/gi,'Mango Game').replace(/سیماب/g,'مانگو گیم');
   const script=document.querySelector('script[src*="mango-game-labels-v1.js"]');
   if(!script)return;
   const logo=new URL('../mango-game-icon.png',script.src).href;
   document.querySelectorAll('img[src*="simab-logo"]').forEach(img=>{
     img.src=logo;img.alt='لوگوی Mango Game';
   });
   document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(icon=>{icon.href=logo;});
   // Only visible brand headings; do not touch inputs, hidden payloads or rules.
   const targets=document.querySelectorAll('h1,.brand-title,.room-brand,.header-center-title,.modal-title');
   for(const element of targets){
     const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
     let node;
     while((node=walker.nextNode())){
       const text=node.nodeValue||'';
       const revised=text.replace(/\bSIMAB\b/gi,'Mango Game').replace(/سیماب/g,'مانگو گیم');
       if(revised!==text)node.nodeValue=revised;
     }
   }
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})();