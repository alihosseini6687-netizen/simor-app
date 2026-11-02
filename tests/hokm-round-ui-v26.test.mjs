import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const party=readFileSync(new URL('../assets/js/simab-party-v16.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/css/simab-phase4-v22.css',import.meta.url),'utf8');
const i18n=readFileSync(new URL('../assets/js/i18n/phase4.js',import.meta.url),'utf8');
const start=party.indexOf("if(t.phase==='round_end'){const next=node('section','hokm-round-action')");
const end=party.indexOf("\n }\n else if(s.kind==='ludo')",start);
assert.ok(start>=0&&end>start,'run real v22 next-round markup');
const realBlock=party.slice(start,end);
new vm.Script(realBlock);
function paint({phase='round_end',owner=true,disabled=false}={}){
 const root={children:[],append(...v){this.children.push(...v);}};
 const bound=[],moves=[];
 const node=(tag,cls='',label='')=>({tag,className:cls,textContent:label,children:[],attributes:{},append(...v){this.children.push(...v);},setAttribute(key,value){this.attributes[key]=value;}});
 const button=(label,fn,isDisabled,cls)=>({tag:'button',className:cls,textContent:label,disabled:isDisabled,onclick:fn});
 const context={t:{phase},node,a:root,mine:()=>owner,disabled,button,move:v=>moves.push(v),window:{SimabI18n:{bind(el,key){bound.push(key);el.dataset={i18n:key};}}}};
 vm.runInNewContext(realBlock,context);
 return {root,bound,moves};
}
test('only the current authorized Hokm player can start another round',()=>{
 const self=paint({owner:true});
 assert.equal(self.root.children.length,1);
 const panel=self.root.children[0];
 assert.equal(panel.className,'hokm-round-action');
 assert.equal(panel.attributes.role,'status');
 assert.equal(panel.attributes['aria-live'],'polite');
 const buttons=panel.children.filter(x=>x.tag==='button');
 assert.equal(buttons.length,1);
 assert.equal(buttons[0].disabled,false);
 buttons[0].onclick();
 assert.equal(self.moves.length,1);
 assert.equal(self.moves[0].type,'next_round');
 const guest=paint({owner:false});
 assert.equal(guest.root.children[0].children.filter(x=>x.tag==='button').length,0);
 assert.ok(guest.root.children[0].children.some(x=>x.className==='hokm-round-wait'));
 const inactive=paint({phase:'play'});
 assert.equal(inactive.root.children.length,0);
});
test('Hokm round completion binds existing localized strings rather than hard-coded only Persian',()=>{
 const self=paint({owner:true}),guest=paint({owner:false});
 assert.deepEqual(self.bound,['hokm.roundComplete','hokm.roundWinner','hokm.nextRound']);
 assert.deepEqual(guest.bound,['hokm.roundComplete','hokm.roundWinner','hokm.waitingHakem']);
 for(const key of [...new Set([...self.bound,...guest.bound])])assert.ok(i18n.includes("'"+key+"'"),key+' translated');
});
test('current authoritative Hokm seat has a unique visual cue, with mobile support',()=>{
 assert.match(party,/seat=node\('div','table-seat seat-'\+pos\+\(i===s\.current&&!s\.finished\?' current':''\)\)/);
 assert.match(css,/#arena\.hokm \.table-seat\.current/);
 assert.match(css,/@media\(max-width:420px\)/);
 assert.doesNotMatch(css,/content:" • نوبت"/,'turn marker must be language-neutral');
});
