import { useMemo, useState } from "react";
import { outputFor, type Engine } from "../engine/engine";
import { describeFormula } from "../engine/formulas";
import { costOf, MODEL_IDS } from "../engine/pricing";
import type { TextKind } from "../engine/types";
import { countWords, formatPercent, formatTokens, formatUSD } from "../lib/format";
import { useDebounced } from "../lib/hooks";
import { useSettings } from "../lib/settings";
import { Badge, Button, Card, LockIcon, Meter, Notice, NumberField, Segmented, Select, SparkIcon, StatTile, cx } from "./ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Sector,} from "recharts";

const COST_COLORS = ["#3B82F6", "#10B981"]
const CostPieShape = (props: any) =>{
  const { index,...rest }=props;
  return (
    <Sector
    {...rest}
    fill={COST_COLORS[index %
      COST_COLORS.length
      ]} />
  );
};
const KIND_OPTIONS: { value: TextKind; label: string; hint: string }[] = [
  { value: "prompt", label: "Prompt", hint: "Estimate the reply Claude will write" },
  { value: "response", label: "Response", hint: "Count an existing reply as output tokens" },
];

export function EstimateView({ engine }: { engine: Engine }) {
  const { settings, update } = useSettings();
  const samples = engine.insights.samples;
  const [text, setText] = useState(samples[0]?.prompt ?? "");
  const [kind, setKind] = useState<TextKind>("prompt");
  const [override, setOverride] = useState<string | null>(null);
  const [recommendedPrompt, setRecommendedPrompt] = useState("");
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const getRecommendation = async () => {
    if (!text.trim()) return;

    setRecommendationLoading(true);
    setRecommendationError(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Recommendation API error: ${response.status}`);
      }

      const data = await response.json();

      setRecommendedPrompt(data.recommended_prompt);
    } catch (error) {
      setRecommendationError(
        error instanceof Error
          ? error.message
          : "Failed to generate recommendation."
      );
    } finally {
      setRecommendationLoading(false);
    }
  };
  const debounced = useDebounced(text, 200);

  const analysis = useMemo(() => engine.analyze(debounced, kind), [engine, debounced, kind]);
  const top = analysis.ranking[0];
  const category = kind === "prompt" ? (override ?? top?.label ?? null) : null;
  const output = category ? outputFor(engine, category, analysis.tokens) : null;
  const inputTokens = kind === "prompt" ? analysis.tokens : 0;
  const outputTokens = kind === "prompt" ? (output?.estimate ?? 0) : analysis.tokens;
  const costs = Object.fromEntries(
    MODEL_IDS.map((id) => [id, costOf(inputTokens, outputTokens, settings.prices[id], settings.factors)]),
  ) as Record<(typeof MODEL_IDS)[number], ReturnType<typeof costOf>>;
  const cost = costs[settings.model];
  const price = settings.prices[settings.model];
  const formula = category ? engine.data.formulas[category] : null;
  const empty = !debounced.trim();
  const stale = debounced !== text;

  const loadSample = (label: string) => {
    const s = samples.find((x) => x.classification === label);
    if (s) {
      setText(s.prompt);
      setKind("prompt");
      setOverride(null);
    }
  };

  const recommendedAnalysis = 
  useMemo(
    () =>
      recommendedPrompt.trim() ? engine.analyze(recommendedPrompt, "prompt") :null, [engine, recommendedPrompt] 
  );

  const recommendedCategory =
  recommendedAnalysis?.ranking?.[0]?.label ?? null;

  const recommendedOutput = 
  recommendedAnalysis && recommendedCategory
  ? outputFor(
    engine,
    recommendedCategory,
    recommendedAnalysis.tokens
  )
  : null;

  const recommendedInputTokens = recommendedAnalysis?.tokens ?? 0;

  const recommendedOutputTokens = recommendedOutput?.estimate ?? 0;

  const recommendedCosts = Object.fromEntries(MODEL_IDS.map((id) => [
    id,
    costOf(
      recommendedInputTokens,
      recommendedOutputTokens,
      settings.prices[id],
      settings.factors
    ),
  ])) as Record<(typeof MODEL_IDS)[number], ReturnType<typeof 
  costOf>>;
  
  const originalTotalTokens = Math.round(inputTokens + outputTokens);
  const recommendedTotalTokens = Math.round(recommendedInputTokens + recommendedOutputTokens);
  const originalCost = cost.total;
  const recommendedCost = recommendedCosts[settings.model]?.total ?? 0;
  const tokenSavings = originalTotalTokens - recommendedTotalTokens;
  const costSavings = originalCost - recommendedCost;
  const tokenSavingsPositive = tokenSavings >= 0;
  const costSavingsPositive = costSavings >= 0;
  const tokenSavingsPercent = originalTotalTokens > 0 ? (tokenSavings / originalTotalTokens) * 100 : 0;
  const costSavingsPercent = originalCost > 0 ? (costSavings / originalCost) * 100 : 0;
  const tokenChangeText = tokenSavingsPositive ? `${Math.abs(tokenSavings)} fewer tokens` : `${Math.abs(tokenSavings)} more tokens`;
  const costChangeText = costSavingsPositive ? `${Math.abs(costSavingsPercent).toFixed(1)}% lower cost` : `${Math.abs(costSavingsPercent).toFixed(1)}% higher cost`;
  const optimizationChartData = [
    {
      metric: "Input tokens",
      Original: inputTokens,
      Optimized: recommendedInputTokens,
    },
    {
      metric: "Output tokens",
      Original: outputTokens,
      Optimized: recommendedOutputTokens,
    },
    {
      metric: "Total tokens",
      Original: outputTokens,
      Optimized: recommendedTotalTokens
    },
  ];
  const costChartData = [
    {
      name: "Input cost",
      value: cost.input,
    },
    {
      name: "Output cost",
      value: cost.output,
    },
  ];
  const COST_COLORS=["#3B82F6","#10B981"];

  return (
    <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)_minmax(0,4fr)]">
      <Card
        title="Your text"
        subtitle={<span className="inline-flex items-center gap-1"><LockIcon /> Counted in your browser, nothing is sent anywhere</span>}
        actions={<Segmented label="Text type" options={KIND_OPTIONS} value={kind} onChange={(k) => { setKind(k); setOverride(null); }} size="sm" />}
      >
        <label htmlFor="text-input" className="sr-only">Text to estimate</label>
        <textarea
          id="text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={kind === "prompt" ? "Paste a prompt to estimate the reply and its cost…" : "Paste a response to count its output tokens…"}
          rows={12}
          className="w-full resize-y rounded-xl border border-line bg-surface-2 p-3 font-mono text-[13px] leading-relaxed text-ink placeholder:text-ink-2"
        />
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <dl className="tabular flex gap-4 text-xs text-ink-2">
            <div><dt className="inline">Characters </dt><dd className="inline font-semibold text-ink">{formatTokens(text.length)}</dd></div>
            <div><dt className="inline">Words </dt><dd className="inline font-semibold text-ink">{formatTokens(countWords(text))}</dd></div>
            <div><dt className="inline">Tokens </dt><dd className="inline font-semibold text-ink">{formatTokens(analysis.tokens)}</dd></div>
          </dl>
          <div className="flex items-end gap-2">
            <Select label="Try a sample" value="" onChange={(e) => loadSample(e.target.value)} className="w-44">
              <option value="" disabled>Choose a category…</option>
              {samples.map((s) => <option key={s.classification} value={s.classification}>{s.classification}</option>)}
            </Select>
            <Button variant="ghost" onClick={() => { setText(""); setOverride(null); }} disabled={!text}>Clear</Button>
            <Button variant="primary" onClick={getRecommendation} disabled={!text.trim() || recommendationLoading}>{recommendationLoading ? "Optimizing..." : "Optimize Prompt"}</Button>
          </div>
        </div>
      </Card>

      {recommendedPrompt && (
        <Card
        title="Recommended Prompt"
        subtitle="Optimized Prompt"
        >
          <textarea
          value={recommendedPrompt}
          readOnly
          rows={6}
          className="w-full resize-none
          rounded-xl border border-line
          bg-surface px-4 py-3 font-mono
          text-[13px] leading-relaxed
          text-ink"
          />
          <div className="grid grid-cols-3 gap-3">
            <StatTile
              label="Input tokens"
            value={formatTokens(recommendedInputTokens)}/>
            <StatTile
              label="Est. output tokens"
            value={formatTokens(recommendedOutputTokens)}/>
            <StatTile
              label="Total tokens"
            value={formatTokens(recommendedInputTokens + recommendedOutputTokens)}/>
          </div>
          {recommendedCosts[settings.model] !== undefined && (
            <div className="mt-3 rounded-xl border border-line bg-surface p-4">
              <div className="text-xs text-ink-2">
                Estimated cost
              </div>
              <div className="mt-1 text-xl font-semibold text-ink">
                {formatUSD(recommendedCosts[settings.model].total)}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="mt-3 rounded-xl border border-line bg-surface p-4">
              <div className="text-sm font-medium text-slate-600">Token Savings</div>
              <div className={`mt-1 text-2xl font-semibold ${tokenSavingsPositive ? "text-emerald-600" : "text-red-600"}`}>
                {Math.abs(tokenSavings)}
              </div>
              <div className={`text-xs ${tokenSavingsPositive ? "text-emerald-600" : "text-red-600"}`}>
                {tokenChangeText}
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-line bg-surface p-4">
              <div className="text-sm font-medium text-slate-600">Cost Savings</div>
              <div className={`mt-1 text-2xl font-semibold ${costSavingsPositive ? "text-emerald-600" : "text-red-600"}`}>
                {formatUSD(Math.abs(costSavings))}
              </div>
              <div className={`text-xs ${costSavingsPositive ? "text-emerald-600" : "text-red-600"}`}>{costChangeText}</div>
            </div>
          </div>
          <div className="mt-4 grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="h-56 w-full">
            <h3 className="text-sm font-semibold text-slate-900">
                Optimization Comparison
              </h3>
              <p className="text-xs text-slate-500">
                Original prompt vs Optimized prompt
              </p>
              <div className="h-48 w-full flex justify-center">
              <div className="h-full w-[420px] max-w-full mx-auto">
              <ResponsiveContainer 
              width="100%"height="100%">
                <BarChart
                data={optimizationChartData}
                margin={{top:5, right:10, left:0, bottom:5}}
                >
                  <CartesianGrid
                  strokeDasharray="33"/>
                  <XAxis dataKey="metric" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar
                  dataKey="Original"
                  name="Original"
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                  />
                  <Bar
                  dataKey="Optimized"
                  name="Optimized"
                  fill="#10B981"
                  radius={[4,4,0,0]}
                  />
                </BarChart>
              </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
          {recommendationError && (
            <Notice tone="critical"
            title="Recommendation failed">
              {recommendationError}
            </Notice>
          )}
        </Card>
      )}

      <Card title="Estimate" subtitle={`${price.name} · ${engine.data.tokenizer} tokens`} className={cx("transition-opacity", stale && "opacity-70")}>
        {empty ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-series-1"><SparkIcon /></span>
            <p className="max-w-xs text-sm text-ink-2">Paste a prompt to see its token count, category, estimated reply length and cost.</p>
            <Button variant="primary" onClick={() => loadSample(samples[0].classification)}>Try a sample prompt</Button>
          </div>
        ) : (
          <div className="fade-in space-y-5" aria-live="polite">
            <div>
              <div className="text-xs text-ink-2">{kind === "prompt" ? "Estimated cost per request" : "Cost of this reply as output"}</div>
              <div className="mt-1 text-5xl font-semibold tracking-tight text-ink">{formatUSD(cost.total)}</div>
              <div className="mt-1 text-xs text-ink-2">
                {kind === "prompt" ? <>input {formatUSD(cost.input)} + estimated output {formatUSD(cost.output)}</> : <>{formatTokens(analysis.tokens)} output tokens at ${price.output} per million</>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <StatTile className="px-3" label="Input tokens" value={formatTokens(inputTokens)} sub={kind === "prompt" ? "counted" : "not a prompt"} />
              <StatTile
                className="px-3"
                label={kind === "prompt" ? "Est. output" : "Output tokens"}
                value={formatTokens(outputTokens)}
                sub={output ? <span title="80% of replies fall in this range">{formatTokens(output.low)}–{formatTokens(output.high)} (80%)</span> : "counted"}
              />
              <StatTile className="px-3" label="Total tokens" value={formatTokens(inputTokens + outputTokens)} sub={kind === "prompt" ? "input + output" : "output only"} />
            </div>

            {kind === "prompt" && top && category && (
              <div className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-2">Category</span>
                    <Badge>{category}</Badge>
                    {override && <span className="text-xs text-ink-2">(set manually)</span>}
                  </div>
                  <div className="flex items-end gap-2">
                    <Select label="Change category" value={category} onChange={(e) => setOverride(e.target.value === top.label ? null : e.target.value)} className="w-48">
                      {engine.data.classes.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                    {override && <Button size="sm" variant="ghost" onClick={() => setOverride(null)}>Reset</Button>}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="w-full"><Meter value={top.probability} label="Classifier confidence" /></div>
                  <span className="tabular shrink-0 text-xs text-ink-2">{formatPercent(top.probability)} confident in {top.label}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {output?.extrapolated && formula && (
                <Notice tone="warning" title="Extrapolation">
                  This prompt is longer than any {category} prompt in the dataset ({formatTokens(formula.input_range[1])} tokens max), so the estimate
                  extends the formula beyond its data.
                </Notice>
              )}
              {kind === "prompt" && top && !override && top.probability < 0.5 && (
                <Notice tone="warning" title="Low confidence">The category is uncertain; check it and change it if needed.</Notice>
              )}
              {settings.factors.input === 1 && settings.factors.output === 1 && (
                <Notice tone="info" title="Open-source count">
                  Claude's own tokenizer usually counts more tokens than {engine.data.tokenizer}. Set a Claude factor in Settings for closer costs.
                </Notice>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <caption className="sr-only">Cost by model</caption>
                <thead className="bg-surface-2 text-xs text-ink-2">
                  <tr><th scope="col" className="px-3 py-2 text-left font-medium">Model</th><th scope="col" className="px-3 py-2 text-right font-medium">Input</th><th scope="col" className="px-3 py-2 text-right font-medium">Output</th><th scope="col" className="px-3 py-2 text-right font-medium">Total</th></tr>
                </thead>
                <tbody className="tabular">
                  {MODEL_IDS.map((id) => (
                    <tr key={id} onClick={() => update({ model: id })} className={cx("cursor-pointer border-t border-line", id === settings.model ? "bg-accent-soft" : "hover:bg-surface-2")}>
                      <th scope="row" className="px-3 py-2 text-left font-medium text-ink">{settings.prices[id].name}</th>
                      <td className="px-3 py-2 text-right text-ink-2">{formatUSD(costs[id].input)}</td>
                      <td className="px-3 py-2 text-right text-ink-2">{formatUSD(costs[id].output)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-ink">{formatUSD(costs[id].total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {formula && output && (
              <details className="group rounded-xl border border-line p-4 text-sm">
                <summary className="cursor-pointer select-none font-medium text-ink">How this estimate was calculated</summary>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-2">
                  <li>Tokens: {engine.data.tokenizer} counts <b className="text-ink">{formatTokens(analysis.tokens)}</b> input tokens{settings.factors.input !== 1 && <> × Claude factor {settings.factors.input} = {formatTokens(analysis.tokens * settings.factors.input)}</>}.</li>
                  <li>Category: {override ? "set manually to" : "the local classifier picks"} <b className="text-ink">{category}</b>{!override && top && <> ({formatPercent(top.probability)})</>}.</li>
                  <li>Formula for {category}: output = <code className="font-mono text-ink">{describeFormula(formula)}</code> = <b className="text-ink">{formatTokens(output.estimate)}</b> tokens.</li>
                  <li>80% range: {formatTokens(output.low)}–{formatTokens(output.high)} tokens (×{formula.interval.low.toFixed(2)}–×{formula.interval.high.toFixed(2)}, from cross-validated errors).</li>
                  <li>Cost: input × ${price.input}/M + output × ${price.output}/M{settings.factors.output !== 1 && <> (output × Claude factor {settings.factors.output})</>} = <b className="text-ink">{formatUSD(cost.total)}</b>.</li>
                </ol>
                <p className="mt-3 text-xs text-ink-2">
                  Formula accuracy for {category} on held-out data: R² {formula.cv_metrics?.r2?.toFixed(3)}, typical error ±{formula.cv_metrics?.mae.toFixed(0)} tokens,
                  from {formatTokens(formula.samples)} dataset records. The estimate covers the visible reply; Sonnet 5 and Opus 5 think by default, and thinking tokens are billed as output.
                </p>
              </details>
            )}
          </div>
        )}
      </Card>

      <div className="grid content-start gap-5 lg:col-span-2 lg:grid-cols-2 xl:col-span-1 xl:grid-cols-1">
        <Card title="Volume projection" subtitle="Current estimate × your traffic">
          <NumberField label="Requests per day" value={settings.requestsPerDay} step={100} onChange={(v) => update({ requestsPerDay: v })} />
          <table className="tabular mt-4 w-full text-sm">
            <caption className="sr-only">Projected cost by model</caption>
            <thead className="text-xs text-ink-2">
              <tr><th scope="col" className="pb-2 text-left font-medium">Model</th><th scope="col" className="pb-2 text-right font-medium">Month</th><th scope="col" className="pb-2 text-right font-medium">Year</th></tr>
            </thead>
            <tbody>
              {MODEL_IDS.map((id) => (
                <tr key={id} className="border-t border-line">
                  <th scope="row" className={cx("py-2 text-left font-medium", id === settings.model ? "text-ink" : "text-ink-2")}>{settings.prices[id].name}</th>
                  <td className="py-2 text-right text-ink-2">{empty ? "–" : formatUSD(costs[id].total * settings.requestsPerDay * 30.4)}</td>
                  <td className={cx("py-2 text-right", id === settings.model ? "font-semibold text-ink" : "text-ink-2")}>{empty ? "–" : formatUSD(costs[id].total * settings.requestsPerDay * 365)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title={formula ? `Accuracy for ${category}` : "Engine accuracy"} subtitle="Measured on data the engine never saw">
          <div className="grid grid-cols-2 gap-3">
            {formula?.cv_metrics ? (
              <>
                <StatTile label="Typical error" value={`±${formula.cv_metrics.mae.toFixed(0)}`} sub="output tokens (MAE)" />
                <StatTile label="R²" value={formula.cv_metrics.r2?.toFixed(2) ?? "–"} sub={`${formatTokens(formula.samples)} records`} />
              </>
            ) : (
              <>
                <StatTile label="Typical error" value={`±${engine.data.end_to_end.local_classifier.mae.toFixed(0)}`} sub="output tokens (MAE)" />
                <StatTile label="R²" value={engine.data.end_to_end.local_classifier.r2?.toFixed(2) ?? "–"} sub="all categories" />
              </>
            )}
            <StatTile label="Classifier accuracy" value={formatPercent(engine.data.classifier.heldout_accuracy, 1)} sub="held-out prompts" className="col-span-2" />
          </div>
        </Card>
      </div>
    </div>
  );
}
