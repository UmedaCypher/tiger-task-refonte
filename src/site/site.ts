import '@fontsource-variable/bricolage-grotesque/opsz.css';
// Comportements du site : parrainage, apparitions au défilement, barre de navigation.

// Lien d'affilié : ?ref=code (posé par /r/<code>) → gardé 60 jours, lu ensuite par l'app (même domaine)
const ref = new URLSearchParams(location.search).get('ref');
if (ref && /^[a-z0-9-]{3,24}$/.test(ref)) {
  localStorage.setItem('tt:ref', JSON.stringify({ code: ref, at: Date.now() }));
  const clean = new URL(location.href);
  clean.searchParams.delete('ref');
  history.replaceState(null, '', clean.toString());
}

// Apparition douce des blocs, comme une mise au point
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const els = document.querySelectorAll<HTMLElement>('.reveal');
if (reduce || !('IntersectionObserver' in window)) {
  els.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  );
  els.forEach((el) => io.observe(el));
}

// La barre se densifie dès qu'on fait défiler
const nav = document.querySelector('.nav');
const onScroll = () => nav?.classList.toggle('is-scrolled', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---- Titre : les mots arrivent un par un, comme une mise au point
document.querySelectorAll<HTMLElement>('h1.words').forEach((h) => {
  if (reduce) return;
  let i = 0;
  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const part of (child.textContent ?? '').split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) frag.append(part);
          else {
            const w = document.createElement('span');
            w.className = 'w';
            w.style.setProperty('--i', String(i++));
            w.textContent = part;
            frag.append(w);
          }
        }
        child.replaceWith(frag);
      } else if (child instanceof HTMLElement && child.tagName !== 'svg') walk(child);
    }
  };
  walk(h);
  h.style.setProperty('--n', String(i));
  requestAnimationFrame(() => h.classList.add('is-in'));
});

// ---- La maquette de l'accueil vit toute seule : elle colore ses tâches et te chambre
const ROAST: Record<string, string[]> = {
  g: ['Faite. Regarde-toi, tout responsable.', 'Une de moins. Le tigre approuve.'],
  y: ['Flemme assumée. Demain, promis.', 'Deuxième report. Elle commence à te connaître.'],
  k: ['EPIC FAIL débloqué. Il fallait oser.'],
  b: ['EPIC WIN. Champagne (avec modération).'],
};
const SCRIPT: [number, string][] = [
  [2, 'g'],
  [3, 'y'],
  [4, 'b'],
];
document.querySelectorAll<HTMLElement>('.hero-mock .mock').forEach((mock) => {
  if (reduce) return;
  const chips = [...mock.querySelectorAll<HTMLElement>('.m-chip')];
  const toast = mock.querySelector<HTMLElement>('.m-toast');
  const initial = chips.map((c) => c.className);
  let step = 0;
  const tick = () => {
    if (step === SCRIPT.length) {
      chips.forEach((c, i) => {
        c.className = initial[i];
        c.querySelector('i')!.textContent = initial[i].includes('c-w') ? '' : '✓';
      });
      step = 0;
      return;
    }
    const [idx, c] = SCRIPT[step++];
    const chip = chips[idx];
    if (!chip) return;
    chip.className = `m-chip c-${c} is-fx`;
    chip.querySelector('i')!.textContent = c === 'g' || c === 'b' ? '✓' : c === 'y' ? '→' : '×';
    if (toast) {
      const lines = ROAST[c] ?? [''];
      toast.textContent = lines[Math.floor(Math.random() * lines.length)];
      toast.classList.remove('is-on');
      void toast.offsetWidth;
      toast.classList.add('is-on');
    }
  };
  let timer = setInterval(tick, 2600);
  document.addEventListener('visibilitychange', () => {
    clearInterval(timer);
    if (!document.hidden) timer = setInterval(tick, 2600);
  });
});
