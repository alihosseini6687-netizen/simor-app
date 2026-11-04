/* Mango presentation adapter: run AFTER the existing seven-language renderer.
   No changes to signed auth, game state, APIs or payment payloads. */
(()=>{
 'use strict';
 const rebrand=()=>{
   document.title=document.title.replace(/SIMAB|Simor/gi,'Mango Game').replace(/سیماب/g,'مانگو گیم');
   for(const element of document.querySelectorAll('h1,.brand-title,.room-brand,.header-center-title,.modal-title')){
     const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node;
     while((node=walker.nextNode())){
       const text=node.nodeValue||'';
       const updated=text.replace(/\bSIMAB\b/gi,'Mango Game').replace(/سیماب/g,'مانگو گیم');
       if(text!==updated)node.nodeValue=updated;
     }
   }
 };
 const boot=()=>{
   const script=document.querySelector('script[src*="mango-game-labels-v1.js"]');if(!script)return;
   const logo=new URL('../mango-game-icon.png',script.src).href;
   document.querySelectorAll('img[src*="simab-logo"]').forEach(img=>{img.src=logo;img.alt='لوگوی Mango Game';});
   document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(link=>{link.href=logo;});
   const afterLocale=()=>requestAnimationFrame(rebrand);
   window.addEventListener('simab-language-ready',afterLocale);
   if(window.SimabI18n?.lang)afterLocale();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();