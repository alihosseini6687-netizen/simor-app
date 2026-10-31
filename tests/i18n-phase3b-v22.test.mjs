import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {localeContext,legacyClassification} from './support/i18n-inventory-v22.mjs';

for(const lang of ['en','fa','ru','ar','hi','fr','de'])test('phase3b '+lang+': every retained source has a stable key and no fallback',()=>{
 const x=localeContext(lang),coverage=x.SimabI18n.coverage()[lang];assert.equal(coverage.missingKeys.length,0);assert.equal(coverage.legacyUnmapped.length,0);
 for(const source of Object.keys(x.SimabLegacyI18n.inventory())){const key=x.SimabI18n.sourceKey(source);assert.equal(typeof key,'string',source);assert.ok(x.SimabLocales.catalogs[lang][key],key);const text=x.SimabI18n.t(source);assert.ok(text.trim());assert.ok(!text.includes('undefined'));}
 assert.deepEqual([...x.SimabI18n.missing],[]);
});
test('phase3b the original 234 omissions are unique sources, classified separately from occurrences',()=>{
  const recovered=readFileSync(new URL('./fixtures/phase3-original-i18n-coverage-v22.json',import.meta.url));
  assert.equal(createHash('sha256').update(recovered).digest('hex'),'69e1d5864d17381d82d211fe11ac0a62650a64c2696011fb88121678e160dc2a');
  const rows=legacyClassification();assert.equal(rows.length,234);assert.equal(new Set(rows.map(row=>row.source)).size,234);assert.ok(rows.every(row=>row.key&&row.category));assert.ok(rows.some(row=>row.occurrences>1));assert.ok(rows.some(row=>row.occurrences===0));
  const evidence=JSON.parse(readFileSync(new URL('../docs/SIMAB_V22_PHASE3B_I18N_INVENTORY.json',import.meta.url),'utf8'));
  assert.deepEqual(rows.map(row=>row.source),evidence.original234.map(row=>row.source));
});
test('phase3b numeric placeholders cannot disguise untranslated prose',()=>{
 const x=localeContext('de');x.SimabI18n.t('یک متن تازه و ترجمه‌نشده با پایان ژتون');assert.ok(x.SimabI18n.missing.includes('یک متن تازه و ترجمه‌نشده با پایان ژتون'));
 assert.equal(x.SimabI18n.sourceKey('invented untranslated sentence coins'),null);
});
test('phase3b unknown keys and unexpected text stay measurable, never silently become English',()=>{
 const x=localeContext('fr');assert.equal(x.SimabI18n.key('missing.test.key'),'[missing.test.key]');x.SimabI18n.t('unexpected application sentence');assert.ok(x.SimabI18n.missing.includes('missing.test.key'));assert.ok(x.SimabI18n.missing.includes('unexpected application sentence'));
});
test('phase3b prompt translation covers all 500 original positions and retains curated packs',()=>{
 const x=localeContext();vm.runInContext(readFileSync(new URL('../assets/js/simab-truth-bank-v16.js',import.meta.url),'utf8'),x);
 assert.equal(x.SimabPromptKeys.truth.length,300);assert.equal(x.SimabPromptKeys.dare.length,200);
 for(const lang of ['ru','ar','hi','fr','de'])for(const [category,count] of [['truth',300],['dare',200]]){const bank=x.SimabPromptLocales[lang][category];assert.equal(bank.length,count+8);assert.equal(new Set(bank).size,bank.length);assert.ok(bank.every(text=>!text.includes('{topic}')));for(let i=0;i<count;i++)assert.notEqual(bank[i],x.SimabTruthBankEn[category][i]);}
});
test('phase3b every catalog has the same keys and interpolation schema',()=>{
 const x=localeContext(),catalogs=x.SimabLocales.catalogs,base=catalogs.en;for(const [lang,catalog] of Object.entries(catalogs)){assert.deepEqual(Object.keys(catalog).sort(),Object.keys(base).sort());for(const [key,value] of Object.entries(catalog)){assert.ok(value.trim(),lang+' '+key);assert.deepEqual([...value.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),[...base[key].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),lang+' '+key);}}
});
test('phase3b administration templates keep user titles opaque and counts intact',()=>{
 for(const lang of ['en','fa','ru','ar','hi','fr','de']){
  const x=localeContext(lang),label=x.SimabI18n.key('admin.offerOption',{title:'Wallet',count:1,total:20});
  assert.ok(label.startsWith('Wallet • '));assert.ok(label.includes('1/20'));
  const name=x.SimabI18n.t('حذف مأموریت Home').replace(/[\u2068\u2069]/g,'');assert.ok(name.includes('Home'));assert.ok(!name.includes('{name}'));
 }
});
