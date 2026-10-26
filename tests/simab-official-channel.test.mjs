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

test('new tasks verify the configured channel server-side and label external visits honestly',()=>{
  const task=read('supabase/functions/simab-central-quests/task-api.ts');
  assert.match(task,/getChatMember/);assert.match(task,/channel_membership_required/);assert.match(task,/channel_bot_not_admin/);assert.match(task,/simab_task_claim_v16/);assert.match(client,/قابل تأیید خودکار نیست/);assert.match(client,/doAdmin\('task_start'/);assert.match(client,/doAdmin\('claim'/);
});

test('existing game and admin page JS remains valid',()=>{
  new Script(client);
  for(const page of ['admin/index.html','quests/index.html']){
    const s=read(page);
    for(const [,code] of s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Script(code);
    assert.match(s,/simab-central-quests\.js\?v=(?:7|20261025|10|11|16|17)/);
    assert.match(s,/simab-wallet-client\.js\?v=\d+/);
  }
  new Script(stripTypeScriptTypes(edge).replace(/^import .*?\n/gm,''));
});
