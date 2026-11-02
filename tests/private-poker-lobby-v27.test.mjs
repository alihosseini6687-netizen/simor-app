import test from 'node:test';
import assert from 'node:assert/strict';
import {uiHarness} from './support/ui-harness.mjs';

const invite='ABCDEFGHJK';
function fixture(start='?code='+invite){
 const redirects=[];
 const ui=uiHarness('assets/js/simab-private-poker-v14.js','paint,load,createJoin,showInvitePreview',{
  globals:{location:{search:start},history:{replaceState:(_a,_b,url)=>redirects.push(url)}},
  setupDOM:({$,document})=>{
   const tile=document.createElement('section');tile.className='room-call';
   $('poker-lobby').append(tile);
  }
 });
 let transactions=0;
 ui.wallet.mutate=async()=>{transactions++;throw Error('unexpected wallet mutation')};
 return {...ui,redirects,get transactions(){return transactions;}};
}
const failure=code=>Object.assign(Error(code),{code});

test('friend opening signed Poker invite sees authorized preview, not room_forbidden',async()=>{
 const h=fixture();
 h.wallet.read=async(action,payload)=>{
  assert.equal(action,'room');
  if(payload.op==='state')throw failure('room_forbidden');
  return{preview:{code:invite,buyIn:100,status:'waiting',count:1,maxPlayers:4}};
 };
 await h.api.load();
 assert.match(h.$('lobby-status').textContent,/دعوت پوکر/);
 assert.match(h.$('lobby-status').textContent,/۱|1/);
 assert.equal(h.$('join-code').value,invite);
 assert.equal(h.transactions,0);
});

test('Poker guest cannot submit a financial join when a preview is full or already playing',async()=>{
 for(const preview of [
  {code:invite,buyIn:100,status:'waiting',count:4,maxPlayers:4},
  {code:invite,buyIn:100,status:'playing',count:2,maxPlayers:4},
  {code:invite,buyIn:100,status:'finished',count:4,maxPlayers:4}
 ]){
  const h=fixture('?code='+invite);h.$('join-code').value=invite;
  h.wallet.read=async()=>({preview});
  await h.api.createJoin('join');
  assert.equal(h.transactions,0);
  assert.match(h.$('lobby-status').textContent,/میز پُر است|باز نیست/);
 }
});

test('Poker invitation for Hokm is an explicit, non-destructive link to the right game',async()=>{
 const h=fixture();
 h.wallet.read=async(action,payload)=>{
  if(action==='room'&&payload.op==='state')throw failure('wrong_room_type');
  if(action==='game_room'&&payload.op==='preview')return{preview:{game:'hokm'}};
  throw Error('unexpected request');
 };
 await h.api.load();
 const box=h.$('existing-previous-table');
 const links=box.children.filter(x=>x.tagName==='A');
 assert.equal(links.length,1);
 assert.equal(links[0].href,'../room/index.html?game=hokm&code='+invite);
 assert.equal(box.children.filter(x=>x.tagName==='BUTTON').length,0);
 assert.equal(h.transactions,0);
});

test('unavailable Poker invite clears stale URL and allows new room creation',async()=>{
 const h=fixture();
 h.wallet.read=async()=>{throw failure('room_not_found')};
 await h.api.load();
 assert.ok(h.redirects.includes('friends.html'));
 assert.match(h.$('lobby-status').textContent,/میز پیدا نشد|کد دعوت یافت نشد/);
 assert.equal(h.$('create-room').disabled,false);
 assert.equal(h.transactions,0);
});

test('new Poker room writes a durable resume code and ignores stale polling responses',()=>{
 const h=fixture('');
 const room=(version,buyIn=100)=>({version,room:{code:invite,viewer:0,host:true,status:'waiting',maxPlayers:4,buyIn,members:[{subject:'123',name:'host',emoji:'👤'}],signals:[],messages:[]}});
 h.api.paint(room(4));
 assert.ok(h.redirects.includes('?code='+invite));
 assert.equal(h.$('poker-start').disabled,true,'host must wait for at least a second Poker player');
 h.api.paint(room(3,300));
 assert.equal(h.$('buy-in').value,100,'an old poll must not roll back a newer room version');
 h.api.paint({...room(5),room:{...room(5).room,members:[{subject:'123',name:'host',emoji:'👤'},{subject:'456',name:'guest',emoji:'🙂'}]}});
 assert.equal(h.$('poker-start').disabled,false);
 assert.equal(h.transactions,0);
});

test('malformed invite cannot be previewed or charged',async()=>{
 const h=fixture('?code=javascript:alert(1)');
 h.$('join-code').value='%%%';
 h.wallet.read=async()=>{throw Error('unexpected read')};
 await h.api.createJoin('join');
 assert.equal(h.transactions,0);
 assert.match(h.$('lobby-status').textContent,/معتبر|not_found|unexpected read/);
});

test('finished Poker room reports actual server settlement rather than claiming everyone got buy-in back',()=>{
 const h=fixture('');
 h.api.paint({version:5,room:{code:invite,viewer:0,host:true,status:'finished',buyIn:100,maxPlayers:2,members:[{subject:'1',name:'host',emoji:'👤'},{subject:'2',name:'friend',emoji:'🙂'}],signals:[],messages:[]}});
 assert.match(h.$('room-note').textContent,/طبق نتیجهٔ سروری تسویه شد/);
 assert.doesNotMatch(h.$('room-note').textContent,/هر نفر به کیف پول خودش برگشت/);
});
