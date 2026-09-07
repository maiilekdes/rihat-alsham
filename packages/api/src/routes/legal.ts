import { Router } from 'express';
import {
  LEGAL_DOCS,
  findDoc,
  BUSINESS_DETAILS,
  LEGAL_DOCUMENTS_READY,
  MISSING_BUSINESS_DETAILS,
} from '../legal/content';

/**
 * Public legal pages. Deliberately unauthenticated — the App Store needs to
 * fetch the privacy policy without an account, and a customer must be able to
 * read the refund policy before deciding to order.
 *
 * Server-rendered plain HTML with no JavaScript and no external requests, so
 * the pages work on any device, load instantly, and cannot themselves become a
 * privacy problem by pulling in a font or a script from someone else.
 */
export const legalRouter = Router();

// A public policy containing TODO values can mislead customers and App Store
// reviewers. Keep every legal route closed until the business details are
// verified and filled in; the missing field names are logged server-side only.
legalRouter.use((req, res, next) => {
  if (LEGAL_DOCUMENTS_READY) return next();
  console.warn(
    `[legal] Draft requested at ${req.originalUrl}; missing: ${MISSING_BUSINESS_DETAILS.join(', ')}`
  );
  const english = req.query.lang === 'en';
  return res
    .status(503)
    .type('html')
    .send(
      `<!doctype html><html lang="${english ? 'en' : 'ar'}" dir="${english ? 'ltr' : 'rtl'}"><head>` +
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        `<title>${english ? 'Legal documents are being prepared' : 'المستندات النظامية قيد الإعداد'}</title>` +
        '<style>body{max-width:42rem;margin:4rem auto;padding:0 1.25rem;font:18px/1.8 system-ui;color:#2C1B10;background:#FBF1DE}</style>' +
        `</head><body><h1>${english ? 'Legal documents are being prepared' : 'المستندات النظامية قيد الإعداد'}</h1>` +
        `<p>${english ? 'Please contact the restaurant by phone while these documents are completed.' : 'يرجى التواصل مع المطعم هاتفياً إلى حين اكتمال هذه المستندات.'}</p>` +
        `<p><a href="tel:${BUSINESS_DETAILS.phone}">${BUSINESS_DETAILS.phone}</a></p></body></html>`
    );
});

function page(title: string, body: string, lang: 'ar' | 'en') {
  const rtl = lang === 'ar';
  const other = rtl ? 'en' : 'ar';
  const otherLabel = rtl ? 'English' : 'العربية';
  return `<!doctype html>
<html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — ${rtl ? BUSINESS_DETAILS.legalNameAr : BUSINESS_DETAILS.legalNameEn}</title>
<style>
  /* Colours chosen to meet WCAG AA against the parchment ground: ink #2C1B10
     on #FBF1DE is 14.7:1, maroon #6E1B14 is 10.2:1. The app's gold accent is
     only 2.8:1 and is deliberately NOT used for text here. */
  :root { --bg:#FBF1DE; --ink:#2C1B10; --maroon:#6E1B14; --rule:#DCC79A; --card:#FFFDF8; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
         font: 17px/1.75 -apple-system, "Segoe UI", system-ui, sans-serif; }
  .wrap { max-width: 46rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
  header { border-bottom: 2px solid var(--maroon); padding-bottom: 1rem; margin-bottom: 2rem;
           display:flex; flex-wrap:wrap; gap:1rem; align-items:baseline; justify-content:space-between; }
  h1 { color: var(--maroon); font-size: 1.6rem; margin: 0; }
  h2 { color: var(--maroon); font-size: 1.15rem; margin: 2rem 0 .5rem; }
  a { color: var(--maroon); }
  a:focus-visible, :focus-visible { outline: 3px solid var(--maroon); outline-offset: 2px; }
  .updated { color:#5F4A33; font-size:.9rem; }
  table { width:100%; border-collapse:collapse; margin:1rem 0; background:var(--card); }
  th, td { border:1px solid var(--rule); padding:.6rem .75rem; text-align:${rtl ? 'right' : 'left'}; }
  th { background:var(--maroon); color:#FFFDF8; }
  nav { margin-bottom:2rem; padding:.75rem 1rem; background:var(--card);
        border:1px solid var(--rule); border-radius:8px; }
  nav a { margin-${rtl ? 'left' : 'right'}: 1rem; display:inline-block; }
  footer { margin-top:3rem; padding-top:1rem; border-top:1px solid var(--rule);
           font-size:.9rem; color:#5F4A33; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#1B120C; --ink:#F3E7D5; --maroon:#E8A87C; --rule:#4A3728; --card:#241811; }
    th { color:#1B120C; }
    .updated, footer { color:#C4B29A; }
  }
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>${title}</h1>
  <a href="?lang=${other}" lang="${other}">${otherLabel}</a>
</header>
<nav aria-label="${rtl ? 'المستندات النظامية' : 'Legal documents'}">
${LEGAL_DOCS.map(
  (d) => `<a href="/legal/${d.slug}?lang=${lang}">${rtl ? d.titleAr : d.titleEn}</a>`
).join('\n')}
</nav>
<main>
${body}
</main>
<footer>
  ${rtl ? BUSINESS_DETAILS.legalNameAr : BUSINESS_DETAILS.legalNameEn} ·
  ${rtl ? BUSINESS_DETAILS.addressAr : BUSINESS_DETAILS.addressEn} ·
  <a href="tel:${BUSINESS_DETAILS.phone}">${BUSINESS_DETAILS.phone}</a>
</footer>
</div>
</body>
</html>`;
}

legalRouter.get('/', (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'ar';
  const list = LEGAL_DOCS.map(
    (d) => `<h2><a href="/legal/${d.slug}?lang=${lang}">${lang === 'ar' ? d.titleAr : d.titleEn}</a></h2>`
  ).join('\n');
  res.type('html').send(page(lang === 'ar' ? 'المستندات النظامية' : 'Legal', list, lang));
});

legalRouter.get('/:slug', (req, res) => {
  const doc = findDoc(req.params.slug);
  if (!doc) return res.status(404).type('html').send(page('404', '<p>Not found.</p>', 'en'));
  const lang = req.query.lang === 'en' ? 'en' : 'ar';
  res.type('html').send(page(lang === 'ar' ? doc.titleAr : doc.titleEn, lang === 'ar' ? doc.ar : doc.en, lang));
});
