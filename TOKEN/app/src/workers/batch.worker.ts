import { loadEngine, outputFor } from "../engine/engine";
import type { TextKind } from "../engine/types";

export interface BatchRequest {
  rows: string[];
  kind: TextKind;
}

export interface BatchRowResult {
  tokens: number;
  classification: string | null;
  confidence: number | null;
  estimate: number | null;
  low: number | null;
  high: number | null;
  extrapolated: boolean;
}

export type BatchMessage =
  | { type: "progress"; done: number; total: number }
  | { type: "done"; results: BatchRowResult[]; ms: number }
  | { type: "error"; message: string };

const ctx = self as unknown as Worker;
const engine = loadEngine();

ctx.onmessage = async ({ data }: MessageEvent<BatchRequest>) => {
  try {
    const e = await engine;
    const started = performance.now();
    const results: BatchRowResult[] = [];
    data.rows.forEach((text, i) => {
      const { tokens, ranking } = e.analyze(text, data.kind);
      const top = ranking[0];
      const out = top ? outputFor(e, top.label, tokens) : null;
      results.push({
        tokens,
        classification: top?.label ?? null,
        confidence: top?.probability ?? null,
        estimate: out?.estimate ?? null,
        low: out?.low ?? null,
        high: out?.high ?? null,
        extrapolated: out?.extrapolated ?? false,
      });
      if (i % 20 === 0 || i === data.rows.length - 1) ctx.postMessage({ type: "progress", done: i + 1, total: data.rows.length });
    });
    ctx.postMessage({ type: "done", results, ms: performance.now() - started } satisfies BatchMessage);
  } catch (err) {
    ctx.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) } satisfies BatchMessage);
  }
};
