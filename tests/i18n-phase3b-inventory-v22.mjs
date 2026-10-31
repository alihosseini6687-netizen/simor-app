import {writeFile} from 'node:fs/promises';
import {localeContext,legacyClassification,sourceCandidates} from './support/i18n-inventory-v22.mjs';

const x=localeContext(),legacy=legacyClassification(),candidates=sourceCandidates();
const unmapped=candidates.filter(row=>!x.SimabI18n.sourceKey(row.source));
const result={
 scope:'Static source candidates, not rendered occurrences or confirmed omissions. Includes prompt-bank originals, fragments, numeric strings, redirects, technical text and dormant states. Runtime coverage is separate.',
 coverage:x.SimabI18n.coverage(),
 summary:{legacyEntries:Object.keys(x.SimabLegacyI18n.inventory()).length,originalMissingUnique:legacy.length,originalMissingOccurrences:legacy.reduce((sum,row)=>sum+row.occurrences,0),retainedCompatibilityOnly:legacy.filter(row=>!row.occurrences).length,candidateStrings:candidates.length,unmappedCandidates:unmapped.length},
 original234:legacy,unmappedCandidates:unmapped
};
await writeFile(new URL('../docs/SIMAB_V22_PHASE3B_I18N_INVENTORY.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.summary,null,2));
