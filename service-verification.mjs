import { instructorStore } from './learn/instructor-store.mjs';
import { config } from './learn/config.mjs';

export const verificationCopy={
 en:{title:'Verify your email before sending',note:'Clients and providers must verify their email before Marocora starts work or reviews an application. A secure email link creates or signs you into your Marocora account. No password or phone verification is required.',send:'Send verification email',sent:'Check your inbox and spam folder. Open the secure link, then return to this form and send your request. Your details remain in this tab.',verified:'Email verified. You can now send this request.',wrong:'Verify the email address entered in this form, or use the address already verified in your account.',error:'We could not send the verification email. Check the address and try again later.',limit:'Too many requests. Please wait before trying again.',pending:'Your verified request is recorded. Email notification delivery is pending; do not send another copy.',receipt:'Request reference',callback:'Your email is verified',callbackNote:'Return to your original form tab and send your request. Verification alone does not submit a form, approve a provider or confirm a booking.',invalid:'The verification link is invalid or expired. Return to your form and request a new email.',back:'Return to the service form',signin:'Check verification',review:'Verified service requests',staff:'Sign in with your authorised staff account to view the private queue.',refresh:'Refresh',start:'Start review / work',close:'Close request',empty:'No verified service requests yet.',delivery:'Notification delivery',work:'Work status',policy:'Only requests recorded in this private queue have server-confirmed email verification. Text or a verification flag in a Formspree email is not proof.'},
 fr:{title:'Vérifiez votre e-mail avant l’envoi',note:'Clients et prestataires doivent vérifier leur e-mail avant le début du travail ou l’examen d’une candidature. Un lien sécurisé crée votre compte Marocora ou vous y connecte. Aucun mot de passe ni contrôle du téléphone n’est requis.',send:'Envoyer l’e-mail de vérification',sent:'Consultez votre boîte de réception et vos indésirables. Ouvrez le lien sécurisé, puis revenez à ce formulaire pour envoyer votre demande. Vos informations restent dans cet onglet.',verified:'E-mail vérifié. Vous pouvez envoyer cette demande.',wrong:'Vérifiez l’adresse saisie dans ce formulaire ou utilisez celle déjà vérifiée dans votre compte.',error:'Impossible d’envoyer l’e-mail. Vérifiez l’adresse et réessayez plus tard.',limit:'Trop de demandes. Veuillez patienter.',pending:'Votre demande vérifiée est enregistrée. La notification est en attente ; n’envoyez pas de doublon.',receipt:'Référence',callback:'Votre e-mail est vérifié',callbackNote:'Revenez à l’onglet du formulaire et envoyez votre demande. La vérification seule n’envoie aucun formulaire, n’approuve aucun prestataire et ne confirme aucune réservation.',invalid:'Lien invalide ou expiré. Demandez un nouvel e-mail depuis le formulaire.',back:'Retour au formulaire',signin:'Vérifier',review:'Demandes de services vérifiées',staff:'Connectez-vous avec votre compte autorisé pour consulter la file privée.',refresh:'Actualiser',start:'Commencer l’examen / le travail',close:'Clore la demande',empty:'Aucune demande vérifiée.',delivery:'Envoi de la notification',work:'État du travail',policy:'Seules les demandes de cette file privée ont une vérification confirmée par le serveur. Un indicateur dans un e-mail Formspree ne constitue pas une preuve.'},
 ar:{title:'تحقق من بريدك الإلكتروني قبل الإرسال',note:'يجب على العملاء ومقدمي الخدمات التحقق من البريد الإلكتروني قبل بدء العمل أو مراجعة الطلب. ينشئ رابط آمن حسابك في ماروكورا أو يسجل دخولك إليه. لا حاجة إلى كلمة مرور أو التحقق من الهاتف.',send:'إرسال رسالة التحقق',sent:'راجع صندوق الوارد والبريد غير المرغوب فيه. افتح الرابط الآمن ثم عد إلى هذا النموذج وأرسل طلبك. تبقى بياناتك في علامة التبويب هذه.',verified:'تم التحقق من البريد. يمكنك الآن إرسال الطلب.',wrong:'تحقق من البريد المدخل في النموذج أو استخدم البريد الذي تم التحقق منه في حسابك.',error:'تعذر إرسال رسالة التحقق. راجع العنوان وحاول لاحقاً.',limit:'طلبات كثيرة. يرجى الانتظار.',pending:'تم تسجيل طلبك المتحقق منه. إرسال الإشعار قيد الانتظار؛ لا ترسل نسخة أخرى.',receipt:'مرجع الطلب',callback:'تم التحقق من بريدك الإلكتروني',callbackNote:'عد إلى علامة تبويب النموذج الأصلية وأرسل طلبك. التحقق وحده لا يرسل النموذج ولا يعتمد مقدم خدمة ولا يؤكد حجزاً.',invalid:'الرابط غير صالح أو منتهي. عد إلى النموذج واطلب رسالة جديدة.',back:'العودة إلى النموذج',signin:'فحص التحقق',review:'طلبات الخدمات المتحقق منها',staff:'سجل الدخول بحساب الموظف المخول لعرض قائمة الطلبات الخاصة.',refresh:'تحديث',start:'بدء المراجعة أو العمل',close:'إغلاق الطلب',empty:'لا توجد طلبات متحقق منها بعد.',delivery:'تسليم الإشعار',work:'حالة العمل',policy:'تؤكد سجلات هذه القائمة الخاصة التحقق من البريد على الخادم. وجود عبارة تحقق في رسالة فورمسبري ليس دليلاً.'},
 es:{title:'Verifica tu correo antes de enviar',note:'Clientes y proveedores deben verificar su correo antes de comenzar el trabajo o revisar una solicitud. Un enlace seguro crea tu cuenta de Marocora o inicia sesión. No requiere contraseña ni verificación telefónica.',send:'Enviar correo de verificación',sent:'Revisa tu bandeja de entrada y correo no deseado. Abre el enlace seguro, vuelve a este formulario y envía la solicitud. Tus datos permanecen en esta pestaña.',verified:'Correo verificado. Ya puedes enviar esta solicitud.',wrong:'Verifica el correo de este formulario o utiliza el correo ya verificado en tu cuenta.',error:'No pudimos enviar el correo. Revisa la dirección e inténtalo más tarde.',limit:'Demasiadas solicitudes. Espera antes de intentarlo de nuevo.',pending:'Tu solicitud verificada está registrada. La notificación está pendiente; no envíes otra copia.',receipt:'Referencia',callback:'Tu correo está verificado',callbackNote:'Vuelve a la pestaña original y envía tu solicitud. La verificación por sí sola no envía formularios, aprueba proveedores ni confirma reservas.',invalid:'Enlace inválido o caducado. Solicita otro correo desde el formulario.',back:'Volver al formulario',signin:'Comprobar verificación',review:'Solicitudes de servicios verificadas',staff:'Inicia sesión con tu cuenta autorizada para ver la cola privada.',refresh:'Actualizar',start:'Iniciar revisión / trabajo',close:'Cerrar solicitud',empty:'No hay solicitudes verificadas.',delivery:'Entrega de notificación',work:'Estado del trabajo',policy:'Solo las solicitudes de esta cola privada tienen verificación confirmada por el servidor. Una etiqueta en un correo de Formspree no es prueba.'}
};
const safePages=new Set(['contact.html','translation-request.html','translator-apply.html','join.html','lesson-request.html','booking-confirmation.html','service-review.html','vendor-review.html','application.html']);
const emailEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.trim().toLowerCase()===b.trim().toLowerCase();
const locale=()=>window.MarocoraSite?.locale||new URLSearchParams(location.search).get('lang')||'en';
const text=()=>verificationCopy[locale()]||verificationCopy.en;
const contexts=new WeakMap();
function addPanel(container){
 let ctx=contexts.get(container);if(ctx)return ctx;
 const panel=document.createElement('section');panel.className='email-verification-panel';panel.style.cssText='border:1px solid #b9c9c2;border-radius:12px;padding:18px;margin:18px 0;background:#f4f8f6;color:#17382d';
 const heading=document.createElement('h2'),note=document.createElement('p'),message=document.createElement('p'),button=document.createElement('button');
 message.setAttribute('role','status');message.setAttribute('aria-live','polite');button.type='button';
 panel.append(heading,note,message,button);container.prepend(panel);
 ctx={panel,heading,note,message,button,email:'',sent:false,busy:false,messageKey:''};contexts.set(container,ctx);
 const render=()=>{const c=text();heading.textContent=c.title;note.textContent=c.note;button.textContent=c.send;if(ctx.messageKey)message.textContent=c[ctx.messageKey]+(ctx.receipt?` ${c.receipt}: ${ctx.receipt}`:'');};
 ctx.show=(key,receipt='')=>{ctx.messageKey=key;ctx.receipt=receipt;render();};
 render();document.addEventListener('marocora:language',render);
 button.onclick=async()=>{
  if(ctx.busy)return;
  const email=container.querySelector('[name=email]')?.value||ctx.email;
  const validator=document.createElement('input');validator.type='email';validator.required=true;validator.value=email;
  if(!validator.checkValidity()){ctx.show('wrong');container.querySelector('[name=email]')?.focus();return;}
  ctx.busy=true;button.disabled=true;
  try{
   const page=location.pathname.split('/').pop();
   const callback=new URL('/verify-email.html',location.origin);
   try{localStorage.setItem('marocora.verification.return',JSON.stringify({page:safePages.has(page)?page:'contact.html',lang:locale()}));}catch{}
   const {error}=await instructorStore.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:callback.href,shouldCreateUser:true}});
   if(error)throw error;ctx.sent=true;ctx.show('sent');
  }catch{ctx.show('error');}
  finally{ctx.busy=false;button.disabled=false;}
 };
 return ctx;
}
export function prepareVerification(container){addPanel(container);}
export async function verifiedUserFor(email,container){
 const ctx=addPanel(container);ctx.email=email;
 const {data,error}=await instructorStore.auth.getUser();
 const user=error?null:data.user;
 if(user?.email_confirmed_at&&!user.is_anonymous&&emailEqual(user.email,email)){ctx.show('verified');return user;}
 ctx.show(user?'wrong':'note');ctx.panel.scrollIntoView({block:'center',behavior:'smooth'});
 const e=new Error('EMAIL_VERIFICATION_PENDING');e.verificationPending=true;throw e;
}
export function formFields(formData){
 const fields={};for(const [key,value] of formData){if(typeof value!=='string')throw new Error('FILES_NOT_SUPPORTED');if(Object.hasOwn(fields,key)){if(!Array.isArray(fields[key]))fields[key]=[fields[key]];fields[key].push(value);}else fields[key]=value;}return fields;
}
const requestIds=new WeakMap();
export async function submitVerifiedIntake(kind,formData,container){
 const fields=formFields(formData);await verifiedUserFor(fields.email,container);
 const serialized=JSON.stringify({kind,fields});let cached=requestIds.get(container);
 if(!cached||cached.serialized!==serialized){cached={serialized,id:crypto.randomUUID()};requestIds.set(container,cached);}
 const {data:{session}}=await instructorStore.auth.getSession();
 const response=await fetch(`${config.supabaseURL}/functions/v1/service-intake`,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.supabasePublishableKey,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({requestId:cached.id,kind,fields})});
 let result;try{result=await response.json();}catch{throw new Error('INTAKE_UNAVAILABLE');}
 if(!response.ok||!result.verified){const e=new Error(result.error||'INTAKE_UNAVAILABLE');if(result.error==='EMAIL_MISMATCH'||result.error==='EMAIL_VERIFICATION_REQUIRED'){e.verificationPending=true;addPanel(container).show('wrong');}throw e;}
 if(result.delivery!=='delivered'){
  addPanel(container).show('pending',result.receipt);
  return {...result,pending:true};
 }
 return result;
}
