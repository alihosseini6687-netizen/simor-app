import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const projectRoot=fileURLToPath(new URL('../../',import.meta.url));
export const normalizeSource=source=>source.replace(/\r\n/g,'\n');
export const readSource=url=>normalizeSource(readFileSync(url,'utf8'));
// The Edge entry point has single-line static imports. Handle LF, CRLF and EOF.
export const stripImports=source=>normalizeSource(source).replace(/^import [^\n]*(?:\n|$)/gm,'');
