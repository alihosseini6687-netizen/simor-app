// Optional coturn-compatible REST credentials. Secrets remain server-only.
// No configuration means the existing STUN-only behavior.
export async function roomIceServers(env=(key:string)=>typeof Deno==='undefined'?undefined:Deno.env.get(key),now=Date.now()) {
 const stun={urls:'stun:stun.l.google.com:19302'};
 const raw=env('SIMAB_TURN_URLS'),secret=env('SIMAB_TURN_SECRET');
 if(!raw||!secret||secret.length<32||secret.length>2048)return [stun];
 const urls=raw.split(',').map(s=>s.trim());
 if(urls.length>4||!urls.every(url=>{
  const match=/^turns?:([a-z0-9.-]+):(\d{1,5})(?:\?transport=(udp|tcp))?$/i.exec(url);
  return !!match&&Number(match[2])>0&&Number(match[2])<=65535;
 }))return [stun];
 const expires=Math.floor(now/1000)+600;
 const username=expires+':simab:'+crypto.randomUUID();
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(username));
 const credential=btoa(String.fromCharCode(...new Uint8Array(signature)));
 return [stun,{urls,username,credential}];
}
