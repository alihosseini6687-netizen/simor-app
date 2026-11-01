import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('./fixtures/independent-release-protected-v22.json',import.meta.url),'utf8'));
const sha=text=>createHash('sha256').update(text).digest('hex');
const homeCSS='<link rel="stylesheet" href="assets/css/simab-phase3-v22.css?v=20261101">';
const roomCSS='<link rel="stylesheet" href="../../assets/css/simab-phase3-v22.css?v=20261101"><link rel="stylesheet" href="../../assets/css/simab-phase4-v22.css?v=20261101">';
test('preserve original protected code while allowing exact reviewed UI/i18n modifications',()=>{
 for(const [file,expected] of Object.entries(manifest.hashes)){
  let source=readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/\r\n/g,'\n');
  if(file==='assets/js/simab-i18n-v16.js'){
   assert.equal(sha(source),'6ec31198b96b6719f6bf35846449b9488dee15ed2d096878303a1fed2ab463be',file);
   continue;
  }
  if(file==='assets/js/simab-party-v16.js'){
   // Only these three audited invite-flow edits are permitted over the v22 baseline.
   const changes=[["code=r.room.code;if(!practice&&new URLSearchParams(location.search).get('code')!==code)history.replaceState(null,'','?game='+encodeURIComponent(kind)+'&code='+encodeURIComponent(code));offset=","code=r.room.code;offset="],["$('start').disabled=busy||!!SimabWallet.pending||!r||!r.host||r.status!=='waiting'||r.members.length!==requiredPlayers(r);","$('start').disabled=busy||!!SimabWallet.pending||!r||r.members.length<min;"],["$('copy').onclick=async()=>{try{if(!navigator.clipboard?.writeText)throw Error('clipboard_unavailable');await navigator.clipboard.writeText(code);$('status').textContent='کد کپی شد.';}catch{$('status').textContent='کد دعوت: '+code;}};","$('copy').onclick=()=>navigator.clipboard?.writeText(code).then(()=>{$('status').textContent='کد کپی شد.';}).catch(()=>{$('status').textContent=code;});"]];
   for(const [current,baseline] of changes){
    assert.equal(source.split(current).length-1,1,'exactly one approved invite change');
    source=source.replace(current,baseline);
   }
   // v24: preserve the protected game engine; only truthful die presentation changes.
   const diceVisualChanges=[["decorateDice(s.kind==='ludo'?s.table.die:s.kind==='truth'&&s.mode==='bottle'?null:s.die);","decorateDice(s.kind==='ludo'?s.table.die:s.die||1);"],["function decorateDice(value){const valid=Number.isInteger(value)&&value>=1&&value<=6,patterns={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};document.querySelectorAll('.dice3d').forEach(b=>{b.replaceChildren();b.dataset.unrolled=valid?'false':'true';b.setAttribute('aria-label',valid?'نتیجهٔ تاس: '+fmt(value):'هنوز تاس انداخته نشده');if(!valid){b.append(node('span','dice-unrolled','?'));return;}const cube=node('span','dice-cube');const rotation={1:[-22,28],2:[-22,-62],3:[-112,28],4:[68,28],5:[-22,118],6:[-22,208]}[value];cube.style.transform='rotateX('+rotation[0]+'deg) rotateY('+rotation[1]+'deg)';[1,2,6,5,3,4].forEach(v=>{const face=node('span','die-face');for(let i=0;i<9;i++){const dot=node(patterns[v].includes(i)?'i':'span');face.append(dot);}cube.append(face);});b.append(cube);});}","function decorateDice(value){const patterns={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};document.querySelectorAll('.dice3d').forEach(b=>{b.replaceChildren();b.setAttribute('aria-label','تاس '+fmt(value||1));const cube=node('span','dice-cube');const rotation={1:[-22,28],2:[-22,-62],3:[-112,28],4:[68,28],5:[-22,118],6:[-22,208]}[value||1];cube.style.transform='rotateX('+rotation[0]+'deg) rotateY('+rotation[1]+'deg)';[1,2,6,5,3,4].forEach(v=>{const face=node('span','die-face');for(let i=0;i<9;i++){const dot=node(patterns[v].includes(i)?'i':'span');face.append(dot);}cube.append(face);});b.append(cube);});}"]];
   for(const [current,baseline] of diceVisualChanges){
    assert.equal(source.split(current).length-1,1,'one approved die display change');
    source=source.replace(current,baseline);
   }
  }
  if(file==='index.html'){
   // Permit only the two extra Telegram deep-link fallbacks.
   const newRoute="window.Telegram?.WebApp?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||new URLSearchParams(location.search).get('startapp')||new URLSearchParams(location.search).get('start')||''",oldRoute="window.Telegram?.WebApp?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||''";
   assert.equal(source.split(newRoute).length-1,1,'approved invite routing fallback');
   source=source.replace(newRoute,oldRoute);
   // Both exact link-only UI CSS release and the new language-loader cache key are approved.
   if(source.includes(homeCSS)){
    assert.equal(source.split(homeCSS).length-1,1,'only one home Phase3 link');
    source=source.replace(homeCSS,'');
   }
   const changed='assets/js/simab-i18n-v16.js?v=20261101';
   assert.equal(source.split(changed).length-1,1,'only one localized loader cache key');
   source=source.replace(changed,'assets/js/simab-i18n-v16.js?v=20');
  }
  if(file==='games/room/index.html'&&source.includes(roomCSS)){
   assert.equal(source.split(roomCSS).length-1,1,'only one shared-room Phase3/4 link pair');
   source=source.replace(roomCSS,'');
  }
  assert.equal(sha(source),expected,file);
 }
});
