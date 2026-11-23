import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Moon,
  Radio,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  Trash2,
} from 'lucide-react';
import {
  buildDaemonEnvFile,
  type AppPreferences,
  type Locale,
  type SecretCredentials,
  type SecretStorageMode,
  type ThemeMode,
} from '../core/settings';
import { HttpDaemonTransport } from '../core/transport';
import type { EnginePolicy, SimSpeed } from '../core/types';
import type { Dictionary } from '../i18n/translations';

interface SettingsViewProps {
  preferences: AppPreferences;
  secrets: SecretCredentials;
  policy: EnginePolicy;
  simSpeed: SimSpeed;
  transportMode: 'SIMULATION' | 'DAEMON';
  t: Dictionary;
  onUpdatePreferences: (patch: Partial<AppPreferences>) => void;
  onUpdateSecrets: (patch: Partial<SecretCredentials>) => void;
  onClearAllSecrets: () => void;
  onUpdatePolicy: (patch: Partial<EnginePolicy>) => void;
  onSetSimSpeed: (speed: SimSpeed) => void;
  onConnectDaemon: (url: string, bearerToken: string) => Promise<{ ok: boolean; message: string }>;
  onSwitchToSimulation: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  preferences,
  secrets,
  policy,
  simSpeed,
  transportMode,
  t,
  onUpdatePreferences,
  onUpdateSecrets,
  onClearAllSecrets,
  onUpdatePolicy,
  onSetSimSpeed,
  onConnectDaemon,
  onSwitchToSimulation,
}) => {
  const [showGemini, setShowGemini] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);
  const [showBearer, setShowBearer] = useState(false);
  const [secretNotice, setSecretNotice] = useState<string | null>(null);

  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleExportEnv = () => {
    const content = buildDaemonEnvFile({
      secrets,
      daemonBaseUrl: preferences.daemonBaseUrl,
      policy,
    });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '.env';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSecretNotice(t.settings.envExported);
  };

  const handleClearSecrets = () => {
    onClearAllSecrets();
    setSecretNotice(t.settings.secretsCleared);
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    setConnResult(null);
    const probe = new HttpDaemonTransport(
      preferences.daemonBaseUrl || 'http://localhost:8000',
      secrets.daemonBearerToken
    );
    const res = await probe.ping();
    setConnResult({ ok: res.ok, message: `${res.message} (${res.latencyMs}ms)` });
    setTestingConn(false);
  };

  const handleConnectRemote = async () => {
    setTestingConn(true);
    const res = await onConnectDaemon(
      preferences.daemonBaseUrl || 'http://localhost:8000',
      secrets.daemonBearerToken
    );
    setConnResult(res);
    setTestingConn(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1120px] w-full mx-auto space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Appearance & Localization */}
        <section className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 space-y-4">
          <div className="border-b border-slate-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
              <Globe className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h2>{t.settings.appearanceTitle}</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {t.settings.appearanceDesc}
            </p>
          </div>

          <div className="space-y-4">
            {/* Theme Mode */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                {t.settings.themeLabel}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(['dark', 'light'] as ThemeMode[]).map((mode) => {
                  const active = preferences.theme === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdatePreferences({ theme: mode })}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold border transition-colors cursor-pointer ${
                        active
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-200'
                          : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      {mode === 'dark' ? (
                        <Moon className="w-3.5 h-3.5" />
                      ) : (
                        <Sun className="w-3.5 h-3.5" />
                      )}
                      {mode === 'dark' ? t.common.dark : t.common.light}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interface Language */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                {t.settings.languageLabel}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'ru', label: 'Русский (RU)' },
                    { id: 'en', label: 'English (EN)' },
                  ] as { id: Locale; label: string }[]
                ).map((lang) => {
                  const active = preferences.locale === lang.id;
                  return (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => onUpdatePreferences({ locale: lang.id })}
                      className={`px-3 py-2.5 text-xs font-semibold border transition-colors cursor-pointer ${
                        active
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-200'
                          : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      {lang.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Card 2: Transport & Daemon Connection */}
        <section className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 space-y-4">
          <div className="border-b border-slate-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
              <Radio className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h2>{t.settings.transportTitle}</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {t.settings.transportDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onSwitchToSimulation}
              className={`px-3 py-2.5 text-xs font-semibold border text-left transition-colors cursor-pointer ${
                transportMode === 'SIMULATION'
                  ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/15 text-cyan-900 dark:text-cyan-200'
                  : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400'
              }`}
            >
              <div>{t.settings.modeLocalSim}</div>
              <div className="text-[10px] font-mono opacity-75 mt-0.5">
                LocalSimulationTransport
              </div>
            </button>

            <button
              type="button"
              onClick={handleConnectRemote}
              className={`px-3 py-2.5 text-xs font-semibold border text-left transition-colors cursor-pointer ${
                transportMode === 'DAEMON'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-200'
                  : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400'
              }`}
            >
              <div>{t.settings.modeRemoteDaemon}</div>
              <div className="text-[10px] font-mono opacity-75 mt-0.5">
                HttpDaemonTransport (REST/WS)
              </div>
            </button>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="settings-daemon-url"
              className="block text-xs font-medium text-slate-700 dark:text-zinc-300"
            >
              {t.settings.daemonUrlLabel}
            </label>
            <div className="flex gap-2">
              <input
                id="settings-daemon-url"
                type="url"
                value={preferences.daemonBaseUrl}
                onChange={(e) => onUpdatePreferences({ daemonBaseUrl: e.target.value })}
                placeholder="http://localhost:8000"
                className="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                disabled={testingConn}
                onClick={handleTestConnection}
                className="px-3 py-2 text-xs font-semibold border border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                {testingConn ? t.settings.testing : t.settings.testConnection}
              </button>
            </div>
          </div>

          {connResult && (
            <div
              className={`p-2.5 text-xs font-mono border flex items-start gap-2 ${
                connResult.ok
                  ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                  : 'border-rose-300 dark:border-rose-500/45 bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-200'
              }`}
            >
              {connResult.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="break-words">{connResult.message}</span>
            </div>
          )}
        </section>

        {/* Card 3: API Keys & Providers (.env safe generator) */}
        <section className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 space-y-4">
          <div className="border-b border-slate-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
              <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h2>{t.settings.secretsTitle}</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {t.settings.secretsDesc}
            </p>
          </div>

          <div className="space-y-3">
            {/* Gemini API Key */}
            <div className="space-y-1">
              <label
                htmlFor="secret-gemini"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300"
              >
                {t.settings.geminiKeyLabel}
              </label>
              <div className="flex">
                <input
                  id="secret-gemini"
                  type={showGemini ? 'text' : 'password'}
                  autoComplete="off"
                  value={secrets.geminiApiKey}
                  onChange={(e) => onUpdateSecrets({ geminiApiKey: e.target.value })}
                  placeholder="AIza..."
                  className="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowGemini((v) => !v)}
                  className="px-2.5 border border-l-0 border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 cursor-pointer"
                  aria-label="Toggle Gemini API Key visibility"
                >
                  {showGemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Anthropic / OpenAI Optional Key */}
            <div className="space-y-1">
              <label
                htmlFor="secret-secondary"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300"
              >
                {t.settings.secondaryKeyLabel}
              </label>
              <div className="flex">
                <input
                  id="secret-secondary"
                  type={showSecondary ? 'text' : 'password'}
                  autoComplete="off"
                  value={secrets.secondaryProviderKey}
                  onChange={(e) => onUpdateSecrets({ secondaryProviderKey: e.target.value })}
                  placeholder="sk-..."
                  className="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecondary((v) => !v)}
                  className="px-2.5 border border-l-0 border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 cursor-pointer"
                  aria-label="Toggle secondary provider key visibility"
                >
                  {showSecondary ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Daemon Bearer Token */}
            <div className="space-y-1">
              <label
                htmlFor="secret-bearer"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300"
              >
                {t.settings.daemonTokenLabel}
              </label>
              <div className="flex">
                <input
                  id="secret-bearer"
                  type={showBearer ? 'text' : 'password'}
                  autoComplete="off"
                  value={secrets.daemonBearerToken}
                  onChange={(e) => onUpdateSecrets({ daemonBearerToken: e.target.value })}
                  placeholder="mc_live_..."
                  className="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowBearer((v) => !v)}
                  className="px-2.5 border border-l-0 border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 cursor-pointer"
                  aria-label="Toggle daemon bearer token visibility"
                >
                  {showBearer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Storage Mode */}
            <div className="space-y-1.5 pt-1">
              <span className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                {t.settings.storageModeLabel}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  [
                    { id: 'memory', label: t.settings.storageMemory },
                    { id: 'session', label: t.settings.storageSession },
                  ] as { id: SecretStorageMode; label: string }[]
                ).map((opt) => {
                  const active = preferences.secretStorageMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdatePreferences({ secretStorageMode: opt.id })}
                      className={`px-3 py-2 text-[11px] font-medium border text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-200'
                          : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Security Warning */}
            <div className="p-2.5 border border-amber-300 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-500/10 text-[11px] text-amber-900 dark:text-amber-200">
              {t.settings.storageWarning}
            </div>

            {secretNotice && (
              <div className="p-2.5 border border-emerald-300 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-500/10 text-[11px] font-mono text-emerald-800 dark:text-emerald-300">
                {secretNotice}
              </div>
            )}

            {/* Export .env + Clear All Secrets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportEnv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-cyan-600 dark:bg-cyan-500 text-white dark:text-zinc-950 hover:bg-cyan-700 dark:hover:bg-cyan-400 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {t.settings.exportEnv}
              </button>

              <button
                type="button"
                onClick={handleClearSecrets}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-rose-300 dark:border-rose-500/45 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t.settings.clearSecrets}
              </button>
            </div>
          </div>
        </section>

        {/* Card 4: Full Engine Policy Defaults */}
        <section className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 space-y-4">
          <div className="border-b border-slate-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
              <SlidersHorizontal className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h2>{t.settings.policyTitle}</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {t.settings.policyDesc}
            </p>
          </div>

          <div className="space-y-4 text-xs">
            {/* HITL Mode */}
            <div className="flex items-center justify-between gap-3 py-1">
              <div>
                <div className="font-medium text-slate-800 dark:text-zinc-200">
                  HITL Mode (Human-in-the-Loop)
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Disables auto-merge; routes all APPROVE verdicts to operator.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={policy.hitl_mode}
                onClick={() => onUpdatePolicy({ hitl_mode: !policy.hitl_mode })}
                className={`px-3 py-1.5 font-mono font-semibold border transition-colors cursor-pointer ${
                  policy.hitl_mode
                    ? 'border-rose-400 dark:border-rose-500/50 bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                    : 'border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400'
                }`}
              >
                {policy.hitl_mode ? t.common.on : t.common.off}
              </button>
            </div>

            {/* Auto-Merge Threshold */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="settings-threshold"
                  className="font-medium text-slate-800 dark:text-zinc-200"
                >
                  Auto-Merge Threshold (0.50 – 0.99)
                </label>
                <span className="font-mono font-bold tabular-nums text-cyan-700 dark:text-cyan-300">
                  {policy.auto_merge_threshold.toFixed(2)}
                </span>
              </div>
              <input
                id="settings-threshold"
                type="range"
                min={0.5}
                max={0.99}
                step={0.01}
                value={policy.auto_merge_threshold}
                onChange={(e) =>
                  onUpdatePolicy({ auto_merge_threshold: Number(e.target.value) })
                }
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Max Rework */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-800 dark:text-zinc-200">
                  Max Rework Cycles
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Exceeding escalates automatically to HUMAN_REQUIRED.
                </div>
              </div>
              <div className="inline-flex items-center border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 font-mono">
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePolicy({ max_rework: Math.max(1, policy.max_rework - 1) })
                  }
                  className="px-3 py-1.5 hover:bg-slate-200 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  -
                </button>
                <span className="px-3.5 py-1.5 font-bold tabular-nums text-amber-700 dark:text-amber-300 border-x border-slate-300 dark:border-zinc-800">
                  {policy.max_rework}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePolicy({ max_rework: Math.min(10, policy.max_rework + 1) })
                  }
                  className="px-3 py-1.5 hover:bg-slate-200 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Stall Timeout */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="settings-stall-timeout"
                  className="font-medium text-slate-800 dark:text-zinc-200"
                >
                  Watchdog Stall Timeout (sec)
                </label>
                <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-zinc-100">
                  {policy.stall_timeout_sec}s
                </span>
              </div>
              <input
                id="settings-stall-timeout"
                type="range"
                min={30}
                max={300}
                step={15}
                value={policy.stall_timeout_sec}
                onChange={(e) =>
                  onUpdatePolicy({ stall_timeout_sec: Number(e.target.value) })
                }
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Sim Clock Accelerator */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div>
                <div className="font-medium text-slate-800 dark:text-zinc-200">
                  Simulation Clock Speed
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Accelerates Watchdog stall timers in Local Simulation mode.
                </div>
              </div>
              <div className="inline-flex border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 p-0.5 font-mono">
                {([1, 10, 60] as const).map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => onSetSimSpeed(speed)}
                    className={`px-3 py-1 transition-colors cursor-pointer ${
                      simSpeed === speed
                        ? 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-zinc-950 font-bold'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
