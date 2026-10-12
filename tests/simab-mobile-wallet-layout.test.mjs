import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {Script} from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pages=[
 'index.html','swap/index.html','streak/index.html','quests/index.html',
 'games/slot/index.html','games/wheel/index.html','games/poker/index.html',
 'games/backgammon/index.html','games/tap/index.html'
];
test('wallet link is in page flow, never direct flex body child',()=>{
 for(const path of pages){
  const html=read(path);
  assert.doesNotMatch(html,/<body>\s*<a class="simab-secure-entry"/,path);
  const main=html.indexOf('<div class="app-wrapper">');
  const nav=html.indexOf('<a class="simab-secure-entry"');
  assert.ok(nav>0,'missing wallet link '+path);
  if(main!==-1){
    const headerEnd=html.indexOf('</header>',main);
    assert.ok(nav>headerEnd,'link must be within content after header in '+path);
  } else {
    const top=html.indexOf('<div class="top-bar">');
    assert.ok(top>0&&nav>top,'game link must follow top bar: '+path);
  }
  assert.equal((html.match(/class="simab-secure-entry"/g)||[]).length,1,
    'duplicate wallet card '+path);
 });
});
test('one shared responsive stylesheet powers all wallet links; URLs resolve',()=>{
 const css=read('assets/css/simab-secure-entry-v7.css');
 assert.match(css,/max-width:100%!important/);
 assert.match(css,/min-width:0/);
 assert.match(css,/focus-visible/);
 assert.match(css,/flex:0 0 auto/);
 for(const path of pages){
  const html=read(path);
  const match=html.match(/<link rel="stylesheet" href="([^"]*simab-secure-entry-v7\.css\?v=7)">/);
  assert.ok(match,'no link stylesheet '+path);
  const full=resolve(root,dirname(path),match[1].split('?')[0]);
  assert.ok(existsSync(full),'bad CSS path '+path);
  assert.doesNotMatch(html,/<style>\s*\.simab-secure-entry\{/,'duplicated CSS '+path);
  for(const [,script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    new Script(script,{filename:path});
  }
 }
});
test('no legacy page claims to hold server-backed funds',()=>{
 const swap=read('swap/index.html');
 assert.match(swap,/سکه محلی \(آزمایشی\)/);
 assert.match(swap,/ژتون بازی‌های آزمایشی/);
 assert.match(read('streak/index.html'),/حالت آزمایشی/);
});
test('new wallet stays narrow-screen usable without exposing local coins',()=>{
 const html=read('wallet/index.html');
 assert.match(html,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(html,/overflow-wrap:anywhere/);
 assert.match(html,/input\{min-width:0;font-size:16px\}/);
 assert.match(html,/font-size:clamp\(17px,5\.1vw,25px\)/);
 const client=read('assets/js/simab-secure-wallet.js');
 assert.doesNotMatch(client,/CloudStorage\.(?:getItem|setItem)/);
 assert.match(client,/Telegram\?\.WebApp\?\.initData/);
});
