import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {localeFiles,localeSources} from './support/i18n-v22.mjs';

// Production loader's precise order, no files omitted.
test('SIMAB seven language assets: complete ordered production loader',()=>{
  assert.deepEqual(localeFiles,[
    'legacy-en-fa.js','catalogs.js','screens.js','remaining-ui.js',
    'remaining-terms.js','owned-screens.js','game-messages.js',
    'secondary-screens.js','owned-terms.js','rules-extra.js',
    'errors.js','other-tools.js','wallet-policies.js','prompts.js',
    'prompt-templates.js','phase4.js','runtime.js']);
});
for(const code of ['en','fa','ru','ar','hi','fr','de']) {
  test('SIMAB seven language catalogs and existing labels: '+code,()=>{
    const context={window:null,document:{readyState:'loading',documentElement:{},addEventListener(){}},localStorage:{getItem(){return code;}},console,Intl};
    context.window=context;
    for(const source of localeSources)runInNewContext(source,context);
    const app=context.SimabI18n;
    assert.equal(app.lang,code);
    assert.equal(context.document.documentElement.dir,['fa','ar'].includes(code)?'rtl':'ltr');
    const coverage=app.coverage()[code];
    assert.ok(coverage.total>1000);
    assert.equal(coverage.missingKeys.length,0);
    assert.equal(coverage.legacyUnmapped.length,0);
    for(const key of ['nav.home','nav.games','action.create','action.share','game.turn']) {
      assert.ok(app.key(key,{name:'Alex'}).trim(),key);
      assert.ok(!app.key(key,{name:'Alex'}).includes('undefined'),key);
    }
  });
}
