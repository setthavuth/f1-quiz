"""Convert the F1 personality test spreadsheet into JSON for the web app.

Usage:  python scripts/build_data.py

Reads   F1_2026_Personality_Test_Questions_and_Scoring.xlsx
Writes  src/data/questions.json, src/data/traits.json
        src/data/drivers.json (only if a "Driver Profile" sheet exists)

Validation failures abort with a non-zero exit code.
"""

from __future__ import annotations

import json
import pathlib
import sys
from collections import OrderedDict

from openpyxl import load_workbook

ROOT = pathlib.Path(__file__).resolve().parent.parent
XLSX = ROOT / "F1_2026_Personality_Test_Questions_and_Scoring.xlsx"
OUT = ROOT / "src" / "data"

# (spreadsheet column header, JSON key) in canonical order
TRAITS = [
    ("Attack", "attack"),
    ("Composure", "composure"),
    ("Strategy", "strategy"),
    ("Competitive Drive", "competitiveDrive"),
    ("Sociability", "sociability"),
    ("Adaptability", "adaptability"),
    ("Independence", "independence"),
    ("Experimentation", "experimentation"),
]

# Ranges used by the spreadsheet's normalization formulas (Quiz Response!E29:L30).
EXPECTED_RANGES = {
    "attack": (-18, 40),
    "composure": (2, 56),
    "strategy": (7, 68),
    "competitiveDrive": (3, 50),
    "sociability": (-9, 50),
    "adaptability": (2, 49),
    "independence": (-14, 56),
    "experimentation": (-5, 55),
}

EXPECTED_QUESTIONS = 24
OPTION_IDS = ["A", "B", "C", "D"]
SCORE_MIN, SCORE_MAX = -2, 3

errors: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


def clean(value) -> str:
    return " ".join(str(value).split()) if value is not None else ""


def header_index(row) -> dict[str, int]:
    return {clean(v): i for i, v in enumerate(row) if v is not None}


def read_questions(wb):
    ws = wb["Question Bank"]
    rows = list(ws.iter_rows(values_only=True))
    h = header_index(rows[0])
    for col in ["Question ID", "Question Type", "Pair ID", "Question", "Option", "Answer Text"] + [t for t, _ in TRAITS]:
        if col not in h:
            fail(f"Question Bank: missing column '{col}'")
    if errors:
        return []

    questions: "OrderedDict[int, dict]" = OrderedDict()
    for n, r in enumerate(rows[1:], start=2):
        if r[h["Question ID"]] is None:
            continue
        qid = int(r[h["Question ID"]])
        q = questions.setdefault(qid, {
            "id": qid,
            "type": clean(r[h["Question Type"]]),
            "pairId": clean(r[h["Pair ID"]]),
            "text": clean(r[h["Question"]]),
            "options": [],
        })
        scores = {}
        for col, key in TRAITS:
            v = r[h[col]]
            if not isinstance(v, (int, float)) or int(v) != v:
                fail(f"Row {n}: {col} score '{v}' is not an integer")
                continue
            v = int(v)
            if not SCORE_MIN <= v <= SCORE_MAX:
                fail(f"Row {n}: {col} score {v} outside {SCORE_MIN}..{SCORE_MAX}")
            scores[key] = v
        q["options"].append({
            "id": clean(r[h["Option"]]),
            "text": clean(r[h["Answer Text"]]),
            "scores": scores,
        })

    qs = list(questions.values())
    if len(qs) != EXPECTED_QUESTIONS:
        fail(f"Expected {EXPECTED_QUESTIONS} questions, found {len(qs)}")
    if [q["id"] for q in qs] != list(range(1, len(qs) + 1)):
        fail("Question IDs must be 1..N in order")
    for q in qs:
        ids = [o["id"] for o in q["options"]]
        if ids != OPTION_IDS:
            fail(f"Question {q['id']}: options must be {OPTION_IDS}, found {ids}")

    pairs: dict[str, list[dict]] = {}
    for q in qs:
        pairs.setdefault(q["pairId"], []).append(q)
    for pid, members in pairs.items():
        racing = [m for m in members if m["type"] == "Racing"]
        if len(members) != 2 or len(racing) != 1:
            fail(f"Pair {pid}: expected one Racing + one real-life question, found {[(m['id'], m['type']) for m in members]}")
    return qs


def compute_ranges(questions):
    ranges = {}
    for _, key in TRAITS:
        lo = sum(min(o["scores"][key] for o in q["options"]) for q in questions)
        hi = sum(max(o["scores"][key] for o in q["options"]) for q in questions)
        ranges[key] = (lo, hi)
        if (lo, hi) != EXPECTED_RANGES[key]:
            fail(f"Trait {key}: computed range {lo}..{hi} differs from spreadsheet formula range "
                 f"{EXPECTED_RANGES[key]}. Update EXPECTED_RANGES (and the Quiz Response sheet) if intentional.")
    return ranges


def read_traits(wb, ranges):
    ws = wb["Trait Guide"]
    rows = list(ws.iter_rows(values_only=True))
    h = header_index(rows[0])
    guide = {clean(r[h["Trait"]]): r for r in rows[1:] if r[h["Trait"]]}
    traits = []
    for label, key in TRAITS:
        r = guide.get(label)
        if r is None:
            fail(f"Trait Guide: missing trait '{label}'")
            continue
        traits.append({
            "key": key,
            "label": label,
            "low": clean(r[h["Low-score expression"]]),
            "high": clean(r[h["High-score expression"]]),
            "note": clean(r[h["Interpretation note"]]),
            "min": ranges[key][0],
            "max": ranges[key][1],
        })
    return traits


def read_drivers(wb):
    """Optional sheet. Columns: Driver ID, Driver, Team, Team Color, Number, Blurb, Blurb (TH), + 8 trait columns (0-100)."""
    if "Driver Profile" not in wb.sheetnames:
        return None
    ws = wb["Driver Profile"]
    rows = list(ws.iter_rows(values_only=True))
    h = header_index(rows[0])
    required = ["Driver ID", "Driver", "Team", "Team Color", "Blurb", "Blurb (TH)"] + [t for t, _ in TRAITS]
    missing = [c for c in required if c not in h]
    if missing:
        fail(f"Driver Profile: missing columns {missing}")
        return None
    drivers = []
    for n, r in enumerate(rows[1:], start=2):
        if not r[h["Driver ID"]]:
            continue
        traits = {}
        for col, key in TRAITS:
            v = r[h[col]]
            if not isinstance(v, (int, float)) or not 0 <= v <= 100:
                fail(f"Driver Profile row {n}: {col} must be 0..100, got '{v}'")
                continue
            traits[key] = round(v)
        d = {
            "id": clean(r[h["Driver ID"]]),
            "name": clean(r[h["Driver"]]),
            "team": clean(r[h["Team"]]),
            "teamColor": clean(r[h["Team Color"]]),
            "blurb": {
                "en": clean(r[h["Blurb"]]),
                "th": clean(r[h["Blurb (TH)"]]) if "Blurb (TH)" in h else "",
            },
            "traits": traits,
        }
        if not d["blurb"]["th"]:
            fail(f"Driver Profile row {n}: missing Thai blurb (column 'Blurb (TH)')")
        if "Number" in h and r[h["Number"]] is not None:
            d["number"] = int(r[h["Number"]])
        drivers.append(d)
    return {"placeholder": False, "drivers": drivers}


def write_json(name, data):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)}")


def main() -> int:
    wb = load_workbook(XLSX, data_only=False)
    questions = read_questions(wb)
    ranges = compute_ranges(questions) if questions and not errors else {}
    traits = read_traits(wb, ranges) if ranges else []
    drivers = read_drivers(wb)

    if errors:
        print("Validation failed:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    write_json("questions.json", questions)
    write_json("traits.json", traits)
    if drivers is not None:
        write_json("drivers.json", drivers)
    else:
        print("no 'Driver Profile' sheet found; leaving src/data/drivers.json (placeholder) untouched")
    return 0


if __name__ == "__main__":
    sys.exit(main())
