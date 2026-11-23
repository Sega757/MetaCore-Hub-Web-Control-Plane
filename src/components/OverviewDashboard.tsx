import React from 'react';
import {
  Activity,
  AlertOctagon,
  ArrowUpRight,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { ALL_TASK_STATES } from '../core/fsm';
import type { DlqErrorCode, EngineSnapshot, TaskState } from '../core/types';
import type { Dictionary } from '../i18n/translations';
import {
  formatUtcTime,
  getWatchdogEffectiveDisplay,
  TASK_STATE_STYLE,
} from './semantics';

interface OverviewDashboardProps {
  snapshot: EngineSnapshot;
  t: Dictionary;
  onInspectTask: (taskId: string) => void;
  onOpenSecurity: () => void;
  onOpenWatchdog: () => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  snapshot,
  t,
  onInspectTask,
  onOpenSecurity,
  onOpenWatchdog,
}) => {
  const { tasks, policy, dlq, audit, audit_verification } = snapshot;

  const totalTasks = tasks.length;
  const activeTasks = tasks.filter(
    (tk) =>
      tk.state === 'DISPATCHED' ||
      tk.state === 'IN_PROGRESS' ||
      tk.state === 'ARBITER_VALIDATING' ||
      tk.state === 'REWORK'
  ).length;
  const mergedTasks = tasks.filter((tk) => tk.state === 'MERGED').length;
  const humanTasks = tasks.filter((tk) => tk.state === 'HUMAN_REQUIRED').length;
  const otherTerminal = tasks.filter(
    (tk) => tk.state === 'FAILED' || tk.state === 'CANCELLED'
  ).length;

  const decidedPool = mergedTasks + humanTasks;
  const autoMergePct = decidedPool > 0 ? Math.round((mergedTasks / decidedPool) * 100) : 0;

  const verdictTasks = tasks.filter((tk) => tk.verdict !== null);
  const avgConfidence =
    verdictTasks.length > 0
      ? verdictTasks.reduce((sum, tk) => sum + (tk.verdict?.confidence ?? 0), 0) /
        verdictTasks.length
      : null;

  const openBreakers = tasks.filter((tk) => tk.watchdog.circuit_breaker === 'OPEN').length;

  // FSM distribution counts
  const stateCounts: Record<TaskState, number> = {
    DISPATCHED: 0,
    IN_PROGRESS: 0,
    ARBITER_VALIDATING: 0,
    REWORK: 0,
    HUMAN_REQUIRED: 0,
    MERGED: 0,
    FAILED: 0,
    CANCELLED: 0,
  };
  for (const tk of tasks) {
    stateCounts[tk.state] += 1;
  }
  const maxStateCount = Math.max(1, ...Object.values(stateCounts));

  // Donut chart segments (pure SVG)
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const donutSegments = [
    { label: t.overview.autoMergedLabel, value: mergedTasks, color: '#10b981' },
    { label: t.overview.humanEscalatedLabel, value: humanTasks, color: '#f43f5e' },
    { label: t.overview.inFlightLabel, value: activeTasks, color: '#06b6d4' },
    { label: t.overview.terminalOtherLabel, value: otherTerminal, color: '#71717a' },
  ];
  const donutTotal = Math.max(1, totalTasks);
  let cumulativeOffset = 0;

  // DLQ breakdown by error code
  const dlqByCode = new Map<DlqErrorCode, number>();
  for (const item of dlq) {
    dlqByCode.set(item.code, (dlqByCode.get(item.code) ?? 0) + 1);
  }
  const dlqEntries = Array.from(dlqByCode.entries());
  const maxDlqCode = Math.max(1, ...dlqEntries.map(([, c]) => c));

  // Audit activity sparkline buckets (deterministic 8 buckets across audit history)
  const auditBuckets = Array.from({ length: 8 }, (_, idx) => {
    const start = Math.floor((idx * audit.length) / 8);
    const end = Math.floor(((idx + 1) * audit.length) / 8);
    const slice = audit.slice(start, Math.max(start, end));
    const dlqHits = slice.filter((e) => e.event_type.startsWith('dlq.')).length;
    return {
      index: idx,
      total: slice.length,
      dlqHits,
    };
  });
  const maxBucket = Math.max(1, ...auditBuckets.map((b) => b.total));

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1440px] w-full mx-auto">
      {/* KPI Row (4 clean cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Tasks & Auto-Merge Share */}
        <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>{t.overview.kpiTotalTasks}</span>
            <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2.5 font-mono tabular-nums">
            <span className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
              {totalTasks}
            </span>
            <span className="text-xs text-cyan-700 dark:text-cyan-400">
              {activeTasks} {t.overview.kpiActiveSubtitle}
            </span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {t.overview.kpiAutoMergeRate}: {autoMergePct}% ({mergedTasks}/{decidedPool || 0})
          </div>
        </div>

        {/* KPI 2: HITL Escalations */}
        <div
          className={`border p-4 space-y-2 ${
            humanTasks > 0
              ? 'border-rose-300 dark:border-rose-500/45 bg-rose-50/70 dark:bg-rose-950/20'
              : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
            <span>{t.overview.kpiEscalations}</span>
            <AlertOctagon
              className={`w-4 h-4 ${
                humanTasks > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-400 dark:text-zinc-500'
              }`}
            />
          </div>
          <div className="flex items-baseline gap-2.5 font-mono tabular-nums">
            <span
              className={`text-2xl font-bold ${
                humanTasks > 0
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-slate-900 dark:text-zinc-100'
              }`}
            >
              {humanTasks}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              {t.overview.kpiHumanSubtitle}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            Breakers OPEN:{' '}
            <strong
              className={
                openBreakers > 0
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }
            >
              {openBreakers}
            </strong>
          </div>
        </div>

        {/* KPI 3: Avg Arbiter Confidence */}
        <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>{t.overview.kpiAvgConfidence}</span>
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2.5 font-mono tabular-nums">
            <span className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
              {avgConfidence !== null ? avgConfidence.toFixed(2) : '—'}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              / {policy.auto_merge_threshold.toFixed(2)} threshold
            </span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-zinc-400">
            Evaluated verdicts: {verdictTasks.length}
          </div>
        </div>

        {/* KPI 4: DLQ & SHA-256 Audit Integrity */}
        <button
          type="button"
          onClick={onOpenSecurity}
          className={`text-left border p-4 space-y-2 transition-colors cursor-pointer ${
            audit_verification.valid
              ? 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-emerald-400 dark:hover:border-emerald-500/40'
              : 'border-rose-400 dark:border-rose-500/60 bg-rose-50 dark:bg-rose-950/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>{t.overview.kpiDlqAudit}</span>
            {audit_verification.valid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            )}
          </div>
          <div className="flex items-baseline gap-2.5 font-mono tabular-nums">
            <span
              className={`text-lg font-bold ${
                audit_verification.valid
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-300'
              }`}
            >
              {audit_verification.valid ? t.common.auditValid : t.common.auditTampered}
            </span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-zinc-400 flex items-center justify-between">
            <span>{audit.length} SHA-256 links</span>
            <span className={dlq.length > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}>
              DLQ: {dlq.length}
            </span>
          </div>
        </button>
      </div>

      {/* Charts Row 1: FSM State Distribution + Auto-Merge vs HITL Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Horizontal Bar Chart: FSM State Distribution */}
        <div className="lg:col-span-7 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
              {t.overview.chartFsmDist}
            </h2>
            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500 tabular-nums">
              8 FSM states
            </span>
          </div>

          <div className="space-y-2">
            {ALL_TASK_STATES.map((state) => {
              const count = stateCounts[state];
              const pct = Math.round((count / maxStateCount) * 100);
              const style = TASK_STATE_STYLE[state];
              return (
                <div key={state} className="grid grid-cols-12 items-center gap-2 text-xs font-mono">
                  <div className={`col-span-5 sm:col-span-4 truncate text-[11px] ${style.text}`}>
                    {state}
                  </div>
                  <div className="col-span-5 sm:col-span-6 h-3 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 overflow-hidden">
                    <div
                      className="h-full transition-all duration-200"
                      style={{
                        width: count > 0 ? `${Math.max(8, pct)}%` : '0%',
                        backgroundColor: style.barColor,
                      }}
                    />
                  </div>
                  <div className="col-span-2 text-right tabular-nums text-slate-700 dark:text-zinc-300 font-semibold">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SVG Donut Chart: Auto-Merge vs Human Escalations */}
        <div className="lg:col-span-5 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
              {t.overview.chartMergeVsHitl}
            </h2>
            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500 tabular-nums">
              n = {totalTasks}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
            <svg viewBox="0 0 120 120" className="w-32 h-32 shrink-0" role="img" aria-label="Task outcomes distribution">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                className="stroke-slate-200 dark:stroke-zinc-800"
                strokeWidth="14"
              />
              {donutSegments.map((seg) => {
                if (seg.value === 0) return null;
                const dash = (seg.value / donutTotal) * circumference;
                const offset = -cumulativeOffset;
                cumulativeOffset += dash;
                return (
                  <circle
                    key={seg.label}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="14"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={offset}
                    transform="rotate(-90 60 60)"
                  />
                );
              })}
              <text
                x="60"
                y="56"
                textAnchor="middle"
                className="fill-slate-900 dark:fill-zinc-100 font-mono text-base font-bold"
              >
                {autoMergePct}%
              </text>
              <text
                x="60"
                y="70"
                textAnchor="middle"
                className="fill-slate-500 dark:fill-zinc-400 font-mono text-[8px]"
              >
                MERGED
              </text>
            </svg>

            <div className="space-y-2 w-full sm:w-auto text-xs font-mono tabular-nums">
              {donutSegments.map((seg) => (
                <div key={seg.label} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-slate-600 dark:text-zinc-300 text-[11px]">
                      {seg.label}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-zinc-100">
                    {seg.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Arbiter Confidence vs Threshold + DLQ / Audit Dynamics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Confidence vs Threshold Bullet Chart */}
        <div className="lg:col-span-6 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
              {t.overview.chartConfidenceVsThreshold}
            </h2>
            <span className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400 tabular-nums">
              Threshold {policy.auto_merge_threshold.toFixed(2)}
            </span>
          </div>

          {verdictTasks.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-zinc-500 py-4">
              No arbiter verdicts recorded yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {verdictTasks.slice(0, 6).map((tk) => {
                const conf = tk.verdict?.confidence ?? 0;
                const blockedHard =
                  tk.escalation_reasons.includes('SCOPE_VIOLATION') ||
                  tk.escalation_reasons.includes('TEST_FAILURE');
                return (
                  <button
                    key={tk.task_id}
                    type="button"
                    onClick={() => onInspectTask(tk.task_id)}
                    className="w-full text-left space-y-1 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-slate-800 dark:text-zinc-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                        {tk.task_id} ·{' '}
                        <span className="text-slate-500 dark:text-zinc-400">
                          {tk.verdict?.engine_source}
                        </span>
                      </span>
                      <span
                        className={
                          blockedHard
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : conf >= policy.auto_merge_threshold
                              ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                              : 'text-amber-700 dark:text-amber-400 font-semibold'
                        }
                      >
                        {conf.toFixed(2)} {blockedHard ? '(GATE BLOCKED)' : ''}
                      </span>
                    </div>
                    <div className="relative h-3 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                      <div
                        className={`h-full ${
                          blockedHard
                            ? 'bg-rose-500'
                            : conf >= policy.auto_merge_threshold
                              ? 'bg-emerald-500'
                              : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.round(conf * 100))}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-slate-900 dark:bg-zinc-100"
                        style={{ left: `${Math.round(policy.auto_merge_threshold * 100)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* DLQ Violations Breakdown & Audit Activity Bars */}
        <div className="lg:col-span-6 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
              {t.overview.chartDlqDynamics}
            </h2>
            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500 tabular-nums">
              {audit.length} events · {dlq.length} DLQ
            </span>
          </div>

          {/* Mini SVG Audit vs DLQ Timeline */}
          <div className="border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-3">
            <div className="grid grid-cols-8 gap-2 items-end h-20">
              {auditBuckets.map((bucket) => {
                const totalH = Math.max(8, Math.round((bucket.total / maxBucket) * 100));
                const dlqH =
                  bucket.dlqHits > 0
                    ? Math.max(18, Math.round((bucket.dlqHits / bucket.total) * totalH))
                    : 0;
                return (
                  <div
                    key={bucket.index}
                    className="flex flex-col items-center justify-end h-full gap-1"
                    title={`Bucket #${bucket.index + 1}: ${bucket.total} audit events (${bucket.dlqHits} DLQ)`}
                  >
                    <div className="w-full h-full flex flex-col justify-end bg-slate-200/60 dark:bg-zinc-900">
                      <div
                        className="w-full bg-cyan-500/80 dark:bg-cyan-500/70 flex flex-col justify-end"
                        style={{ height: `${totalH}%` }}
                      >
                        {dlqH > 0 && (
                          <div className="w-full bg-rose-500" style={{ height: `${dlqH}%` }} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-zinc-500">
              <span>Genesis #0</span>
              <span className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 bg-cyan-500" /> Audit
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 bg-rose-500" /> DLQ
                </span>
              </span>
              <span>Head #{Math.max(0, audit.length - 1)}</span>
            </div>
          </div>

          {/* DLQ Breakdown */}
          {dlqEntries.length === 0 ? (
            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-3 py-2">
              {t.overview.noDlqViolations}
            </div>
          ) : (
            <div className="space-y-1.5">
              {dlqEntries.map(([code, count]) => (
                <div key={code} className="grid grid-cols-12 items-center gap-2 text-[11px] font-mono">
                  <span className="col-span-6 truncate text-rose-700 dark:text-rose-400">
                    {code}
                  </span>
                  <div className="col-span-4 h-2 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${Math.round((count / maxDlqCode) * 100)}%` }}
                    />
                  </div>
                  <span className="col-span-2 text-right font-semibold tabular-nums text-slate-800 dark:text-zinc-200">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fleet Watchdog & Recent Tasks Table */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
            {t.overview.fleetWatchdogTitle}
          </h2>
          <button
            type="button"
            onClick={onOpenWatchdog}
            className="text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            Watchdog &amp; Chaos Lab
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[680px] text-left border-collapse text-xs font-mono tabular-nums">
            <thead className="bg-slate-50 dark:bg-zinc-950/70 border-b border-slate-200 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-zinc-400">
              <tr>
                <th className="py-2.5 px-4">Task</th>
                <th className="py-2.5 px-4">Branch</th>
                <th className="py-2.5 px-4">FSM State</th>
                <th className="py-2.5 px-4">Watchdog</th>
                <th className="py-2.5 px-4">Updated</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800/70">
              {tasks.map((tk) => {
                const st = TASK_STATE_STYLE[tk.state];
                const wd = getWatchdogEffectiveDisplay(tk, policy.stall_timeout_sec);
                return (
                  <tr
                    key={tk.task_id}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                      {tk.task_id}{' '}
                      <span className="font-normal text-slate-400 dark:text-zinc-500">
                        v{tk.version}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-zinc-300 max-w-[200px] truncate">
                      {tk.branch}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 text-[10px] font-semibold border ${st.text} ${st.bg} ${st.border}`}>
                        {st.shortLabel}
                      </span>
                    </td>
                    <td className={`py-2.5 px-4 whitespace-nowrap ${wd.textClass}`}>
                      {wd.label}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                      {formatUtcTime(tk.updated_at)}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspectTask(tk.task_id)}
                        className="text-cyan-700 dark:text-cyan-400 hover:underline font-sans font-medium cursor-pointer"
                      >
                        {t.common.inspectTask}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
