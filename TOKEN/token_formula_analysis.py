#!/usr/bin/env python3
"""Derive one formula per prompt classification that estimates output tokens from input tokens.

    python token_formula_analysis.py DATA_FILE [--sheet NAME] [--out-dir DIR]
        [--folds 5] [--tolerance 0.02] [--min-samples 30] [--seed 42]

DATA_FILE is .csv/.tsv/.xlsx/.xls/.json/.jsonl/.parquet with the columns "prompt",
"input tokens", "prompt classification", "response", "output token" (spaces or
underscores, singular or plural). Only the classification label and the two token
counts are analysed; prompt and response text are never used or printed.

Per classification, linear, logarithmic, power and quadratic formulas are fitted by least
squares and cross-validated. A formula is eligible only if it never goes below 0 for an
input of 1 token or more and never more than doubles when the input doubles (checked up
to 10x the longest prompt in the class). The final formula is the simplest eligible one
whose CV RMSE is within --tolerance of the most accurate eligible one.

Writes to --out-dir (default ./token_formula_output):
    final_formulas.md         one formula per classification: table, list and JSON mapping
    final_formulas.json       classification -> formula string
    formula_registry.json     classification -> formula type and parameters
    token_formula_report.md   full analysis: statistics, candidates, checks, outliers
    class_stats.csv           per-classification statistics
    model_comparison.csv      cross-validated metrics and checks for every candidate
"""
import argparse
import json
import math
import re
import sys
import warnings
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd

COLUMNS = {  # role -> accepted headers after normalise(), preferred first
    "label": ("prompt classification", "classification"),
    "x": ("input tokens", "input token"),
    "y": ("output tokens", "output token"),
}
CHECK_HORIZON = 10     # reliability checks cover inputs from 1 token to this multiple of the longest prompt
WEAK_R2 = 0.10         # below this CV R², input tokens explain little of the output
MATERIAL_SHIFT = 0.10  # dropping influential records moves an estimate by more than this -> material
SIMILAR_GAP = 0.10     # two formulas this close across their shared input range -> similar


# --- candidate formulas ---

def fit_constant(x, y):
    return {"c": float(np.mean(y))}


def fit_linear(x, y):
    a, b = np.polyfit(x, y, 1)
    return {"a": float(a), "b": float(b)}


def fit_logarithmic(x, y):
    a, b = np.polyfit(np.log(x), y, 1)
    return {"a": float(a), "b": float(b)}


def fit_power(x, y):
    """Least squares for y = a * x^b on the original scale.

    For a fixed b the best a has a closed form, so only b is searched: a coarse
    grid, then golden-section refinement around the best grid point.
    """
    s = float(np.median(x))
    z = x / s  # keeps z**b well-conditioned

    def profile(b):
        zb = z**b
        a = (zb @ y) / (zb @ zb)
        return float(np.sum((y - a * zb) ** 2)), a

    grid = np.linspace(-3, 4, 141)
    i = int(np.argmin([profile(b)[0] for b in grid]))
    lo, hi = grid[max(i - 1, 0)], grid[min(i + 1, len(grid) - 1)]
    g = (math.sqrt(5) - 1) / 2
    for _ in range(50):
        c, d = hi - g * (hi - lo), lo + g * (hi - lo)
        if profile(c)[0] < profile(d)[0]:
            hi = d
        else:
            lo = c
    b = (lo + hi) / 2
    return {"a": float(profile(b)[1] / s**b), "b": float(b)}


def fit_polynomial(x, y):
    s = float(np.median(x))
    a, b, c = np.polyfit(x / s, y, 2)  # fit on rescaled input, then convert back
    return {"a": float(a / s**2), "b": float(b / s), "c": float(c)}


CANDIDATES = [  # simplest first: ties in accuracy go to the earlier one
    ("linear", fit_linear),
    ("logarithmic", fit_logarithmic),
    ("power", fit_power),
    ("polynomial", fit_polynomial),
]
FALLBACK = ("constant", fit_constant)  # class average, used only when no candidate is eligible


def predict(kind, p, x):
    x = np.asarray(x, dtype=float)
    if kind == "constant":
        return np.full(x.shape, p["c"])
    if kind == "linear":
        return p["a"] * x + p["b"]
    if kind == "logarithmic":
        return p["a"] * np.log(x) + p["b"]
    if kind == "power":
        return p["a"] * x ** p["b"]
    return p["a"] * x**2 + p["b"] * x + p["c"]


def reliability_issue(kind, p, x_max):
    """Why a formula is unsafe to ship, or None if it passes both checks."""
    x = np.geomspace(1, CHECK_HORIZON * x_max, 500)
    y = predict(kind, p, x)
    negative = x[y < 0]
    if negative.size:
        return f"negative for inputs of {negative.min():.0f}-{negative.max():.0f} tokens"
    steep = x[predict(kind, p, 2 * x) > 2 * y + 1e-6]
    if steep.size:
        return f"more than doubles when the input doubles, from {steep.min():.0f} input tokens"
    return None


def coef(v):
    """At least 4 decimals and 4 significant digits."""
    decimals = max(4, 3 - math.floor(math.log10(abs(v)))) if v else 4
    return f"{v:.{decimals}f}"


def formula_text(kind, p, x="Input", code=False):
    """Right-hand side of the formula; code=True gives a plain expression such as '2.5 * input_tokens + 40'."""
    mul = " * " if code else " × "

    def plus(v):
        return f" {'-' if v < 0 else '+'} {coef(abs(v))}"

    if kind == "constant":
        return coef(p["c"])
    if kind == "linear":
        return f"{coef(p['a'])}{mul}{x}{plus(p['b'])}"
    if kind == "logarithmic":
        return f"{coef(p['a'])}{mul}{'log' if code else 'ln'}({x}){plus(p['b'])}"
    if kind == "power":
        return f"{coef(p['a'])}{mul}" + (f"pow({x}, {coef(p['b'])})" if code else f"{x}^{coef(p['b'])}")
    square = f"{x} * {x}" if code else f"{x}²"
    return f"{coef(p['a'])}{mul}{square}{plus(p['b'])}{mul}{x}{plus(p['c'])}"


# --- evaluation ---

def score(y, pred):
    err = y - pred
    sst = float(np.sum((y - y.mean()) ** 2))
    return {
        "r2": 1 - float(err @ err) / sst if sst > 0 else math.nan,
        "mae": float(np.mean(np.abs(err))),
        "rmse": float(np.sqrt(np.mean(err**2))),
    }


def assign_folds(labels, k, seed):
    """Balanced k-fold ids inside every classification."""
    rng = np.random.default_rng(seed)
    folds = np.empty(len(labels), dtype=int)
    for idx in labels.groupby(labels).indices.values():
        folds[rng.permutation(idx)] = np.arange(len(idx)) % k
    return folds


def out_of_fold(kind, fit, x, y, folds, k, keep=None):
    """Cross-validated predictions; `keep` restricts which records may be used for fitting."""
    pred = np.empty(len(y))
    for f in range(k):
        test = folds == f
        if test.any():
            train = ~test if keep is None else ~test & keep
            pred[test] = predict(kind, fit(x[train], y[train]), x[test])
    return pred


def evaluate(kind, fit, x, y, folds, k):
    params = fit(x, y)
    oof = out_of_fold(kind, fit, x, y, folds, k)
    return {"kind": kind, "fit": fit, "params": params, "oof": oof, **score(y, oof),
            "issue": reliability_issue(kind, params, x.max()), "near_best": False}


def choose(candidates, tolerance):
    """Simplest eligible candidate whose CV RMSE is within `tolerance` of the best eligible one."""
    eligible = [c for c in candidates if c["issue"] is None]
    if not eligible:
        return None
    best = min(c["rmse"] for c in eligible)
    for c in eligible:
        c["near_best"] = c["rmse"] <= best * (1 + tolerance)
    return next(c for c in eligible if c["near_best"])


def influential(x, y):
    """Records with Cook's distance > 4/n under a straight-line fit."""
    n = len(x)
    a, b = np.polyfit(x, y, 1)
    resid = y - (a * x + b)
    mse = float(resid @ resid) / (n - 2)
    if mse == 0:
        return np.zeros(n, dtype=bool)
    lev = 1 / n + (x - x.mean()) ** 2 / np.sum((x - x.mean()) ** 2)
    cooks = resid**2 / (2 * mse) * lev / (1 - lev) ** 2
    return cooks > 4 / n


def outlier_check(chosen, x, y, folds, args):
    """Refit the chosen formula without influential records and measure how far the estimates move."""
    mask = influential(x, y)
    count = int(mask.sum())
    res = {"count": count, "share": count / len(y), "compared": False, "material": False}
    if count == 0 or len(y) - count < args.min_samples:
        return res
    kind, fit = chosen["kind"], chosen["fit"]
    clean_params = fit(x[~mask], y[~mask])
    probes = np.percentile(x, [50, 95])
    before, after = predict(kind, chosen["params"], probes), predict(kind, clean_params, probes)
    shift = (after - before) / np.maximum(before, 1)
    res.update(
        compared=True, probes=probes, before=before, after=after, shift=shift, clean_params=clean_params,
        material=bool(np.abs(shift).max() > MATERIAL_SHIFT),
        full_cv={"mae": chosen["mae"], "rmse": chosen["rmse"]},
        # fitted without the flagged records, but scored on every held-out record
        clean_cv=score(y, out_of_fold(kind, fit, x, y, folds, args.folds, keep=~mask)),
    )
    return res


def analyse_class(label, x, y, folds, args):
    n = len(y)
    res = {"label": label, "n": n, "flags": [], "candidates": [], "outliers": None, "cv": None,
           "fitted": False, "input_range": (x.min(), x.max()),
           "p5": float(np.percentile(x, 5)), "p95": float(np.percentile(x, 95))}
    at_max = int(np.sum(y == y.max()))
    if at_max >= max(5, 0.01 * n):
        res["flags"].append(f"possible output cap: {at_max} records ({at_max / n:.1%}) sit exactly at the "
                            f"maximum of {y.max():g} tokens")
    if n < args.min_samples:
        res.update(kind="constant", params={"c": float(np.median(y))})
        res["flags"].insert(0, f"insufficient data (n = {n} < {args.min_samples}): median output used as a "
                               f"fallback, not a fitted formula")
        return res

    if len(np.unique(x)) >= 3:
        res["candidates"] = [evaluate(kind, fit, x, y, folds, args.folds) for kind, fit in CANDIDATES]
    chosen = choose(res["candidates"], args.tolerance)
    if chosen is None:
        chosen = evaluate(*FALLBACK, x, y, folds, args.folds)
        res["flags"].append("no input-based formula passed the reliability checks: class average used"
                            if res["candidates"] else "fewer than 3 distinct input values: class average used")
    res.update(kind=chosen["kind"], params=chosen["params"], oof=chosen["oof"], fitted=True,
               cv={k: chosen[k] for k in ("r2", "mae", "rmse")})
    if chosen["kind"] != "constant":
        if chosen["r2"] < WEAK_R2:
            res["flags"].append(f"weak relationship (CV R² {chosen['r2']:.2f}): expect large per-prompt errors")
        o = res["outliers"] = outlier_check(chosen, x, y, folds, args)
        if o["material"]:
            res["flags"].append(f"sensitive to influential records: refitting without {o['count']} of them "
                                f"({o['share']:.1%}) moves the estimate at median/P95 input by "
                                f"{o['shift'][0]:+.1%}/{o['shift'][1]:+.1%}; all records retained")
    return res


def global_comparison(results, x, y, folds, args):
    """Class-specific formulas vs one formula for everything, scored on the same held-out records."""
    fitted = [r for r in results if r["fitted"]]
    chosen = choose([evaluate(kind, fit, x, y, folds, args.folds) for kind, fit in CANDIDATES], args.tolerance)
    if not fitted or chosen is None:
        return None
    idx = np.concatenate([r["idx"] for r in fitted])
    return {"kind": chosen["kind"], "params": chosen["params"], "n": len(idx),
            "per_class": score(y[idx], np.concatenate([r["oof"] for r in fitted])),
            "single": score(y[idx], chosen["oof"][idx])}


def similar_pairs(results):
    """Pairs whose selected formulas stay within SIMILAR_GAP of each other over the shared P5-P95 input range."""
    pairs = []
    for a, b in combinations([r for r in results if r["fitted"]], 2):
        lo, hi = max(a["p5"], b["p5"]), min(a["p95"], b["p95"])
        if lo >= hi:
            continue
        grid = np.linspace(lo, hi, 50)
        fa, fb = predict(a["kind"], a["params"], grid), predict(b["kind"], b["params"], grid)
        gap = float(np.max(np.abs(fa - fb) / np.maximum((fa + fb) / 2, 1)))
        if gap <= SIMILAR_GAP:
            pairs.append((a["label"], b["label"], gap, lo, hi))
    return pairs


# --- input ---

def normalise(name):
    return re.sub(r"[\s_\-]+", " ", str(name).replace("﻿", "")).strip().lower()


def load(path, sheet):
    suffix = path.suffix.lower()
    if suffix in (".csv", ".tsv"):
        sep = "\t" if suffix == ".tsv" else ","
        try:
            return pd.read_csv(path, sep=sep, encoding="utf-8-sig")
        except UnicodeDecodeError:
            return pd.read_csv(path, sep=sep, encoding="cp1252")
    if suffix in (".xlsx", ".xls"):
        return pd.read_excel(path, sheet_name=sheet)
    if suffix in (".json", ".jsonl"):
        return pd.read_json(path, lines=suffix == ".jsonl")
    if suffix == ".parquet":
        return pd.read_parquet(path)
    sys.exit(f"Unsupported file type {suffix!r}")


def prepare(raw):
    by_name = {normalise(c): c for c in raw.columns}
    cols = {}
    for role, accepted in COLUMNS.items():
        found = next((by_name[a] for a in accepted if a in by_name), None)
        if found is None:
            sys.exit(f"No column for {role!r}: expected one of {accepted}; found {list(raw.columns)}")
        cols[role] = found
    data = pd.DataFrame({
        "label": raw[cols["label"]],
        "x": pd.to_numeric(raw[cols["x"]], errors="coerce"),
        "y": pd.to_numeric(raw[cols["y"]], errors="coerce"),
    })
    bad = data["label"].isna() | data["x"].isna() | data["y"].isna() | (data["x"] <= 0) | (data["y"] < 0)
    data = data[~bad].reset_index(drop=True)
    data["label"] = data["label"].astype(str)
    return data, int(bad.sum()), cols


def class_stats(data):
    rows = []
    for label, g in data.groupby("label", sort=False):
        gx, gy = g["x"], g["y"]
        rows.append({
            "classification": label,
            "records": len(g),
            "pct_of_total": 100 * len(g) / len(data),
            "input_min": gx.min(), "input_max": gx.max(), "input_mean": gx.mean(), "input_median": gx.median(),
            "output_min": gy.min(), "output_max": gy.max(), "output_mean": gy.mean(), "output_median": gy.median(),
            "mean_output_input_ratio": (gy / gx).mean(),
            "pearson_r": gx.corr(gy),
            "spearman_rho": gx.rank().corr(gy.rank()),
        })
    return pd.DataFrame(rows).sort_values(["records", "classification"], ascending=[False, True], ignore_index=True)


def near_duplicate_labels(labels):
    groups = {}
    for label in labels:
        groups.setdefault(normalise(label), []).append(label)
    return [g for g in groups.values() if len(g) > 1]


# --- output ---

def md_table(headers, rows, align=None):
    marks = {"l": "---", "r": "---:"}
    lines = ["| " + " | ".join(headers) + " |",
             "|" + "|".join(marks[a] for a in align or "l" * len(headers)) + "|"]
    lines += ["| " + " | ".join(str(v).replace("|", "\\|") for v in row) + " |" for row in rows]
    return "\n".join(lines)


def metric_cells(cv):
    return [f"{cv['r2']:.3f}", f"{cv['mae']:.1f}", f"{cv['rmse']:.1f}"] if cv else ["n/a"] * 3


def section_groups(stats, duplicates):
    rows = [[s.classification, f"{s.records:,}", f"{s.pct_of_total:.1f}%",
             f"{s.input_min:g} / {s.input_median:g} / {s.input_mean:.1f} / {s.input_max:g}",
             f"{s.output_min:g} / {s.output_median:g} / {s.output_mean:.1f} / {s.output_max:g}",
             f"{s.mean_output_input_ratio:.2f}", f"{s.pearson_r:.3f}", f"{s.spearman_rho:.3f}"]
            for s in stats.itertuples(index=False)]
    lines = ["## 1. Classification Groups", "",
             md_table(["Classification", "Records", "% of total", "Input tokens min / median / mean / max",
                       "Output tokens min / median / mean / max", "Mean output/input ratio", "Pearson r",
                       "Spearman ρ"], rows)]
    if duplicates:
        lines += ["", "Labels that differ only in case or spacing (kept separate): "
                  + "; ".join(" vs ".join(f"`{label}`" for label in g) for g in duplicates)]
    return "\n".join(lines)


def selection_note(r, tol):
    if r["kind"] == "constant":
        return f"**Selected: class average** ({'; '.join(r['flags'])})."
    eligible = [c for c in r["candidates"] if c["issue"] is None]
    best = min(eligible, key=lambda c: c["rmse"])
    why = ("the most accurate formula that passes the reliability check" if best["kind"] == r["kind"]
           else f"the simplest formula that passes the reliability check and is within {tol} of the most "
                f"accurate one, {best['kind']} at RMSE {best['rmse']:.1f}")
    note = f"**Selected: {r['kind']}**, {why}."
    failed = [c for c in r["candidates"] if c["issue"]]
    if failed:
        note += " Failed the reliability check: " + "; ".join(f"{c['kind']} ({c['issue']})" for c in failed) + "."
    r2 = r["cv"]["r2"]
    note += f" Input tokens explain {r2:.0%} of output-token variance on held-out records" + (
        ", so an input-based formula is justified." if r2 >= WEAK_R2
        else "; the relationship is weak, so expect large per-prompt errors.")
    return note


def outlier_note(o):
    if o["count"] == 0:
        return "Outliers: no influential records (Cook's distance > 4/n)."
    head = f"Outliers: {o['count']} influential records ({o['share']:.1%}, Cook's distance > 4/n)."
    if not o["compared"]:
        return head + " Too few records would remain to refit without them."
    (p50, p95), (b50, b95), (a50, a95), (s50, s95) = o["probes"], o["before"], o["after"], o["shift"]
    return (f"{head} Refit without them: estimate at median input ({p50:g}) {b50:.0f} → {a50:.0f} ({s50:+.1%}), "
            f"at P95 input ({p95:g}) {b95:.0f} → {a95:.0f} ({s95:+.1%}); held-out MAE "
            f"{o['full_cv']['mae']:.1f} → {o['clean_cv']['mae']:.1f}, RMSE {o['full_cv']['rmse']:.1f} → "
            f"{o['clean_cv']['rmse']:.1f} (all records scored). "
            f"{'Material' if o['material'] else 'Not material'}; the final formula keeps all records.")


def section_analysis(results, args):
    tol = f"{args.tolerance:.0%}"
    lines = ["## 2. Formula Analysis", "",
             f"Formulas are least-squares fits on all records of the class; CV R², MAE and RMSE are measured on "
             f"held-out records ({args.folds}-fold cross-validation). Reliability check: the formula must never go "
             f"below 0 for an input of 1 token or more and must never more than double when the input doubles, "
             f"checked up to {CHECK_HORIZON}× the longest prompt in the class."]
    for r in results:
        lines += ["", f"### {r['label']} ({r['n']:,} records)", ""]
        if not r["candidates"]:
            lines.append(f"No candidate formulas fitted: {'; '.join(r['flags'])}.")
            continue
        rows = []
        for c in r["candidates"]:
            name = c["kind"].capitalize()
            if c["kind"] == r["kind"]:
                name = f"**{name}** (selected)"
            rows.append([name, "Output = " + formula_text(c["kind"], c["params"]), *metric_cells(c),
                         c["issue"] or "pass", "yes" if c["near_best"] else "no"])
        lines.append(md_table(["Model", "Formula", "CV R²", "CV MAE", "CV RMSE", "Reliability check",
                               f"Within {tol} of best eligible RMSE"], rows))
        lines += ["", selection_note(r, tol)]
        if r["outliers"]:
            lines += ["", outlier_note(r["outliers"])]
    return "\n".join(lines)


def range_note(results):
    lo = min(r["input_range"][0] for r in results)
    hi = max(r["input_range"][1] for r in results)
    return (f"**Calibrated range:** input tokens {lo:g}-{hi:g}. Every final formula passed the reliability check "
            f"(never below 0 for inputs of 1 token or more; doubling the input at most doubles the estimate, "
            f"checked up to {CHECK_HORIZON}× the longest prompt), so estimates for longer prompts grow at most in "
            f"proportion to the input. They are still extrapolations.")


def section_mapping(results, pairs, comparison):
    rows = [[r["label"], f"{r['n']:,}", "Output = " + formula_text(r["kind"], r["params"]), *metric_cells(r["cv"]),
             "; ".join(r["flags"]) or "-"] for r in results]
    lines = ["## 3. Final Classification → Formula Mapping", "",
             md_table(["Classification", "Samples", "Formula", "R²", "MAE", "RMSE", "Notes"], rows), "",
             "R², MAE and RMSE are cross-validated (held-out records). The formulas give estimates, not exact "
             "counts: expect a single prompt to be off by roughly the MAE.", "", range_note(results), ""]
    if pairs:
        lines.append(f"**Statistically similar classifications** (final formulas within ±{SIMILAR_GAP:.0%} of "
                     f"each other across their shared P5-P95 input range; kept separate because the application "
                     f"classifies by these labels):")
        lines += [f"- {a} ≈ {b}: largest gap {gap:.1%} over input {lo:g}-{hi:g} tokens" for a, b, gap, lo, hi in pairs]
    else:
        lines.append(f"**Statistically similar classifications:** none. Every pair of formulas differs by more than "
                     f"{SIMILAR_GAP:.0%} somewhere in their shared input range.")
    if comparison:
        pc, single = comparison["per_class"], comparison["single"]
        lines += ["", f"**Classification-specific vs one global formula** (same held-out records, "
                      f"n = {comparison['n']:,}): per-class formulas MAE {pc['mae']:.1f}, RMSE {pc['rmse']:.1f}, "
                      f"R² {pc['r2']:.3f}; single global {comparison['kind']} formula "
                      f"(Output = {formula_text(comparison['kind'], comparison['params'])}) MAE {single['mae']:.1f}, "
                      f"RMSE {single['rmse']:.1f}, R² {single['r2']:.3f}."]
    return "\n".join(lines)


JS_EVALUATOR = """\
// estimateOutputTokens(registry, "<classification>", inputTokens) -> estimated output tokens
// Calibrated for f.input_range; outside it the estimate is an extrapolation.
function estimateOutputTokens(registry, classification, inputTokens) {
  const f = registry[classification];
  if (!f) throw new Error(`No formula for classification "${classification}"`);
  const p = f.parameters;
  const x = Math.max(inputTokens, 1);
  const y = {
    constant: () => p.c,
    linear: () => p.a * x + p.b,
    logarithmic: () => p.a * Math.log(x) + p.b, // natural log
    power: () => p.a * Math.pow(x, p.b),
    polynomial: () => p.a * x * x + p.b * x + p.c,
  }[f.formula_type]();
  return Math.round(y);
}"""


def section_registry(registry):
    return "\n".join([
        "## 4. Implementation-Ready Formula Registry", "",
        "Saved as `formula_registry.json`. Parameters per `formula_type` (x = input tokens): constant `c`; "
        "linear `a*x + b`; logarithmic `a*ln(x) + b`; power `a*x^b`; polynomial `a*x^2 + b*x + c`.", "",
        "```json", json.dumps(registry, indent=2, ensure_ascii=False), "```", "",
        "Evaluator for the web app:", "", "```js", JS_EVALUATOR, "```",
    ])


def as_number(v):
    v = float(v)
    return int(v) if v.is_integer() else v


def registry_entry(r):
    cv = r["cv"]
    return {
        "formula_type": r["kind"],
        "parameters": {k: float(f"{v:.6g}") for k, v in r["params"].items()},
        "expression": formula_text(r["kind"], r["params"], x="input_tokens", code=True),
        "samples": r["n"],
        "input_range": [as_number(v) for v in r["input_range"]],
        "cv_metrics": ({k: (None if math.isnan(v) else round(v, 4)) for k, v in cv.items()} if cv else None),
        "notes": r["flags"],
    }


def final_mapping(results):
    return {r["label"]: formula_text(r["kind"], r["params"], x="input_tokens", code=True) for r in results}


def final_formulas_md(results, args):
    rows = [[r["label"], formula_text(r["kind"], r["params"], x="Input Tokens"), *metric_cells(r["cv"])]
            for r in results]
    blocks = [f"Classification: {r['label']}  \nFormula:  \nEstimated Output Tokens = "
              f"{formula_text(r['kind'], r['params'], x='Input Tokens')}" for r in results]
    return "\n\n".join([
        md_table(["Classification", "Final Formula", "R²", "MAE", "RMSE"], rows, align="llrrr"),
        f"R², MAE and RMSE are from {args.folds}-fold cross-validation (records not used to fit the formula).",
        *blocks,
        "```json\n" + json.dumps(final_mapping(results), indent=4, ensure_ascii=False) + "\n```",
    ]) + "\n"


def model_table(results):
    return pd.DataFrame([
        {"classification": r["label"], "samples": r["n"], "model": c["kind"], "selected": c["kind"] == r["kind"],
         "formula": formula_text(c["kind"], c["params"], x="input_tokens", code=True), "cv_r2": c["r2"],
         "cv_mae": c["mae"], "cv_rmse": c["rmse"], "reliability_issue": c["issue"] or "",
         "within_tolerance": c["near_best"], **{f"param_{k}": v for k, v in c["params"].items()}}
        for r in results for c in r["candidates"]
    ])


def parse_args():
    p = argparse.ArgumentParser(description="Derive one output-token formula per prompt classification.")
    p.add_argument("data_file", type=Path)
    p.add_argument("--sheet", default=0, type=lambda s: int(s) if s.isdigit() else s,
                   help="Excel sheet name or index (default: first sheet)")
    p.add_argument("--out-dir", type=Path, default=Path("token_formula_output"))
    p.add_argument("--folds", type=int, default=5)
    p.add_argument("--tolerance", type=float, default=0.02,
                   help="prefer a simpler eligible formula if its CV RMSE is within this fraction of the best "
                        "eligible one (default 0.02)")
    p.add_argument("--min-samples", type=int, default=30, help="smaller classes get no fitted formula")
    p.add_argument("--seed", type=int, default=42)
    return p.parse_args()


def main():
    args = parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    warnings.filterwarnings("ignore", message="Polyfit may be poorly conditioned")

    data, dropped, cols = prepare(load(args.data_file, args.sheet))
    labels = data["label"].to_numpy()
    x, y = data["x"].to_numpy(float), data["y"].to_numpy(float)
    folds = assign_folds(data["label"], args.folds, args.seed)
    stats = class_stats(data)

    results = []
    for label in stats["classification"]:
        idx = np.flatnonzero(labels == label)
        results.append({**analyse_class(label, x[idx], y[idx], folds[idx], args), "idx": idx})

    registry = {r["label"]: registry_entry(r) for r in results}
    header = "\n".join([
        "# Output-token formulas by prompt classification", "",
        f"Source `{args.data_file.name}`: {len(data):,} records used ({dropped:,} dropped for missing or invalid "
        f"token counts), {len(results)} classifications. Group `{cols['label']}`, input `{cols['x']}`, "
        f"output `{cols['y']}`.",
        f"Selection rule: a formula must pass the reliability check (never below 0 for inputs of 1 token or more; "
        f"never more than doubling when the input doubles, up to {CHECK_HORIZON}× the longest prompt). Among those, "
        f"the simplest whose cross-validated RMSE is within {args.tolerance:.0%} of the most accurate is chosen "
        f"(linear < logarithmic < power < polynomial). {args.folds}-fold CV stratified by classification, "
        f"seed {args.seed}.",
    ])
    report = "\n\n".join([
        header,
        section_groups(stats, near_duplicate_labels(stats["classification"])),
        section_analysis(results, args),
        section_mapping(results, similar_pairs(results), global_comparison(results, x, y, folds, args)),
        section_registry(registry),
    ]) + "\n"
    final_md = final_formulas_md(results, args)

    out = args.out_dir
    out.mkdir(parents=True, exist_ok=True)
    (out / "final_formulas.md").write_text(final_md, encoding="utf-8")
    (out / "final_formulas.json").write_text(json.dumps(final_mapping(results), indent=4, ensure_ascii=False) + "\n",
                                             encoding="utf-8")
    (out / "formula_registry.json").write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n",
                                               encoding="utf-8")
    (out / "token_formula_report.md").write_text(report, encoding="utf-8")
    stats.to_csv(out / "class_stats.csv", index=False)
    model_table(results).to_csv(out / "model_comparison.csv", index=False)
    print(final_md)
    print(f"Wrote final_formulas.md, final_formulas.json, formula_registry.json, token_formula_report.md, "
          f"class_stats.csv and model_comparison.csv to {out}")


if __name__ == "__main__":
    main()
