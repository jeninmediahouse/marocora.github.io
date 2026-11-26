// Public introduction-video page. Server-rendered, no third-party embeds, no
// cookies, so the privacy policy stays accurate.

const LABELS = {teacher: 'Language teacher', translator: 'Translator / agency', transport: 'Transportation company'};
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export function introPage({id, displayName, type}) {
  const name = escape(displayName || 'Marocora partner');
  const kind = escape(LABELS[type] || '');
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} — introduction · Marocora</title>
<meta name="description" content="Introduction video from ${name}, a reviewed Marocora partner.">
<meta name="robots" content="index,follow">
<style>
:root{color-scheme:light}
body{margin:0;background:#f6f8f6;color:#132a22;font:17px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
header{background:#123c32;color:#fff;padding:14px 5%}header a{color:#fff;text-decoration:none;font-weight:700}
main{max-width:760px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:28px;line-height:1.25;margin:0 0 4px}
p.meta{color:#4a5c53;margin:0 0 20px}
video{width:100%;max-height:70vh;background:#000;border-radius:10px;display:block}
.actions{margin-top:22px;display:flex;gap:12px;flex-wrap:wrap}
.button{display:inline-block;padding:12px 18px;border-radius:7px;text-decoration:none;font-weight:700;background:#12644f;color:#fff}
.button.secondary{background:#fff;color:#12644f;border:1px solid #12644f}
footer{padding:24px 5%;color:#4a5c53;font-size:14px}
</style>
</head>
<body>
<header><a href="/">Marocora</a></header>
<main>
  <h1>${name}</h1>
  <p class="meta">${kind ? kind + ' · ' : ''}Reviewed Marocora partner</p>
  <video controls playsinline preload="metadata" src="/api/intro/${escape(id)}/video"></video>
  <div class="actions">
    <a class="button" href="/supply-profile.html?id=${escape(id)}">View full profile</a>
    <a class="button secondary" href="/professionals.html">All professionals</a>
  </div>
  <p class="meta" style="margin-top:22px">This video was reviewed before publication. Marocora introduces independent professionals; clients contract with them directly.</p>
</main>
<footer>© 2026 Marocora · <a href="/legal.html">Legal</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></footer>
</body>
</html>`;
}
