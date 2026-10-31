/* Offline packaging only. Requires an exported v14 source tree; never contacts
 * Supabase, deploys, copies secrets or includes/applies SQL migrations.
 * Usage: node scripts/prepare-sevens-backend-bridge-v22.mjs --baseline=DIR --out=NEW_DIR
 */
import {cpSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>process.argv.slice(2).find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3);
if(!arg('baseline')||!arg('out'))throw Error('Specify --baseline and a new --out directory.');
const baseline=resolve(arg('baseline')),out=resolve(arg('out'));
if(out===baseline||out.startsWith(baseline+sep)||out===repo||out.startsWith(repo+sep)||existsSync(out))throw Error('Output must be a new external directory, outside baseline/repository.');
const sub='supabase/functions/simab-central-quests',source=resolve(baseline,sub),current=resolve(repo,sub);
const read=file=>readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const line=(text,prefix)=>{const hits=text.split('\n').filter(l=>l.trimStart().startsWith(prefix));if(hits.length!==1)throw Error('Expected unique source line: '+prefix);return hits[0];};
const replace=(text,needle,value)=>{if(text.split(needle).length!==2)throw Error('Baseline shape differs: '+needle.slice(0,90));return text.replace(needle,value);};
const replaceLine=(text,prefix,value)=>replace(text,line(text,prefix),value);
const gameNow=read(resolve(current,'party-games.ts')),apiNow=read(resolve(current,'party-api.ts'));
let games=read(resolve(source,'party-games.ts')),api=read(resolve(source,'party-api.ts'));
if(/sevensRulesVersion/.test(games+api))throw Error('Expected unversioned v14 source, not an already upgraded backend.');
const validator=gameNow.slice(gameNow.indexOf('function validateSevens('),gameNow.indexOf('export function stepParty('));
if(!validator.startsWith('function validateSevens('))throw Error('Missing canonical validator.');
games=replace(games,'export function startParty(',line(gameNow,'export function sevensRulesVersion(')+'\nexport function startParty(');
games=replaceLine(games,"if(kind==='sevens')",line(gameNow,"if(kind==='sevens')"));
games=replace(games,'export function stepParty(',validator+'export function stepParty(');
games=replace(games,"s.lastEvent='move';","const gifts=s.kind==='sevens'?validateSevens(s,i,m):[];s.lastEvent='move';");
games=replaceLine(games,"else if(s.kind==='sevens'){if(m.type===",line(gameNow,"else if(s.kind==='sevens'){if(m.type==="));
games=replaceLine(games,"if(s.kind==='sevens'){p.hand",line(gameNow,"if(s.kind==='sevens'){p.sevensRulesVersion"));
api=replace(api,'publicParty,gameSizes}', 'publicParty,gameSizes,sevensRulesVersion}');
api=replace(api,'export async function partyAPI(',line(apiNow,'const roomSevensRules=')+'\nexport async function partyAPI(');
const entry=line(api,'export async function partyAPI(');
api=replace(api,entry,entry+'\n'+line(apiNow,"if(p.op==='capabilities')"));
api=replaceLine(api,'const signature=JSON.stringify(',line(apiNow,'const signature=JSON.stringify('));
api=replaceLine(api,"if(op==='create')",line(apiNow,"if(op==='create')"));
api=replaceLine(api,"if(op==='preview')",line(apiNow,'const sevensRules=')+'\n'+line(apiNow,"if(op==='preview')")+'\n'+line(apiNow,"if(sevensRules?.sevensRulesVersion===2"));
api=replaceLine(api,"if(op==='start')",line(apiNow,"if(op==='start')"));
api=replace(api,'iceServers},state:',"iceServers,...(s.gameKind==='sevens'?{sevensRules:roomSevensRules(s)}:{})},state:");
api=replace(api,"'invalid_gift'];","'invalid_gift','sevens_upgrade_required'];");
// All transformation guards pass before any output is written. Only two source
// files change; existing JWT configuration and every other dependency are copied.
mkdirSync(out,{recursive:false});mkdirSync(resolve(out,'supabase/functions'),{recursive:true});
cpSync(source,resolve(out,sub),{recursive:true,filter:f=>!/(?:^|[\\/])\.[^\\/]+/.test(relative(source,f))});
cpSync(resolve(baseline,'supabase/config.toml'),resolve(out,'supabase/config.toml'));
writeFileSync(resolve(out,sub,'party-games.ts'),games);writeFileSync(resolve(out,sub,'party-api.ts'),api);
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const files=[];function visit(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const f=resolve(dir,e.name);if(e.isDirectory())visit(f);else files.push(f);}}visit(resolve(out,'supabase'));
const manifest=files.map(f=>{const rel=relative(out,f).replaceAll('\\','/'),old=resolve(baseline,rel);return{path:rel,baselineSha256:sha(old),candidateSha256:sha(f)};});
const changed=manifest.filter(f=>f.baselineSha256!==f.candidateSha256).map(f=>f.path).sort();
if(JSON.stringify(changed)!==JSON.stringify([sub+'/party-api.ts',sub+'/party-games.ts']))throw Error('Unexpected changed bridge dependency. Do not deploy.');
const unresolved=[];for(const file of files.filter(f=>f.endsWith('.ts')))for(const match of read(file).matchAll(/from\s+['"](\.[^'"]+)['"]/g))if(!existsSync(resolve(dirname(file),match[1])))unresolved.push({file,import:match[1]});
if(unresolved.length)throw Error('Missing baseline dependencies: '+JSON.stringify(unresolved));
writeFileSync(resolve(out,'BRIDGE_MANIFEST.json'),JSON.stringify({scope:'Offline bridge candidate, not deployed. Baseline must be the authenticated v14 export.',changed,unresolvedImports:unresolved,files:manifest},null,2)+'\n');
console.log(JSON.stringify({out,changed,dependencyFiles:files.length,unresolvedImports:unresolved.length,jwtConfigurationUnchanged:true,migrationsIncluded:false},null,2));
