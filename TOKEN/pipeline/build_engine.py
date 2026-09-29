#!/usr/bin/env python3
"""Build the Token Estimator Pro engine from the labelled dataset - free, local, offline.

    .venv\\Scripts\\python pipeline\\build_engine.py [--data data\\it_llm_token_budget_dataset_5col_20000.csv]

1. Re-count every prompt and response with the open-source o200k_base tokenizer (tiktoken).
   The web app runs the same tokenizer in the browser (js-tiktoken), so formula inputs match.
2. Re-fit one output-token formula per classification with token_formula_analysis.py
   (unchanged method: candidate formulas, reliability checks, cross-validation).
3. Train a local classifier (TF-IDF + logistic regression) on the dataset's labels.
4. Score the full pipeline (local classifier -> formula) on a held-out 20% of prompts.
5. Derive an empirical 80% range for every formula from cross-validated errors.
6. Export the JSON the app loads (app/public/engine/) and parity fixtures for its tests.
"""
import argparse
import json
import math
import os
import re
import subprocess
import sys
from collections import Counter
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PIPELINE = ROOT / "pipeline"
OUT = PIPELINE / "out"
APP_ENGINE = ROOT / "app" / "public" / "engine"
APP_FIXTURES = ROOT / "app" / "src" / "engine" / "fixtures"
os.environ.setdefault("TIKTOKEN_CACHE_DIR", str(PIPELINE / ".cache" / "tiktoken"))  # bundled o200k_base file

import truststore  # noqa: E402

truststore.inject_into_ssl()  # trust the Windows certificate store (Zscaler) if a download is ever needed
import tiktoken  # noqa: E402
from sklearn.feature_extraction.text import TfidfVectorizer  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import accuracy_score, f1_score  # noqa: E402
from sklearn.model_selection import StratifiedGroupKFold  # noqa: E402

sys.path.insert(0, str(PIPELINE))
from token_formula_analysis import CANDIDATES, FALLBACK, assign_folds, out_of_fold, predict, score  # noqa: E402

TOKENIZER = "o200k_base"
TOKEN_PATTERN = r"[a-z0-9]+"  # mirrored exactly by app/src/engine/classifier.ts
MAX_FEATURES = 12000
C_GRID = (2.0, 8.0, 32.0)
SEED = 42
FITS = dict(CANDIDATES + [FALLBACK])


def sig(v, digits=6):
    return float(f"{v:.{digits}g}")


# --- 1. re-count with the runtime tokenizer ---

def recount(df):
    enc = tiktoken.get_encoding(TOKENIZER)
    out = df.rename(columns={"input_tokens": "input_tokens_synthetic", "output_tokens": "output_tokens_synthetic"})
    out["input_tokens"] = [len(t) for t in enc.encode_ordinary_batch(df["prompt"].tolist())]
    out["output_tokens"] = [len(t) for t in enc.encode_ordinary_batch(df["response"].tolist())]
    return out[["prompt", "input_tokens", "prompt_classification", "response", "output_tokens",
                "input_tokens_synthetic", "output_tokens_synthetic"]]


# --- 2. formulas (existing, unchanged analysis script) ---

def fit_formulas(csv_path):
    out_dir = OUT / "formulas"
    subprocess.run([sys.executable, str(PIPELINE / "token_formula_analysis.py"), str(csv_path), "--out-dir", str(out_dir)],
                   check=True, stdout=subprocess.DEVNULL)
    return json.loads((out_dir / "formula_registry.json").read_text(encoding="utf-8")), out_dir


# --- 3. classifier ---

def make_vectorizer():
    return TfidfVectorizer(lowercase=True, token_pattern=TOKEN_PATTERN, ngram_range=(1, 2), sublinear_tf=True,
                           min_df=3, max_features=MAX_FEATURES, norm="l2", smooth_idf=True, dtype=np.float64)


def train_classifier(texts, labels, C):
    vec = make_vectorizer()
    X = vec.fit_transform(texts)
    clf = LogisticRegression(C=C, max_iter=3000)
    clf.fit(X, labels)
    return vec, clf


def choose_c(texts, labels, groups):
    """3-fold grouped CV on the training split; identical prompts never straddle folds."""
    folds = StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=SEED)
    scores = {}
    for C in C_GRID:
        accs = []
        for tr, te in folds.split(texts, labels, groups):
            vec, clf = train_classifier(texts[tr], labels[tr], C)
            accs.append(accuracy_score(labels[te], clf.predict(vec.transform(texts[te]))))
        scores[C] = float(np.mean(accs))
    return max(scores, key=scores.get), scores


def export_classifier(vec, clf):
    return {
        "type": "tfidf-logistic-regression",
        "token_pattern": TOKEN_PATTERN,
        "lowercase": True,
        "ngram_range": [1, 2],
        "sublinear_tf": True,
        "norm": "l2",
        "classes": clf.classes_.tolist(),
        "vocabulary": vec.get_feature_names_out().tolist(),
        "idf": [sig(v) for v in vec.idf_],
        "coef": [[sig(v, 5) for v in row] for row in clf.coef_],
        "intercept": [sig(v) for v in clf.intercept_],
    }


def classify_from_export(model, texts):
    """Pure-Python version of the in-browser classifier, run on the exported JSON."""
    index = {t: i for i, t in enumerate(model["vocabulary"])}
    idf, W, b = np.array(model["idf"]), np.array(model["coef"]), np.array(model["intercept"])
    pattern = re.compile(model["token_pattern"])
    probs = []
    for text in texts:
        toks = pattern.findall(text.lower())
        counts = Counter(g for g in toks + [f"{x} {y}" for x, y in zip(toks, toks[1:])] if g in index)
        scores = b.copy()
        if counts:
            idx = np.array([index[g] for g in counts])
            v = (1 + np.log(np.array(list(counts.values()), float))) * idf[idx]
            scores += W[:, idx] @ (v / np.linalg.norm(v))
        e = np.exp(scores - scores.max())
        probs.append(e / e.sum())
    return np.array(probs)


# --- 4-5. held-out evaluation and 80% ranges ---

def holdout_split(df):
    folds = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)
    return next(folds.split(df, df["prompt_classification"], groups=df["prompt"]))


def formula_predict(registry, labels, x):
    out = np.empty(len(x))
    for label in np.unique(labels):
        m = labels == label
        f = registry[label]
        out[m] = predict(f["formula_type"], f["parameters"], x[m])
    return out


def refit_on(registry, df):
    """Same formula type per class, re-fitted on a subset (for honest held-out scoring)."""
    refit = {}
    for label, f in registry.items():
        g = df[df["prompt_classification"] == label]
        kind = f["formula_type"]
        refit[label] = {"formula_type": kind, "parameters": FITS[kind](g["input_tokens"].to_numpy(float),
                                                                      g["output_tokens"].to_numpy(float))}
    return refit


def interval_candidates(registry, df):
    """Cross-validated errors per class -> 80% ranges as additive offsets and as ratios."""
    folds = assign_folds(df["prompt_classification"], 5, SEED)
    result = {}
    for label, f in registry.items():
        m = (df["prompt_classification"] == label).to_numpy()
        x, y = df.loc[m, "input_tokens"].to_numpy(float), df.loc[m, "output_tokens"].to_numpy(float)
        kind = f["formula_type"]
        oof = np.maximum(out_of_fold(kind, FITS[kind], x, y, folds[m], 5), 1)
        result[label] = {"x": x, "y": y, "oof": oof,
                         "offset": np.percentile(y - oof, [10, 90]), "ratio": np.percentile(y / oof, [10, 90])}
    return result


def inside_range(c, method):
    lo, hi = c[method]
    low, high = (c["oof"] + lo, c["oof"] + hi) if method == "offset" else (c["oof"] * lo, c["oof"] * hi)
    return (c["y"] >= low) & (c["y"] <= high)


def band_coverage(c, method):
    bands = pd.qcut(c["x"], 5, labels=False, duplicates="drop")
    return pd.Series(inside_range(c, method)).groupby(bands).mean()


def histogram(values, edges):
    counts, _ = np.histogram(np.clip(values, edges[0], edges[-1]), bins=edges)
    return counts.tolist()


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--data", type=Path, default=ROOT / "data" / "it_llm_token_budget_dataset_5col_20000.csv")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    APP_ENGINE.mkdir(parents=True, exist_ok=True)
    APP_FIXTURES.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(args.data, encoding="utf-8-sig")
    df = recount(raw)
    recounted_csv = OUT / f"dataset_{TOKENIZER}.csv"
    df.to_csv(recounted_csv, index=False)
    ratio_in = df["input_tokens"].sum() / df["input_tokens_synthetic"].sum()
    ratio_out = df["output_tokens"].sum() / df["output_tokens_synthetic"].sum()
    print(f"1. Re-counted {len(df):,} records with {TOKENIZER}: totals are {ratio_in:.3f}x (input) and "
          f"{ratio_out:.3f}x (output) the dataset's synthetic counts")

    registry, formula_dir = fit_formulas(recounted_csv)
    kinds = Counter(f["formula_type"] for f in registry.values())
    print(f"2. Re-fitted formulas: {dict(kinds)} (full report: {formula_dir / 'token_formula_report.md'})")

    texts, labels, groups = df["prompt"].to_numpy(), df["prompt_classification"].to_numpy(), df["prompt"].to_numpy()
    train, test = holdout_split(df)
    C, c_scores = choose_c(texts[train], labels[train], groups[train])
    vec, clf = train_classifier(texts[train], labels[train], C)
    pred_test = clf.predict(vec.transform(texts[test]))
    acc, macro_f1 = accuracy_score(labels[test], pred_test), f1_score(labels[test], pred_test, average="macro")
    print(f"3. Classifier: C={C} (grouped CV accuracy {c_scores}); held-out accuracy {acc:.3f}, macro-F1 {macro_f1:.3f}")

    x, y = df["input_tokens"].to_numpy(float), df["output_tokens"].to_numpy(float)
    held = refit_on(registry, df.iloc[train])
    true_based = formula_predict(held, labels[test], x[test])
    pred_based = formula_predict(held, pred_test, x[test])
    e2e_true, e2e_pred = score(y[test], true_based), score(y[test], pred_based)
    print(f"4. Held-out output estimate: MAE {e2e_true['mae']:.1f} with true labels vs {e2e_pred['mae']:.1f} with the "
          f"local classifier (R2 {e2e_true['r2']:.3f} vs {e2e_pred['r2']:.3f})")

    cands = interval_candidates(registry, df)
    worst = {m: float(np.mean([np.abs(band_coverage(c, m) - 0.8).max() for c in cands.values()])) for m in ("ratio", "offset")}
    method = min(worst, key=worst.get)
    print(f"5. 80% range method: {method} (mean worst-band coverage error: ratio {worst['ratio']:.3f}, "
          f"offset {worst['offset']:.3f})")

    # final classifier on all records
    vec, clf = train_classifier(texts, labels, C)
    model = export_classifier(vec, clf)
    exported = classify_from_export(model, texts)
    agree = float(np.mean(np.array(model["classes"])[exported.argmax(1)] == clf.predict(vec.transform(texts))))
    drift = float(np.abs(exported - clf.predict_proba(vec.transform(texts))).max())
    assert agree > 0.999 and drift < 1e-3, (agree, drift)

    classes = list(registry)  # largest class first
    engine = {
        "version": 1,
        "built": date.today().isoformat(),
        "tokenizer": TOKENIZER,
        "dataset": {"file": args.data.name, "records": len(df), "token_counts": f"re-counted with {TOKENIZER}",
                    "original_counter": "synthetic_approx_v1 (kept only for reference)"},
        "classes": classes,
        "formulas": {},
        "classifier": {"heldout_accuracy": round(acc, 4), "heldout_macro_f1": round(macro_f1, 4), "C": C,
                       "features": len(model["vocabulary"])},
        "end_to_end": {"heldout_records": int(len(test)), "true_labels": {k: round(v, 4) for k, v in e2e_true.items()},
                       "local_classifier": {k: round(v, 4) for k, v in e2e_pred.items()}},
        "interval": {"level": 0.8, "method": method},
    }
    for label in classes:
        f, c = registry[label], cands[label]
        lo, hi = c[method]
        engine["formulas"][label] = {**f, "interval": {"low": sig(lo, 5), "high": sig(hi, 5)},
                                     "interval_coverage_by_input_band": [round(v, 3) for v in band_coverage(c, method)]}

    # dashboard data
    rng = np.random.default_rng(SEED)
    pick = rng.choice(len(test), size=min(1500, len(test)), replace=False)
    tpc = df["input_tokens"] / df["prompt"].str.len()
    edges = np.round(np.linspace(tpc.quantile(0.005), tpc.quantile(0.995), 26), 4)
    predicted = np.array(model["classes"])[exported.argmax(1)]
    samples = []
    for label in classes:
        confident = (labels == label) & (predicted == label) & (exported.max(1) >= 0.9)
        cand = df[confident] if confident.any() else df[labels == label]
        target = cand["input_tokens"].median()
        samples.append({"classification": label, "prompt": cand.iloc[(cand["input_tokens"] - target).abs().argmin()]["prompt"]})
    insights = {
        "distribution": [{"classification": k, "records": int((labels == k).sum())} for k in classes],
        "validation": {"r2": round(e2e_pred["r2"], 4), "mae": round(e2e_pred["mae"], 2),
                       "points": [{"actual": int(y[test][i]), "predicted": round(float(pred_based[i]), 1),
                                   "classification": str(labels[test][i]), "correct": bool(pred_test[i] == labels[test][i])}
                                  for i in pick]},
        "tokens_per_char": {"edges": edges.tolist(),
                            "counts": {k: histogram(tpc[labels == k].to_numpy(), edges) for k in classes}},
        "summary": {
            "prompt_tokens_per_char": round(float(tpc.median()), 4),
            "prompt_tokens_per_word": round(float((df["input_tokens"] / df["prompt"].str.split().str.len()).median()), 4),
            "response_tokens_per_char": round(float((df["output_tokens"] / df["response"].str.len()).median()), 4),
            "response_tokens_per_word": round(float((df["output_tokens"] / df["response"].str.split().str.len()).median()), 4),
            "cv_outside_80pct_range": round(float(1 - np.concatenate([inside_range(c, method) for c in cands.values()]).mean()), 4),
        },
        "confusion": {"labels": classes,
                      "matrix": [[int(((labels[test] == a) & (pred_test == b)).sum()) for b in classes] for a in classes]},
        "samples": samples,
    }

    fixtures_idx = rng.choice(len(df), size=300, replace=False)
    edge_cases = ["", "   ", "<|endoftext|> is a special token", "Café naïve résumé – “quotes” and emoji 🚀",
                  "SELECT id, name FROM users WHERE created_at > '2024-01-01';", "def f(x):\n    return x ** 2\n",
                  "https://example.com/path?q=1&lang=en", "12345678901234567890", "A" * 500]
    fixture_texts = [str(t) for t in df["prompt"].to_numpy()[fixtures_idx]] + edge_cases
    enc = tiktoken.get_encoding(TOKENIZER)
    fixture_probs = classify_from_export(model, fixture_texts)
    fixtures = [{"text": t, "tokens": len(enc.encode_ordinary(t)),
                 "classification": model["classes"][int(p.argmax())], "probs": [round(float(v), 8) for v in p]}
                for t, p in zip(fixture_texts, fixture_probs)]

    (APP_ENGINE / "engine.json").write_text(json.dumps(engine, indent=1, ensure_ascii=False), encoding="utf-8")
    (APP_ENGINE / "classifier.json").write_text(json.dumps(model, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    (APP_ENGINE / "insights.json").write_text(json.dumps(insights, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    (APP_FIXTURES / "parity.json").write_text(json.dumps({"tokenizer": TOKENIZER, "cases": fixtures}, ensure_ascii=False),
                                              encoding="utf-8")
    sizes = {p.name: f"{p.stat().st_size / 1e6:.2f} MB" for p in APP_ENGINE.glob("*.json")}
    print(f"6. Exported {sizes} to {APP_ENGINE}; {len(fixtures)} parity fixtures to {APP_FIXTURES}")


if __name__ == "__main__":
    main()
