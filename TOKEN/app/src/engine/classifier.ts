import type { ClassScore, ClassifierModel } from "./types";

/**
 * In-browser twin of the TF-IDF + logistic-regression classifier trained by
 * pipeline/build_engine.py. Must stay in lockstep with classify_from_export() there:
 * lowercase -> [a-z0-9]+ tokens -> unigrams + bigrams -> (1 + ln tf) * idf -> L2 -> softmax.
 */
export class Classifier {
  readonly classes: string[];
  private readonly index = new Map<string, number>();
  private readonly pattern: RegExp;

  constructor(private readonly model: ClassifierModel) {
    this.classes = model.classes;
    model.vocabulary.forEach((term, i) => this.index.set(term, i));
    this.pattern = new RegExp(model.token_pattern, "g");
  }

  rank(text: string): ClassScore[] {
    const { idf, coef, intercept } = this.model;
    const tokens = text.toLowerCase().match(this.pattern) ?? [];
    const counts = new Map<number, number>();
    const add = (gram: string) => {
      const i = this.index.get(gram);
      if (i !== undefined) counts.set(i, (counts.get(i) ?? 0) + 1);
    };
    tokens.forEach(add);
    for (let i = 1; i < tokens.length; i++) add(`${tokens[i - 1]} ${tokens[i]}`);

    const scores = intercept.slice();
    if (counts.size) {
      const features = [...counts].map(([i, tf]) => [i, (1 + Math.log(tf)) * idf[i]] as const);
      const norm = Math.hypot(...features.map(([, v]) => v));
      for (let k = 0; k < scores.length; k++) {
        const row = coef[k];
        for (const [i, v] of features) scores[k] += (row[i] * v) / norm;
      }
    }
    const max = Math.max(...scores);
    const exp = scores.map((s) => Math.exp(s - max));
    const total = exp.reduce((a, b) => a + b, 0);
    return this.classes
      .map((label, k) => ({ label, probability: exp[k] / total }))
      .sort((a, b) => b.probability - a.probability);
  }
}
