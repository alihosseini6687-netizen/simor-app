import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {resolve,dirname} from 'node:path';import {Script} from 'node:vm';
const root=new URL('../',import.meta.url).pathname,read=p=>readFileSync(root+p,'utf8');
const pages=['index.html','swap/index.html','streak/index.html','quests/index.html','games/slot/index.html','games/wheel/index.html','games/poker/index.html','games/backgammon/index.html','games/tap/index.html','games/horoscope/index.html','friends/index.html','admin/index.html'];
test('all balance displays have the shared server wallet and no local money writes',()=>{
 for(const p of pages){const html=read(p);assert.match(html,/simab-wallet-client\.js\?v=12/,p);assert.doesNotMatch(html,/CloudStorage\.(getItem|setItem)|simor_coins_|simab_chips_/);}
});
test('all local styles and scripts exist and inline scripts compile',()=>{
 for(const p of pages){const html=read(p);for(const [,code] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Script(code,{filename:p});
 for(const [,asset] of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)){if(/^https?:/.test(asset))continue;assert.ok(existsSync(resolve(root,dirname(p),asset.split('?')[0])),asset);}}
});
test('normal pages scroll; poker alone fills and rotates its bounded game stage',()=>{
 assert.match(read('assets/css/simab-common.css'),/min-height:100dvh/);const css=read('assets/css/simab-poker-v10.css');assert.match(css,/body.in-poker\{overflow:hidden/);assert.match(css,/orientation:portrait/);assert.match(css,/width:100dvh;height:100dvw/);
});
test('wallet balances show loading markers instead of fabricated local defaults',()=>{
 for(const p of ['index.html','wallet/index.html','swap/index.html'])assert.match(read(p),/data-coins>—/);
 assert.match(read('assets/js/simab-wallet-client.js'),/Telegram\?\.WebApp\?\.initData/);
});
