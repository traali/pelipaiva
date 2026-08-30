import React, { useCallback, useEffect, useState } from 'react';
import { Cpu, Download, Loader2, ShieldOff } from 'lucide-react';
import {
  describeOnDeviceRuntime,
  OnDeviceRuntime,
  requestLoadOnDeviceModel,
  turnOffOnDeviceLlm
} from '../lib/ai/onDeviceLlm';
import { OnDeviceLlmChoice, setOnDeviceLlmChoice } from '../lib/ai/onDeviceLlmPrefs';

export const OnDeviceLlmSettings: React.FC = () => {
  const [runtime, setRuntime] = useState<OnDeviceRuntime | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await describeOnDeviceRuntime();
    setRuntime(next);
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const handleSelect = async (id: OnDeviceLlmChoice) => {
    setError(null);
    if (id === 'off') {
      turnOffOnDeviceLlm();
      await refresh();
      return;
    }
    const option = runtime?.options.find((o) => o.id === id);
    if (!option?.available) return;

    if (option.needsUserLoad && runtime?.loaded !== id) {
      setOnDeviceLlmChoice(id);
      await refresh();
      return;
    }

    setBusy(true);
    try {
      const res = await requestLoadOnDeviceModel(id);
      if (!res.ok) setError(res.error || 'Käyttöönotto epäonnistui');
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const handleLoad = async () => {
    if (!runtime || runtime.choice === 'off') return;
    setBusy(true);
    setError(null);
    try {
      const res = await requestLoadOnDeviceModel(runtime.choice);
      if (!res.ok) setError(res.error || 'Lataus epäonnistui');
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  if (!runtime) {
    return (
      <div className="p-3.5 rounded-2xl bg-surface border border-border-subtle text-xs text-text-muted">
        Ladataan tekoälyasetusta…
      </div>
    );
  }

  const selected = runtime.options.find((o) => o.id === runtime.choice);
  const showLoad =
    runtime.choice !== 'off' &&
    selected?.available &&
    selected.needsUserLoad &&
    runtime.loaded !== runtime.choice &&
    !runtime.neuralReady;

  return (
    <section
      className="p-3.5 rounded-2xl bg-surface border border-pitch/30 flex flex-col gap-3 shadow-xs"
      aria-labelledby="ondevice-llm-title"
    >
      <div className="flex items-start gap-2.5">
        <div className="p-2 rounded-xl bg-pitch/15 text-pitch shrink-0">
          <Cpu className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 id="ondevice-llm-title" className="text-xs font-black text-text-primary">
            Laitteen tekoäly
          </h3>
          <p className="text-[11px] text-text-muted leading-snug">
            Oletus pois. Malli ladataan vain jos haluat. Kevyt käyttö: yksi viesti kerrallaan,
            ei pilveen, ei keksittyjä kelloja.
          </p>
        </div>
      </div>

      <div role="radiogroup" aria-label="Laitteen tekoäly" className="flex flex-col gap-1.5">
        {runtime.options.map((opt) => {
          const checked = runtime.choice === opt.id;
          const disabled = opt.id !== 'off' && !opt.available;
          return (
            <label
              key={opt.id}
              className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left ${
                checked
                  ? 'border-pitch bg-pitch/10'
                  : 'border-border-subtle bg-surface-elevated/60'
              } ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
            >
              <input
                type="radio"
                name="pelipaiva-ondevice-llm"
                value={opt.id}
                checked={checked}
                disabled={disabled || busy}
                onChange={() => handleSelect(opt.id)}
                className="mt-0.5 accent-emerald-700"
              />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-text-primary">{opt.label}</span>
                <span className="block text-[11px] text-text-muted leading-snug">{opt.detail}</span>
              </span>
            </label>
          );
        })}
      </div>

      {showLoad && (
        <button
          type="button"
          onClick={handleLoad}
          disabled={busy}
          className="w-full py-2 px-3 rounded-xl bg-pitch text-text-inverse text-xs font-bold hover:brightness-110 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {runtime.choice === 'qwen06' ? 'Lataa Qwen 0.6B tälle puhelimelle' : 'Lataa Chrome-malli tälle koneelle'}
        </button>
      )}

      {runtime.choice !== 'off' && runtime.neuralReady && (
        <button
          type="button"
          onClick={() => handleSelect('off')}
          className="w-full py-2 px-3 rounded-xl bg-surface-elevated border border-border-strong text-text-secondary text-xs font-bold hover:text-radar hover:border-radar cursor-pointer flex items-center justify-center gap-1.5"
        >
          <ShieldOff className="w-3.5 h-3.5" />
          Poista tekoäly käytöstä
        </button>
      )}

      <p className="text-[11px] text-text-secondary leading-snug" data-testid="ondevice-llm-summary">
        {runtime.summaryFi}
      </p>
      {error && (
        <p className="text-[11px] text-radar font-semibold" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
