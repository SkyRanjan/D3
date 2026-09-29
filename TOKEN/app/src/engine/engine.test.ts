import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Classifier } from "./classifier";
import { estimateOutput, evaluateFormula } from "./formulas";
import { costOf, DEFAULT_PRICES } from "./pricing";
import { countTokens, loadTokenizer } from "./tokenizer";
import type { ClassifierModel, EngineData } from "./types";
import parity from "./fixtures/parity.json";

const load = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../../public/engine/${name}`, import.meta.url), "utf8")) as T;
const engine = load<EngineData>("engine.json");
const classifier = new Classifier(load<ClassifierModel>("classifier.json"));

describe("parity with the Python pipeline", () => {
  it("counts o200k_base tokens exactly like tiktoken", async () => {
    const enc = await loadTokenizer();
    const mismatches = parity.cases.filter((c) => countTokens(enc, c.text) !== c.tokens);
    expect(mismatches.map((c) => c.text.slice(0, 40))).toEqual([]);
  });

  it("classifies exactly like the exported model", () => {
    for (const c of parity.cases) {
      const ranking = classifier.rank(c.text);
      expect(ranking[0].label).toBe(c.classification);
      const byLabel = Object.fromEntries(ranking.map((r) => [r.label, r.probability]));
      classifier.classes.forEach((label, k) => expect(byLabel[label]).toBeCloseTo(c.probs[k], 6));
    }
  });
});

describe("formula engine", () => {
  it("evaluates every formula type", () => {
    expect(evaluateFormula({ formula_type: "linear", parameters: { a: 2, b: 10 } }, 5)).toBe(20);
    expect(evaluateFormula({ formula_type: "constant", parameters: { c: 7 } }, 99)).toBe(7);
    expect(evaluateFormula({ formula_type: "polynomial", parameters: { a: 1, b: 1, c: 1 } }, 2)).toBe(7);
    expect(evaluateFormula({ formula_type: "power", parameters: { a: 3, b: 2 } }, 2)).toBe(12);
    expect(evaluateFormula({ formula_type: "logarithmic", parameters: { a: 1, b: 0 } }, Math.E)).toBeCloseTo(1);
  });

  it("has one formula per classification, never negative and never faster than proportional", () => {
    expect(Object.keys(engine.formulas).sort()).toEqual([...engine.classes].sort());
    for (const f of Object.values(engine.formulas)) {
      for (let x = 1; x <= 10 * f.input_range[1]; x++) {
        const y = evaluateFormula(f, x);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(evaluateFormula(f, 2 * x)).toBeLessThanOrEqual(2 * y + 1e-6);
      }
    }
  });

  it("returns an 80% range around the estimate", () => {
    const label = engine.classes[0];
    const out = estimateOutput(engine, label, 30);
    expect(out.low).toBeLessThan(out.estimate);
    expect(out.high).toBeGreaterThan(out.estimate);
    expect(out.extrapolated).toBe(false);
    expect(estimateOutput(engine, label, 10_000).extrapolated).toBe(true);
  });
});

describe("pricing", () => {
  it("prices input and output separately", () => {
    const cost = costOf(1_000_000, 1_000_000, DEFAULT_PRICES["claude-sonnet-5"], { input: 1, output: 1 });
    expect(cost).toEqual({ input: 2, output: 10, total: 12 });
    expect(costOf(1_000_000, 0, DEFAULT_PRICES["claude-opus-5"], { input: 1.2, output: 1 }).total).toBeCloseTo(6);
  });
});
