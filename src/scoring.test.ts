import { describe, expect, it } from 'vitest';
import questionsJson from './data/questions.json';
import traitsJson from './data/traits.json';
import driversJson from './data/drivers.json';
import {
  TRAIT_KEYS,
  computeRaw,
  isComplete,
  matchDrivers,
  normalize,
  scoreQuiz,
  type Answers,
  type Driver,
  type Question,
  type TraitInfo,
  type TraitScores,
} from './scoring';
import { STRINGS, questionText, t, thContent } from './i18n';

const questions = questionsJson as Question[];
const traits = traitsJson as TraitInfo[];
const drivers = (driversJson as { drivers: Driver[] }).drivers;

const allOf = (letter: string): Answers => Object.fromEntries(questions.map((q) => [q.id, letter]));
const vec = (values: number[]): TraitScores =>
  Object.fromEntries(TRAIT_KEYS.map((k, i) => [k, values[i]])) as TraitScores;

// Expected values computed independently from the xlsx (sum of columns per option letter,
// then the Quiz Response sheet's normalization formula).
const EXPECTED: Record<string, { raw: number[]; normalized: number[] }> = {
  A: { raw: [35, 10, 13, 48, 17, 18, 42, 7], normalized: [91, 15, 10, 96, 44, 34, 80, 20] },
  B: { raw: [-9, 49, 67, 21, 13, 10, 8, 0], normalized: [16, 87, 98, 38, 37, 17, 31, 8] },
  C: { raw: [-9, 42, 39, 9, 35, 13, -2, 3], normalized: [16, 74, 52, 13, 75, 23, 17, 13] },
  D: { raw: [11, 29, 21, 20, 3, 41, 46, 50], normalized: [50, 50, 23, 36, 20, 83, 86, 92] },
};

describe('data', () => {
  it('has 24 questions with options A–D', () => {
    expect(questions).toHaveLength(24);
    for (const q of questions) expect(q.options.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('has trait ranges matching the spreadsheet formulas', () => {
    expect(traits.map((t) => [t.key, t.min, t.max])).toEqual([
      ['attack', -18, 40],
      ['composure', 2, 56],
      ['strategy', 7, 68],
      ['competitiveDrive', 3, 50],
      ['sociability', -9, 50],
      ['adaptability', 2, 49],
      ['independence', -14, 56],
      ['experimentation', -5, 55],
    ]);
  });

  it('has 22 drivers with complete 0–100 profiles', () => {
    expect(drivers).toHaveLength(22);
    for (const d of drivers) {
      for (const k of TRAIT_KEYS) {
        expect(d.traits[k]).toBeGreaterThanOrEqual(0);
        expect(d.traits[k]).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('scoring', () => {
  for (const [letter, expected] of Object.entries(EXPECTED)) {
    it(`matches the spreadsheet for all-${letter} answers`, () => {
      const { raw, normalized } = scoreQuiz(questions, traits, allOf(letter));
      expect(raw).toEqual(vec(expected.raw));
      expect(normalized).toEqual(vec(expected.normalized));
    });
  }

  it('scores the minimum and maximum possible answers as 0 and 100', () => {
    for (const t of traits) {
      const pick = (best: boolean) =>
        Object.fromEntries(
          questions.map((q) => {
            const sorted = [...q.options].sort((a, b) => a.scores[t.key] - b.scores[t.key]);
            return [q.id, (best ? sorted[sorted.length - 1] : sorted[0]).id];
          }),
        );
      expect(normalize(computeRaw(questions, pick(false)), traits)[t.key]).toBe(0);
      expect(normalize(computeRaw(questions, pick(true)), traits)[t.key]).toBe(100);
    }
  });

  it('rejects incomplete answers', () => {
    const partial = allOf('A');
    delete partial[24];
    expect(isComplete(questions, partial)).toBe(false);
    expect(() => computeRaw(questions, partial)).toThrow(/Question 24/);
  });
});

describe('matching', () => {
  it('returns an exact profile as a 100% top match', () => {
    const [top] = matchDrivers(drivers[5].traits, drivers);
    expect(top.driver.id).toBe(drivers[5].id);
    expect(top.match).toBe(100);
  });

  it('returns top 3 sorted by similarity', () => {
    const result = matchDrivers(vec([50, 50, 50, 50, 50, 50, 50, 50]), drivers);
    expect(result).toHaveLength(3);
    expect(result[0].distance).toBeLessThanOrEqual(result[1].distance);
    expect(result[1].distance).toBeLessThanOrEqual(result[2].distance);
  });

  it('breaks ties by data order', () => {
    const twin = (id: string): Driver => ({ ...drivers[0], id });
    const result = matchDrivers(drivers[0].traits, [twin('first'), twin('second')], 2);
    expect(result.map((r) => r.driver.id)).toEqual(['first', 'second']);
  });
});

describe('translations', () => {
  it('has a Thai translation for every question and option', () => {
    for (const q of questions) {
      const th = thContent.questions[q.id];
      expect(th?.text, `question ${q.id}`).toBeTruthy();
      for (const o of q.options) expect(th.options[o.id], `question ${q.id} option ${o.id}`).toBeTruthy();
    }
  });

  it('has Thai labels for every trait and question type', () => {
    for (const tr of traits) {
      const th = thContent.traits[tr.key];
      for (const field of ['label', 'low', 'high', 'note'] as const) expect(th?.[field], `${tr.key}.${field}`).toBeTruthy();
    }
    for (const type of new Set(questions.map((q) => q.type))) expect(thContent.types[type], type).toBeTruthy();
  });

  it('has English and Thai blurbs for every driver', () => {
    for (const d of drivers) {
      expect(d.blurb.en, d.id).toBeTruthy();
      expect(d.blurb.th, d.id).toBeTruthy();
    }
  });

  it('has the same UI string keys in both languages', () => {
    expect(Object.keys(STRINGS.th).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });

  it('falls back to English content and fills variables', () => {
    expect(questionText(questions[0], 'en')).toBe(questions[0].text);
    expect(questionText(questions[0], 'th')).toBe(thContent.questions[1].text);
    expect(t('questionOf', { n: 3, total: 24 }, 'en')).toBe('Question 3 of 24');
    expect(t('questionOf', { n: 3, total: 24 }, 'th')).toBe('ข้อ 3 จาก 24');
  });
});
