import type { EngineData, Formula, OutputEstimate } from "./types";

/** Same evaluation as pipeline/token_formula_analysis.py predict(). */
export function evaluateFormula(f: Pick<Formula, "formula_type" | "parameters">, inputTokens: number): number {
  const p = f.parameters;
  const x = Math.max(inputTokens, 1);
  switch (f.formula_type) {
    case "constant":
      return p.c;
    case "linear":
      return p.a * x + p.b;
    case "logarithmic":
      return p.a * Math.log(x) + p.b;
    case "power":
      return p.a * Math.pow(x, p.b);
    case "polynomial":
      return p.a * x * x + p.b * x + p.c;
  }
}

export function estimateOutput(engine: EngineData, classification: string, inputTokens: number): OutputEstimate {
  const f = engine.formulas[classification];
  if (!f) throw new Error(`No formula for classification "${classification}"`);
  const estimate = evaluateFormula(f, inputTokens);
  const { low, high } = f.interval;
  const [lo, hi] = engine.interval.method === "ratio" ? [estimate * low, estimate * high] : [estimate + low, estimate + high];
  return { estimate, low: Math.max(0, lo), high: Math.max(0, hi), extrapolated: inputTokens > f.input_range[1] };
}

/** Human-readable formula, e.g. "3.2987 × input + 39.1285". */
export function describeFormula(f: Pick<Formula, "formula_type" | "parameters">): string {
  const p = f.parameters;
  const n = (v: number) => (Math.abs(v) >= 1000 ? v.toFixed(1) : Number(v.toPrecision(5)).toString());
  const plus = (v: number) => `${v < 0 ? "−" : "+"} ${n(Math.abs(v))}`;
  switch (f.formula_type) {
    case "constant":
      return n(p.c);
    case "linear":
      return `${n(p.a)} × input ${plus(p.b)}`;
    case "logarithmic":
      return `${n(p.a)} × ln(input) ${plus(p.b)}`;
    case "power":
      return `${n(p.a)} × input^${n(p.b)}`;
    case "polynomial":
      return `${n(p.a)} × input² ${plus(p.b)} × input ${plus(p.c)}`;
  }
}
