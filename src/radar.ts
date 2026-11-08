import { TRAIT_KEYS, type TraitScores } from './scoring';

const SIZE = 320;
const C = SIZE / 2;
const R = 112;

function point(i: number, value: number, radius = R): [number, number] {
  const angle = (Math.PI * 2 * i) / TRAIT_KEYS.length - Math.PI / 2;
  const r = (value / 100) * radius;
  return [C + r * Math.cos(angle), C + r * Math.sin(angle)];
}

const poly = (values: number[]) =>
  values.map((v, i) => point(i, v).map((n) => n.toFixed(1)).join(',')).join(' ');

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Inline SVG radar chart of the user's profile, optionally overlaid with a driver's.
 * `labels` are the (localized) trait labels in TRAIT_KEYS order.
 */
export function radarSvg(
  labels: string[],
  you: TraitScores,
  title: string,
  driver?: { color: string; traits: TraitScores },
): string {
  const rings = [25, 50, 75, 100]
    .map((v) => `<polygon class="radar-grid" points="${poly(TRAIT_KEYS.map(() => v))}" />`)
    .join('');
  const axes = TRAIT_KEYS.map((_, i) => {
    const [x, y] = point(i, 100);
    return `<line class="radar-grid" x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" />`;
  }).join('');
  const text = labels
    .map((label, i) => {
      const [x, y] = point(i, 100, R + 16);
      const anchor = Math.abs(x - C) < 4 ? 'middle' : x > C ? 'start' : 'end';
      return `<text class="radar-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle">${esc(label)}</text>`;
    })
    .join('');
  const driverShape = driver
    ? `<polygon class="radar-driver" style="--c:${driver.color}" points="${poly(TRAIT_KEYS.map((k) => driver.traits[k]))}" />`
    : '';
  const youShape = `<polygon class="radar-you" points="${poly(TRAIT_KEYS.map((k) => you[k]))}" />`;

  return `<svg class="radar" viewBox="-80 4 ${SIZE + 160} ${SIZE - 8}" role="img" aria-label="${esc(title)}">
    ${rings}${axes}${driverShape}${youShape}${text}
  </svg>`;
}
