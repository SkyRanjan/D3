import type { Engine } from "../engine/engine";
import { describeFormula } from "../engine/formulas";
import { formatPercent, formatTokens } from "../lib/format";
import { useSettings } from "../lib/settings";
import { DataTable } from "./tables";
import { Card, Notice } from "./ui";

export function EngineView({ engine }: { engine: Engine }) {
  const { data, calibration } = engine;
  const { settings } = useSettings();
  const worstBand = Math.min(...Object.values(data.formulas).flatMap((f) => f.interval_coverage_by_input_band));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-5">
        <Card title="Output engine: one formula per category" subtitle={`x = input tokens (${data.tokenizer}). Accuracy is cross-validated on records each formula never saw.`}>
          <div className="overflow-x-auto">
            <DataTable
              columns={["Category", "Estimated output tokens", "R²", "MAE", "RMSE", "80% range", "Records"]}
              align={["left", "left", "right", "right", "right", "right", "right"]}
              rows={data.classes.map((c) => {
                const f = data.formulas[c];
                return [
                  c,
                  <code className="font-mono">{describeFormula(f).replace(/input/g, "x")}</code>,
                  f.cv_metrics?.r2?.toFixed(3) ?? "–",
                  f.cv_metrics?.mae.toFixed(1) ?? "–",
                  f.cv_metrics?.rmse.toFixed(1) ?? "–",
                  `×${f.interval.low.toFixed(2)}–×${f.interval.high.toFixed(2)}`,
                  formatTokens(f.samples),
                ];
              })}
            />
          </div>
          <p className="mt-3 text-xs text-ink-2">
            Every formula passed the reliability check: never below 0 for any input of 1 token or more, and doubling the input never more than doubles the
            estimate. Linear won in every category once explosive and negative-going candidates were excluded.
          </p>
        </Card>

        <Card title="How an estimate is made">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-2">
            <li><b className="text-ink">Count</b> the prompt with the open-source <code className="font-mono">{data.tokenizer}</code> tokenizer, bundled in the app.</li>
            <li><b className="text-ink">Classify</b> it into one of the {data.classes.length} dataset categories with a local TF-IDF + logistic-regression model ({formatTokens(data.classifier.features)} features, {formatPercent(data.classifier.heldout_accuracy, 1)} accurate on held-out prompts).</li>
            <li><b className="text-ink">Estimate</b> the reply with that category's formula, plus an empirical 80% range from cross-validated errors.</li>
            <li><b className="text-ink">Price</b> input and output separately with the selected model's rates (Settings), optionally scaled by a Claude token factor.</li>
          </ol>
          <p className="mt-3 text-sm text-ink-2">
            End to end on {formatTokens(data.end_to_end.heldout_records)} held-out prompts: typical error ±{data.end_to_end.local_classifier.mae.toFixed(1)} output tokens with the local classifier,
            versus ±{data.end_to_end.true_labels.mae.toFixed(1)} with the true categories. The classifier adds almost no error.
          </p>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Keep in mind">
          <div className="space-y-2">
            <Notice tone="info" title="Tokenizer">
              {data.tokenizer} is an open-source tokenizer, not Claude's. Claude's own counts are only available through Anthropic's free token-counting API;
              Anthropic notes OpenAI-style tokenizers undercount Claude by roughly 15–20% on typical text, more on code.
            </Notice>
            <Notice tone="info" title="Dataset">
              The {formatTokens(data.dataset.records)} records are synthetic (IT-LLM-Global-Sim-v1). Formulas describe those responses, not a specific Claude model's replies.
            </Notice>
            <Notice tone="info" title="Straight lines">
              One linear formula per category is stable and never explodes, but it misses some curvature: in the weakest prompt-length band only {formatPercent(worstBand)} of
              replies fall inside the 80% range.
            </Notice>
            <Notice tone="info" title="Thinking">Claude Sonnet 5 and Opus 5 think by default. Thinking tokens are billed as output and are not in these estimates.</Notice>
          </div>
        </Card>

        <Card title="Claude calibration" subtitle="Optional, free, needs an Anthropic API key">
          {calibration ? (
            <p className="text-sm text-ink-2">
              Measured {calibration.measured} on {formatTokens(calibration.records)} records with <code className="font-mono">{calibration.model}</code>: Claude counts ×{calibration.input_factor.toFixed(3)} (input) and ×{calibration.output_factor.toFixed(3)} (output) the {data.tokenizer} tokens.
              {settings.factors.input === calibration.input_factor ? " These factors are in use." : " Apply them in Settings."}
            </p>
          ) : (
            <p className="text-sm text-ink-2">
              Not calibrated. The app uses {data.tokenizer} counts as is (factor {settings.factors.input}). To measure the real Claude ratio for free, run{" "}
              <code className="font-mono">pipeline/calibrate_claude.py</code> with an Anthropic API key. It counts a sample of the dataset with Claude's token-counting endpoint.
            </p>
          )}
        </Card>

        <Card title="Rebuild the engine">
          <p className="text-sm text-ink-2">Built {data.built} from <code className="font-mono">{data.dataset.file}</code>. After changing the dataset, run:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-xs text-ink">.venv\Scripts\python pipeline\build_engine.py</pre>
        </Card>
      </div>
    </div>
  );
}
