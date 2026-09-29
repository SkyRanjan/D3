import { useEffect, useRef } from "react";
import type { Engine } from "../engine/engine";
import { DEFAULT_PRICES, MODEL_IDS } from "../engine/pricing";
import { useSettings } from "../lib/settings";
import { Button, CloseIcon, NumberField, Segmented } from "./ui";

export function SettingsDialog({ open, onClose, engine }: { open: boolean; onClose: () => void; engine: Engine | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { settings, update } = useSettings();
  const calibration = engine?.calibration;

  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);

  const setPrice = (id: (typeof MODEL_IDS)[number], key: "input" | "output", v: number) =>
    update({ prices: { ...settings.prices, [id]: { ...settings.prices[id], [key]: v } } });

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="settings-title"
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="settings-title" className="text-base font-semibold">Settings</h2>
        <Button variant="ghost" size="sm" aria-label="Close settings" onClick={onClose}><CloseIcon /></Button>
      </div>
      <div className="max-h-[70vh] space-y-6 overflow-y-auto px-5 py-5">
        <section>
          <h3 className="text-sm font-semibold">Prices (USD per million tokens)</h3>
          <p className="mt-0.5 text-xs text-ink-2">Anthropic list prices as published mid-2026. Update them if they change.</p>
          <div className="mt-3 space-y-3">
            {MODEL_IDS.map((id) => (
              <div key={id} className="grid grid-cols-[1fr_6rem_6rem] items-end gap-3">
                <span className="pb-2 text-sm font-medium">{settings.prices[id].name}</span>
                <NumberField label="Input" value={settings.prices[id].input} step={0.5} onChange={(v) => setPrice(id, "input", v)} />
                <NumberField label="Output" value={settings.prices[id].output} step={0.5} onChange={(v) => setPrice(id, "output", v)} />
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => update({ prices: DEFAULT_PRICES })}>Reset prices</Button>
        </section>

        <section>
          <h3 className="text-sm font-semibold">Claude token factor</h3>
          <p className="mt-0.5 text-xs text-ink-2">
            Multiplies the open-source {engine?.data.tokenizer ?? "o200k_base"} counts before pricing. 1.00 uses them as is. Measure the real ratio for free with
            pipeline/calibrate_claude.py rather than guessing.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <NumberField label="Input tokens ×" value={settings.factors.input} step={0.01} min={0.5} onChange={(v) => update({ factors: { ...settings.factors, input: v } })} />
            <NumberField label="Output tokens ×" value={settings.factors.output} step={0.01} min={0.5} onChange={(v) => update({ factors: { ...settings.factors, output: v } })} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => update({ factors: { input: 1, output: 1 } })}>Reset to 1.00</Button>
            {calibration && (
              <Button size="sm" onClick={() => update({ factors: { input: calibration.input_factor, output: calibration.output_factor } })}>
                Use calibration ({calibration.model}, ×{calibration.input_factor.toFixed(2)} / ×{calibration.output_factor.toFixed(2)})
              </Button>
            )}
          </div>
        </section>

        <section className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Theme</h3>
          <Segmented label="Theme" options={[{ value: "light" as const, label: "Light" }, { value: "dark" as const, label: "Dark" }]} value={settings.theme} onChange={(theme) => update({ theme })} size="sm" />
        </section>

        <section>
          <h3 className="text-sm font-semibold">Local data</h3>
          <p className="mt-0.5 text-xs text-ink-2">Settings and the last 5 batches live only in this browser.</p>
          <Button
            size="sm"
            className="mt-2"
            onClick={() => {
              ["tep.settings", "tep.history", "tep.theme"].forEach((k) => localStorage.removeItem(k));
              location.reload();
            }}
          >
            Clear saved data
          </Button>
        </section>
      </div>
    </dialog>
  );
}
