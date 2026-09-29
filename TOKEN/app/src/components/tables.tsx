import { useState, type ReactNode } from "react";
import { Card, ChartIcon, TableIcon, cx } from "./ui";

/** A chart card with a table-view twin (the WCAG-clean equivalent of every chart). */
export function ChartCard({ title, subtitle, table, children, className }: {
  title: string;
  subtitle?: ReactNode;
  table: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card
      title={title}
      subtitle={subtitle}
      className={className}
      actions={
        <button
          type="button"
          aria-pressed={asTable}
          onClick={() => setAsTable((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          {asTable ? <ChartIcon /> : <TableIcon />}
          {asTable ? "Chart view" : "Table view"}
        </button>
      }
    >
      {asTable ? <div className="max-h-80 overflow-auto">{table}</div> : children}
    </Card>
  );
}

export function DataTable({ columns, rows, align }: { columns: string[]; rows: ReactNode[][]; align?: ("left" | "right")[] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-surface text-ink-2">
        <tr>
          {columns.map((c, i) => (
            <th key={c} scope="col" className={cx("border-b border-line px-2 py-2 font-medium", align?.[i] === "right" && "text-right")}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody className="tabular text-ink">
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line last:border-0">
            {r.map((cell, j) => (
              <td key={j} className={cx("px-2 py-1.5", align?.[j] === "right" && "text-right")}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
