// Gabarit commun des pages du site : <head>, navigation en verre, pied de page.

export const SITE = {
  name: 'Tiger Task',
  // remplace par ton domaine définitif (utilisé pour les balises canoniques et le partage)
  url: 'https://tiger-task.reliques-contact.workers.dev',
};

const NAV = [
  ['/methode/', 'La méthode'],
  ['/tarifs/', 'Tarifs'],
  ['/blog/', 'Blog'],
  ['/faq/', 'FAQ'],
];

const logo = `<svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true"><rect x="1" y="1" width="18" height="18" rx="5" fill="#ff7a45"/><path d="M1 7.5h18M1 12.5h18M7.5 1v18" stroke="#fff" stroke-opacity=".55"/><rect x="7.5" y="7.5" width="11.5" height="5" fill="#fff" fill-opacity=".9"/></svg>`;

export function page({ path, title, description, body, depth, dark = false }) {
  const up = '../'.repeat(depth + 1);
  const canonical = SITE.url + path;
  const fullTitle = path === '/' ? `${SITE.name} — ${title}` : `${title} · ${SITE.name}`;
  const nav = NAV.map(([href, label]) => `<a href="${href}"${path.startsWith(href) ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="fr"${dark ? ' data-tone="night"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${fullTitle}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="fr_FR">
<meta name="theme-color" content="#f3f2f7">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="${up}src/site/site.css">
<script type="module" src="${up}src/site/site.ts"></script>
</head>
<body>
<a class="skip" href="#contenu">Aller au contenu</a>
<header class="nav glass">
  <a class="brand" href="/">${logo}<span>Tiger Task</span></a>
  <nav class="nav-links" aria-label="Navigation principale">${nav}</nav>
  <a class="btn btn-primary nav-cta" href="/app/">Ouvrir l’app</a>
</header>
<main id="contenu">
${body}
</main>
<footer class="foot">
  <div class="foot-grid">
    <div>
      <a class="brand" href="/">${logo}<span>Tiger Task</span></a>
      <p>Une ligne par jour, une couleur par tâche.</p>
    </div>
    <nav aria-label="Produit"><h2>Produit</h2><a href="/methode/">La méthode</a><a href="/tarifs/">Tarifs</a><a href="/app/">Ouvrir l’app</a></nav>
    <nav aria-label="Ressources"><h2>Ressources</h2><a href="/blog/">Blog</a><a href="/faq/">FAQ</a><a href="/affiliation/">Programme d’affiliation</a></nav>
    <nav aria-label="Légal"><h2>Légal</h2><a href="/mentions-legales/">Mentions légales</a><a href="/cgv/">Conditions de vente</a><a href="/confidentialite/">Confidentialité</a></nav>
  </div>
  <p class="foot-note">Tiger Task s’inspire de la méthode d’organisation décrite publiquement par l’auteur Fibre Tigre. Tiger Task est un projet indépendant, sans lien avec lui.</p>
</footer>
</body>
</html>
`;
}

/** La maquette de l'app en HTML/CSS : la feuille, la lentille du jour, le flou des autres jours */
export function appMock({ night = false } = {}) {
  const rows = [
    ['lun', '23', [['g', 'Écrire 500 mots'], ['g', 'Courses'], ['y', 'Mail au comptable']]],
    ['mar', '24', [['b', 'Mail au comptable'], ['g', 'Sport']]],
    ['mer', '25', [['g', 'Appeler maman'], ['p', 'Dossier client'], ['r', 'Ranger']]],
  ];
  const after = [
    ['ven', '27', [['w', 'Dentiste 9h']]],
    ['sam', '28', []],
    ['dim', '29', [['w', 'Marché']]],
  ];
  const mini = ([c, t]) => `<span class="m-mini"><i class="d-${c}"></i>${t}</span>`;
  const row = ([wd, n, ts], i, arr, dir) =>
    `<div class="m-row" style="--k:${dir === 'up' ? arr.length - i : i + 1}"><b>${wd} <strong>${n}</strong></b>${ts.map(mini).join('')}</div>`;
  const chip = (c, t, done) => `<span class="m-chip c-${c}" data-c="${c}"><i>${done ? '✓' : ''}</i>${t}</span>`;
  return `<div class="mock${night ? ' is-night' : ''}" aria-hidden="true">
  <div class="mock-bar"><span></span><span></span><span></span></div>
  ${rows.map((r, i, a) => row(r, i, a, 'up')).join('')}
  <div class="m-lens">
    <div class="m-lens-head"><span>Jeudi 26 novembre</span><em>2/5</em></div>
    <div class="m-chips">${chip('g', 'Préparer la réunion', 1)}${chip('g', 'Relire le contrat', 1)}${chip('w', 'Réserver le train')}${chip('w', 'Sport 30 min')}${chip('y', 'Appeler la banque')}</div>
  </div>
  ${after.map((r, i, a) => row(r, i, a, 'down')).join('')}
  <div class="m-fab"><small>JEU</small>26</div>
  <p class="m-toast" aria-hidden="true"></p>
</div>`;
}

/** La mascotte : une tête de tigre à facettes, en SVG (avatar des bulles) */
export function tigerHead(size = 44) {
  return `<svg class="tiger-head" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
  <path d="M10 6 22 14 12 24Z" fill="#2a1b16"/><path d="M13 11 20 15 14 21Z" fill="#f6efe6"/>
  <path d="M54 6 42 14 52 24Z" fill="#2a1b16"/><path d="M51 11 44 15 50 21Z" fill="#f6efe6"/>
  <path d="M32 8 52 18 58 36 48 52 32 58 16 52 6 36 12 18Z" fill="#ee8a3a"/>
  <path d="M32 8 52 18 32 30Z" fill="#f29a4c"/><path d="M32 8 12 18 32 30Z" fill="#e47e30"/>
  <path d="M12 18 6 36 20 34Z" fill="#d9702a"/><path d="M52 18 58 36 44 34Z" fill="#e88536"/>
  <path d="M6 36 16 52 24 42Z" fill="#f6efe6"/><path d="M58 36 48 52 40 42Z" fill="#efe4d6"/>
  <path d="M24 42 32 58 40 42 32 46Z" fill="#f6efe6"/><path d="M16 52 32 58 24 42Z" fill="#efe4d6"/><path d="M48 52 32 58 40 42Z" fill="#f6efe6"/>
  <path d="M29 9 32 20 35 9Z" fill="#2a1b16"/><path d="M22 12 26 21 27 12Z" fill="#2a1b16"/><path d="M42 12 38 21 37 12Z" fill="#2a1b16"/>
  <path d="M7 30 15 31 9 26Z" fill="#2a1b16"/><path d="M57 30 49 31 55 26Z" fill="#2a1b16"/>
  <path class="tiger-eye" d="M20 30 27 28 26 33 21 33Z" fill="#2a1b16"/><path class="tiger-eye" d="M44 30 37 28 38 33 43 33Z" fill="#2a1b16"/>
  <path d="M28 38 36 38 32 43Z" fill="#b96a62"/>
</svg>`;
}

/** La journée façon Aube : grand message, jauge de liberté, tâches (interactive dans l'accueil) */
export function dayCard({ night = false, live = false } = {}) {
  const tasks = live
    ? [['w', 'Répondre au mail qui fait peur'], ['w', 'Sport 30 min'], ['w', 'Relire le contrat'], ['w', 'Mettre le site en ligne']]
    : [['g', 'Préparer la réunion'], ['g', 'Sport 30 min'], ['y', 'Mail qui fait peur ↻3'], ['k', 'Impôts en ligne'], ['b', 'Mettre le site en ligne']];
  const mark = { g: '✓', b: '✓', y: '→', k: '×', w: '' };
  const judged = tasks.filter(([c]) => c !== 'w').length;
  const pct = Math.round((judged / tasks.length) * 100);
  return `<div class="day${night ? ' is-night' : ''}${live ? ' is-live' : ''}" ${live ? '' : 'aria-hidden="true"'}>
  <p class="day-date">Jeudi 26 novembre</p>
  <p class="day-msg">${live ? 'Une journée neuve. Plus vite tu t’y mets, plus vite tu es libre.' : 'Journée close. Un EPIC FAIL, un EPIC WIN : journée intense.'}</p>
  <div class="day-gauge"><i style="width:${pct}%"></i></div>
  <p class="day-legend"><span>${judged} sur ${tasks.length} · ${pct} %</span><span>${live ? 'Liberté dans 4 tâches' : 'Liberté débloquée'}</span></p>
  <div class="day-chips">${tasks
    .map(([c, t], i) => (live ? `<button type="button" class="day-chip c-${c}" data-i="${i}"><i>${mark[c]}</i>${t}</button>` : `<span class="day-chip c-${c}"><i>${mark[c]}</i>${t}</span>`))
    .join('')}</div>
  ${live ? '<p class="day-hint">Coche une tâche : le tigre se réveille.</p>' : ''}
</div>`;
}
