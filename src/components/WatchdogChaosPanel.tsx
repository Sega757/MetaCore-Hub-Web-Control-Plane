import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Flame,
  HeartPulse,
  RotateCcw,
  ShieldAlert,
  TimerOff,
  Zap,
} from 'lucide-react';
import type {
  ChaosRunResult,
  ChaosScenarioId,
  EnginePolicy,
  TaskRecord,
} from '../core/types';
import type { Dictionary } from '../i18n/translations';
import {
  formatUtcTime,
  getWatchdogEffectiveDisplay,
  TASK_STATE_STYLE,
} from './semantics';

interface WatchdogChaosPanelProps {
  tasks: TaskRecord[];
  task: TaskRecord | null;
  policy: EnginePolicy;
  lastChaosResult: ChaosRunResult | null;
  runningScenario: ChaosScenarioId | null;
  t: Dictionary;
  onSelectTask: (taskId: string) => void;
  onRunChaos: (scenario: ChaosScenarioId) => void;
  onResetBreaker: (taskId: string) => void;
  onSendHeartbeat: (taskId: string) => void;
  onInspectTask?: (taskId: string) => void;
}

interface ChaosButtonSpec {
  id: ChaosScenarioId;
  title: string;
  subtitle: string;
  accent: 'emerald' | 'rose' | 'amber' | 'cyan';
  icon: React.ReactNode;
}

const CHAOS_SCENARIOS: readonly ChaosButtonSpec[] = [
  {
    id: 'HAPPY_PATH',
    title: 'Happy Path',
    subtitle: 'Clean diff, green tests, conf 0.94 -> MERGED',
    accent: 'emerald',
    icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
  },
  {
    id: 'SCOPE_ESCAPE',
    title: 'Scope Escape (0.99 Attack)',
    subtitle: 'Edits config/secrets.py + 0.99 APPROVE -> BLOCKED',
    accent: 'rose',
    icon: <ShieldAlert className="w-3.5 h-3.5 shrink-0" />,
  },
  {
    id: 'GEMINI_FALLBACK',
    title: 'Gemini Fallback',
    subtitle: 'Malformed LLM JSON -> RuleBased cap 0.80 -> HITL',
    accent: 'amber',
    icon: <Cpu className="w-3.5 h-3.5 shrink-0" />,
  },
  {
    id: 'REWORK_OVERFLOW',
    title: 'Rework Overflow',
    subtitle: 'Exceeds max_rework -> forced HUMAN_REQUIRED',
    accent: 'amber',
    icon: <RotateCcw className="w-3.5 h-3.5 shrink-0" />,
  },
  {
    id: 'WATCHDOG_STALL',
    title: 'Watchdog Stall',
    subtitle: 'Idle >120s -> Nudge L1 -> L2 -> Circuit OPEN',
    accent: 'rose',
    icon: <TimerOff className="w-3.5 h-3.5 shrink-0" />,
  },
  {
    id: 'INJECT_INVALID_DLQ',
    title: 'Inject Invalid Event (DLQ)',
    subtitle: 'Branch "main" + bad schema -> DLQ, 0 FSM change',
    accent: 'rose',
    icon: <Flame className="w-3.5 h-3.5 shrink-0" />,
  },
];

const ACCENT_CLASSES: Record<ChaosButtonSpec['accent'], string> = {
  emerald:
    'border-emerald-300 dark:border-emerald-500/30 hover:border-emerald-500 dark:hover:border-emerald-400/60 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  rose:
    'border-rose-300 dark:border-rose-500/30 hover:border-rose-500 dark:hover:border-rose-400/60 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-800 dark:text-rose-300',
  amber:
    'border-amber-300 dark:border-amber-500/30 hover:border-amber-500 dark:hover:border-amber-400/60 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-amber-800 dark:text-amber-300',
  cyan:
    'border-cyan-300 dark:border-cyan-500/30 hover:border-cyan-500 dark:hover:border-cyan-400/60 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300',
};

export const WatchdogChaosPanel: React.FC<WatchdogChaosPanelProps> = ({
  tasks,
  task,
  policy,
  lastChaosResult,
  runningScenario,
  t,
  onSelectTask,
  onRunChaos,
  onResetBreaker,
  onSendHeartbeat,
  onInspectTask,
}) => {
  const timeout = policy.stall_timeout_sec;
  const maxSpan = timeout * 3;
  const elapsed = task?.watchdog.elapsed_sec ?? 0;
  const progressPct = Math.min(100, Math.round((elapsed / maxSpan) * 100));
  const wdDisplay = task ? getWatchdogEffectiveDisplay(task, timeout) : null;
  const isBreakerOpen = task?.watchdog.circuit_breaker === 'OPEN';
  const canHeartbeat = task && task.state === 'IN_PROGRESS' && !isBreakerOpen;

  return (
    <div className="p-4 sm:p-6 max-w-[1320px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left 5 cols: Watchdog & Circuit Breaker Monitor */}
      <section className="lg:col-span-5 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 sm:p-5 space-y-4 self-start">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              {t.watchdog.monitorTitle}
            </h2>
          </div>

          <select
            aria-label="Select task for Watchdog monitor"
            value={task?.task_id ?? ''}
            onChange={(e) => onSelectTask(e.target.value)}
            className="px-2 py-1 text-xs font-mono bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
          >
            {tasks.map((tk) => (
              <option key={tk.task_id} value={tk.task_id}>
                {tk.task_id} ({tk.state})
              </option>
            ))}
          </select>
        </div>

        {task && wdDisplay ? (
          <>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500 dark:text-zinc-400 truncate">
                {task.repo.split('/').pop()} @ {task.branch}
              </span>
              <span
                className={`px-1.5 py-0.5 text-[10px] font-semibold border ${TASK_STATE_STYLE[task.state].text} ${TASK_STATE_STYLE[task.state].bg} ${TASK_STATE_STYLE[task.state].border}`}
              >
                {task.state}
              </span>
            </div>

            {/* Idle Stall Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
                <span className={`font-semibold ${wdDisplay.textClass}`}>{wdDisplay.label}</span>
                <span className="text-slate-700 dark:text-zinc-300">
                  {Math.floor(elapsed)}s / {maxSpan}s
                </span>
              </div>

              <div className="relative h-3.5 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${wdDisplay.barClass}`}
                  style={{ width: `${progressPct}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-px bg-slate-400 dark:bg-zinc-500/70"
                  style={{ left: '33.33%' }}
                  title={`Nudge L1 at ${timeout}s`}
                />
                <div
                  className="absolute top-0 bottom-0 w-px bg-slate-400 dark:bg-zinc-500/70"
                  style={{ left: '66.66%' }}
                  title={`Nudge L2 at ${timeout * 2}s`}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500 dark:text-zinc-500">
                <span>0s</span>
                <span>L1 {timeout}s</span>
                <span>L2 {timeout * 2}s</span>
                <span>Trip {maxSpan}s</span>
              </div>
            </div>

            {/* Watchdog Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
                <div className="text-[10px] text-slate-500 dark:text-zinc-500">
                  {t.watchdog.nudgeCounter}
                </div>
                <div
                  className={`mt-1 text-base font-bold tabular-nums ${
                    task.watchdog.nudge_count === 0
                      ? 'text-slate-800 dark:text-zinc-200'
                      : task.watchdog.nudge_count === 1
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {task.watchdog.nudge_count} / {task.watchdog.max_nudges}
                </div>
              </div>

              <div
                className={`p-3 border ${
                  isBreakerOpen
                    ? 'border-rose-400 dark:border-rose-500/50 bg-rose-50 dark:bg-rose-500/15'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950'
                }`}
              >
                <div className="text-[10px] text-slate-500 dark:text-zinc-500">
                  {t.watchdog.circuitBreaker}
                </div>
                <div
                  className={`mt-1 text-base font-bold ${
                    isBreakerOpen
                      ? 'text-rose-700 dark:text-rose-300'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {task.watchdog.circuit_breaker}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-2 pt-1">
              {canHeartbeat && (
                <button
                  type="button"
                  onClick={() => onSendHeartbeat(task.task_id)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-cyan-400 dark:border-cyan-500/35 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition-colors cursor-pointer"
                >
                  <HeartPulse className="w-3.5 h-3.5" />
                  {t.watchdog.sendHeartbeat}
                </button>
              )}

              <button
                type="button"
                disabled={!isBreakerOpen}
                onClick={() => onResetBreaker(task.task_id)}
                className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold border transition-colors ${
                  isBreakerOpen
                    ? 'border-rose-500 bg-rose-600 dark:bg-rose-500 text-white dark:text-zinc-950 hover:bg-rose-700 dark:hover:bg-rose-400 cursor-pointer'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900/40 text-slate-400 dark:text-zinc-600 cursor-not-allowed'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t.watchdog.manualResetBreaker}
              </button>
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-500 dark:text-zinc-500">No task selected.</div>
        )}
      </section>

      {/* Right 7 cols: Chaos & Verification Lab */}
      <section className="lg:col-span-7 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              {t.watchdog.chaosLabTitle}
            </h2>
          </div>
          <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-500">
            6 deterministic invariants
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
          {t.watchdog.chaosLabDesc}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CHAOS_SCENARIOS.map((item) => {
            const busy = runningScenario === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={runningScenario !== null}
                onClick={() => onRunChaos(item.id)}
                className={`w-full text-left p-3 border bg-slate-50/70 dark:bg-zinc-950/60 transition-colors disabled:opacity-50 cursor-pointer ${ACCENT_CLASSES[item.accent]}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-xs">
                    {item.icon}
                    <span>{item.title}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-500">
                    {busy ? 'RUN...' : 'EXEC'}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] font-mono text-slate-600 dark:text-zinc-400 leading-snug">
                  {item.subtitle}
                </div>
              </button>
            );
          })}
        </div>

        {lastChaosResult && (
          <div className="p-3.5 border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5 text-cyan-700 dark:text-cyan-300 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                LAST RUN · {lastChaosResult.scenario}
              </span>
              <span className="tabular-nums">{formatUtcTime(lastChaosResult.timestamp)}</span>
            </div>
            <p className="text-xs font-mono text-slate-800 dark:text-zinc-200 leading-relaxed">
              {lastChaosResult.outcome}
            </p>
            {lastChaosResult.task_id && onInspectTask && (
              <button
                type="button"
                onClick={() => onInspectTask(lastChaosResult.task_id!)}
                className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 hover:underline cursor-pointer"
              >
                {t.common.inspectTask} {lastChaosResult.task_id} -&gt;
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
