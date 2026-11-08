# F1 2026 Personality Test

Answer 24 scenarios (12 on track, 12 in everyday life), get scored on eight racing traits, and see which three drivers on the 2026 grid are most like you. The app is available in **Thai (default) and English**, and you can save your result as an image to post on social media.

It's a static site (Vite + TypeScript) hosted on GitHub Pages. No data leaves the browser.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # scoring tests (checked against the spreadsheet)
npm run build    # production build in dist/
```

## Editing questions or scoring

The spreadsheet `F1_2026_Personality_Test_Questions_and_Scoring.xlsx` is the source of truth. After editing it:

```bash
pip install openpyxl
npm run data     # regenerates src/data/*.json, with validation
```

Thai translations live in `src/data/content.th.json`. Update them whenever a question or answer changes. `npm test` fails if any translation is missing.

Driver profiles are currently **placeholders** in `src/data/drivers.json`. To replace them, add a `Driver Profile` sheet to the spreadsheet with these columns: `Driver ID, Driver, Team, Team Color, Number, Blurb, Blurb (TH)`, plus the 8 trait columns (0–100). Then run `npm run data`.

## Deploy

Push to `main`. In the GitHub repo, go to **Settings → Pages → Source** and select **GitHub Actions**. The workflow in `.github/workflows/deploy.yml` tests, builds, and publishes the site.

---

Unofficial fan project for entertainment. It is not a scientific or clinical psychological assessment, and it is not affiliated with Formula 1, the FIA, or any team.
