export type ModelId = "claude-sonnet-5" | "claude-opus-5";

export interface ModelPrice {
  id: ModelId;
  name: string;
  /** USD per million tokens. */
  input: number;
  output: number;
}

/** Anthropic list prices per million tokens (input / output), as published mid-2026. Editable in Settings. */
export const DEFAULT_PRICES: Record<ModelId, ModelPrice> = {
  "claude-sonnet-5": { id: "claude-sonnet-5", name: "Claude Sonnet 5", input: 2, output: 10 },
  "claude-opus-5": { id: "claude-opus-5", name: "Claude Opus 5", input: 5, output: 25 },
};

export const MODEL_IDS: ModelId[] = ["claude-sonnet-5", "claude-opus-5"];

export interface TokenFactors {
  /** Multipliers from open-source o200k_base tokens to Claude tokens (1 = no adjustment). */
  input: number;
  output: number;
}

export interface Cost {
  input: number;
  output: number;
  total: number;
}

/** Input and output are priced separately - never multiply a token total by one price. */
export function costOf(inputTokens: number, outputTokens: number, price: ModelPrice, factors: TokenFactors): Cost {
  const input = (inputTokens * factors.input * price.input) / 1e6;
  const output = (outputTokens * factors.output * price.output) / 1e6;
  return { input, output, total: input + output };
}
