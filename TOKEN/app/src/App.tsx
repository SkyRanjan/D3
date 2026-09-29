import { lazy, Suspense, useEffect, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { EstimateView } from "./components/EstimateView";
import { SettingsDialog } from "./components/SettingsDialog";
import { Button, GearIcon, LockIcon, MoonIcon, Notice, Segmented, SunIcon, cx } from "./components/ui";
import { loadEngine, type Engine } from "./engine/engine";
import { MODEL_IDS } from "./engine/pricing";
import { formatPercent, formatTokens } from "./lib/format";
import { useSettings } from "./lib/settings";

// Chart-heavy views load on first visit, keeping the Estimate view's first paint small.
const BatchView = lazy(() => import("./components/BatchView").then((m) => ({ default: m.BatchView })));
const InsightsView = lazy(() => import("./components/InsightsView").then((m) => ({ default: m.InsightsView })));
const EngineView = lazy(() => import("./components/EngineView").then((m) => ({ default: m.EngineView })));

const TABS = [
  { id: "estimate", label: "Estimate" },
  { id: "batch", label: "Batch" },
  { id: "insights", label: "Insights" },
  { id: "engine", label: "Engine" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const tabFromHash = (): TabId => (TABS.find((t) => `#${t.id}` === location.hash)?.id ?? "estimate");

export default function App() {
  const { settings, update } = useSettings();
  const [engine, setEngine] = useState<Engine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>(tabFromHash);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    loadEngine().then(setEngine, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const go = (id: TabId) => {
    history.replaceState(null, "", `#${id}`);
    setTab(id);
  };

  return (
    <div className="min-h-screen bg-page">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-ink">Token Estimator Pro</div>
              <div className="text-[11px] text-ink-2">Claude token &amp; cost estimates</div>
            </div>
          </div>
          <nav aria-label="Views" className="no-print order-3 -mx-1 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-current={tab === t.id ? "page" : undefined}
                onClick={() => go(t.id)}
                className={cx("shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", tab === t.id ? "bg-accent-soft text-accent-text" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="no-print ml-auto flex items-center gap-2">
            <Segmented
              label="Model"
              options={MODEL_IDS.map((id) => ({ value: id, label: settings.prices[id].name.replace("Claude ", "") }))}
              value={settings.model}
              onChange={(model) => update({ model })}
              size="sm"
            />
            <Button variant="ghost" size="sm" aria-label={`Switch to ${settings.theme === "dark" ? "light" : "dark"} mode`} onClick={() => update({ theme: settings.theme === "dark" ? "light" : "dark" })}>
              {settings.theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </Button>
            <Button variant="ghost" size="sm" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><GearIcon /></Button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        {tab === "estimate" && (
          <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Calculate token costs before you send</h1>
              <p className="mt-1 max-w-2xl text-sm text-ink-2">
                Paste a prompt: a local classifier picks its category, that category's formula estimates the reply, and both sides are priced for Claude.
              </p>
            </div>
            <ul className="flex flex-wrap gap-2 text-xs text-ink-2">
              {["Runs in your browser", "Free & open source", "No API key", "Works offline"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1"><LockIcon /> {t}</li>
              ))}
            </ul>
          </section>
        )}

        {error ? (
          <div className="mx-auto max-w-xl py-12"><Notice tone="critical" title="The engine did not load">{error}</Notice></div>
        ) : !engine ? (
          <div className="py-24 text-center text-sm text-ink-2" role="status">Loading the local engine…</div>
        ) : (
          <ErrorBoundary resetKey={tab}>
            <Suspense fallback={<div className="py-24 text-center text-sm text-ink-2" role="status">Loading…</div>}>
              {tab === "estimate" && <EstimateView engine={engine} />}
              {tab === "batch" && <BatchView engine={engine} />}
              {tab === "insights" && <InsightsView engine={engine} />}
              {tab === "engine" && <EngineView engine={engine} />}
            </Suspense>
          </ErrorBoundary>
        )}
      </main>

      <footer className="mx-auto max-w-[1500px] px-4 pb-8 text-xs text-ink-2 sm:px-6">
        {engine && (
          <p>
            Engine built {engine.data.built} from {formatTokens(engine.data.dataset.records)} records · {engine.data.tokenizer} tokenizer · classifier{" "}
            {formatPercent(engine.data.classifier.heldout_accuracy, 1)} accurate · estimates, not exact counts.
          </p>
        )}
      </footer>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} engine={engine} />
    </div>
  );
}
