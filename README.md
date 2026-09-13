# Says Daily

A daily survey-guessing game inspired by the Family-Feud-style format popularized by TV game shows: each day features **one** open-ended prompt (e.g. "Name something you'd find in a kitchen") with a board of 5-10 ranked common-sense answers, each worth points. Guess as many as you can before 3 wrong or duplicate guesses end the round.

Fully static (HTML/CSS/JS, no backend) and deployable via GitHub Pages.

## How it works

- `questions/boards.json` — a bank of 200+ survey boards, each with a category, a prompt, and a ranked list of answers (points summing to 100 per board).
- Each day, one board is picked deterministically from a hash of the date, so every visitor gets the same daily board.
- The player types free-text guesses. Guesses are matched against the board's answers with typo tolerance (Levenshtein-based fuzzy matching) and curated synonym/alias lists — see `scoring.js`.
- 3 strikes (a wrong guess or a duplicate of an already-revealed answer) ends the round early; the score locks in whatever was revealed.
- Streaks are tracked in `localStorage`, and a replay lock stores the day's result so refreshing doesn't reset progress.
- After the round, a compact shareable text summary is generated for copy/paste.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `style.css` | Modern game-show-style visuals (gradient stage, flip tiles, strike indicators) |
| `script.js` | Daily board selection, game loop (guesses/strikes/score), streak tracking, share text |
| `scoring.js` (`GameEngine`) | Typo-tolerant guess matching against a board's ranked answers |
| `questions/boards.json` | The survey board bank |
| `scripts/validate_boards.js` | Validates `boards.json`: schema, point totals (=100, descending), no duplicate prompts/ids |

## Board schema

```json
{
  "id": "hh_001",
  "category": "Kitchen Items",
  "prompt": "Name something you'd find in a kitchen.",
  "answers": [
    { "rank": 1, "text": "Refrigerator", "points": 28, "acceptableAnswers": ["refrigerator", "fridge"] },
    { "rank": 2, "text": "Stove", "points": 22, "acceptableAnswers": ["stove", "oven", "range"] }
  ]
}
```

Each board has 5-10 answers; points are positive integers, strictly descending by rank, summing to exactly 100.

## Validating the board bank

```
node scripts/validate_boards.js
```

## Running locally

Any static file server works, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deployment

Deployed via GitHub Pages from the `main` branch root.
