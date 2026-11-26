// Génère les pages HTML du site dans web/ (lancé automatiquement avant chaque build).
// Pour modifier le site : édite site/pages.mjs, et ajoute un article en déposant un .md dans site/blog/.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { page, SITE } from './layout.mjs';
import * as P from './pages.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..', 'web');

function write(path, html) {
  const file = path === '/' ? join(web, 'index.html') : path === '/404' ? join(web, '404.html') : join(web, path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}
const depthOf = (path) => (path === '/' || path === '/404' ? 0 : path.split('/').filter(Boolean).length);

for (const p of [P.home, P.methode, P.tarifs, P.faq, P.affiliation, P.mentions, P.cgv, P.confidentialite, P.notFound]) {
  write(p.path, page({ ...p, depth: depthOf(p.path) }));
}

// ---- Blog : un fichier Markdown par article, avec un en-tête title / description / date
const posts = readdirSync(join(here, 'blog'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const raw = readFileSync(join(here, 'blog', f), 'utf8');
    const [, front, content] = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
    const meta = Object.fromEntries(front.split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));
    return { slug: f.replace(/\.md$/, ''), ...meta, html: marked.parse(content) };
  })
  .sort((a, b) => b.date.localeCompare(a.date));

const fmt = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

for (const post of posts) {
  const path = `/blog/${post.slug}/`;
  write(
    path,
    page({
      path,
      depth: 2,
      title: post.title,
      description: post.description,
      body: `
<article class="post">
  <header class="page-head"><div class="wrap narrow">
    <p class="eyebrow"><a href="/blog/">Blog</a> · ${fmt(post.date)}</p>
    <h1>${post.title}</h1>
    <p class="lead">${post.description}</p>
  </div></header>
  <div class="prose wrap narrow">${post.html}</div>
</article>
<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        url: SITE.url + path,
      })}</script>`,
    }),
  );
}

write(
  '/blog/',
  page({
    path: '/blog/',
    depth: 1,
    title: 'Blog',
    description: 'Organisation, discipline et bilans : des articles pour tenir tes journées, sans culpabilité.',
    body: `
<section class="page-head"><div class="wrap narrow">
  <p class="eyebrow">Blog</p>
  <h1>Tenir ses journées, sans culpabilité.</h1>
</div></section>
<section class="wrap narrow posts">
  ${posts
    .map(
      (p) => `<a class="post-card reveal" href="/blog/${p.slug}/"><span class="fine">${fmt(p.date)}</span><h2>${p.title}</h2><p>${p.description}</p></a>`,
    )
    .join('\n  ')}
</section>`,
  }),
);

// ---- sitemap.xml et robots.txt
const urls = ['/', '/methode/', '/tarifs/', '/faq/', '/affiliation/', '/blog/', ...posts.map((p) => `/blog/${p.slug}/`)];
mkdirSync(join(here, '..', 'public'), { recursive: true });
writeFileSync(
  join(here, '..', 'public', 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE.url}${u}</loc></url>`).join('\n')}\n</urlset>\n`,
);
writeFileSync(join(here, '..', 'public', 'robots.txt'), `User-agent: *\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${SITE.url}/sitemap.xml\n`);

console.log(`site : ${urls.length} pages + 404 générées`);
