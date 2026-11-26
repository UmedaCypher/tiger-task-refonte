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
