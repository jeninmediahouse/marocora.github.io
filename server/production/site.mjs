// Only authored website pages and their browser assets may leave the build.
// Never serve the build directory wholesale: it also contains legacy clients.
export const publicPages=new Set([
 'reset-password.html',
 'supply-register.html','supply-profile.html',
 'index.html','production-login.html','contact.html','contact-thank-you.html',
 'professionals.html','join.html','thank-you.html','teachers.html','teacher-sample.html',
 'teacher-apply.html','lesson-request.html','lesson-thank-you.html','translators.html',
 'translator-sample.html','translator-tanya-naser.html','translator-tareq-naser.html',
 'translator-apply.html','translator-application-thank-you.html','translation-request.html',
 'translation-thank-you.html','verify-email.html','learn/index.html',
 'legal.html','privacy.html','terms.html','imprint.html'
]);
export const privatePages=new Set([
 'supply-dashboard.html',
 'learning-room.html','instant-quote.html','translation-workspace.html',
 'application.html','vendor-review.html','service-review.html','launch-report.html',
 'staff-review.html','learn/account.html','learn/schedule.html'
]);
export const adminPages=new Set(['supply-review.html']);
export const browserAssets=new Set([
 'reset-password.mjs','supply-directory.mjs',
 'supply-copy.mjs','supply-dashboard.mjs','supply-review.mjs','supply-register.mjs','supply-profile.mjs','supply-client.mjs','supply.css',
 'production-login.mjs','learning-room.mjs','learning-room.css','home-language.mjs','legal.css','pricing.mjs',
 'site-language.mjs','site-language.css','site-services.mjs','site-copy.mjs','home-copy.mjs',
 'site-ui-copy.mjs','site-extra-copy.mjs','translation-copy.mjs','translation-service.mjs',
 'translation-service.css','translation-validation.mjs','service-verification.mjs',
 'service-account.mjs','application.mjs','vendor-review.mjs','service-review.mjs',
 'launch-report.mjs','launch-report.css','vendor-workflow.css','receipt.css',
 'teachers-data.js','GOPR1269.JPG','hero-global.jpg','online-lesson.jpg','language-class.jpg','hero-globe.jpg','9e214abf-95c6-43e7-b4d5-20c17e8ff5a8.png',
 'robots.txt','sitemap.xml','learn/locale.mjs','learn/currencies.mjs','learn/styles.css',
 'learn/instructor.css','learn/instructor.mjs','learn/staff-review.mjs','learn/app.mjs',
 'learn/account.mjs','learn/schedule.mjs','learn/learning-room-session.mjs',
 'learn/lesson-login.mjs','learn/live-learning-room.mjs','learn/mock-learning-room.mjs',
 'learn/room-copy.mjs'
]);
export const productionAliases={
 '/instant-quote.html':'server/block1/ui/instant-quote.html',
 '/translation-workspace.html':'server/block1/ui/instant-quote.html',
 '/instant-quote.mjs':'server/block1/ui/instant-quote.mjs',
 '/instant-quote.css':'server/block1/ui/instant-quote.css',
 '/block1-local.mjs':'server/production/translation-client.mjs'
};
export function websitePath(pathname){
 return pathname==='/'?'/index.html':pathname==='/learn/'?'/learn/index.html':pathname;
}
export function loginLocation(pathname,search=''){
 return '/production-login.html?'+new URLSearchParams({next:pathname+search});
}
