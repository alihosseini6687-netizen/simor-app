/* Mango Game — visible brand text only. Stable API names, balance IDs and storage keys remain SIMAB. */
(()=>{'use strict';
 const rename=/سیماب|SIMAB/g;
 const label=text=>text.replace(rename,m=>m==='SIMAB'?'Mango Game':'مانگو گیم');
 const run=()=>{
  if(document.title)document.title=label(document.title);
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];let n;
  while((n=walker.nextNode())){
   if(!n.parentElement||n.parentElement.closest('script,style,textarea,code,pre,[contenteditable],[data-no-brand]'))continue;
   if(rename.test(n.nodeValue||''))nodes.push(n);
   rename.lastIndex=0;
  }
  for(const node of nodes)node.nodeValue=label(node.nodeValue);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});
 else run();
})();