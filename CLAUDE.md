# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**F1 2026 Personality Test**: a static web app. Users answer 24 scenario questions, get scores on 8 personality traits, and are matched to the 2026 F1 drivers whose profiles are closest. It is hosted on **GitHub Pages**, so there is no backend: everything runs in the browser.

This is an unofficial fan project for entertainment. It is not a scientific or clinical psychological measurement.

**Audience: mainly Thai.** The app is bilingual (Thai and English), and **Thai is the default language**. Every user-facing string must exist in both languages.

## Source of truth

`F1_2026_Personality_Test_Questions_and_Scoring.xlsx` is the canonical spec. Do not hand-edit generated question data. Change the spreadsheet and regenerate.

| Sheet | Contents |
|---|---|
| Question Bank | 96 rows = 24 questions × 4 options (A–D). Columns: Question ID, Question Type, Pair ID, Question, Option, Answer Text, then 8 trait scores |
| Quiz Response | Reference implementation of scoring (Excel formulas) |
| Trait Guide | Low/high descriptions + interpretation note per trait |
| Scoring Notes | Design rationale (pairing, scale, balance) |

### Traits (fixed order, used everywhere)
`attack, composure, strategy, competitiveDrive, sociability, adaptability, independence, experimentation`

### Question structure
- 24 questions: 12 **Racing**, plus 12 real-life analogues (**Everyday / Work / Pressure / Social**).
- Each **Pair ID** (P1–P12) links one racing question with one real-life question that measures similar traits. This reduces aspirational racing bias.
- Every option scores **all 8 traits** with integers from **-2 to +3**.
- Option letters are deliberately balanced: no letter maps to one style. **Shuffling option display order is allowed**, but scoring must key on the option ID and never on the displayed position.

### Scoring algorithm (must match the spreadsheet exactly)
1. `raw[trait] = Σ score(question, selectedOption, trait)` over all 24 answers.
2. `normalized[trait] = round((raw - min) / (max - min) * 100)`, which gives 0–100.
3. Compute only when all 24 questions are answered.

Min/max per trait (the sum of per-question min/max options, verified against the data):

| Trait | Min | Max |
|---|---|---|
| Attack | -18 | 40 |
| Composure | 2 | 56 |
| Strategy | 7 | 68 |
| Competitive Drive | 3 | 50 |
| Sociability | -9 | 50 |
| Adaptability | 2 | 49 |
| Independence | -14 | 56 |
| Experimentation | -5 | 55 |

Compute min/max from the data in the build script rather than hard-coding it. Then assert that the values equal this table, so any spreadsheet edit that changes the ranges is noticed.

Note: Excel `ROUND` rounds half away from zero, while JS `Math.round` rounds half toward +∞. The values are all ≥ 0 here, so the two agree, but keep it in mind.

### Driver matching (NOT yet in the spreadsheet)
The spreadsheet's "Next step" calls for a **2026 Driver Profile** sheet: an 8-trait 0–100 profile for each of the 22 drivers. This still has to be authored (it is a creative, subjective decision for the project owner).
- **Current state:** `src/data/drivers.json` is hand-written **placeholder** data (`"placeholder": true`), and the results page shows a notice while that flag is set.
- Driver `blurb` is bilingual: `{ "en": ..., "th": ... }`. Names and team names stay in English.
- **To replace it:** add a `Driver Profile` sheet with columns `Driver ID, Driver, Team, Team Color, Number, Blurb, Blurb (TH)` plus the 8 trait columns (0–100). `npm run data` then overwrites drivers.json with `"placeholder": false`. Without that sheet, the script leaves drivers.json untouched.
- Similarity: Euclidean distance on the 8 normalized traits, converted to a match % (`100 - dist / maxDist * 100`, where `maxDist = sqrt(8 * 100²)`). Show the Top 3.
- Ties: break deterministically by driver order in the data file.
- Verify the 2026 grid (11 teams, 22 drivers including Cadillac) against an official source before release.

## Internationalization (Thai / English)
- English content comes from the spreadsheet JSON. **Thai content lives in `src/data/content.th.json`**, which is hand-maintained and not generated. It holds question text, option text, trait label/low/high/note, and question-type labels.
- When a question or option changes in the xlsx, update its Thai translation as well. Tests fail if any Thai entry is missing.
- UI strings live in `src/i18n.ts` (`STRINGS.en` / `STRINGS.th`, with the same keys and enforced by a test). Use `t('key', {vars})` in code. Never hard-code display text.
- Content accessors are `questionText`, `optionText`, `traitText`, `typeLabel` and `driverBlurb`. They fall back to English.
- The language choice is stored in `localStorage` under `f1quiz.lang`. Switching re-renders and keeps quiz state. `<html lang>` is updated, and CSS `:lang(th)` switches to the **Kanit** font, because Titillium Web has no Thai glyphs. Thai also needs a taller line-height.
- Thai has no spaces between words. Wrap canvas text with `Intl.Segmenter` (see `resultImage.ts`), and never split on spaces.
- Translations were written by Claude. Have a native Thai speaker review them before launch.

## Result image (replaces share links)
- `src/resultImage.ts` draws a 1080×1350 PNG (4:5, for social feeds) on a `<canvas>` in the current language. It shows the top match, P2/P3, the 8 trait bars, the site URL, and a "sample data" note while drivers are placeholders.
- It waits on `document.fonts.load(...)` before drawing, so the web fonts (including the Thai subset) are used.
- The UI shows the image in a `<dialog>` with **Download** (`<a download>`) and **Share** buttons. Share uses the Web Share API with files and is shown only when `navigator.canShare({files})` returns true. On phones, users can also long-press the image to save it.
- There are no share URLs or query params. Results persist via `localStorage`.

## Tech stack
- **Vite + TypeScript**, vanilla DOM (no framework needed at this size). Plain CSS with custom properties.
- **Vitest** for unit tests of scoring and matching.
- **Python + openpyxl** script to convert the xlsx to JSON (`scripts/build_data.py`).
- **GitHub Actions** deploys `dist/` to GitHub Pages on push to `main`.
- `vite.config.ts` uses `base: './'` (relative), so the build works under any Pages repo name.

### Toolchain quirks (Windows dev machine)
- **Smart App Control blocks Rollup's native `.node` binary** (`ERR_DLOPEN_FAILED`, "An Application Control policy has blocked this file"). `package.json` therefore overrides `rollup` with `npm:@rollup/wasm-node`. Keep this override.
- **npm 10 crashes resolving Vitest 4's optional peers** ("Cannot read properties of null (reading 'edgesOut')"). `.npmrc` sets `legacy-peer-deps=true` so that `npm install` and `npm ci` (including CI) work.
- If an install ever fails partway, delete `node_modules` and `package-lock.json`, then reinstall.

## Layout
```
CLAUDE.md
F1_2026_Personality_Test_Questions_and_Scoring.xlsx
scripts/build_data.py        # xlsx -> src/data/*.json, with validation
src/
  data/questions.json        # GENERATED, do not edit by hand
  data/traits.json           # GENERATED from Trait Guide (+ computed min/max)
  data/drivers.json          # PLACEHOLDER until the Driver Profile sheet exists
  data/content.th.json       # Thai translations (hand-maintained)
  i18n.ts                    # UI strings (th/en), current language, localized content accessors
  scoring.ts                 # pure: computeRaw, normalize, scoreQuiz, matchDrivers
  scoring.test.ts            # Vitest: scoring vs xlsx + translation completeness
  radar.ts                   # inline-SVG radar chart (you vs top match), localized labels
  resultImage.ts             # canvas-rendered PNG result card
  main.ts                    # UI: intro -> quiz -> results, state, localStorage, keyboard, image dialog
  styles.css                 # dark F1-inspired theme, CSS custom properties
index.html
.github/workflows/deploy.yml # test + build + deploy to GitHub Pages on push to main
```

### App behaviour notes
- Progress is saved in `localStorage` under `f1quiz.progress.v2` as `{index, answers, done}`. When `done` is set, a reload reopens the results page. "Retake" clears it.
- Selecting an answer auto-advances after 280 ms, except on the last question, which needs "See results".
- Keyboard: `1–4` / `A–D` select, `←` goes back, `→` goes forward.

## Commands
```bash
npm install
npm run dev           # local dev server
npm run build         # production build to dist/
npm run test          # vitest
python scripts/build_data.py   # regenerate JSON from the xlsx (requires openpyxl)
```
On Windows, write JSON with `encoding="utf-8"`. Some answer text contains curly quotes (e.g. "colleague’s"), and the console's default codepage garbles them.

## Development plan

**Status (2026-11-08):** Phases 1–4 and most of Phase 6 are done, using placeholder driver data. The Thai/English switch and the result image (in place of share links) have been added. Still remaining: Phase 5 (real driver profiles with Thai blurbs, and a check of the 2026 grid), native review of the Thai translations, an Open Graph image, and pushing to GitHub with Pages enabled.

**Phase 1: Data pipeline.** Write `build_data.py`: read the sheets, validate (24 questions, 4 options each, 12 pairs of 2, scores within -2..3, min/max table matches), and emit JSON. Fail loudly on any validation error.

**Phase 2: Scoring core.** Write `scoring.ts` as pure functions with Vitest tests. Test cases: all-A, all-B, all-C, all-D, plus one hand-computed mixed set. Cross-check these against the Excel Quiz Response sheet.

**Phase 3: Quiz UI.** Screens: intro/disclaimer → one question per screen with a progress bar (n/24) → results. Support Back/Next and keyboard navigation (1–4 / A–D, arrow keys). Persist in-progress answers in `localStorage` (wrapped in try/catch). Mobile-first.

**Phase 4: Results.** Show 8 trait bars (0–100) labeled with the Trait Guide's low/high expressions. An optional radar chart is inline SVG, with no chart library required. Show the Top 3 driver matches with match %, a "Retake" button, and a "Save result image" button (PNG via canvas; see above).

**Phase 5: Driver profiles.** Add the Driver Profile sheet to the xlsx (owner provides the scores) and extend `build_data.py`. Add a short blurb per driver.

**Phase 6: Polish & deploy.** Add F1-inspired styling (dark theme, racing accents), an accessibility pass (contrast, focus states, `aria-live` for progress), Open Graph meta for sharing, the GitHub Actions Pages workflow, and a README.

## Conventions & constraints
- Keep scoring logic pure and framework-free, and keep it separate from the DOM code.
- Do not use official F1, FIA, or team logos, trademarks, or driver photos without rights. Use team colors, text, and original graphics. Show a footer disclaimer: "Unofficial fan project. Not affiliated with Formula 1, the FIA, or any team."
- No analytics or tracking, and no data leaves the browser.
- Only add dependencies when they clearly earn their place. The site should stay small and fast.
