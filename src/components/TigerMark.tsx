/** L'emblème : un sceau circulaire traversé des rayures du tigre. */
export function TigerMark({ size = 32, color = 'var(--gold)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="27" fill="none" stroke={color} strokeWidth="2.5" />
      <circle cx="32" cy="32" r="21" fill="none" stroke={color} strokeWidth="1" opacity=".45" />
      <g stroke={color} strokeWidth="3.2" strokeLinecap="round" fill="none">
        <path d="M21 17c5 4 8 9 9 14" />
        <path d="M43 17c-5 4-8 9-9 14" />
        <path d="M14 30c5 0 10 2 13 6" />
        <path d="M50 30c-5 0-10 2-13 6" />
        <path d="M19 45c4-2 8-2 11 0" />
        <path d="M45 45c-4-2-8-2-11 0" />
        <path d="M32 39v10" />
      </g>
    </svg>
  );
}

/** Coups de pinceau en fond d'écran, à peine visibles */
export function Stripes() {
  return (
    <svg className="stripes" viewBox="0 0 400 900" preserveAspectRatio="none" aria-hidden="true">
      <g fill="currentColor">
        <path d="M400 40C320 70 250 60 190 95c60-5 130 0 210-20z" />
        <path d="M400 170c-110 20-190 70-260 60 80 25 170 0 260-25z" />
        <path d="M400 330c-70 10-120 45-200 40 70 30 140 10 200-10z" />
        <path d="M400 520c-130 15-210 80-300 70 100 35 210 5 300-30z" />
        <path d="M400 700c-60 5-110 30-170 25 60 25 120 15 170-5z" />
        <path d="M400 840c-100 10-160 40-230 35 80 25 160 5 230-15z" />
      </g>
    </svg>
  );
}
