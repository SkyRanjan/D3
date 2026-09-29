import { Classifier } from "./classifier";
import { estimateOutput } from "./formulas";
import { countTokens, loadTokenizer } from "./tokenizer";
import type { Calibration, ClassifierModel, EngineData, Insights, OutputEstimate, TextAnalysis, TextKind } from "./types";

export interface Engine {
  data: EngineData;
  insights: Insights;
  calibration: Calibration | null;
  classifier: Classifier;
  count(text: string): number;
  analyze(text: string, kind: TextKind): TextAnalysis;
}

async function fetchJson<T>(name: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}engine/${name}`);
  if (!res.ok) throw new Error(`Could not load engine/${name} (HTTP ${res.status}). Run pipeline/build_engine.py first.`);
  return (await res.json()) as T;
}

export async function loadEngine(): Promise<Engine> {
  const [data, model, insights, calibration, enc] = await Promise.all([
    fetchJson<EngineData>("engine.json"),
    fetchJson<ClassifierModel>("classifier.json"),
    fetchJson<Insights>("insights.json"),
    fetchJson<Calibration>("calibration.json").catch(() => null), // optional, see pipeline/calibrate_claude.py
    loadTokenizer(),
  ]);
  const classifier = new Classifier(model);
  return {
    data,
    insights,
    calibration,
    classifier,
    count: (text) => countTokens(enc, text),
    analyze: (text, kind) => ({
      tokens: countTokens(enc, text),
      ranking: kind === "prompt" && text.trim() ? classifier.rank(text) : [],
    }),
  };
}

/** Classification -> formula -> estimated output tokens with its 80% range. */
export function outputFor(engine: Engine, classification: string, inputTokens: number): OutputEstimate | null {
  return inputTokens > 0 ? estimateOutput(engine.data, classification, inputTokens) : null;
}
