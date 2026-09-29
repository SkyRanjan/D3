# Token Estimator Pro

Estimate Claude token usage and cost **before** you send a prompt. Paste a prompt, and the app:

1. counts its tokens with the open-source `o200k_base` tokenizer,
2. classifies it into one of the dataset's 12 categories with a local classifier,
3. estimates the reply length with that category's formula (plus an 80% range),
4. prices input and output separately for Claude Sonnet 5 and Claude Opus 5.

Everything runs in the browser. It needs no API key and makes no paid calls, and it works offline and behind Zscaler.

## Run the app

Requires Node.js 22.15+ (tested with 24).

```powershell
cd app
$env:NODE_OPTIONS = "--use-system-ca"   # Zscaler: let npm trust the Windows certificate store
npm install
npm run dev                             # http://localhost:5173
```

`npm test` runs the engine tests (parity with the Python pipeline). `npm run build` produces a static site in `app/dist/` you can host anywhere.

## Rebuild the engine (Python)

The app ships with a built engine (`app/public/engine/*.json`). Rebuild it after changing the dataset:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r pipeline\requirements.txt
.venv\Scripts\python pipeline\build_engine.py
```

`build_engine.py` performs these steps:

| Step | What it does |
|---|---|
| Re-count | Every prompt and response with `o200k_base` (tiktoken). The browser runs the identical tokenizer (js-tiktoken). The dataset's original counts came from a synthetic counter (`synthetic_approx_v1`) that no tokenizer reproduces, so they are kept only for reference. |
| Re-fit | One formula per category with the unchanged `pipeline/token_formula_analysis.py`: linear, logarithmic, power and quadratic candidates; reliability checks (never negative, never more than doubling when the input doubles); 5-fold cross-validation. All 12 categories came out linear. |
| Classify | Trains a TF-IDF + logistic-regression classifier on the 12 labels. Held-out accuracy is 98.3%, with identical prompts never split across train and test. |
| Score | Measures the full pipeline on 20% held-out prompts: ±32.7 output tokens typical error (MAE), the same as with the true labels. |
| Export | Writes the JSON the app loads, plus parity fixtures for the app's tests. |

The tokenizer file is bundled in `pipeline/.cache/tiktoken`, so the build runs offline. If a download is ever needed, the scripts use the Windows certificate store (truststore), which works behind Zscaler.

## Optional: calibrate against Claude's real tokenizer (free)

`o200k_base` is not Claude's tokenizer. Claude's counts are available only through Anthropic's token-counting endpoint. The endpoint is free to use but rate-limited, and it needs an API key. To measure the ratio on a sample of this dataset:

```powershell
.venv\Scripts\python -m pip install -r pipeline\requirements-claude.txt
.venv\Scripts\python pipeline\calibrate_claude.py --dry-run
.venv\Scripts\python pipeline\calibrate_claude.py --model claude-sonnet-5
```

It sends about 600 sampled texts to Anthropic's API and writes `app/public/engine/calibration.json`. Settings then offers "Use calibration", which scales token counts to Claude's before pricing.

## Project layout

```
data/                       source dataset (not committed; see .gitignore)
pipeline/
  build_engine.py           re-count, re-fit, train, score, export
  token_formula_analysis.py formula selection method (unchanged)
  calibrate_claude.py       optional free Claude calibration
app/
  public/engine/            built engine: formulas, classifier, dashboard data
  src/engine/               tokenizer, classifier, formula engine, pricing (+ tests)
  src/workers/              batch processing off the main thread
  src/components/           Estimate, Batch, Insights, Engine views
```

## Accuracy and limits

- **Estimates, not exact counts.** A single reply is typically off by 17–46 output tokens, depending on the category (see the Engine tab). Across all categories, 20% of replies fall outside the 80% range, as designed.
- **Straight lines miss some curvature.** Short prompts are covered less well: in the weakest prompt-length band, 62% of replies fall inside the 80% range.
- **The dataset is synthetic.** The formulas describe its responses, not a specific Claude model's replies.
- **Thinking tokens are not included.** Sonnet 5 and Opus 5 think by default, and thinking is billed as output.
- **Prices are editable.** They default to Anthropic list prices from mid-2026 (Sonnet 5 $2/$10, Opus 5 $5/$25 per million input/output tokens) and can be changed in Settings.
