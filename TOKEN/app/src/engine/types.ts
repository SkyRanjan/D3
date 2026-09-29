// Shapes of the JSON files built by pipeline/build_engine.py (app/public/engine/).

export type FormulaType = "constant" | "linear" | "logarithmic" | "power" | "polynomial";

export interface Metrics {
  r2: number | null;
  mae: number;
  rmse: number;
}

export interface Formula {
  formula_type: FormulaType;
  parameters: Record<string, number>;
  expression: string;
  samples: number;
  input_range: [number, number];
  cv_metrics: Metrics | null;
  notes: string[];
  /** Empirical 80% range, as multipliers (ratio) or token offsets of the estimate. */
  interval: { low: number; high: number };
  interval_coverage_by_input_band: number[];
}

export interface EngineData {
  version: number;
  built: string;
  tokenizer: string;
  dataset: { file: string; records: number; token_counts: string; original_counter: string };
  classes: string[];
  formulas: Record<string, Formula>;
  classifier: { heldout_accuracy: number; heldout_macro_f1: number; C: number; features: number };
  end_to_end: { heldout_records: number; true_labels: Metrics; local_classifier: Metrics };
  interval: { level: number; method: "ratio" | "offset" };
}

export interface ClassifierModel {
  type: string;
  token_pattern: string;
  lowercase: boolean;
  ngram_range: [number, number];
  classes: string[];
  vocabulary: string[];
  idf: number[];
  coef: number[][];
  intercept: number[];
}

export interface Insights {
  distribution: { classification: string; records: number }[];
  validation: {
    r2: number;
    mae: number;
    points: { actual: number; predicted: number; classification: string; correct: boolean }[];
  };
  tokens_per_char: { edges: number[]; counts: Record<string, number[]> };
  summary: {
    prompt_tokens_per_char: number;
    prompt_tokens_per_word: number;
    response_tokens_per_char: number;
    response_tokens_per_word: number;
    cv_outside_80pct_range: number;
  };
  confusion: { labels: string[]; matrix: number[][] };
  samples: { classification: string; prompt: string }[];
}

/** Optional: written by pipeline/calibrate_claude.py (free Claude count_tokens API). */
export interface Calibration {
  model: string;
  measured: string;
  records: number;
  input_factor: number;
  output_factor: number;
}

export type TextKind = "prompt" | "response";

export interface ClassScore {
  label: string;
  probability: number;
}

export interface OutputEstimate {
  estimate: number;
  low: number;
  high: number;
  /** True when the prompt is longer than any prompt of this class in the dataset. */
  extrapolated: boolean;
}

export interface TextAnalysis {
  tokens: number;
  /** Ranked classifier scores (prompts only). */
  ranking: ClassScore[];
}
