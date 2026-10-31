import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {localeContext} from './support/i18n-inventory-v22.mjs';
import {sevensLanguages,penaltyPatterns,penaltyText} from './support/ui-i18n-sevens-v22.mjs';

const source=readFileSync(new URL('../assets/js/simab-party-v16.js',import.meta.url),'utf8');
for(const lang of sevensLanguages)test('Sevens draw labels, counts and unchanged action: '+lang,()=>{
 const x=localeContext(lang);
 assert.equal(x.SimabLocales.catalogs[lang]['sevens.drawPenalty'],penaltyPatterns[lang]);
 const helper=source.match(/function sevensDrawButton\([^]*?\n}/)?.[0];assert.ok(helper,'production presentation helper');
 x.uiText=(key,fallback,values)=>x.SimabI18n.key(key,values);
 x.fmt=n=>String(n);x.button=(text,fn,disabled)=>({dataset:{},textContent:text,disabled,onclick:fn});
 vm.runInContext(helper,x);
 for(const penalty of [0,1,2,4,6,12,20])for(const disabled of [false,true]){
  const state={penalty,current:1,direction:-1,hand:[4,9,12]},before=JSON.stringify(state),moves=[];
  const b=x.sevensDrawButton(state,move=>moves.push(JSON.parse(JSON.stringify(move))),disabled);
  assert.equal(b.textContent,penalty?penaltyText(lang,penalty):x.SimabI18n.key('cards.draw'));
  assert.equal(b.dataset.i18n,penalty?'sevens.drawPenalty':'cards.draw');assert.equal(b.disabled,disabled);
  if(!disabled){b.onclick();assert.deepEqual(moves,[{type:'draw'}]);}
  assert.equal(JSON.stringify(state),before);
 }
 for(const count of [2,4,6,12,20])assert.equal(x.SimabI18n.t('کارت بردار ('+count+')'),penaltyText(lang,count));
 assert.deepEqual([...x.SimabI18n.missing],[]);
});
