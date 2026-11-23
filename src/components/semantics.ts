import { isTerminalState } from '../core/fsm';
import type { EscalationReason, TaskRecord, TaskState, WatchdogStatus } from '../core/types';

export interface StateVisualStyle {
  text: string;
  bg: string;
  border: string;
  barColor: string;
  svgFillDark: string;
  svgStrokeDark: string;
  svgTextDark: string;
  svgFillLight: string;
  svgStrokeLight: string;
  svgTextLight: string;
  shortLabel: string;
}

export const TASK_STATE_STYLE: Record<TaskState, StateVisualStyle> = {
  DISPATCHED: {
    text: 'text-sky-700 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-500/10',
    border: 'border-sky-300 dark:border-sky-500/35',
    barColor: '#0ea5e9',
    svgFillDark: '#082f49',
    svgStrokeDark: '#38bdf8',
    svgTextDark: '#e0f2fe',
    svgFillLight: '#e0f2fe',
    svgStrokeLight: '#0284c7',
    svgTextLight: '#0c4a6e',
    shortLabel: 'DISPATCHED',
  },
  IN_PROGRESS: {
    text: 'text-cyan-700 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-500/10',
    border: 'border-cyan-300 dark:border-cyan-500/35',
    barColor: '#06b6d4',
    svgFillDark: '#083344',
    svgStrokeDark: '#22d3ee',
    svgTextDark: '#cffafe',
    svgFillLight: '#cffafe',
    svgStrokeLight: '#0891b2',
    svgTextLight: '#164e63',
    shortLabel: 'IN_PROGRESS',
  },
  ARBITER_VALIDATING: {
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-300 dark:border-amber-500/35',
    barColor: '#f59e0b',
    svgFillDark: '#451a03',
    svgStrokeDark: '#f59e0b',
    svgTextDark: '#fef3c7',
    svgFillLight: '#fef3c7',
    svgStrokeLight: '#d97706',
    svgTextLight: '#78350f',
    shortLabel: 'ARBITER_VALIDATING',
  },
  REWORK: {
    text: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-300 dark:border-amber-400/35',
    barColor: '#eab308',
    svgFillDark: '#422006',
    svgStrokeDark: '#fbbf24',
    svgTextDark: '#fef9c3',
    svgFillLight: '#fef9c3',
    svgStrokeLight: '#ca8a04',
    svgTextLight: '#713f12',
    shortLabel: 'REWORK',
  },
  HUMAN_REQUIRED: {
    text: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-500/15',
    border: 'border-rose-300 dark:border-rose-500/45',
    barColor: '#f43f5e',
    svgFillDark: '#4c0519',
    svgStrokeDark: '#fb7185',
    svgTextDark: '#ffe4e6',
    svgFillLight: '#ffe4e6',
    svgStrokeLight: '#e11d48',
    svgTextLight: '#881337',
    shortLabel: 'HUMAN_REQUIRED',
  },
  MERGED: {
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-300 dark:border-emerald-500/35',
    barColor: '#10b981',
    svgFillDark: '#022c22',
    svgStrokeDark: '#34d399',
    svgTextDark: '#d1fae5',
    svgFillLight: '#d1fae5',
    svgStrokeLight: '#059669',
    svgTextLight: '#064e3b',
    shortLabel: 'MERGED',
  },
  FAILED: {
    text: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-500/15',
    border: 'border-rose-300 dark:border-rose-500/40',
    barColor: '#dc2626',
    svgFillDark: '#450a0a',
    svgStrokeDark: '#f43f5e',
    svgTextDark: '#fecdd3',
    svgFillLight: '#fee2e2',
    svgStrokeLight: '#dc2626',
    svgTextLight: '#7f1d1d',
    shortLabel: 'FAILED',
  },
  CANCELLED: {
    text: 'text-slate-600 dark:text-zinc-400',
    bg: 'bg-slate-100 dark:bg-zinc-800/60',
    border: 'border-slate-300 dark:border-zinc-700',
    barColor: '#71717a',
    svgFillDark: '#18181b',
    svgStrokeDark: '#71717a',
    svgTextDark: '#d4d4d8',
    svgFillLight: '#f1f5f9',
    svgStrokeLight: '#64748b',
    svgTextLight: '#334155',
    shortLabel: 'CANCELLED',
  },
};

export const WATCHDOG_STYLE: Record<
  WatchdogStatus,
  { text: string; bar: string; label: string }
> = {
  HEALTHY: {
    text: 'text-cyan-700 dark:text-cyan-400',
    bar: 'bg-cyan-500 dark:bg-cyan-400',
    label: 'HEALTHY',
  },
  NUDGE_L1: {
    text: 'text-amber-700 dark:text-amber-400',
    bar: 'bg-amber-500 dark:bg-amber-400',
    label: 'Nudge L1 (Continue)',
  },
  NUDGE_L2: {
    text: 'text-amber-700 dark:text-amber-300',
    bar: 'bg-amber-600 dark:bg-amber-500',
    label: 'Nudge L2 (Diagnostic)',
  },
  CIRCUIT_OPEN: {
    text: 'text-rose-700 dark:text-rose-400',
    bar: 'bg-rose-600 dark:bg-rose-500',
    label: 'CIRCUIT BREAKER OPEN',
  },
};

export interface WatchdogEffectiveDisplay {
  label: string;
  compactLabel: string;
  textClass: string;
  barClass: string;
  isMonitoring: boolean;
}

/**
 * Exact Watchdog status resolver per Hardening #4:
 * - HUMAN_REQUIRED -> PAUSED (Awaiting HITL)
 * - MERGED / FAILED / CANCELLED -> STOPPED (Terminal) (+ BREAKER OPEN if tripped)
 * - DISPATCHED / ARBITER_VALIDATING -> STANDBY
 * - IN_PROGRESS / REWORK -> Live HEALTHY / Nudge L1 / Nudge L2 / CIRCUIT BREAKER OPEN
 */
export function getWatchdogEffectiveDisplay(
  task: TaskRecord,
  stallTimeoutSec: number
): WatchdogEffectiveDisplay {
  const breakerOpen = task.watchdog.circuit_breaker === 'OPEN';

  if (task.state === 'HUMAN_REQUIRED') {
    return {
      label: breakerOpen ? 'PAUSED (Awaiting HITL) · BREAKER OPEN' : 'PAUSED (Awaiting HITL)',
      compactLabel: breakerOpen ? 'PAUSED · OPEN' : 'PAUSED (HITL)',
      textClass: breakerOpen
        ? 'text-rose-700 dark:text-rose-400 font-semibold'
        : 'text-amber-700 dark:text-amber-400',
      barClass: breakerOpen ? 'bg-rose-500' : 'bg-amber-500/70',
      isMonitoring: false,
    };
  }

  if (isTerminalState(task.state)) {
    return {
      label: breakerOpen ? 'STOPPED (Terminal) · BREAKER OPEN' : 'STOPPED (Terminal)',
      compactLabel: breakerOpen ? 'STOPPED · OPEN' : 'STOPPED',
      textClass: breakerOpen
        ? 'text-rose-700 dark:text-rose-400 font-semibold'
        : 'text-slate-500 dark:text-zinc-500',
      barClass: breakerOpen ? 'bg-rose-500' : 'bg-slate-400 dark:bg-zinc-600',
      isMonitoring: false,
    };
  }

  if (task.state === 'DISPATCHED' || task.state === 'ARBITER_VALIDATING') {
    return {
      label: `STANDBY (${task.state})`,
      compactLabel: 'STANDBY',
      textClass: 'text-slate-500 dark:text-zinc-400',
      barClass: 'bg-slate-400 dark:bg-zinc-600',
      isMonitoring: false,
    };
  }

  const base = WATCHDOG_STYLE[task.watchdog.status];
  return {
    label: base.label,
    compactLabel: breakerOpen
      ? 'BREAKER OPEN'
      : `${Math.floor(task.watchdog.elapsed_sec)}s/${stallTimeoutSec}s`,
    textClass: base.text,
    barClass: base.bar,
    isMonitoring: true,
  };
}

export const ESCALATION_LABELS: Record<EscalationReason, { title: string; detail: string }> = {
  SCOPE_VIOLATION: {
    title: 'SCOPE VIOLATION',
    detail: 'Patch modified files outside allowed_files whitelist. Cannot be overridden by arbiter.',
  },
  TEST_FAILURE: {
    title: 'TEST GATE FAILED',
    detail: 'Test suite reported failures or zero passing tests. Auto-merge blocked.',
  },
  LOW_CONFIDENCE: {
    title: 'LOW CONFIDENCE',
    detail: 'Effective arbiter confidence is below active auto_merge_threshold.',
  },
  HITL_MODE: {
    title: 'HITL MODE ACTIVE',
    detail: 'EnginePolicy.hitl_mode is enabled; all APPROVE verdicts require operator sign-off.',
  },
  MAX_REWORK_EXCEEDED: {
    title: 'MAX REWORK EXCEEDED',
    detail: 'Task exceeded EnginePolicy.max_rework attempts and was escalated.',
  },
  ARBITER_FALLBACK: {
    title: 'ARBITER FALLBACK (CAP 0.80)',
    detail: 'GeminiArbiter faulted; FallbackRules capped confidence at 0.80 to enforce human review.',
  },
  ARBITER_ESCALATED: {
    title: 'ARBITER ESCALATED',
    detail: 'Arbiter explicitly returned ESCALATE_HUMAN verdict.',
  },
  CIRCUIT_BREAKER_OPEN: {
    title: 'CIRCUIT BREAKER OPEN',
    detail: 'Watchdog exhausted 2 nudges without worker activity; worker isolated until manual reset.',
  },
};

export function formatUtcTime(tsMs: number): string {
  const d = new Date(tsMs);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}Z`;
}

export function shortHash(hash: string, len = 8): string {
  if (!hash) return '--------';
  return hash.slice(0, len);
}
