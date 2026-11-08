// Draws the shareable result card (1080×1350, 4:5 portrait for social feeds) on a canvas.

import { driverBlurb, t, traitText, type Lang } from './i18n';
import type { DriverMatch, TraitInfo, TraitScores } from './scoring';

export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1350;
const PAD = 72;

const COLOR = {
  bg: '#0b0b10',
  surface: '#16161f',
  track: '#2a2a38',
  text: '#f4f4f6',
  muted: '#a3a3b5',
  accent: '#e10600',
};

interface Fonts {
  family: string;
  display: string; // weight/style prefix for headline text
}

function fontsFor(lang: Lang): Fonts {
  return lang === 'th'
    ? { family: "Kanit, 'Titillium Web', sans-serif", display: 'italic 800' }
    : { family: "'Titillium Web', Kanit, sans-serif", display: 'italic 900' };
}

/** Make sure web fonts (including the Thai subset) are loaded before drawing. */
async function ensureFonts(lang: Lang, sample: string) {
  if (!document.fonts?.load) return;
  const fam = lang === 'th' ? 'Kanit' : '"Titillium Web"';
  const specs = lang === 'th' ? ['400', '500', '700', 'italic 800'] : ['400', '600', '700', '900'];
  const loads = specs.map((s) => document.fonts.load(`${s} 32px ${fam}`, sample).catch(() => []));
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 4000))]);
}

// ---------- text helpers ----------

function segments(text: string, lang: Lang): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter(lang, { granularity: 'word' });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  // Fallback: Thai has no spaces between words, so break anywhere.
  return lang === 'th' ? Array.from(text) : text.split(/(\s+)/);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, lang: Lang, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const seg of segments(text, lang)) {
    const test = line + seg;
    if (ctx.measureText(test).width > maxWidth && line.trim()) {
      lines.push(line.trim());
      line = seg.trimStart();
    } else {
      line = test;
    }
  }
  if (line.trim()) lines.push(line.trim());
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = last + '…';
    return kept;
  }
  return lines;
}

/** Largest font size (stepping down) at which text fits maxWidth. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: (px: number) => string, max: number, min: number) {
  let size = max;
  ctx.font = font(size);
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Card with a team-colored stripe on the left edge. */
function teamCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, tint = false) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 22);
  if (tint) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, hexToRgba(color, 0.28));
    g.addColorStop(0.7, COLOR.surface);
    ctx.fillStyle = COLOR.surface;
    ctx.fill();
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = COLOR.surface;
  }
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 12, h);
  ctx.restore();
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(255,255,255,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// ---------- main ----------

export interface ResultImageInput {
  lang: Lang;
  matches: DriverMatch[];
  normalized: TraitScores;
  traits: TraitInfo[];
  placeholder: boolean;
  siteUrl: string;
}

export async function renderResultImage(input: ResultImageInput): Promise<Blob> {
  const { lang, matches, normalized, traits, placeholder, siteUrl } = input;
  const f = fontsFor(lang);
  const [top, ...others] = matches;
  const upper = (s: string) => (lang === 'en' ? s.toUpperCase() : s);

  await ensureFonts(lang, `${t('youDriveLike', {}, lang)} ${top.driver.name} ${driverBlurb(top.driver, lang)} 0123456789%`);

  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  const W = IMAGE_WIDTH;
  const inner = W - PAD * 2;

  // Background + glow
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, W, IMAGE_HEIGHT);
  const glow = ctx.createRadialGradient(W * 0.85, -60, 0, W * 0.85, -60, 760);
  glow.addColorStop(0, 'rgba(225,6,0,0.30)');
  glow.addColorStop(1, 'rgba(225,6,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, IMAGE_HEIGHT);

  // Top stripe
  ctx.fillStyle = COLOR.accent;
  ctx.fillRect(0, 0, W, 14);
  ctx.fillStyle = '#fff';
  for (let x = 80; x < W; x += 84) ctx.fillRect(x, 0, 4, 14);

  ctx.textBaseline = 'alphabetic';
  let y = 112;

  // Eyebrow
  ctx.font = `700 28px ${f.family}`;
  ctx.fillStyle = COLOR.muted;
  ctx.fillText(upper(t('imageHeader', {}, lang)), PAD, y);

  // Headline
  y += 84;
  ctx.font = `${f.display} 66px ${f.family}`;
  ctx.fillStyle = COLOR.text;
  ctx.fillText(upper(t('youDriveLike', {}, lang)), PAD, y, inner);

  y += 104;
  const nameText = upper(top.driver.name);
  const nameSize = fitFont(ctx, nameText, inner, (px) => `${f.display} ${px}px ${f.family}`, 116, 60);
  ctx.fillStyle = COLOR.accent;
  ctx.fillText(nameText, PAD, y, inner);
  y += Math.round(nameSize * 0.18) + 36;

  // Hero card (P1)
  const heroTop = y;
  const textX = PAD + 44;
  const matchColW = 220;
  const textW = inner - 44 - matchColW;
  ctx.font = `400 30px ${f.family}`;
  const blurbLines = wrap(ctx, driverBlurb(top.driver, lang), textW, lang, 2);
  const heroH = 40 + 40 + 20 + blurbLines.length * 44 + 30;
  teamCard(ctx, PAD, heroTop, inner, heroH, top.driver.teamColor, true);

  ctx.font = `700 34px ${f.family}`;
  ctx.fillStyle = COLOR.text;
  ctx.fillText(`P1 · ${top.driver.team}`, textX, heroTop + 62, textW);
  ctx.font = `400 30px ${f.family}`;
  ctx.fillStyle = '#d9d9e3';
  blurbLines.forEach((line, i) => ctx.fillText(line, textX, heroTop + 120 + i * 44));

  ctx.textAlign = 'right';
  ctx.fillStyle = COLOR.text;
  ctx.font = `700 92px ${f.family}`;
  ctx.fillText(`${top.match}%`, W - PAD - 36, heroTop + heroH / 2 + 22);
  ctx.font = `600 24px ${f.family}`;
  ctx.fillStyle = COLOR.muted;
  ctx.fillText(upper(t('match', {}, lang)), W - PAD - 36, heroTop + heroH / 2 + 60);
  ctx.textAlign = 'left';
  y = heroTop + heroH + 50;

  // P2 / P3 side by side
  ctx.font = `700 24px ${f.family}`;
  ctx.fillStyle = COLOR.muted;
  ctx.fillText(upper(t('imageOthers', {}, lang)), PAD, y);
  y += 22;
  const gap = 24;
  const cardW = (inner - gap) / 2;
  const cardH = 116;
  others.slice(0, 2).forEach((m, i) => {
    const x = PAD + i * (cardW + gap);
    teamCard(ctx, x, y, cardW, cardH, m.driver.teamColor);
    const nameW = cardW - 40 - 130;
    ctx.font = `600 22px ${f.family}`;
    ctx.fillStyle = COLOR.muted;
    ctx.fillText(`P${i + 2} · ${m.driver.team}`, x + 36, y + 44, nameW);
    fitFont(ctx, m.driver.name, nameW, (px) => `700 ${px}px ${f.family}`, 34, 24);
    ctx.fillStyle = COLOR.text;
    ctx.fillText(m.driver.name, x + 36, y + 88, nameW);
    ctx.textAlign = 'right';
    ctx.font = `700 46px ${f.family}`;
    ctx.fillText(`${m.match}%`, x + cardW - 28, y + 76);
    ctx.textAlign = 'left';
  });
  y += cardH + 66;

  // Traits: 2 columns × 4 rows
  ctx.font = `700 30px ${f.family}`;
  ctx.fillStyle = COLOR.text;
  ctx.fillText(upper(t('profileTitle', {}, lang)), PAD, y);
  y += 24;
  const colGap = 48;
  const colW = (inner - colGap) / 2;
  const rowH = (IMAGE_HEIGHT - 110 - y) / Math.ceil(traits.length / 2);
  traits.forEach((tr, i) => {
    const tx = traitText(tr, lang);
    const x = PAD + (i % 2) * (colW + colGap);
    const ry = y + Math.floor(i / 2) * rowH + 38;
    const v = normalized[tr.key];

    ctx.font = `700 28px ${f.family}`;
    ctx.fillStyle = COLOR.text;
    ctx.fillText(tx.label, x, ry, colW - 70);
    ctx.textAlign = 'right';
    ctx.fillText(String(v), x + colW, ry);
    ctx.textAlign = 'left';

    roundRect(ctx, x, ry + 14, colW, 12, 6);
    ctx.fillStyle = COLOR.track;
    ctx.fill();
    if (v > 0) {
      const fillW = Math.max(12, (colW * v) / 100);
      const g = ctx.createLinearGradient(x, 0, x + fillW, 0);
      g.addColorStop(0, '#8a0400');
      g.addColorStop(1, COLOR.accent);
      roundRect(ctx, x, ry + 14, fillW, 12, 6);
      ctx.fillStyle = g;
      ctx.fill();
    }

    ctx.fillStyle = COLOR.muted;
    const half = colW / 2 - 8;
    fitFont(ctx, tx.low, half, (px) => `400 ${px}px ${f.family}`, 20, 15);
    ctx.fillText(tx.low, x, ry + 52, half);
    fitFont(ctx, tx.high, half, (px) => `400 ${px}px ${f.family}`, 20, 15);
    ctx.textAlign = 'right';
    ctx.fillText(tx.high, x + colW, ry + 52, half);
    ctx.textAlign = 'left';
  });

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(PAD, IMAGE_HEIGHT - 96, inner, 2);
  ctx.font = `700 26px ${f.family}`;
  ctx.fillStyle = COLOR.text;
  ctx.fillText(siteUrl, PAD, IMAGE_HEIGHT - 48, inner * 0.55);
  if (placeholder) {
    ctx.font = `400 20px ${f.family}`;
    ctx.fillStyle = COLOR.muted;
    ctx.textAlign = 'right';
    ctx.fillText(t('imageSample', {}, lang), W - PAD, IMAGE_HEIGHT - 50, inner * 0.44);
    ctx.textAlign = 'left';
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}
