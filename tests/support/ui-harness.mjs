import vm from 'node:vm';
import {readSource} from './source.mjs';

// Small DOM double for behavior tests. Pixel geometry is tested in Chromium,
// not inferred from this double.
export class Element {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.style={setProperty(k,v){this[k]=String(v);},getPropertyValue(k){return this[k]||'';}};this.className='';this.value='';this.hidden=false;this.disabled=false;this._text='';this.classList={add:(...xs)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...xs])].join(' ');},contains:x=>this.className.split(/\s+/).includes(x),remove:(...xs)=>{this.className=this.className.split(/\s+/).filter(x=>!xs.includes(x)).join(' ');},toggle:(x,on)=>{on??=!this.classList.contains(x);this.classList[on?'add':'remove'](x);return on;}};}
  set textContent(s){this._text=String(s);this.children=[];}
  get textContent(){return this._text+this.children.map(x=>typeof x==='string'?x:x.textContent).join('');}
  append(...xs){for(const x of xs){if(x.parentElement)x.parentElement.children=x.parentElement.children.filter(y=>y!==x);if(typeof x!=='string')x.parentElement=this;this.children.push(x);}}
  prepend(x){this.append(x);this.children.unshift(this.children.pop());}
  replaceChildren(...xs){for(const x of this.children)if(typeof x!=='string')x.parentElement=null;this.children=[];this._text='';this.append(...xs);}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  contains(x){return this===x||this.children.some(c=>typeof c!=='string'&&c.contains(x));}
  querySelectorAll(selector){const matches=x=>selector.split(',').some(part=>{const s=part.trim();return s.startsWith('.')?s.slice(1).split('.').every(c=>x.classList.contains(c)):x.tagName===s.toUpperCase();});return this.children.flatMap(x=>typeof x==='string'?[]:[...(matches(x)?[x]:[]),...x.querySelectorAll(selector)]);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  get lastChild(){return this.children.at(-1);}
  scrollIntoView(){}
}

export function uiHarness(file,hook,{game='ludo',globals={}}={}){
  const body=new Element('body'),nodes=new Map(),sounds=[],timers=new Map(),intervals=[],subscriptions=[];
  body.dataset.game=game;
  const $=id=>{if(!nodes.has(id)){const el=new Element();el.id=id;nodes.set(id,el);body.append(el);}return nodes.get(id);};
  $('truth-mode').value='dice';
  const document={body,visibilityState:'visible',getElementById:$,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),createTextNode:s=>String(s),addEventListener(){},querySelectorAll:s=>s==='#existing-room button'?$('existing-room').querySelectorAll('button'):s.includes(':checked')?[]:body.querySelectorAll(s)};
  let nextTimer=0;
  const wallet={pending:null,state:{serverWallet:true},ready:{then(){return {catch(){}};}},subscribe:fn=>subscriptions.push(fn),integer:Number,read:async()=>({room:null}),mutate:async()=>{throw Error('unexpected wallet mutation');}};
  const window={SimabI18n:{locale:'en-US',lang:'en'},addEventListener(){}};
  const context={window,document,URLSearchParams,location:{search:'?game='+game},history:{replaceState(){}},navigator:{},SimabWallet:wallet,SimabProfile:{get:()=>''},SimabSound:{unlock(){},play:k=>sounds.push(k),isEnabled:()=>true,toggle(){}},SimabRoomMedia:{update(){},stop(){},refreshAvatars(){}},addEventListener(){},setInterval:fn=>intervals.push(fn),setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn(),confirm:()=>true,console};
  Object.assign(context,globals);
  const source=readSource(new URL('../../'+file,import.meta.url));
  const end=source.lastIndexOf('})();');
  if(end<0)throw Error('missing UI closure');
  vm.runInNewContext(source.slice(0,end)+'window.__test={'+hook+'};'+source.slice(end),context,{filename:file});
  return {api:window.__test,$,body,document,wallet,sounds,intervals,subscriptions,timers,flush(){const tasks=[...timers.values()];timers.clear();tasks.forEach(fn=>fn());}};
}
