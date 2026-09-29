import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartColors } from "../lib/hooks";
import { formatTokens, formatUSDAxis } from "../lib/format";

interface TipRow {
  name?: string | number;
  value?: unknown;
  color?: string;
}

/** Values lead, labels follow; series keyed with a short line, not a box. */
function Tip({ active, payload, title, rows }: { active?: boolean; payload?: readonly TipRow[]; title?: ReactNode; rows?: TipRow[] }) {
  const list = rows ?? payload ?? [];
  if (!active || !list.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      {title && <div className="mb-1 text-ink-2">{title}</div>}
      {list.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          {r.color && <span className="h-0.5 w-3 rounded" style={{ background: r.color }} aria-hidden="true" />}
          <span className="font-semibold text-ink">{String(r.value)}</span>
          <span className="text-ink-2">{r.name}</span>
        </div>
      ))}
    </div>
  );
}

const axisProps = (c: ChartColors) => ({
  stroke: c.axis,
  tick: { fill: c.ink2, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: c.axis },
});

type Point = { actual: number; predicted: number; classification: string; correct: boolean };

export function ActualVsPredictedChart({ points, colors }: { points: Point[]; colors: ChartColors }) {
  const max = Math.ceil(Math.max(10, ...points.map((p) => Math.max(p.actual, p.predicted))) / 50) * 50;
  const series = [
    { name: "Classified correctly", data: points.filter((p) => p.correct), color: colors.series1 },
    { name: "Misclassified", data: points.filter((p) => !p.correct), color: colors.series2 },
  ];
  const dot = (color: string) => (props: unknown) => {
    const { cx = 0, cy = 0 } = props as { cx?: number; cy?: number };
    return (
      <g>
        <circle cx={cx} cy={cy} r={12} fill="transparent" />
        <circle cx={cx} cy={cy} r={4} fill={color} stroke={colors.surface} strokeWidth={2} />
      </g>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
        <CartesianGrid stroke={colors.grid} />
        <XAxis type="number" dataKey="actual" domain={[0, max]} {...axisProps(colors)} label={{ value: "Actual output tokens", position: "insideBottom", offset: -16, fill: colors.ink2, fontSize: 11 }} />
        <YAxis type="number" dataKey="predicted" domain={[0, max]} {...axisProps(colors)} width={48} label={{ value: "Estimated", angle: -90, position: "insideLeft", fill: colors.ink2, fontSize: 11 }} />
        <ReferenceLine segment={[{ x: 0, y: 0 }, { x: max, y: max }]} stroke={colors.muted} strokeWidth={1} ifOverflow="hidden" />
        <Tooltip
          cursor={false}
          content={(p) => {
            const pt = (p.payload?.[0]?.payload ?? null) as Point | null;
            return pt ? (
              <Tip active={p.active} title={pt.classification} rows={[
                { value: formatTokens(pt.actual), name: "actual", color: pt.correct ? colors.series1 : colors.series2 },
                { value: formatTokens(pt.predicted), name: "estimated" },
              ]} />
            ) : null;
          }}
        />
        <Legend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize: 12, color: colors.ink2 }} />
        {series.map((s) => (
          <Scatter key={s.name} name={s.name} data={s.data} fill={s.color} shape={dot(s.color)} isAnimationActive={false} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function HistogramChart({ bins, colors, unit }: { bins: { label: string; count: number }[]; colors: ChartColors; unit: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={bins} margin={{ top: 8, right: 8, bottom: 28, left: 8 }} barCategoryGap={2}>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps(colors)} interval="preserveStartEnd" minTickGap={24} label={{ value: unit, position: "insideBottom", offset: -16, fill: colors.ink2, fontSize: 11 }} />
        <YAxis {...axisProps(colors)} width={48} allowDecimals={false} tickFormatter={formatTokens} />
        <Tooltip
          cursor={{ fill: colors.grid, opacity: 0.5 }}
          content={(p) => <Tip active={p.active} title={`${p.label} ${unit}`} rows={[{ value: formatTokens(Number(p.payload?.[0]?.value ?? 0)), name: "prompts" }]} />}
        />
        <Bar dataKey="count" fill={colors.series1} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Sorted horizontal bars in one hue; `highlight` emphasises one category and mutes the rest. */
export function CategoryBarChart({ data, colors, format, highlight, valueName }: {
  data: { label: string; value: number }[];
  colors: ChartColors;
  format: (v: number) => string;
  highlight?: string | null;
  valueName: string;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, sorted.length * 28 + 24)}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 72, bottom: 4, left: 8 }} barCategoryGap={4}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="label" width={150} {...axisProps(colors)} axisLine={false} tick={{ fill: colors.ink, fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: colors.grid, opacity: 0.5 }}
          content={(p) => <Tip active={p.active} title={String(p.label)} rows={[{ value: format(Number(p.payload?.[0]?.value ?? 0)), name: valueName }]} />}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
          {sorted.map((d) => (
            <Cell key={d.label} fill={highlight && d.label !== highlight ? colors.axis : colors.series1} />
          ))}
          <LabelList dataKey="value" position="right" formatter={(v: unknown) => format(Number(v))} style={{ fill: colors.ink2, fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RunningCostChart({ data, colors, names, format }: {
  data: { row: number; a: number; b: number }[];
  colors: ChartColors;
  names: [string, string];
  format: (v: number) => string;
}) {
  const last = data.length - 1;
  const endLabel = (value: number) => (props: unknown) => {
    const { x = 0, y = 0, index } = props as { x?: number; y?: number; index?: number };
    return index === last ? (
      <text x={x + 6} y={y + 4} fill={colors.ink2} fontSize={11}>{format(value)}</text>
    ) : null;
  };
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 72, bottom: 28, left: 8 }}>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis dataKey="row" type="number" domain={[1, "dataMax"]} {...axisProps(colors)} allowDecimals={false} label={{ value: "Rows processed", position: "insideBottom", offset: -16, fill: colors.ink2, fontSize: 11 }} />
        <YAxis {...axisProps(colors)} width={56} tickFormatter={formatUSDAxis} />
        <Tooltip
          cursor={{ stroke: colors.axis, strokeWidth: 1 }}
          content={(p) => (
            <Tip active={p.active} title={`After row ${String(p.label)}`} rows={(p.payload ?? []).map((r) => ({ value: format(Number(r.value)), name: String(r.name), color: String(r.color ?? r.stroke ?? "") }))} />
          )}
        />
        <Legend verticalAlign="top" height={28} iconType="plainline" itemSorter="dataKey" wrapperStyle={{ fontSize: 12, color: colors.ink2 }} />
        <Line type="monotone" dataKey="a" name={names[0]} stroke={colors.series1} strokeWidth={2} dot={false} isAnimationActive={false} label={data.length ? endLabel(data[last].a) : undefined} />
        <Line type="monotone" dataKey="b" name={names[1]} stroke={colors.series2} strokeWidth={2} dot={false} isAnimationActive={false} label={data.length ? endLabel(data[last].b) : undefined} />
      </LineChart>
    </ResponsiveContainer>
  );
}
