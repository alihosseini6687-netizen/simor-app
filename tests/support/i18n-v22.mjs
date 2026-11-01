import {readSource} from './source.mjs';
// Exercise exactly the ordered production resources, not a hand-maintained subset.
const loader=readSource(new URL('../../assets/js/simab-i18n-v16.js',import.meta.url));
export const localeFiles=[...loader.match(/for\(const name of \[([^\]]+)\]/)[1].matchAll(/'([^']+\.js)'/g)].map(match=>match[1]);
export const localeSources=localeFiles.map(file=>readSource(new URL('../../assets/js/i18n/'+file,import.meta.url)));
