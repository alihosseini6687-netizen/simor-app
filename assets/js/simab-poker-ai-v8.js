/* AI decision model for local practice Texas Hold'em. Not server-authoritative.
 * Different personalities, pot odds and hole-card strength; NEVER hardcode the same all-in.
 * Pure decision function for Node regression tests and on-device code.
 */
(function(root){
"use strict";
const profiles={
 bot1:{name:"مسعود",style:"tight",aggression:.18,opening:76},
 bot2:{name:"سارا",style:"balanced",aggression:.35,opening:62},
 bot3:{name:"آریا",style:"thoughtful",aggression:.26,opening:105},
 bot4:{name:"نیما",style:"aggressive",aggression:.57,opening:92},
 bot5:{name:"رضا",style:"loose",aggression:.41,opening:84},
};
function clamp(n,lo,hi){return Math.max(lo,Math.min(hi,n))}
function holeStrength(cards){
 if(!Array.isArray(cards)||cards.length<2)return .28;
 const a=cards[0],b=cards[1],v1=Number(a.val||a.v||2),v2=Number(b.val||b.v||2);
 const paired=v1===v2,high=Math.max(v1,v2),low=Math.min(v1,v2);
 return clamp((paired?.53+high/44:high/24+low/65)+
   (a.suit===b.suit?.085:0)+(Math.abs(v1-v2)<=2?.065:0)-
   (low<7&&!paired?.08:0),.06,.96);
}
function choose(opts){
 const bot=profiles[opts.id]||profiles.bot3,level=opts.difficulty||"medium";
 const r=clamp(Number(opts.rand),0,0.999999),toCall=Math.max(0,Math.floor(opts.toCall||0));
 const stack=Math.max(0,Math.floor(opts.stack||0)),pot=Math.max(1,Math.floor(opts.pot||1));
 const strength=clamp(Number(opts.strength||.35),0,1);
 const adjustment=level==="easy"?-.17:level==="hard"?.1:0;
 const confidence=clamp(strength+adjustment+(bot.aggression-.3)*.25,0,1);
 const odds=toCall/(pot+toCall),pressure=toCall/Math.max(stack+toCall,1);
 if(!stack)return {type:"check",amount:0};
 if(toCall>0&&(confidence+(.22-r*.30)<odds*.95+pressure*.45)){
   return {type:"fold",amount:0};
 }
 const raiseChance=clamp((confidence-.49)*.67+bot.aggression*.33+
   (level==="hard"?.07:level==="easy"?-.11:0),.015,.58);
 const canRaise=stack>toCall+1 && confidence>.39;
 if(canRaise&&r<raiseChance){
   const variance=.7+((r*13)%1)*1.2;
   const target=Math.max(1,Math.round((2+Math.max(0,confidence-.4)*13)*
     variance*(bot.style==="aggressive"?1.5:bot.style==="tight"?.65:1)));
   const maxRisk=level==="easy"?.22:level==="hard"?.45:.33;
   const riskCap=Math.max(1,Math.floor(stack*maxRisk));
   const amount=Math.min(target,riskCap,stack-toCall);
   if(amount>=1)return {type:"raise",amount};
 }
 if(toCall>0)return {type:"call",amount:Math.min(toCall,stack)};
 return {type:"check",amount:0};
}
root.SimabPokerAI=Object.freeze({profiles,holeStrength,choose});
})(typeof window!=="undefined"?window:globalThis);
