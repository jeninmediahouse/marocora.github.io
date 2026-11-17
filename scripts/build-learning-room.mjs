import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {requirePnpm} from './check-package-manager.mjs';
requirePnpm();mkdirSync('.learning-room-assets',{recursive:true});
await build({entryPoints:['learn/live-learning-room.mjs'],outfile:'.learning-room-assets/live-learning-room.mjs',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
console.log('LiveKit browser adapter bundled; no server SDK or environment values included.');
