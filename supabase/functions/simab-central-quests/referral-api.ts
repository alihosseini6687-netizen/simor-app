// Only Telegram-signed callers reach this API. Never credit a coin based on a URL.
const validCode=(s:any)=>typeof s==='string'&&/^[a-f0-9]{32}$/.test(s);
export async function referralAPI(db:any,subject:string,p:any){
 const name=p.action==='referral_info'?'simab_referral_link':'simab_referral_claim';
 if(name==='simab_referral_claim'&&!validCode(p.code))return{status:400,data:{error:'invalid_referral'}};
 const {data,error}=await db.rpc(name,name==='simab_referral_claim'?{p_subject:subject,p_code:p.code}:{p_subject:subject});
 if(error){
  const known=['invalid_referral','self_referral','referrals_disabled','existing_account','referral_daily_limit','wallet_limit'];
  return{status:known.includes(error.message)?409:503,data:{error:known.includes(error.message)?error.message:'referral_unavailable'}};
 }
 return{status:200,data};
}
