#!/usr/bin/env python3
"""Optional: measure how Claude's tokenizer compares with o200k_base on this dataset.

Uses Anthropic's token-counting endpoint, which is free (rate-limited, no text is generated).
It needs Anthropic API credentials (ANTHROPIC_API_KEY or `ant auth login`) and SENDS the sampled
prompts and responses to Anthropic's API. Run pipeline/build_engine.py first.

    .venv\\Scripts\\pip install -r pipeline\\requirements-claude.txt
    .venv\\Scripts\\python pipeline\\calibrate_claude.py --dry-run          # shows what would be sent
    .venv\\Scripts\\python pipeline\\calibrate_claude.py --model claude-sonnet-5

Writes app/public/engine/calibration.json; the app then offers the measured factors in Settings.
"""
import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "pipeline" / "out" / "dataset_o200k_base.csv"
TARGET = ROOT / "app" / "public" / "engine" / "calibration.json"


def fit(o200k, claude):
    """Claude count = factor * o200k count + fixed message overhead."""
    factor, overhead = np.polyfit(o200k, claude, 1)
    r2 = np.corrcoef(o200k, claude)[0, 1] ** 2
    return float(factor), float(overhead), float(r2)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--model", default="claude-sonnet-5", help="model whose tokenizer to measure (e.g. claude-opus-5)")
    parser.add_argument("--per-class", type=int, default=25, help="records sampled per classification")
    parser.add_argument("--workers", type=int, default=8, help="parallel requests (stay under your tier's rate limit)")
    parser.add_argument("--dry-run", action="store_true", help="show the sample size and exit without calling the API")
    args = parser.parse_args()

    if not DATASET.exists():
        sys.exit(f"{DATASET} not found - run pipeline/build_engine.py first.")
    df = pd.read_csv(DATASET)
    sample = df.groupby("prompt_classification").sample(n=args.per_class, random_state=42)
    texts = sample["prompt"].tolist() + sample["response"].tolist()
    print(f"{len(sample)} records ({len(texts)} texts, {sum(map(len, texts)):,} characters) -> {args.model} count_tokens")
    if args.dry_run:
        return

    import truststore

    truststore.inject_into_ssl()  # corporate TLS inspection (Zscaler): trust the Windows certificate store
    import anthropic

    client = anthropic.Anthropic(max_retries=5)

    def count(text):
        return client.messages.count_tokens(model=args.model, messages=[{"role": "user", "content": text}]).input_tokens

    try:
        with ThreadPoolExecutor(args.workers) as pool:
            counts = list(pool.map(count, texts))
    except anthropic.AuthenticationError:
        sys.exit("Anthropic rejected the credentials. Set ANTHROPIC_API_KEY or run `ant auth login`.")
    except anthropic.NotFoundError:
        sys.exit(f"Unknown model {args.model!r}.")
    except anthropic.APIConnectionError as e:
        sys.exit(f"Could not reach the Anthropic API ({e}). Behind a proxy? Check that api.anthropic.com is allowed.")

    n = len(sample)
    in_factor, in_overhead, in_r2 = fit(sample["input_tokens"].to_numpy(float), np.array(counts[:n], float))
    out_factor, out_overhead, out_r2 = fit(sample["output_tokens"].to_numpy(float), np.array(counts[n:], float))
    result = {
        "model": args.model,
        "measured": date.today().isoformat(),
        "records": n,
        "input_factor": round(in_factor, 4),
        "output_factor": round(out_factor, 4),
        "message_overhead_tokens": round((in_overhead + out_overhead) / 2, 1),
        "r2": {"input": round(in_r2, 4), "output": round(out_r2, 4)},
    }
    TARGET.write_text(json.dumps(result, indent=1), encoding="utf-8")
    print(f"Claude ({args.model}) counts x{in_factor:.3f} (prompts) and x{out_factor:.3f} (responses) the o200k_base tokens, "
          f"plus ~{result['message_overhead_tokens']} tokens of message overhead. Saved {TARGET}")


if __name__ == "__main__":
    main()
