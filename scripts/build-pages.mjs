import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { extname, join } from 'node:path';

const root = process.cwd();
const output = join(root, '.pages-dist');
const publicExtensions = new Set(['.html', '.js', '.mjs', '.css', '.jpg', '.jpeg', '.png', '.webp', '.svg', '.ico']);
const namedFiles = new Set(['CNAME', 'robots.txt', 'sitemap.xml']);
const allowed = name => namedFiles.has(name) || publicExtensions.has(extname(name).toLowerCase());
rmSync(output, { recursive: true, force: true });
mkdirSync(output);
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && allowed(entry.name)) cpSync(join(root, entry.name), join(output, entry.name));
}
const learning = join(root, 'learn');
if (existsSync(learning)) {
  mkdirSync(join(output, 'learn'));
  for (const entry of readdirSync(learning, { withFileTypes: true })) {
    if (entry.isFile() && allowed(entry.name)) cpSync(join(learning, entry.name), join(output, 'learn', entry.name));
  }
}
console.log(`Pages artifact ready: ${output}`);
