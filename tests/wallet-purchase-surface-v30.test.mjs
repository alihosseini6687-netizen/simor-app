import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../wallet/index.html',import.meta.url),'utf8');
const terms=readFileSync(new URL('../wallet/terms.html',import.meta.url),'utf8');
const shop=readFileSync(new URL('../assets/js/simab-shop-v15.js',import.meta.url),'utf8');

test('wallet uses current signed-client script, avoiding stale Telegram WebView purchase recovery',()=>{
 assert.match(html,/simab-wallet-client\.js\?v=20261104-payment-audit/);
 assert.doesNotMatch(html,/simab-wallet-client\.js\?v=17/);
 assert.match(html,/simab-shop-v15\.js/);
 assert.match(html,/TELEGRAM STARS/);
});
test('TON connection is not misleadingly sold as a coin payment service',()=>{
 assert.match(html,/خرید سکه با TON فعلاً فعال نیست/);
 assert.match(html,/Tonkeeper یا TON Wallet/);
 assert.match(shop,/tonBalance/);
 assert.doesNotMatch(shop,/sendTransaction\s*\(/);
 assert.match(terms,/در صورت غیرفعال‌بودن فروشگاه/);
});
