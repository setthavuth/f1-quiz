// Language handling: UI strings + localized spreadsheet content.
// English content comes from the spreadsheet JSON; Thai content from content.th.json.

import thJson from './data/content.th.json';
import type { Driver, Option, Question, TraitInfo, TraitKey } from './scoring';

export type Lang = 'th' | 'en';
export const LANGS: Lang[] = ['th', 'en'];
export const DEFAULT_LANG: Lang = 'th'; // primary audience is Thai

interface ThaiContent {
  types: Record<string, string>;
  traits: Record<TraitKey, { label: string; low: string; high: string; note: string }>;
  questions: Record<string, { text: string; options: Record<string, string> }>;
}
export const thContent = thJson as ThaiContent;

const en = {
  pageTitle: 'F1 Personality Test',
  brand: 'F1 Personality Test',
  langLabel: 'Language',
  footer:
    'Unofficial fan project for entertainment. Not a scientific or clinical psychological assessment. Not affiliated with Formula 1, the FIA, or any team.',

  introEyebrow: '2026 Season · Personality Test',
  introTitle1: 'Which F1 driver',
  introTitle2: 'are you?',
  introLead:
    '{n} scenarios, half on track and half in everyday life. Discover your profile across eight racing traits and find the three drivers on the 2026 grid most like you.',
  factQuestions: 'questions',
  factTraits: 'traits',
  factMinutes: 'minutes',
  resume: 'Resume ({n}/{total})',
  startOver: 'Start over',
  start: 'Lights out, let’s go',
  introFine: 'There are no right or wrong answers. Pick what you would actually do, not what a racing driver should do.',

  questionOf: 'Question {n} of {total}',
  answeredLabel: 'Answered questions',
  optionsLabel: 'Answer options',
  back: '← Back',
  next: 'Next →',
  seeResults: 'See results 🏁',
  keyHint: 'Tip: press 1–4 to answer, ← → to move.',

  resultsEyebrow: 'Chequered flag',
  youDriveLike: 'You drive like',
  placeholderNotice: 'Driver profiles are placeholder data during development, so matches are illustrative only.',
  match: 'match',
  profileTitle: 'Your trait profile',
  you: 'You',
  radarLabel: 'Your trait profile compared with {name}',
  saveImage: 'Save result image',
  generating: 'Creating image…',
  retake: 'Retake test',

  imageTitle: 'Your result image',
  imageHint: 'On a phone, press and hold the image to save it, or use Share.',
  download: 'Download',
  share: 'Share',
  close: 'Close',
  imageError: 'Sorry, the image could not be created. Please try again.',
  imageHeader: 'F1 2026 Personality Test',
  imageSample: 'Sample driver data: matches are illustrative only',
  imageOthers: 'Also matches',
};

type Strings = typeof en;

const th: Strings = {
  pageTitle: 'แบบทดสอบบุคลิกภาพ F1',
  brand: 'แบบทดสอบบุคลิกภาพ F1',
  langLabel: 'ภาษา',
  footer:
    'โปรเจกต์ของแฟนคลับที่ไม่เป็นทางการ เพื่อความบันเทิงเท่านั้น ไม่ใช่การประเมินทางจิตวิทยาเชิงวิทยาศาสตร์หรือทางคลินิก และไม่มีส่วนเกี่ยวข้องกับ Formula 1, FIA หรือทีมใด ๆ',

  introEyebrow: 'ฤดูกาล 2026 · แบบทดสอบบุคลิกภาพ',
  introTitle1: 'คุณคือนักแข่ง F1',
  introTitle2: 'คนไหน?',
  introLead:
    '{n} สถานการณ์ ครึ่งหนึ่งบนสนามแข่ง อีกครึ่งในชีวิตประจำวัน ค้นหาบุคลิกของคุณผ่าน 8 คุณลักษณะของนักแข่ง แล้วดูว่านักแข่ง 3 คนไหนบนกริดปี 2026 ที่เหมือนคุณที่สุด',
  factQuestions: 'ข้อ',
  factTraits: 'คุณลักษณะ',
  factMinutes: 'นาที',
  resume: 'ทำต่อ ({n}/{total})',
  startOver: 'เริ่มใหม่',
  start: 'ไฟดับ ออกตัวได้!',
  introFine: 'ไม่มีคำตอบถูกหรือผิด เลือกสิ่งที่คุณจะทำจริง ๆ ไม่ใช่สิ่งที่นักแข่งควรทำ',

  questionOf: 'ข้อ {n} จาก {total}',
  answeredLabel: 'จำนวนข้อที่ตอบแล้ว',
  optionsLabel: 'ตัวเลือกคำตอบ',
  back: '← ย้อนกลับ',
  next: 'ถัดไป →',
  seeResults: 'ดูผลลัพธ์ 🏁',
  keyHint: 'เคล็ดลับ: กด 1–4 เพื่อตอบ และ ← → เพื่อเลื่อนข้อ',

  resultsEyebrow: 'เข้าเส้นชัย!',
  youDriveLike: 'สไตล์ของคุณเหมือน',
  placeholderNotice: 'ข้อมูลนักแข่งยังเป็นข้อมูลตัวอย่างระหว่างการพัฒนา ผลการจับคู่จึงเป็นเพียงตัวอย่างเท่านั้น',
  match: 'ตรงกัน',
  profileTitle: 'โปรไฟล์คุณลักษณะของคุณ',
  you: 'คุณ',
  radarLabel: 'โปรไฟล์คุณลักษณะของคุณเทียบกับ {name}',
  saveImage: 'บันทึกรูปผลลัพธ์',
  generating: 'กำลังสร้างรูป…',
  retake: 'ทำแบบทดสอบใหม่',

  imageTitle: 'รูปผลลัพธ์ของคุณ',
  imageHint: 'บนมือถือ กดค้างที่รูปเพื่อบันทึก หรือกด "แชร์"',
  download: 'ดาวน์โหลด',
  share: 'แชร์',
  close: 'ปิด',
  imageError: 'ขออภัย สร้างรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  imageHeader: 'แบบทดสอบบุคลิกภาพ F1 2026',
  imageSample: 'ข้อมูลนักแข่งเป็นข้อมูลตัวอย่าง ผลการจับคู่เป็นเพียงตัวอย่าง',
  imageOthers: 'ใกล้เคียงกับ',
};

export const STRINGS: Record<Lang, Strings> = { en, th };
export type StringKey = keyof Strings;

// ---------- current language ----------

const LANG_KEY = 'f1quiz.lang';
let current: Lang = DEFAULT_LANG;

export function initLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'th' || saved === 'en') current = saved;
  } catch {
    /* storage unavailable */
  }
  return current;
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  current = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage unavailable */
  }
}

export function t(key: StringKey, vars: Record<string, string | number> = {}, lang: Lang = current): string {
  return STRINGS[lang][key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

// ---------- localized content ----------

export function questionText(q: Question, lang: Lang = current): string {
  return lang === 'th' ? thContent.questions[q.id]?.text ?? q.text : q.text;
}

export function optionText(q: Question, o: Option, lang: Lang = current): string {
  return lang === 'th' ? thContent.questions[q.id]?.options[o.id] ?? o.text : o.text;
}

export function typeLabel(type: string, lang: Lang = current): string {
  return lang === 'th' ? thContent.types[type] ?? type : type;
}

export function traitText(tr: TraitInfo, lang: Lang = current) {
  if (lang === 'th') {
    const x = thContent.traits[tr.key];
    if (x) return x;
  }
  return { label: tr.label, low: tr.low, high: tr.high, note: tr.note };
}

export function driverBlurb(d: Driver, lang: Lang = current): string {
  return d.blurb[lang] || d.blurb.en;
}
