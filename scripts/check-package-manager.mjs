import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function requirePnpm(){
 if(!/^pnpm\//.test(process.env.npm_config_user_agent||''))throw Error('PNPM_REQUIRED: use pnpm install, pnpm test, or pnpm run build:pages.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))requirePnpm();
