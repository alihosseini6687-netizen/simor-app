/* Mango Game — visible brand labels only. Leave original Persian source intact until locale translation. */
(()=>{'use strict';
 function run(){
  const persian=window.SimabI18n?.lang==='fa';
  const rename=persian?/سیماب|\bSIMAB\b/g:/\bSIMAB\b/g;
  const label=text=>text.replace(rename,m=>m==='SIMAB'?'Mango Game':'مانگو گیم');
  if(document.title)document.title=label(document.title);
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];let node;
  while((node=walker.nextNode())){
   if(!node.parentElement||node.parentElement.closest('script,style,textarea,code,pre,[contenteditable],[data-no-brand]'))continue;
   if(rename.test(node.nodeValue||''))nodes.push(node);
   rename.lastIndex=0;
  }
  for(const node of nodes)node.nodeValue=label(node.nodeValue);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});
 else run();
 window.addEventListener('simab-language-ready',()=>requestAnimationFrame(run));
})();