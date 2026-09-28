// Interface preferences are independent from subjects taught by instructors.
export const locales = ['en','ar','fr','es'];
export const localeNames = {en:'English',ar:'العربية',fr:'Français',es:'Español'};
export const normalizeLocale = value => locales.includes(value) ? value : 'en';
export function resolveLocale(search='',storage) {
 const requested=new URLSearchParams(search).get('lang');
 if(locales.includes(requested))return requested;
 try{return normalizeLocale((storage ?? globalThis.localStorage)?.getItem('marocora.locale'));}catch{return 'en';}
}
export function applyLocale(value,doc=globalThis.document,storage) {
 const locale=normalizeLocale(value);
 if(doc){doc.documentElement.lang=locale;doc.documentElement.dir=locale==='ar'?'rtl':'ltr';}
 try{(storage ?? globalThis.localStorage)?.setItem('marocora.locale',locale);}catch{}
 return locale;
}
export function changeLocale(value,params) {
 const locale=applyLocale(value);params.set('lang',locale);
 history.replaceState(null,'',`${location.pathname}?${params}${location.hash}`);
 return locale;
}
// Keep unsaved fields in memory while translating; never persist private form values.
export function captureFields(root) {
 return {fields:[...root.querySelectorAll('input,select,textarea')].map(n=>({id:n.id,name:n.name,value:n.value,checked:n.checked,type:n.type})),details:[...root.querySelectorAll('details')].map(n=>n.open)};
}
export function restoreFields(root,state) {
 const nodes=[...root.querySelectorAll('input,select,textarea')];
 state.fields.forEach((v,i)=>{const n=nodes[i];if(!n||n.id!==v.id||n.name!==v.name||n.type!==v.type)return;n.value=v.value;if(v.type==='checkbox'||v.type==='radio')n.checked=v.checked;});
 [...root.querySelectorAll('details')].forEach((n,i)=>{if(i<state.details.length)n.open=state.details[i];});
}
export const sharedCopy={
 en:{brand:'Marocora Learning',language:'Language',lessons:'lessons',minutes:'minutes',online:'online','in-person':'in person',both:'online or in person',statedExperience:'years of stated experience',published:'Published',hidden:'Hidden',feedbackError:'Could not load staff feedback. Refresh the page.',consent:'I agree that Marocora may publish my display name, introduction, residence, qualifications, languages, media links and approved offerings. My email and private review feedback will not be published.',schedule:'My availability and lesson requests'},
 fr:{brand:'Marocora Apprentissage',language:'Langue',lessons:'cours',minutes:'minutes',online:'en ligne','in-person':'en personne',both:'en ligne ou en personne',statedExperience:'ans d’expérience déclarés',published:'Publié',hidden:'Masqué',feedbackError:'Impossible de charger les commentaires de l’équipe. Actualisez la page.',consent:'J’autorise Marocora à publier mon nom public, ma présentation, ma résidence, mes qualifications, mes langues, mes liens média et les offres approuvées. Mon adresse e-mail et les commentaires privés ne seront pas publiés.',schedule:'Mes disponibilités et demandes de cours'},
 ar:{brand:'ماروكورا للتعلم',language:'لغة الموقع',lessons:'دروس',minutes:'دقيقة',online:'عبر الإنترنت','in-person':'حضوري',both:'عبر الإنترنت أو حضوري',statedExperience:'سنوات خبرة معلنة',published:'منشور',hidden:'مخفي',feedbackError:'تعذر تحميل ملاحظات الفريق. حدث الصفحة.',consent:'أوافق على نشر ماروكورا لاسمي العام وتعريفي وإقامتي ومؤهلاتي ولغاتي وروابط الوسائط والعروض المعتمدة. لن ينشر بريدي الإلكتروني أو ملاحظات المراجعة الخاصة.',schedule:'مواعيدي وطلبات الدروس'},
 es:{brand:'Marocora Aprendizaje',language:'Idioma',lessons:'clases',minutes:'minutos',online:'en línea','in-person':'presencial',both:'en línea o presencial',statedExperience:'años de experiencia declarada',published:'Publicado',hidden:'Oculto',feedbackError:'No se pudieron cargar los comentarios del equipo. Actualiza la página.',consent:'Autorizo a Marocora a publicar mi nombre público, presentación, residencia, cualificaciones, idiomas, enlaces multimedia y ofertas aprobadas. No se publicarán mi correo ni los comentarios privados de revisión.',schedule:'Mi disponibilidad y solicitudes de clases'}
};
export function translateHeader(locale) {
 const brand=document.querySelector('header .brand');if(brand && brand.textContent!=='Marocora')brand.textContent=sharedCopy[locale].brand;
 const select=document.querySelector('#locale');if(select)select.setAttribute('aria-label',sharedCopy[locale].language);
 for(const n of document.querySelectorAll('header .sr-only'))n.textContent=sharedCopy[locale].language;
 for(const a of document.querySelectorAll('header a')){const u=new URL(a.href,location.href);if(u.origin===location.origin){u.searchParams.set('lang',locale);a.href=u.pathname+u.search+u.hash;}}
 for(const n of document.querySelectorAll('input[type=email],input[type=url],input[type=datetime-local],input[type=number],input[name=timezone],#timezone'))n.dir='ltr';
}
