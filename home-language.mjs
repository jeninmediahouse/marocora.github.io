import {resolveLocale,changeLocale,applyLocale,sharedCopy} from './learn/locale.mjs';
import {homeCopy} from './home-copy.mjs?v=20260928-site1';
const params=new URLSearchParams(location.search);
let locale=resolveLocale(location.search);
const normalize=text=>text.replace(/\s+/g,' ').trim();
const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
const translated=[];
while(walker.nextNode()) {
 const n=walker.currentNode;
 if(n.parentElement.closest('script,style,select,.language-item span'))continue;
 const key=normalize(n.textContent);
 if(homeCopy[key])translated.push({node:n,key});
}
const links=[...document.querySelectorAll('a[href]')].map(node=>({node,href:node.getAttribute('href')}));
function render(){
 applyLocale(locale);
 for(const {node,key} of translated)node.textContent=homeCopy[key][locale];
 document.querySelector('#locale').value=locale;
 document.querySelector('#locale').setAttribute('aria-label',sharedCopy[locale].language);
 document.querySelector('#language-label').textContent=sharedCopy[locale].language;
 for(const {node,href} of links){const u=new URL(href,location.href);if(u.origin===location.origin){u.searchParams.set('lang',locale);node.href=u.pathname+u.search+u.hash;}}
 document.title={en:'Marocora — Services in Morocco',fr:'Marocora — Services au Maroc',ar:'ماروكورا — خدمات في المغرب',es:'Marocora — Servicios en Marruecos'}[locale];
}
document.querySelector('#locale').onchange=event=>{locale=changeLocale(event.target.value,params);render();};
render();
