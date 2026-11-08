// Pure scoring + matching logic. No DOM access here.

export const TRAIT_KEYS = [
  'attack',
  'composure',
  'strategy',
  'competitiveDrive',
  'sociability',
  'adaptability',
  'independence',
  'experimentation',
] as const;

export type TraitKey = (typeof TRAIT_KEYS)[number];
export type TraitScores = Record<TraitKey, number>;

export interface Option {
  id: string;
  text: string;
  scores: TraitScores;
}

export interface Question {
  id: number;
  type: string;
  pairId: string;
  text: string;
  options: Option[];
}

export interface TraitInfo {
  key: TraitKey;
  label: string;
  low: string;
  high: string;
  note: string;
  min: number;
  max: number;
}

export interface Driver {
  id: string;
  name: string;
  team: string;
  teamColor: string;
  number?: number;
  blurb: { en: string; th: string };
  traits: TraitScores;
}

export interface DriverMatch {
  driver: Driver;
  distance: number;
  /** 0–100, higher is more similar */
  match: number;
}

/** questionId -> optionId ("A".."D") */
export type Answers = Record<number, string>;

function zeroScores(): TraitScores {
  return Object.fromEntries(TRAIT_KEYS.map((k) => [k, 0])) as TraitScores;
}

export function isComplete(questions: Question[], answers: Answers): boolean {
  return questions.every((q) => q.options.some((o) => o.id === answers[q.id]));
}

/** Sum of trait scores across all selected options. Throws if any answer is missing or invalid. */
export function computeRaw(questions: Question[], answers: Answers): TraitScores {
  const raw = zeroScores();
  for (const q of questions) {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    if (!opt) throw new Error(`Question ${q.id} has no valid answer`);
    for (const k of TRAIT_KEYS) raw[k] += opt.scores[k];
  }
  return raw;
}

/** Mirrors the spreadsheet: ROUND((raw - min) / (max - min) * 100, 0). */
export function normalize(raw: TraitScores, traits: TraitInfo[]): TraitScores {
  const out = zeroScores();
  for (const t of traits) {
    const value = ((raw[t.key] - t.min) / (t.max - t.min)) * 100;
    out[t.key] = Math.min(100, Math.max(0, Math.round(value)));
  }
  return out;
}

export function scoreQuiz(questions: Question[], traits: TraitInfo[], answers: Answers) {
  const raw = computeRaw(questions, answers);
  return { raw, normalized: normalize(raw, traits) };
}

const MAX_DISTANCE = Math.sqrt(TRAIT_KEYS.length * 100 * 100);

export function distance(a: TraitScores, b: TraitScores): number {
  return Math.sqrt(TRAIT_KEYS.reduce((sum, k) => sum + (a[k] - b[k]) ** 2, 0));
}

/** Rank drivers by Euclidean distance; ties keep data-file order (stable sort). */
export function matchDrivers(profile: TraitScores, drivers: Driver[], top = 3): DriverMatch[] {
  return drivers
    .map((driver) => {
      const d = distance(profile, driver.traits);
      return { driver, distance: d, match: Math.round(100 - (d / MAX_DISTANCE) * 100) };
    })
    .sort((x, y) => x.distance - y.distance)
    .slice(0, top);
}
