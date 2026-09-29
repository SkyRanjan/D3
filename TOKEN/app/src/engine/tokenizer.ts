import type { Tiktoken } from "js-tiktoken/lite";

/**
 * Open-source o200k_base tokenizer, bundled with the app (no network, no API key).
 * The pipeline counted the dataset with the identical tokenizer (Python tiktoken),
 * so counts here are on the same scale as the formulas. They are NOT Claude's own
 * token counts - see the Claude token factor in Settings.
 */
let encoder: Promise<Tiktoken> | undefined;

export function loadTokenizer(): Promise<Tiktoken> {
  encoder ??= Promise.all([import("js-tiktoken/lite"), import("js-tiktoken/ranks/o200k_base")]).then(
    ([{ Tiktoken }, ranks]) => new Tiktoken(ranks.default),
  );
  return encoder;
}

/** Special-token text such as "<|endoftext|>" is counted as ordinary text, like tiktoken's encode_ordinary. */
export function countTokens(enc: Tiktoken, text: string): number {
  return text ? enc.encode(text, [], []).length : 0;
}
