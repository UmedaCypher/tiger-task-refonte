/**
 * Les effets : confettis, vibrations, petites mises en scène.
 * Tout passe par la Web Animations API (transform + opacity, donc fluide), et tout se coupe
 * si l'appareil demande moins de mouvement.
 */
import type { Pigment } from './pigments';

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let layer: HTMLDivElement | null = null;
function getLayer() {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  return layer;
}

const PALETTES: Record<string, string[]> = {
  green: ['#21a366', '#5fd39a', '#ff7a45', '#ffd166'],
  blue: ['#3b82f6', '#8b5cf6', '#ff7a45', '#ffd166', '#21a366', '#f472b6'],
  party: ['#ff7a45', '#ffd166', '#21a366', '#3b82f6', '#8b5cf6', '#f472b6'],
};

/** Une gerbe de confettis depuis un point de l'écran */
export function burst(x: number, y: number, palette: keyof typeof PALETTES = 'green', count = 14, power = 1) {
  if (reducedMotion()) return;
  const host = getLayer();
  const colors = PALETTES[palette];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const size = 4 + Math.random() * 5;
    const round = Math.random() < 0.4;
    p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${round ? size : size * 0.45}px;background:${colors[i % colors.length]};border-radius:${round ? '50%' : '1px'}`;
    host.appendChild(p);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = (40 + Math.random() * 60) * power;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 30 * power;
    const rot = (Math.random() - 0.5) * 720;
    p.animate(
      [
        { transform: 'translate(-50%,-50%) scale(0.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.8}px), calc(-50% + ${dy * 0.8}px)) rotate(${rot * 0.6}deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 60 * power}px)) rotate(${rot}deg) scale(0.9)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.8,.3,1)' },
    ).onfinish = () => p.remove();
  }
}

/** La grande fête : journée bouclée ou EPIC WIN */
export function celebrate(from?: Element | null) {
  if (reducedMotion()) return;
  const r = from?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : innerWidth / 2;
  const y = r ? r.top + r.height / 3 : innerHeight / 3;
  burst(x - 60, y, 'party', 22, 1.8);
  setTimeout(() => burst(x + 60, y, 'party', 22, 1.8), 120);
  setTimeout(() => burst(x, y - 30, 'party', 26, 2.2), 240);
}

export function haptic(pattern: number | number[] = 8) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* pas de vibreur */
  }
}

/** L'effet qui accompagne chaque verdict, au moment où la couleur change */
export function verdictFx(pigment: Pigment, el: HTMLElement | null) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const mark = el.querySelector('.chip-mark, .mark')?.getBoundingClientRect() ?? r;
  const cx = mark.left + mark.width / 2;
  const cy = mark.top + mark.height / 2;
  switch (pigment) {
    case 'green':
      haptic(10);
      burst(cx, cy, 'green', 12, 0.8);
      break;
    case 'blue':
      haptic([12, 40, 12, 40, 30]);
      burst(cx, cy, 'blue', 24, 1.4);
      setTimeout(() => burst(r.right - 20, cy, 'blue', 18, 1.2), 150);
      el.closest('.lens')?.classList.add('is-winning');
      setTimeout(() => el.closest('.lens')?.classList.remove('is-winning'), 1400);
      break;
    case 'black':
      haptic([40, 30, 60]);
      break;
    case 'yellow':
      haptic(6);
      if (!reducedMotion()) zzz(cx, cy);
      break;
    default:
      haptic(6);
  }
}

/** Trois petits « z » qui s'envolent : la flemme s'endort */
function zzz(x: number, y: number) {
  const host = getLayer();
  for (let i = 0; i < 3; i++) {
    const z = document.createElement('b');
    z.className = 'fx-z';
    z.textContent = 'z';
    z.style.cssText = `left:${x + 6}px;top:${y - 6}px;font-size:${11 + i * 4}px`;
    host.appendChild(z);
    z.animate(
      [
        { transform: 'translate(0,0) rotate(-10deg)', opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { transform: `translate(${14 + i * 8}px, ${-30 - i * 14}px) rotate(12deg)`, opacity: 0 },
      ],
      { duration: 1300, delay: i * 220, easing: 'ease-out', fill: 'both' },
    ).onfinish = () => z.remove();
  }
}
