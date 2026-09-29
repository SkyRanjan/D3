import { useEffect, useState } from "react";
import type { Theme } from "./settings";

export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export interface ChartColors {
  series1: string;
  series2: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  axis: string;
  surface: string;
}

/** Recharts takes colours as SVG attributes, so resolve the theme's CSS variables to hex. */
export function useChartColors(theme: Theme): ChartColors {
  const read = () => {
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();
    return {
      series1: v("--series-1"),
      series2: v("--series-2"),
      ink: v("--ink"),
      ink2: v("--ink-2"),
      muted: v("--muted"),
      grid: v("--grid"),
      axis: v("--axis"),
      surface: v("--surface"),
    };
  };
  const [colors, setColors] = useState(read);
  useEffect(() => setColors(read()), [theme]);
  return colors;
}
