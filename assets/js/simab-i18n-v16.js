/* Backwards-compatible entry URL. Locale resources are local, ordered and versioned. */
(()=>{'use strict';
 const supported=['en','fa','ru','ar','hi','fr','de'];let lang='en';
 try{const saved=localStorage.getItem('simab_language_v16');if(supported.includes(saved))lang=saved;}catch{}
 document.documentElement.lang=lang;document.documentElement.dir=['fa','ar'].includes(lang)?'rtl':'ltr';
 const base=new URL('i18n/',document.currentScript.src),version='phase3b';
  const ready=(async()=>{for(const name of ['legacy-en-fa.js','catalogs.js','screens.js','remaining-ui.js','remaining-terms.js','owned-screens.js','game-messages.js','secondary-screens.js','owned-terms.js','rules-extra.js','errors.js','other-tools.js','wallet-policies.js','prompts.js','prompt-templates.js','phase4.js','runtime.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(name+'?v='+version,base).href;script.async=false;script.onload=resolve;script.onerror=()=>reject(Error('SIMAB localization resource failed: '+name));document.head.append(script);});})();
 window.SimabI18nReady=ready;
 ready.catch(error=>{console.error(error);document.documentElement.dataset.i18nError='resource-load';});
})();
