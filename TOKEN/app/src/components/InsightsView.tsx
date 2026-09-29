import { useMemo, useState } from "react";
import type { Engine } from "../engine/engine";
import { formatPercent, formatTokens } from "../lib/format";
import { useChartColors } from "../lib/hooks";
import { useSettings } from "../lib/settings";
import { ActualVsPredictedChart, CategoryBarChart, HistogramChart } from "./charts";
import { ChartCard, DataTable } from "./tables";
import { Button, Card, PrintIcon, Select, StatTile } from "./ui";

export function InsightsView({ engine }: { engine: Engine }) {
  const { settings } = useSettings();
  const colors = useChartColors(settings.theme);
  const { insights, data } = engine;
  const [filter, setFilter] = useState<string>("all");
  const scoped = filter === "all" ? null : filter;

  const perClass = useMemo(() => {
    const { labels, matrix } = insights.confusion;
    return labels.map((label, i) => {
      const tp = matrix[i][i];
      const actual = matrix[i].reduce((a, b) => a + b, 0);
      const predicted = matrix.reduce((a, row) => a + row[i], 0);
      return { label, recall: actual ? tp / actual : 0, precision: predicted ? tp / predicted : 0, support: actual };
    });
  }, [insights]);

  const points = scoped ? insights.validation.points.filter((p) => p.classification === scoped) : insights.validation.points;
  const edges = insights.tokens_per_char.edges;
  const counts = scoped
    ? insights.tokens_per_char.counts[scoped]
    : edges.slice(1).map((_, i) => data.classes.reduce((s, c) => s + insights.tokens_per_char.counts[c][i], 0));
  const bins = counts.map((count, i) => ({ label: ((edges[i] + edges[i + 1]) / 2).toFixed(3), count }));
  const records = scoped ? (insights.distribution.find((d) => d.classification === scoped)?.records ?? 0) : data.dataset.records;
  const formula = scoped ? data.formulas[scoped] : null;
  const accuracy = scoped ? perClass.find((p) => p.label === scoped)?.recall ?? 0 : data.classifier.heldout_accuracy;
  const outside = formula
    ? 1 - formula.interval_coverage_by_input_band.reduce((a, b) => a + b, 0) / formula.interval_coverage_by_input_band.length
    : insights.summary.cv_outside_80pct_range;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Category" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-56">
            <option value="all">All categories</option>
            {data.classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <p className="pb-2 text-xs text-ink-2">Scopes every figure below. Validation uses held-out prompts the engine never trained on.</p>
        </div>
        <Button className="no-print" onClick={() => window.print()}><PrintIcon /> Print / PDF</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Dataset records" value={formatTokens(records)} sub={scoped ?? `${data.classes.length} categories`} />
        <StatTile label={scoped ? "Classifier recall" : "Classifier accuracy"} value={formatPercent(accuracy, 1)} sub="held-out prompts" />
        <StatTile label="Typical error" value={`±${(formula?.cv_metrics?.mae ?? data.end_to_end.local_classifier.mae).toFixed(0)}`} sub="output tokens (MAE)" />
        <StatTile label="R²" value={(formula?.cv_metrics?.r2 ?? data.end_to_end.local_classifier.r2 ?? 0).toFixed(2)} sub={scoped ? "cross-validated" : "classifier + formula"} />
        <StatTile label="Outside 80% range" value={formatPercent(outside)} sub="target 20%" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Estimated vs actual output tokens"
          subtitle={`${formatTokens(points.length)} held-out prompts · the line marks a perfect estimate`}
          table={<DataTable columns={["Category", "Actual", "Estimated", "Classified"]} align={["left", "right", "right", "left"]} rows={points.slice(0, 300).map((p) => [p.classification, formatTokens(p.actual), formatTokens(p.predicted), p.correct ? "correctly" : "misclassified"])} />}
        >
          <ActualVsPredictedChart points={points} colors={colors} />
        </ChartCard>

        <ChartCard
          title="Tokens per character"
          subtitle={`Prompts${scoped ? ` in ${scoped}` : ""}, counted with ${data.tokenizer}`}
          table={<DataTable columns={["Tokens per character", "Prompts"]} align={["left", "right"]} rows={bins.map((b) => [b.label, formatTokens(b.count)])} />}
        >
          <HistogramChart bins={bins} colors={colors} unit="tokens per character" />
        </ChartCard>

        <ChartCard
          title="Records by category"
          subtitle="Training data behind each formula"
          table={<DataTable columns={["Category", "Records"]} align={["left", "right"]} rows={insights.distribution.map((d) => [d.classification, formatTokens(d.records)])} />}
        >
          <CategoryBarChart data={insights.distribution.map((d) => ({ label: d.classification, value: d.records }))} colors={colors} format={formatTokens} highlight={scoped} valueName="records" />
        </ChartCard>

        <Card title="Classifier accuracy by category" subtitle="Held-out prompts; recall = share of the category found">
          <div className="max-h-80 overflow-auto">
            <DataTable
              columns={["Category", "Recall", "Precision", "Prompts"]}
              align={["left", "right", "right", "right"]}
              rows={perClass.map((p) => [p.label === scoped ? <b>{p.label}</b> : p.label, formatPercent(p.recall, 1), formatPercent(p.precision, 1), formatTokens(p.support)])}
            />
          </div>
        </Card>
      </div>

      <Card title="Token ratios in the dataset" subtitle={`Medians, ${data.tokenizer} tokens`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Prompt tokens per character" value={insights.summary.prompt_tokens_per_char.toFixed(3)} />
          <StatTile label="Prompt tokens per word" value={insights.summary.prompt_tokens_per_word.toFixed(2)} />
          <StatTile label="Response tokens per character" value={insights.summary.response_tokens_per_char.toFixed(3)} />
          <StatTile label="Response tokens per word" value={insights.summary.response_tokens_per_word.toFixed(2)} />
        </div>
      </Card>
    </div>
  );
}
