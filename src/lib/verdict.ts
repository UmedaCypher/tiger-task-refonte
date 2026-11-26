/** Après un verdict : la réplique du mode roast, et la fête si la journée est bouclée */
import { celebrate } from './fx';
import type { Pigment } from './pigments';
import { roastFor, say } from './roast';
import { getState, tasksOf, type Task } from './store';

export function afterVerdict(before: Task, pigment: Pigment) {
  if (before.pigment === pigment) return;
  const day = tasksOf(getState(), before.date);
  say(roastFor(before, pigment, day));
  const allJudged = day.length >= 3 && day.every((t) => t.pigment !== 'white');
  if (allJudged && pigment !== 'white') setTimeout(() => celebrate(document.querySelector('.lens')), 250);
}
