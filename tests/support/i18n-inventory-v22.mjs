import {readdirSync,readFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import vm from 'node:vm';
import {projectRoot} from './source.mjs';
import {localeSources} from './i18n-v22.mjs';
export function localeContext(lang='en'){
 const document={title:'SIMAB',documentElement:{dataset:{}},readyState:'loading',addEventListener(){}};
 const x={document,localStorage:{getItem:()=>lang},Intl};x.window=x;vm.createContext(x);for(const source of localeSources)vm.runInContext(source,x);return x;
}
export function applicationFiles(){
 const out=[];function visit(path){for(const item of readdirSync(path,{withFileTypes:true})){if(['i18n','node_modules'].includes(item.name))continue;const file=resolve(path,item.name);if(item.isDirectory())visit(file);else if(/\.(?:html|js)$/.test(item.name))out.push(file);}}
 out.push(resolve(projectRoot,'index.html'));for(const dir of ['assets/js','admin','ai','friends','games','offers','quests','streak','swap','wallet'])visit(resolve(projectRoot,dir));return out;
}
export function legacyClassification(){
 const baseline=JSON.parse(readFileSync(resolve(projectRoot,'docs/SIMAB_V22_PHASE3_I18N_COVERAGE.json'),'utf8')).coverage.en.legacyUnmapped;
 const x=localeContext(),inventory=x.SimabLegacyI18n.inventory(),files=applicationFiles().map(file=>({path:relative(projectRoot,file).replaceAll('\\','/'),text:readFileSync(file,'utf8')}));
 const category=en=>/privacy|stored|recorded|cash|withdraw|forfeit|refund|entry|pot|coin|chip|wallet|payment|checkout|purchase|Stars|TON|miner|reward|wheel|streak/i.test(en)?'wallet-reward-policy':/voice|camera|microphone|connection|call|TURN/i.test(en)?'media':/task|mission/i.test(en)?'tasks':/game|table|card|trump|bot|players|poker|slots|dice|spin|fold|raise|check|dealer|hand/i.test(en)?'games':'navigation-home-common';
 return baseline.map(source=>{const locations=files.flatMap(file=>{const occurrences=file.text.split(source).length-1;return occurrences?[{path:file.path,occurrences}]:[];});return {source,english:inventory[source],category:category(inventory[source]),key:x.SimabI18n.sourceKey(source),occurrences:locations.reduce((sum,item)=>sum+item.occurrences,0),locations,status:locations.length?'active-source':'retained-compatibility'};});
}
export function sourceCandidates(){
 const found=new Map();for(const file of applicationFiles()){
  const source=readFileSync(file,'utf8'),path=relative(projectRoot,file).replaceAll('\\','/');
  const add=(text,kind)=>{if(!/[\u0600-\u06ff]/.test(text)||text.length>5000)return;text=text.trim();if(!text)return;const entry=found.get(text)||{source:text,locations:[]};entry.locations.push({path,kind});found.set(text,entry);};
  if(file.endsWith('.html')){const markup=source.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');for(const match of markup.matchAll(/>([^<>]+)</g))add(match[1],'markup');for(const match of markup.matchAll(/(?:placeholder|aria-label|title)="([^"]+)"/g))add(match[1],'attribute');}
  for(const match of source.matchAll(/'((?:\\.|[^'\\\r\n])*)'|"((?:\\.|[^"\\\r\n])*)"/g)){const text=match[1]??match[2];if(text.includes('<')||text.includes('>')||text.includes('{')||text.includes('function(')||text.includes('textContent='))continue;add(text,'literal-or-fragment');}
 }
 return [...found.values()];
}
