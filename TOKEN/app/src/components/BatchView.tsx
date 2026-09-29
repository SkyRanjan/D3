import Papa from "papaparse";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { Engine } from "../engine/engine";
import { costOf, MODEL_IDS } from "../engine/pricing";
import type { TextKind } from "../engine/types";
import { deleteBatch, loadHistory, saveBatch, type BatchRecord, type BatchRow } from "../lib/history";
import { formatCompact, formatPercent, formatTokens, formatUSD } from "../lib/format";
import { useChartColors } from "../lib/hooks";
import { useSettings } from "../lib/settings";
import type { BatchMessage } from "../workers/batch.worker";
import { CategoryBarChart, RunningCostChart } from "./charts";
import { ChartCard, DataTable } from "./tables";
import { Badge, Button, Card, DownloadIcon, Notice, PrintIcon, Segmented, Select, StatTile, TrashIcon, UploadIcon, cx } from "./ui";

const MAX_ROWS = 5000;
const PAGE = 25;
type Parsed = { name: string; rows: Record<string, string>[]; columns: string[]; truncated: boolean };
type SortKey = "index" | "tokens" | "classification" | "estimate" | "cost";

export function BatchView({ engine }: { engine: Engine }) {
  const { settings } = useSettings();
  const colors = useChartColors(settings.theme);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [column, setColumn] = useState("");
  const [kind, setKind] = useState<TextKind>("prompt");
  const [progress, setProgress] = useState<{ done: number; total: number; started: number } | null>(null);
  const [batch, setBatch] = useState<BatchRecord | null>(null);
  const [history, setHistory] = useState(loadHistory);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "index", desc: false });
  const [page, setPage] = useState(0);
  const worker = useRef<Worker | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => worker.current?.terminate(), []);

  const readFile = (file: File) => {
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta, errors }) => {
        const columns = (meta.fields ?? []).filter(Boolean);
        if (!columns.length) return setError(errors[0]?.message ?? "No columns found - is this a CSV with a header row?");
        setParsed({ name: file.name, rows: data.slice(0, MAX_ROWS), columns, truncated: data.length > MAX_ROWS });
        setColumn(columns.find((c) => /^(prompt|text|input|question|message|response)$/i.test(c.trim())) ?? columns[0]);
        if (columns.some((c) => /^response$/i.test(c.trim())) && !columns.some((c) => /^prompt$/i.test(c.trim()))) setKind("response");
      },
      error: (err) => setError(err.message),
    });
  };

  const run = () => {
    if (!parsed) return;
    worker.current?.terminate();
    const w = new Worker(new URL("../workers/batch.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    const texts = parsed.rows.map((r) => String(r[column] ?? ""));
    setProgress({ done: 0, total: texts.length, started: performance.now() });
    setError(null);
    w.onmessage = ({ data }: MessageEvent<BatchMessage>) => {
      if (data.type === "progress") setProgress((p) => (p ? { ...p, done: data.done } : p));
      else if (data.type === "error") {
        setError(data.message);
        setProgress(null);
      } else {
        const record: BatchRecord = {
          id: String(Date.now()),
          name: parsed.name,
          created: new Date().toISOString(),
          kind,
          rows: data.results.map((r, i) => ({ ...r, text: texts[i] })),
        };
        setBatch(record);
        setHistory(saveBatch(record));
        setProgress(null);
        setPage(0);
        w.terminate();
      }
    };
    w.onerror = (e) => {
      setError(e.message || "The batch worker failed to start.");
      setProgress(null);
    };
    w.postMessage({ rows: texts, kind });
  };

  const cancel = () => {
    worker.current?.terminate();
    setProgress(null);
  };

  const rowCost = (r: BatchRow, id: (typeof MODEL_IDS)[number]) =>
    batch?.kind === "response"
      ? costOf(0, r.tokens, settings.prices[id], settings.factors).total
      : costOf(r.tokens, r.estimate ?? 0, settings.prices[id], settings.factors).total;

  const summary = useMemo(() => {
    if (!batch) return null;
    const perModel = Object.fromEntries(MODEL_IDS.map((id) => [id, batch.rows.reduce((s, r) => s + rowCost(r, id), 0)]));
    const byClass = new Map<string, number>();
    batch.rows.forEach((r) => r.classification && byClass.set(r.classification, (byClass.get(r.classification) ?? 0) + rowCost(r, settings.model)));
    const step = Math.max(1, Math.ceil(batch.rows.length / 400));
    const running: { row: number; a: number; b: number }[] = [];
    let a = 0, b = 0;
    batch.rows.forEach((r, i) => {
      a += rowCost(r, MODEL_IDS[0]);
      b += rowCost(r, MODEL_IDS[1]);
      if (i % step === 0 || i === batch.rows.length - 1) running.push({ row: i + 1, a, b });
    });
    return {
      perModel,
      input: batch.rows.reduce((s, r) => s + (batch.kind === "prompt" ? r.tokens : 0), 0),
      output: batch.rows.reduce((s, r) => s + (batch.kind === "prompt" ? (r.estimate ?? 0) : r.tokens), 0),
      extrapolated: batch.rows.filter((r) => r.extrapolated).length,
      byClass: [...byClass].map(([label, value]) => ({ label, value })),
      running,
    };
  }, [batch, settings.prices, settings.factors, settings.model]);

  const sorted = useMemo(() => {
    if (!batch) return [];
    const rows = batch.rows.map((r, index) => ({ ...r, index, cost: rowCost(r, settings.model) }));
    const val = (r: (typeof rows)[number]) => (sort.key === "classification" ? (r.classification ?? "") : sort.key === "estimate" ? (r.estimate ?? -1) : r[sort.key]);
    rows.sort((x, y) => {
      const a = val(x), b = val(y);
      const c = typeof a === "string" ? a.localeCompare(String(b)) : a - Number(b);
      return sort.desc ? -c : c;
    });
    return rows;
  }, [batch, sort, settings.prices, settings.factors, settings.model]);

  const download = () => {
    if (!batch) return;
    const original = parsed && parsed.name === batch.name && parsed.rows.length === batch.rows.length ? parsed.rows : null;
    const rows = batch.rows.map((r, i) => ({
      ...(original ? original[i] : { text: r.text }),
      [`${batch.kind === "prompt" ? "input" : "output"}_tokens_${engine.data.tokenizer}`]: r.tokens,
      ...(batch.kind === "prompt" && {
        predicted_classification: r.classification ?? "",
        classification_confidence: r.confidence?.toFixed(4) ?? "",
        est_output_tokens: r.estimate?.toFixed(1) ?? "",
        est_output_low_80: r.low?.toFixed(1) ?? "",
        est_output_high_80: r.high?.toFixed(1) ?? "",
        beyond_dataset_range: r.extrapolated ? "yes" : "no",
      }),
      ...Object.fromEntries(MODEL_IDS.map((id) => [`cost_usd_${id}`, rowCost(r, id).toPrecision(6)])),
    }));
    const blob = new Blob([Papa.unparse(rows)], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: batch.name.replace(/\.csv$/i, "") + "_estimated.csv" });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const sampleCsv = () => {
    const csv = Papa.unparse(engine.insights.samples.map((s) => ({ prompt: s.prompt })));
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "sample_prompts.csv" });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const eta = progress && progress.done > 0 ? ((performance.now() - progress.started) / progress.done) * (progress.total - progress.done) : null;
  const pageRows = sorted.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.ceil(sorted.length / PAGE);
  const header = (key: SortKey, label: string, right = false) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"} className={cx("border-b border-line px-2 py-2 font-medium", right && "text-right")}>
      <button type="button" onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "classification" && key !== "index" }))} className="inline-flex items-center gap-1 hover:text-ink">
        {label}
        <span aria-hidden="true" className={cx(sort.key !== key && "opacity-0")}>{sort.desc ? "↓" : "↑"}</span>
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Batch upload" subtitle={`CSV with a header row, up to ${formatTokens(MAX_ROWS)} rows. Processed locally in a background worker.`}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cx("flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors", dragging ? "border-series-1 bg-accent-soft" : "border-line")}
          >
            <span className="text-ink-2"><UploadIcon /></span>
            <p className="text-sm text-ink">{parsed ? <><b>{parsed.name}</b> · {formatTokens(parsed.rows.length)} rows</> : "Drop a CSV here"}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => fileInput.current?.click()}>Choose file</Button>
              <Button size="sm" variant="ghost" onClick={sampleCsv}><DownloadIcon /> Sample CSV</Button>
            </div>
            <input ref={fileInput} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Choose a CSV file" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />
          </div>
          {parsed?.truncated && <div className="mt-3"><Notice tone="warning" title="Row limit">Only the first {formatTokens(MAX_ROWS)} rows are processed.</Notice></div>}
          {parsed && (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <Select label="Text column" value={column} onChange={(e) => setColumn(e.target.value)} className="w-52">
                {parsed.columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-2">Rows contain</span>
                <Segmented label="Rows contain" options={[{ value: "prompt" as const, label: "Prompts" }, { value: "response" as const, label: "Responses" }]} value={kind} onChange={setKind} size="sm" />
              </div>
              {progress ? <Button onClick={cancel}>Cancel</Button> : <Button variant="primary" onClick={run}>Estimate {formatTokens(parsed.rows.length)} rows</Button>}
            </div>
          )}
          {progress && (
            <div className="mt-4" aria-live="polite">
              <div className="mb-1 flex justify-between text-xs text-ink-2">
                <span className="tabular">{formatTokens(progress.done)} / {formatTokens(progress.total)} rows</span>
                <span className="tabular">{eta === null ? "Starting…" : `about ${Math.ceil(eta / 1000)}s left`}</span>
              </div>
              <div role="progressbar" aria-label="Batch progress" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} className="h-2 overflow-hidden rounded-full bg-accent-soft">
                <div className="h-full rounded-full bg-series-1 transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            </div>
          )}
          {error && <div className="mt-3"><Notice tone="critical" title="Error">{error}</Notice></div>}
        </Card>

        <Card title="Recent batches" subtitle="Last 5, saved in this browser only">
          {history.length ? (
            <ul className="divide-y divide-line">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-2">
                  <button type="button" onClick={() => { setBatch(h); setPage(0); }} className={cx("min-w-0 text-left", batch?.id === h.id && "font-semibold")}>
                    <span className="block truncate text-sm text-ink">{h.name}</span>
                    <span className="block text-xs text-ink-2">{new Date(h.created).toLocaleString()} · {formatTokens(h.rows.length)} rows</span>
                  </button>
                  <Button size="sm" variant="ghost" aria-label={`Delete ${h.name}`} onClick={() => { setHistory(deleteBatch(h.id)); if (batch?.id === h.id) setBatch(null); }}><TrashIcon /></Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">No batches yet. Results appear here after a run.</p>
          )}
        </Card>
      </div>

      {batch && summary && (
        <div className="fade-in space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">{batch.name} <span className="text-sm font-normal text-ink-2">· {formatTokens(batch.rows.length)} {batch.kind === "prompt" ? "prompts" : "responses"}</span></h2>
            <div className="no-print flex gap-2">
              <Button onClick={download}><DownloadIcon /> Enriched CSV</Button>
              <Button onClick={() => window.print()}><PrintIcon /> Print / PDF</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label={`Total cost · ${settings.prices[settings.model].name}`} value={formatUSD(summary.perModel[settings.model])} sub={`${formatUSD(summary.perModel[settings.model] / batch.rows.length)} per row`} />
            <StatTile label={`Total cost · ${settings.prices[MODEL_IDS.find((m) => m !== settings.model)!].name}`} value={formatUSD(summary.perModel[MODEL_IDS.find((m) => m !== settings.model)!])} sub="for comparison" />
            <StatTile label="Input tokens" value={formatCompact(summary.input)} sub={batch.kind === "prompt" ? "counted" : "responses have none"} />
            <StatTile label={batch.kind === "prompt" ? "Est. output tokens" : "Output tokens"} value={formatCompact(summary.output)} sub={summary.extrapolated ? `${summary.extrapolated} rows beyond dataset range` : "within dataset range"} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            {summary.byClass.length > 0 && (
              <ChartCard
                title="Cost by category"
                subtitle={settings.prices[settings.model].name}
                table={<DataTable columns={["Category", "Cost"]} align={["left", "right"]} rows={[...summary.byClass].sort((a, b) => b.value - a.value).map((d) => [d.label, formatUSD(d.value)])} />}
              >
                <CategoryBarChart data={summary.byClass} colors={colors} format={formatUSD} valueName="cost" />
              </ChartCard>
            )}
            <ChartCard
              title="Running total cost"
              subtitle="Both models, in row order"
              table={<DataTable columns={["Rows", settings.prices[MODEL_IDS[0]].name, settings.prices[MODEL_IDS[1]].name]} align={["left", "right", "right"]} rows={summary.running.map((p) => [formatTokens(p.row), formatUSD(p.a), formatUSD(p.b)])} />}
            >
              <RunningCostChart data={summary.running} colors={colors} names={[settings.prices[MODEL_IDS[0]].name, settings.prices[MODEL_IDS[1]].name]} format={formatUSD} />
            </ChartCard>
          </div>
          <Card title="Results" subtitle={`Costs for ${settings.prices[settings.model].name}; click a column to sort`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-ink-2">
                  <tr>
                    {header("index", "#")}
                    <th scope="col" className="border-b border-line px-2 py-2 font-medium">Text</th>
                    {header("tokens", batch.kind === "prompt" ? "Input" : "Output", true)}
                    {batch.kind === "prompt" && header("classification", "Category")}
                    {batch.kind === "prompt" && header("estimate", "Est. output (80% range)", true)}
                    {header("cost", "Cost", true)}
                  </tr>
                </thead>
                <tbody className="tabular text-ink">
                  {pageRows.map((r) => (
                    <tr key={r.index} className="border-b border-line last:border-0">
                      <td className="px-2 py-2 text-ink-2">{r.index + 1}</td>
                      <td className="max-w-md truncate px-2 py-2" title={r.text}>{r.text}</td>
                      <td className="px-2 py-2 text-right">{formatTokens(r.tokens)}</td>
                      {batch.kind === "prompt" && (
                        <td className="px-2 py-2">{r.classification && <Badge>{r.classification}</Badge>} <span className="text-ink-2">{r.confidence !== null && formatPercent(r.confidence)}</span></td>
                      )}
                      {batch.kind === "prompt" && (
                        <td className="px-2 py-2 text-right">{r.estimate !== null ? <>{formatTokens(r.estimate)} <span className="text-ink-2">({formatTokens(r.low ?? 0)}–{formatTokens(r.high ?? 0)})</span></> : "–"}</td>
                      )}
                      <td className="px-2 py-2 text-right font-medium">{formatUSD(r.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <nav aria-label="Results pages" className="no-print mt-3 flex items-center justify-end gap-2 text-xs text-ink-2">
                <Button size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
                <span className="tabular">Page {page + 1} of {pages}</span>
                <Button size="sm" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Next</Button>
              </nav>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
