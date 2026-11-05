// Picks one category for a site from its title, description and Open Graph data.
import { CATEGORIES } from './taxonomy.mjs';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RX = new Map();
const rx = (w) => { if (!RX.has(w)) RX.set(w, new RegExp(`(^|[^a-z0-9])${esc(w)}($|[^a-z0-9])`, 'i')); return RX.get(w); };
export const hasWord = (text, w) => rx(w).test(text);

export function classify(meta) {
  const fields = [
    [meta.title, 2], [meta.ogTitle, 1.5], [meta.desc, 2], [meta.ogDesc, 1.5], [meta.keywords, 0.75],
  ].map(([s, w]) => [(s || '').toLowerCase(), w]);
  const scores = [];
  for (const c of CATEGORIES) {
    let sc = 0;
    for (const k of c.kw) {
      let best = 0;
      for (const [s, w] of fields) if (s && hasWord(s, k)) best = Math.max(best, w * (k.includes(' ') ? 1.4 : 1));
      sc += best;
    }
    if (sc) scores.push({ c, sc });
  }
  scores.sort((a, b) => b.sc - a.sc);
  if (!scores.length) return null;
  const [a, b] = scores;
  if (a.sc < 2.5) return null;
  if (b && a.sc - b.sc < 1 && a.c.group !== b.c.group) return null;
  return a.c;
}
