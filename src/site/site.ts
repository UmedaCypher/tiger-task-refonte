import '@fontsource-variable/inter-tight/wght.css';
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

// ---- Accueil : le décor 3D, le tigre, et la démo qui le réveille
const heroCanvas = document.querySelector<HTMLCanvasElement>('.hero-canvas');
const demo = document.querySelector<HTMLElement>('.day.is-live');
if (heroCanvas && demo) {
  const chips = [...demo.querySelectorAll<HTMLButtonElement>('.day-chip')];
  const msg = demo.querySelector<HTMLElement>('.day-msg')!;
  const bar = demo.querySelector<HTMLElement>('.day-gauge i')!;
  const legend = demo.querySelectorAll<HTMLElement>('.day-legend span');
  const hint = demo.querySelector<HTMLElement>('.day-hint');
  const say = document.querySelector<HTMLElement>('.tiger-say');
  const bubble = document.querySelector<HTMLElement>('.tiger-say .tiger-bubble');
  const done = new Set<number>();
  let world: { setState(s: { progress: number; mood: 'sleep' | 'awake' | 'free'; night: boolean }): void; perk(): void; onBubble(cb: (x: number, y: number) => void): void } | null = null;

  const render = () => {
    const n = chips.length;
    const k = done.size;
    const r = k / n;
    const left = n - k;
    chips.forEach((c, i) => {
      const on = done.has(i);
      const win = on && i === n - 1;
      c.className = `day-chip c-${on ? (win ? 'b' : 'g') : 'w'}`;
      c.querySelector('i')!.textContent = on ? '✓' : '';
      c.setAttribute('aria-pressed', String(on));
    });
    msg.textContent =
      r === 0 ? 'Une journée neuve. Plus vite tu t’y mets, plus vite tu es libre.'
      : r < 0.4 ? 'C’est parti. TikTok peut attendre un peu.'
      : r < 0.7 ? 'À mi-chemin. Ton canapé commence à t’appeler.'
      : r < 1 ? 'Plus qu’une. La liberté est juste là.'
      : 'Libre ! Va scroller, tu l’as mérité.';
    bar.style.width = `${Math.round(r * 100)}%`;
    legend[0].textContent = `${k} sur ${n} · ${Math.round(r * 100)} %`;
    legend[1].textContent = left ? `Liberté dans ${left} tâche${left > 1 ? 's' : ''}` : 'Liberté débloquée';
    if (bubble) {
      const line =
        k === 0 ? 'Zzz… Coche une tâche, ça me réveillera peut-être.'
        : r < 0.5 ? 'Mmh ? Ah, tu as commencé. Continue, je t’observe.'
        : r < 1 ? 'Tu avances. Je fais semblant de ne pas regarder.'
        : 'EPIC WIN ! Je t’ai gardé une place sur le canapé.';
      if (bubble.textContent !== line) {
        bubble.textContent = line;
        bubble.classList.remove('is-pop');
        void bubble.offsetWidth;
        bubble.classList.add('is-pop');
      }
    }
    world?.setState({ progress: r, mood: k === n ? 'free' : r >= 0.3 ? 'awake' : 'sleep', night: false });
  };

  let auto: ReturnType<typeof setInterval> | null = null;
  const stopAuto = () => auto && (clearInterval(auto), (auto = null));
  chips.forEach((c, i) =>
    c.addEventListener('click', () => {
      stopAuto();
      hint?.remove();
      if (done.has(i)) done.delete(i);
      else {
        done.add(i);
        world?.perk();
      }
      render();
    }),
  );
  // sans interaction, la démo se joue toute seule
  if (!reduce) {
    setTimeout(() => {
      if (auto === null && done.size === 0)
        auto = setInterval(() => {
          if (done.size === chips.length) {
            done.clear();
          } else {
            done.add(done.size);
            world?.perk();
          }
          render();
        }, 3200);
    }, 5000);
  }

  // le décor arrive après le texte : la page reste instantanée
  setTimeout(() => {
    import('../scene/world')
      .then(({ createWorld }) => {
        world = createWorld(heroCanvas, { reduced: reduce });
        world.onBubble((x, y) => {
          if (say) say.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        });
        document.querySelector('.hero-scene')?.classList.add('is-ready');
        render();
      })
      .catch(() => {});
  }, 120);
  render();
}
