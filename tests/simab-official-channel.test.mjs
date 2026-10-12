import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {Script} from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const edge=read('supabase/functions/simab-central-quests/index.ts');
const client=read('assets/js/simab-central-quests.js');

function helpers(mockFetch){
  const from=edge.indexOf('const OFFICIAL_CHANNEL = "@SimorApp";');
  const to=edge.indexOf('const toPublic =',from);
  assert.ok(from>0&&to>from,'actual production channel helpers found');
  const source=stripTypeScriptTypes(edge.slice(from,to));
  return new Function('fetch','AbortSignal',source+
    '\nreturn {isOfficialChannelUrl,isBotAdminInOfficialChannel,OFFICIAL_CHANNEL};'
  )(mockFetch,AbortSignal);
}

test('official channel match rejects spoofed links, bot URLs and query tricks',()=>{
  const {isOfficialChannelUrl,OFFICIAL_CHANNEL}=helpers(async()=>{throw Error('unexpected')});
  assert.equal(OFFICIAL_CHANNEL,'@SimorApp');
  for(const url of ['https://t.me/SimorApp','https://t.me/simorapp/'])
    assert.equal(isOfficialChannelUrl(url),true,url);
  for(const url of [
    'https://t.me/SimorApp_bot','https://t.me/SimorApp?start=evil',
    'https://t.me/SimorApp/posts','https://t.me.evil.example/SimorApp',
    'http://t.me/SimorApp','https://t.me/@SimorApp','javascript:alert(1)',
    'https://user:pass@t.me/SimorApp','https://t.me/SimorApp#post'
  ])assert.equal(isOfficialChannelUrl(url),false,url);
});

test('bot must be a Telegram channel ADMIN for payouts; member or outage is denied',async()=>{
  const makeResponse=status=>async(url,options)=>{
    assert.match(url,/\/getChatMember$/);
    const body=JSON.parse(options.body);
    assert.equal(body.chat_id,'@SimorApp');
    assert.equal(body.user_id,123456789);
    return {ok:true,json:async()=>({ok:true,result:{status}})};
  };
  let h=helpers(makeResponse('administrator'));
  assert.equal(await h.isBotAdminInOfficialChannel('secret-never-logged','123456789'),true);
  h=helpers(makeResponse('creator'));
  assert.equal(await h.isBotAdminInOfficialChannel('secret','123456789'),true);
  h=helpers(makeResponse('member'));
  assert.equal(await h.isBotAdminInOfficialChannel('secret','123456789'),false);
  h=helpers(async()=>{throw Error('offline')});
  assert.equal(await h.isBotAdminInOfficialChannel('secret','123456789'),false);
});

test('rewards never trust local page state, a different channel or external links',()=>{
  assert.match(edge,/if \(!isOfficialChannelUrl\(q\.url\)\) return reply\(409/);
  assert.match(edge,/channel_bot_not_admin/);
  assert.match(edge,/simab_credit_verified_quest/);
  assert.match(edge,/member\.status/);
  assert.match(edge,/getChatMember/);
  assert.match(client,/officialChannelUrl = "https:\/\/t\.me\/SimorApp"/);
  assert.match(client,/simabFillOfficialChannelQuest/);
  assert.match(client,/await loadVerifiedWallet\(\)/);
  assert.match(client,/staticChannelCard\.hidden = true/);
  assert.doesNotMatch(client,/tg: "https:\/\/t\.me\/SimorApp_bot"/);
});

test('existing game and admin page JS remains valid',()=>{
  new Script(client);
  for(const page of ['admin/index.html','quests/index.html']){
    const s=read(page);
    for(const [,code] of s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Script(code);
    assert.match(s,/simab-central-quests\.js\?v=7/);
    assert.match(s,/simab-legacy-guard\.js\?v=1/);
  }
  new Script(stripTypeScriptTypes(edge).replace(/^import .*?\n/m,''));
});
