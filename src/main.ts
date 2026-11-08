import './styles.css';
import questionsJson from './data/questions.json';
import traitsJson from './data/traits.json';
import driversJson from './data/drivers.json';
import { radarSvg } from './radar';
import { renderResultImage } from './resultImage';
import {
  driverBlurb,
  getLang,
  initLang,
  optionText,
  questionText,
  setLang,
  t,
  traitText,
  typeLabel,
  type Lang,
} from './i18n';
import {
  isComplete,
  matchDrivers,
  scoreQuiz,
  type Answers,
  type Driver,
  type Question,
  type TraitInfo,
} from './scoring';

const questions = questionsJson as Question[];
const traits = traitsJson as TraitInfo[];
const driverData = driversJson as { placeholder: boolean; drivers: Driver[] };

const STORAGE_KEY = 'f1quiz.progress.v2';
const AUTO_ADVANCE_MS = 280;

type Screen = 'intro' | 'quiz' | 'results';
const state: { screen: Screen; index: number; answers: Answers } = {
  screen: 'intro',
  index: 0,
  answers: {},
};

const app = document.getElementById('app')!;
let advanceTimer: number | undefined;
let imageUrl: string | null = null;

// ---------- persistence ----------

interface Saved {
  index: number;
  answers: Answers;
  done: boolean;
}

function save() {
  try {
    const data: Saved = { index: state.index, answers: state.answers, done: state.screen === 'results' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable: progress just won't persist */
  }
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data?.index !== 'number' || typeof data?.answers !== 'object' || !data.answers) return null;
    return { index: data.index, answers: data.answers, done: !!data.done };
  } catch {
    return null;
  }
}

function clearSaved() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------- helpers ----------

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const answeredCount = () => questions.filter((q) => state.answers[q.id]).length;

function applyLangToPage() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.title = t('pageTitle');
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as Parameters<typeof t>[0]);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
  });
  document.querySelector('.lang')?.setAttribute('aria-label', t('langLabel'));
}

function results() {
  const { normalized } = scoreQuiz(questions, traits, state.answers);
  return { normalized, matches: matchDrivers(normalized, driverData.drivers, 3) };
}

// ---------- screens ----------

function introView(): string {
  const saved = load();
  const savedCount = saved ? Object.keys(saved.answers).length : 0;
  const resumable = savedCount > 0;
  return `
    <section class="screen intro">
      <p class="eyebrow">${esc(t('introEyebrow'))}</p>
      <h1 tabindex="-1">${esc(t('introTitle1'))}<br /><span class="accent">${esc(t('introTitle2'))}</span></h1>
      <p class="lead">${esc(t('introLead', { n: questions.length }))}</p>
      <ul class="facts">
        <li><strong>${questions.length}</strong> ${esc(t('factQuestions'))}</li>
        <li><strong>8</strong> ${esc(t('factTraits'))}</li>
        <li><strong>~5</strong> ${esc(t('factMinutes'))}</li>
      </ul>
      <div class="actions">
        ${resumable ? `<button class="btn primary" data-action="resume">${esc(t('resume', { n: savedCount, total: questions.length }))}</button>` : ''}
        <button class="btn ${resumable ? 'ghost' : 'primary'}" data-action="start">${esc(t(resumable ? 'startOver' : 'start'))}</button>
      </div>
      <p class="fine">${esc(t('introFine'))}</p>
    </section>`;
}

function quizView(): string {
  const q = questions[state.index];
  const selected = state.answers[q.id];
  const progress = (answeredCount() / questions.length) * 100;
  const last = state.index === questions.length - 1;
  const canFinish = isComplete(questions, state.answers);

  return `
    <section class="screen quiz">
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${questions.length}" aria-valuenow="${answeredCount()}" aria-label="${esc(t('answeredLabel'))}">
        <div class="progress-fill" style="width:${progress}%"></div>
      </div>
      <div class="quiz-meta">
        <span aria-live="polite">${esc(t('questionOf', { n: state.index + 1, total: questions.length }))}</span>
        <span class="chip chip-${q.type.toLowerCase()}">${esc(typeLabel(q.type))}</span>
      </div>
      <h2 class="question" tabindex="-1">${esc(questionText(q))}</h2>
      <div class="options" role="radiogroup" aria-label="${esc(t('optionsLabel'))}">
        ${q.options
          .map(
            (o, i) => `
          <button class="option ${selected === o.id ? 'selected' : ''}" role="radio" aria-checked="${selected === o.id}"
                  data-action="select" data-option="${o.id}">
            <span class="key" aria-hidden="true">${i + 1}</span>
            <span class="option-text">${esc(optionText(q, o))}</span>
          </button>`,
          )
          .join('')}
      </div>
      <div class="nav">
        <button class="btn ghost" data-action="back" ${state.index === 0 ? 'disabled' : ''}>${esc(t('back'))}</button>
        ${
          last
            ? `<button class="btn primary" data-action="finish" ${canFinish ? '' : 'disabled'}>${esc(t('seeResults'))}</button>`
            : `<button class="btn ghost" data-action="next" ${selected ? '' : 'disabled'}>${esc(t('next'))}</button>`
        }
      </div>
      <p class="fine hint">${esc(t('keyHint'))}</p>
    </section>`;
}

function resultsView(): string {
  const { normalized, matches } = results();
  const [top, ...rest] = matches;

  const bars = traits
    .map((tr) => {
      const tx = traitText(tr);
      const v = normalized[tr.key];
      return `
      <li class="trait">
        <div class="trait-head"><span class="trait-name">${esc(tx.label)}</span><span class="trait-value">${v}</span></div>
        <div class="bar" title="${esc(tx.note)}"><div class="bar-fill" style="width:${v}%"></div></div>
        <div class="trait-ends"><span>${esc(tx.low)}</span><span>${esc(tx.high)}</span></div>
      </li>`;
    })
    .join('');

  const card = (m: (typeof matches)[number], rank: number) => `
    <article class="driver ${rank === 1 ? 'driver-top' : ''}" style="--team:${m.driver.teamColor}">
      <div class="driver-rank">P${rank}</div>
      <div class="driver-body">
        <h3>${esc(m.driver.name)}</h3>
        <p class="driver-team">${esc(m.driver.team)}</p>
        ${rank === 1 ? `<p class="driver-blurb">${esc(driverBlurb(m.driver))}</p>` : ''}
      </div>
      <div class="driver-match"><strong>${m.match}%</strong><span>${esc(t('match'))}</span></div>
    </article>`;

  const labels = traits.map((tr) => traitText(tr).label);

  return `
    <section class="screen results">
      <p class="eyebrow">${esc(t('resultsEyebrow'))}</p>
      <h1 tabindex="-1">${esc(t('youDriveLike'))}<br /><span class="accent">${esc(top.driver.name)}</span></h1>
      ${driverData.placeholder ? `<p class="notice">${esc(t('placeholderNotice'))}</p>` : ''}
      <div class="podium">
        ${card(top, 1)}
        ${rest.map((m, i) => card(m, i + 2)).join('')}
      </div>

      <h2 class="section-title">${esc(t('profileTitle'))}</h2>
      <div class="profile">
        <div class="radar-wrap">
          ${radarSvg(labels, normalized, t('radarLabel', { name: top.driver.name }), { color: top.driver.teamColor, traits: top.driver.traits })}
          <div class="legend">
            <span><i class="swatch you"></i>${esc(t('you'))}</span>
            <span><i class="swatch" style="background:${top.driver.teamColor}"></i>${esc(top.driver.name)}</span>
          </div>
        </div>
        <ul class="traits">${bars}</ul>
      </div>

      <div class="actions">
        <button class="btn primary" data-action="save-image">${esc(t('saveImage'))}</button>
        <button class="btn ghost" data-action="retake">${esc(t('retake'))}</button>
      </div>
      <p class="fine" id="image-status" role="status"></p>

      <dialog class="image-dialog" id="image-dialog" aria-labelledby="image-dialog-title">
        <div class="dialog-head">
          <h2 id="image-dialog-title">${esc(t('imageTitle'))}</h2>
          <button class="icon-btn" data-action="close-image" aria-label="${esc(t('close'))}">✕</button>
        </div>
        <img class="result-image" alt="${esc(t('imageTitle'))}" />
        <p class="fine">${esc(t('imageHint'))}</p>
        <div class="actions">
          <a class="btn primary" id="image-download" download>${esc(t('download'))}</a>
          <button class="btn ghost" data-action="share-image" hidden>${esc(t('share'))}</button>
        </div>
      </dialog>
    </section>`;
}

// ---------- render + actions ----------

function render(focus = true) {
  applyLangToPage();
  app.innerHTML =
    state.screen === 'intro' ? introView() : state.screen === 'quiz' ? quizView() : resultsView();
  if (focus) app.querySelector<HTMLElement>('h1, h2.question')?.focus({ preventScroll: true });
}

function show(screen: Screen) {
  state.screen = screen;
  render();
  window.scrollTo({ top: 0 });
}

function go(index: number) {
  window.clearTimeout(advanceTimer);
  state.index = Math.max(0, Math.min(questions.length - 1, index));
  save();
  render();
}

function select(optionId: string) {
  const q = questions[state.index];
  state.answers[q.id] = optionId;
  save();
  render();
  window.clearTimeout(advanceTimer);
  if (state.index < questions.length - 1) {
    const from = state.index;
    advanceTimer = window.setTimeout(() => {
      if (state.screen === 'quiz' && state.index === from) go(from + 1);
    }, AUTO_ADVANCE_MS);
  }
}

function finish() {
  if (!isComplete(questions, state.answers)) {
    go(questions.findIndex((q) => !state.answers[q.id]));
    return;
  }
  window.clearTimeout(advanceTimer);
  state.screen = 'results';
  save();
  show('results');
}

let imageFile: File | null = null;

async function saveImage(button: HTMLButtonElement) {
  const status = document.getElementById('image-status');
  const dialog = document.getElementById('image-dialog') as HTMLDialogElement | null;
  const label = button.textContent;
  button.disabled = true;
  button.textContent = t('generating');
  try {
    const { normalized, matches } = results();
    const blob = await renderResultImage({
      lang: getLang(),
      matches,
      normalized,
      traits,
      placeholder: driverData.placeholder,
      siteUrl: (location.host + location.pathname).replace(/\/(index\.html)?$/, ''),
    });
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(blob);
    const filename = `f1-personality-${matches[0].driver.id}.png`;
    imageFile = new File([blob], filename, { type: 'image/png' });

    const img = dialog?.querySelector<HTMLImageElement>('.result-image');
    const link = document.getElementById('image-download') as HTMLAnchorElement | null;
    const shareBtn = dialog?.querySelector<HTMLButtonElement>('[data-action=share-image]');
    if (img) img.src = imageUrl;
    if (link) {
      link.href = imageUrl;
      link.download = filename;
    }
    if (shareBtn) shareBtn.hidden = !(navigator.canShare?.({ files: [imageFile] }) ?? false);
    if (status) status.textContent = '';
    if (dialog?.showModal) dialog.showModal();
    else link?.click();
  } catch (err) {
    console.error(err);
    if (status) status.textContent = t('imageError');
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

async function shareImage() {
  if (!imageFile) return;
  try {
    await navigator.share({ files: [imageFile], title: t('pageTitle') });
  } catch {
    /* user cancelled or share failed: the download button remains available */
  }
}

app.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  // click on the dialog backdrop closes it
  if (target instanceof HTMLDialogElement) {
    target.close();
    return;
  }
  const el = target.closest<HTMLElement>('[data-action]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  switch (el.dataset.action) {
    case 'start':
      clearSaved();
      state.answers = {};
      state.screen = 'quiz';
      go(0);
      break;
    case 'resume': {
      const saved = load();
      state.answers = saved?.answers ?? {};
      state.screen = 'quiz';
      go(saved?.index ?? 0);
      break;
    }
    case 'select':
      select(el.dataset.option!);
      break;
    case 'back':
      go(state.index - 1);
      break;
    case 'next':
      go(state.index + 1);
      break;
    case 'finish':
      finish();
      break;
    case 'save-image':
      void saveImage(el as HTMLButtonElement);
      break;
    case 'share-image':
      void shareImage();
      break;
    case 'close-image':
      (document.getElementById('image-dialog') as HTMLDialogElement | null)?.close();
      break;
    case 'retake':
      clearSaved();
      state.answers = {};
      state.index = 0;
      show('intro');
      break;
  }
});

document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-lang]');
  if (!btn) return;
  const lang = btn.dataset.lang as Lang;
  if (lang === getLang()) return;
  setLang(lang);
  render(false);
});

document.addEventListener('keydown', (e) => {
  if (state.screen !== 'quiz' || e.altKey || e.ctrlKey || e.metaKey) return;
  const q = questions[state.index];
  const n = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
  if (e.key.length === 1 && n >= 0 && q.options[n]) {
    e.preventDefault();
    select(q.options[n].id);
  } else if (e.key === 'ArrowLeft' && state.index > 0) {
    e.preventDefault();
    go(state.index - 1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (state.index === questions.length - 1) finish();
    else if (state.answers[q.id]) go(state.index + 1);
  }
});

// ---------- boot ----------

initLang();
const saved = load();
if (saved?.done && isComplete(questions, saved.answers)) {
  state.answers = saved.answers;
  state.index = Math.min(saved.index, questions.length - 1);
  state.screen = 'results';
}
render();
