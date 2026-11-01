/* Keyed UI localization with a measured compatibility bridge. Never sends text
 * to a service and never writes into game state, amounts or financial requests. */
(()=>{'use strict';
 const {languages,catalogs}=window.SimabLocales,legacy=window.SimabLegacyI18n;
 let lang='en';try{const saved=localStorage.getItem('simab_language_v16');if(languages[saved])lang=saved;}catch{}
 let {locale,dir}=languages[lang];const missing=new Set(),seen=new WeakMap(),attributes=new WeakMap(),bindings=new WeakMap();
 const normalize=s=>s.replace(/[←↔→🔊🔇🎙🎮👥🤖🎲♠◈]/gu,'').replace(/\s+/g,' ').trim().replace(/[:：]$/,'');
 const aliases=new Map();for(const catalog of Object.values(catalogs))for(const [key,value] of Object.entries(catalog))if(!value.includes('{'))aliases.set(normalize(value),key);
 for(const [source,id] of Object.entries(window.SimabLocaleSources||{}))aliases.set(normalize(source),id);
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const templates=[];
 for(const catalog of Object.values(catalogs))for(const [id,pattern] of Object.entries(catalog)){
  if(!pattern.includes('{'))continue;const names=[];let cursor=0,expression='^';
  for(const match of pattern.matchAll(/\{(\w+)\}/g)){expression+=escape(pattern.slice(cursor,match.index))+'(.*?)';names.push(match[1]);cursor=match.index+match[0].length;}
  expression+=escape(pattern.slice(cursor))+'$';templates.push({id,names,pattern,regex:new RegExp(expression,'u')});
 }
 templates.sort((a,b)=>b.pattern.length-a.pattern.length);
 function resolve(raw){
  const id=aliases.get(normalize(raw));if(id)return {id,values:{}};
  for(const template of templates){const match=raw.match(template.regex);if(!match)continue;
   const values=Object.fromEntries(template.names.map((name,i)=>[name,match[i+1]]));
   // Numeric placeholders must not swallow whole untranslated paragraphs merely
   // because they end with "coins" or "chips". Named people remain opaque.
   if(template.names.some(name=>['number','numbers','total','entry','pot','bar','off','other','count','score','bet','from','to','first','second'].includes(name)&&!/^[\p{N}\s.,،٫٬/|•:+−\-–—×()%]*$/u.test(values[name])&&!aliases.has(normalize(values[name]))))continue;
   return {id:template.id,values};
  }
  const icon=raw.match(/^([\p{Extended_Pictographic}\uFE0F]+\s+)(.+)$/u);if(icon){const binding=resolve(icon[2]);if(binding)return {...binding,prefix:icon[1]};}
  return null;
 }
 const legacyBindings=new Map();
 for(const [fa,en] of Object.entries(legacy.inventory())){const binding=resolve(fa)||resolve(en);if(binding){legacyBindings.set(fa,binding);legacyBindings.set(en,binding);}}
 function key(id,values={}){
   const pattern=catalogs[lang][id];if(typeof pattern!=='string'){missing.add(id);return '['+id+']';}
   return pattern.replace(/\{(\w+)\}/g,(_,name)=>{if(!Object.hasOwn(values,name))return '{'+name+'}';let value=String(values[name]);if(['game','position','number','result','message','starter'].includes(name)){const nested=aliases.get(normalize(value));if(nested&&nested!==id)value=key(nested);else if(['game','position','result','message','starter'].includes(name))value=t(value);}
    if(name==='number')value=value.replace(/[0-9۰-۹٠-٩]/g,c=>{const n='0123456789۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'.indexOf(c)%10;return (lang==='fa'?'۰۱۲۳۴۵۶۷۸۹':lang==='ar'?'٠١٢٣٤٥٦٧٨٩':'0123456789')[n];});return ['name','asker','target','names'].includes(name)&&(dir==='rtl'||/[\u0590-\u08ff]/.test(value))?'\u2068'+value+'\u2069':value;});
 }
 function t(raw){
  if(typeof raw!=='string'||!raw.trim())return raw;
   const trimmed=raw.trim(),english=legacy.english(trimmed),binding=legacyBindings.get(trimmed)||resolve(trimmed)||resolve(english);
   if(binding)return raw.replace(trimmed,(binding.prefix||'')+key(binding.id,binding.values));
   const patterns=[[/^BOT (\d+)$/,m=>key('game.bot',{number:m[1]})],[/^BOT (\d+) is thinking…$/,m=>key('bot.thinking',{number:m[1]})],[/^(.+)’s turn$/,m=>key('game.turn',{name:m[1]})],[/^(\d+) seconds$/,m=>key('game.seconds',{number:new Intl.NumberFormat(locale).format(Number(m[1]))})],[/^Die (\d+)$/,m=>key('dice.number',{number:new Intl.NumberFormat(locale).format(Number(m[1]))})]];
   for(const [pattern,id] of [[/^(\d+) players$/,'game.players'],[/^(\d+) cards$/,'cards.count'],[/^Level (\d+)$/,'miner.level'],[/^Day (\d+)$/,'reward.day'],[/^روز ([۱-۷])$/,'reward.day'],[/^(.+) coins \/ day$/,'miner.daily'],[/^Tank: (.+) coins$/,'miner.capacity'],[/^Buy · (.+) coins$/,'miner.buy'],[/^Refill · (.+) coins$/,'miner.refill'],[/^Claim in (.+) seconds$/,'reward.wait'],[/^(.+) verified coins$/,'wallet.verified']])patterns.push([pattern,m=>key(id,{number:m[1]})]);
  if(lang!=='fa')for(const [pattern,format] of patterns){const match=english.match(pattern);if(match)return raw.replace(trimmed,format(match));}
  // Explicit compatibility fallback, inventoried and disclosed in the UI.
  // Keep exact amounts/rules rather than substituting vague or misleading prose.
   // Numbers, card faces, punctuation and explicit brand names are not prose.
   const parts=trimmed.split(' / ');if(parts.length>1&&parts.every(part=>legacyBindings.has(part)||resolve(part)||/^[\p{N}\s\p{P}\p{S}\uFE0F]+$/u.test(part)))return raw.replace(trimmed,parts.map(part=>t(part)).join(' / '));
   const technical=/^[\p{N}\s\p{P}\p{S}\u200c\u200e\u200f\u2066-\u2069\uFE0F]+$/u.test(trimmed)||/^(?:S|SIMAB|GAMING CLUB|✦ SIMAB GAMING CLUB|⭐ SIMAB|Telegram|TON|Stars|UTC|Tonkeeper|TON Wallet|TELEGRAM STARS|SIMAB GAMING CLUB|SIMAB • FRIENDS CLUB|SIMAB \| Gaming Club|SIMAB ROLLER|[AJQKD]|[AJQK]\s*[♠♥♦♣]|x\d+|@[\w]+)$/iu.test(trimmed);
   // A build marker is not prose and must not trigger a missing-translation warning.
   if(!technical&&!/^•\s*v\d+(?:\.\d+)*$/i.test(trimmed))missing.add(trimmed);
   return lang==='fa'?raw:raw.replace(trimmed,english);
 }
 function coverage(){const keys=Object.keys(catalogs.en);return Object.fromEntries(Object.keys(languages).map(l=>[l,{total:keys.length,translated:keys.filter(k=>typeof catalogs[l][k]==='string'&&catalogs[l][k].length).length,missingKeys:keys.filter(k=>!catalogs[l][k]),legacyUnmapped:Object.keys(legacy.inventory()).filter(fa=>!legacyBindings.has(fa))}]));}
 function bind(element,id,values={},prefix=''){const rendered=prefix+key(id,values);bindings.set(element,{id,values,prefix,rendered});element.dataset.i18n=id;element.textContent=rendered;return element;}
  function bindSource(element,source){const binding=legacyBindings.get(source)||resolve(source);if(binding)return bind(element,binding.id,binding.values,binding.prefix||'');bindings.delete(element);delete element.dataset.i18n;element.textContent=source;return element;}
 function sourceKey(source){return (legacyBindings.get(source)||resolve(source))?.id||null;}
 function audit(root=document.body){missing.clear();scan(root,true);t(titleSource);return [...missing];}
 function setLanguage(next){
  if(!languages[next])throw Error('Unsupported SIMAB locale');
  try{localStorage.setItem('simab_language_v16',next);}catch{document.documentElement.dataset.i18nError='preference-storage';}
  lang=next;({locale,dir}=languages[lang]);missing.clear();
  document.documentElement.lang=lang;document.documentElement.dir=dir;
  ownedIdentityFallbacks();
  const select=document.querySelector('#simab-language select');if(select)select.value=lang;
  scan(document.body,true);document.title=t(titleSource);
  const notice=document.getElementById('simab-i18n-notice');if(notice){notice.textContent=key('i18n.notice');notice.hidden=missing.size===0;}
   window.dispatchEvent(new CustomEvent('simab-language-ready',{detail:{lang,locale,dir}}));
   localizeWalletAccount();
   // Subscribers may synchronously rebuild a game surface. Translate those new
   // nodes before returning, not on the following animation frame.
   scan(document.body,true);document.title=t(titleSource);return true;
 }
 window.SimabI18n=Object.freeze({get lang(){return lang;},get locale(){return locale;},get dir(){return dir;},t,key,bind,bindSource,sourceKey,audit,number:(n,options)=>new Intl.NumberFormat(locale,options).format(n),setLanguage,coverage,get prompts(){return window.SimabPromptLocales?.[lang]||(lang==='fa'?window.SimabTruthBank:window.SimabTruthBankEn);},get missing(){return [...missing];}});
 document.documentElement.lang=lang;document.documentElement.dir=dir;
 const ignored='script,style,code,[data-user-content],[data-coins],[data-chips],[data-wallet-account],.wallet-address,#ton-address,#merchant-address,#user-name-txt,#user-tg-username,#user-num-id,#user-game-id,#chat-log,#poker-chat-log,#chat-archive,.seat-name,.bottle-name,.table-seat>b,#simab-language,#simab-i18n-notice';
 const textIgnored=ignored+',textarea,input,#join-code,#invite-code,#code';
 // Presentation only: leave account identity and wallet requests untouched.
 // The wallet client owns the numeric Telegram ID; translate just its fixed label.
 function localizeWalletAccount(){
  const accountKeys=[...new Set(['آیدی تلگرام',...Object.values(catalogs).map(c=>c['wallet.telegramId'])])];
  const noLoginLabels=[...new Set(['ورود از تلگرام لازم است',...Object.values(catalogs).map(c=>c['wallet.telegramSignIn'])])];
  for(const el of document.querySelectorAll('[data-wallet-account]')){
   const current=el.textContent.trim();
   if(noLoginLabels.includes(current)){const translated=key('wallet.telegramSignIn');if(current!==translated)el.textContent=translated;continue;}
   for(const label of accountKeys){
    const prefix=label+': ';
    if(!current.startsWith(prefix))continue;
    const id=current.slice(prefix.length);
    if(/^\\d{1,20}$/.test(id)){
     const translated=key('wallet.telegramId')+': '+id;
     if(current!==translated)el.textContent=translated;
    }
    break;
   }
  }
 }
 let titleSource=document.title;
 function ownedIdentityFallbacks(){
  const user=window.Telegram?.WebApp?.initDataUnsafe?.user;
  const name=document.getElementById('user-name-txt'),number=document.getElementById('user-num-id');
  if(name&&!user?.id)bind(name,'profile.guest');else if(name&&!user?.first_name)bind(name,'home.player');
  if(number&&!user?.id)bind(number,'profile.outsideTelegram');
 }
 function scan(root,force=false){
  if(root.nodeType===3){if(root.parentElement?.closest(textIgnored))return;const old=seen.get(root);if(!force&&old?.translated===root.nodeValue)return;
   const parent=root.parentElement;let saved=bindings.get(parent);
   if(saved&&parent.textContent!==saved.rendered){bindings.delete(parent);delete parent.dataset.i18n;saved=null;}
   const original=old?.translated===root.nodeValue?old.original:root.nodeValue;
    // A declared key supplies context that automatic aliases cannot infer.
    const explicit=!saved&&parent?.childNodes.length===1&&parent.dataset?.i18n?{id:parent.dataset.i18n,values:{}}:null;
    const binding=saved||explicit||(typeof original==='string'?(legacyBindings.get(original.trim())||resolve(original.trim())):null);
   const translated=binding?(binding.prefix||'')+key(binding.id,binding.values):t(original);seen.set(root,{original,translated});
   if(binding&&parent?.childNodes.length===1){bindings.set(parent,{...binding,rendered:translated});parent.dataset.i18n=binding.id;}
   if(root.nodeValue!==translated)root.nodeValue=translated;return;}
  if(root.nodeType!==1&&root.nodeType!==9||root.matches?.(ignored))return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let text;while(text=walker.nextNode())scan(text,force);
  if(root.nodeType===1)for(const el of [root,...root.querySelectorAll('[data-i18n],[placeholder],[aria-label],[title]')]){
   if(el.closest(ignored))continue;
     if(el.dataset.i18n){const binding=bindings.get(el);if(binding&&el.textContent!==binding.rendered){bindings.delete(el);delete el.dataset.i18n;}else{const value=(binding?.prefix||'')+key(el.dataset.i18n,binding?.values);if(el.textContent!==value)el.textContent=value;bindings.set(el,{id:el.dataset.i18n,values:binding?.values||{},prefix:binding?.prefix||'',rendered:value});}}
    let saved=attributes.get(el);if(!saved){saved={};attributes.set(el,saved);}
    for(const attr of ['placeholder','aria-label','title'])if(el.hasAttribute(attr)){const current=el.getAttribute(attr),old=saved[attr],original=old?.translated===current?old.original:current,value=t(original);saved[attr]={original,translated:value};if(value!==current)el.setAttribute(attr,value);}
  }
 }
 for(const name of ['confirm','alert','prompt']){const original=window[name];if(typeof original==='function')window[name]=function(message,...args){return original.call(window,t(message),...args);};}
 function mount(){
  const bar=document.createElement('div');bar.className='simab-langbar';bar.id='simab-language';
  const label=document.createElement('label');label.textContent='🌐 ';const select=document.createElement('select');select.setAttribute('aria-label','Language / زبان / اللغة');
  for(const [value,metadata] of Object.entries(languages)){const option=document.createElement('option');option.value=value;option.textContent=metadata.name;select.append(option);}select.value=lang;select.onchange=()=>setLanguage(select.value);label.append(select);bar.append(label);document.body.prepend(bar);
  const notice=document.createElement('p');notice.id='simab-i18n-notice';notice.className='simab-i18n-notice';notice.textContent=key('i18n.notice');notice.hidden=true;document.body.prepend(notice);
   ownedIdentityFallbacks();scan(document.body);localizeWalletAccount();notice.hidden=missing.size===0;document.title=t(document.title);
  const pending=new Set();let scheduled=false;
  new MutationObserver(records=>{for(const record of records){if(record.type==='characterData'||record.type==='attributes')pending.add(record.target);else record.addedNodes.forEach(node=>pending.add(node));}if(!scheduled){scheduled=true;requestAnimationFrame(()=>{for(const node of pending)if(node.isConnected)scan(node);localizeWalletAccount();pending.clear();scheduled=false;notice.hidden=missing.size===0;});}}).observe(document.body,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
  window.dispatchEvent(new CustomEvent('simab-language-ready',{detail:{lang,locale,dir}}));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
