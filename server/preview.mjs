import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, relative, resolve, sep } from 'node:path';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end(); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  const filePath = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const target = resolve(root, `.${filePath}`);
  const relativePath = relative(root, target);
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`) ||
      relativePath.split(sep).some(part => part.startsWith('.')) ||
      pathname.startsWith('/server/') || pathname.startsWith('/tests/') ||
      pathname.startsWith('/docs/') || pathname === '/package.json') {
    response.writeHead(404).end(); return;
  }
  try {
    if (!(await stat(target)).isFile()) throw new Error('NOT_FOUND');
    const data = await readFile(target);
    response.writeHead(200, { 'Content-Type': `${types[extname(target).toLowerCase()] || 'application/octet-stream'}; charset=utf-8`,
      'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => {
  console.log(`Marocora preview: http://127.0.0.1:${port}/learn/`);
});
