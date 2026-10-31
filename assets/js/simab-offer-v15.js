(()=>{'use strict';const $=id=>document.getElementById(id),code=new URLSearchParams(location.search).get('code')||'';let displayedOffer=null;
const label=(el,id,fallback,values={})=>window.SimabI18n?.bind?SimabI18n.bind(el,id,values):(el.textContent=fallback);
function paint(o){
 displayedOffer=o;
 for(const [id,text] of [['offer-name',o.title],['offer-text',o.message]]){const el=$(id);el.dataset.userContent='true';delete el.dataset.i18n;el.textContent=text;}
 $('offer-amount').textContent=Number(o.reward).toLocaleString(window.SimabI18n?.locale||'en-US');
 const date=new Date(o.expires_at).toLocaleString(window.SimabI18n?.locale||'en-US'),number=Math.max(0,o.max_claims-o.claims).toLocaleString(window.SimabI18n?.locale||'en-US');
 label($('offer-info'),'offer.info','تا '+date+' • ظرفیت باقی‌مانده '+number+' نفر',{date,number});
 $('offer-claim').disabled=o.reward===0||new Date(o.expires_at)<=new Date()||o.claims>=o.max_claims;
}
async function load(){try{const r=await SimabWallet.read('offer_info',{code});paint(r.offer);}catch(e){displayedOffer=null;delete $('offer-name').dataset.userContent;label($('offer-name'),'offer.unavailable','آفر در دسترس نیست');$('offer-result').textContent=e.message;}}
$('offer-claim').onclick=async()=>{$('offer-claim').disabled=true;try{const r=await SimabWallet.mutate('offer_claim',{code});label($('offer-result'),r.granted?'offer.granted':'offer.already',r.granted?'هدیه به کیف پولت اضافه شد.':'این هدیه را قبلاً دریافت کرده‌ای.');label($('offer-claim'),'offer.received','✓ دریافت شد');}catch(e){$('offer-result').textContent=e.message;}};
addEventListener('simab-language-ready',()=>{if(displayedOffer){const disabled=$('offer-claim').disabled;paint(displayedOffer);$('offer-claim').disabled=disabled;}});SimabWallet.ready.then(load);
})();
