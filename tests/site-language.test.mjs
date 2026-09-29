import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {siteCopy} from '../site-copy.mjs';
import {homeCopy} from '../home-copy.mjs';
import {extraCopy} from '../site-extra-copy.mjs';
import {siteUI} from '../site-ui-copy.mjs';
import {translationCopy} from '../translation-copy.mjs';
const copy={...homeCopy,...siteCopy,...extraCopy,...translationCopy};
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
const excluded=new Set(['index.html','teacher-apply.html','staff-review.html']);
test('all authored visitor text, page titles and form hints have four language versions',()=>{
 for(const file of readdirSync('.').filter(n=>n.endsWith('.html')&&!excluded.has(n))){
  const source=readFileSync(file,'utf8');assert.match(source,/src="site-language\.mjs/);
  const authored=source.replace(/<(script|style|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
  const strings=authored.split(/<[^>]*>/g).map(decode).filter(s=>/[A-Za-z]/.test(s));
  for(const match of authored.matchAll(/(?:placeholder|aria-label|alt)="([^"]+)"/g))strings.push(decode(match[1]));
  for(const text of strings){assert.ok(copy[text],file+': missing '+text);for(const lang of ['en','ar','fr','es'])assert.ok(copy[text][lang]?.trim(),file+': '+lang+' missing '+text);}
 }
 for(const lang of ['en','ar','fr','es'])for(const key of Object.keys(siteUI.en))assert.ok(siteUI[lang][key]);
});
test('home service links resolve to existing pages and translated search categories',()=>{
 const home=readFileSync('index.html','utf8'),directory=readFileSync('professionals.html','utf8');
 const categories=[...directory.matchAll(/data-service-title="([^"]+)"/g)].map(m=>decode(m[1]));
 for(const match of home.matchAll(/href="([^"]+)"/g)){
  const url=new URL(decode(match[1]),'https://marocora.com/');if(url.origin!=='https://marocora.com'||url.pathname==='/')continue;
  if(url.pathname.endsWith('.html'))assert.ok(existsSync('.'+url.pathname),url.pathname+' must exist');
  if(url.searchParams.has('service'))assert.ok(categories.includes(url.searchParams.get('service')),url.href);
 }
 for(const category of categories)for(const lang of ['en','ar','fr','es'])assert.ok(copy[category][lang]);
});
