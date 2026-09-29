import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_PRICES, type ModelId, type ModelPrice, type TokenFactors } from "../engine/pricing";

export type Theme = "light" | "dark";

export interface Settings {
  theme: Theme;
  model: ModelId;
  prices: Record<ModelId, ModelPrice>;
  /** o200k_base -> Claude token multipliers; 1 means "use the open-source count as is". */
  factors: TokenFactors;
  requestsPerDay: number;
}

const KEY = "tep.settings";
const THEME_KEY = "tep.theme"; // also read by the pre-paint script in index.html

function initial(): Settings {
  const theme: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
  const base: Settings = { theme, model: "claude-sonnet-5", prices: DEFAULT_PRICES, factors: { input: 1, output: 1 }, requestsPerDay: 1000 };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Settings> | null;
    return saved ? { ...base, ...saved, theme } : base;
  } catch {
    return base;
  }
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(initial);

  // Layout effect: the theme class must flip before charts re-read their colours in useEffect.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, settings.theme);
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // storage full or disabled: settings still work for this session
    }
  }, [settings]);

  const value = useMemo(() => ({ settings, update: (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })) }), [settings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
