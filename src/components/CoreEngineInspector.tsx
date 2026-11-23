import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  GitBranch,
  Lock,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { ThemeMode } from '../core/settings';
import type { EnginePolicy, SubmitResult, TaskRecord } from '../core/types';
import type { Dictionary } from '../i18n/translations';
import { FsmDiagram } from './FsmDiagram';
import { ESCALATION_LABELS, formatUtcTime, TASK_STATE_STYLE } from './semantics';

interface CoreEngineInspectorProps {
  task: TaskRecord | null;
  policy: EnginePolicy;
  theme: ThemeMode;
  t: Dictionary;
  onSubmitEvent: (rawEvent: unknown) => Promise<SubmitResult>;
}

export const CoreEngineInspector: React.FC<CoreEngineInspectorProps> = ({
  task,
  policy,
  theme,
  t,
  onSubmitEvent,
}) => {
  const [reworkOpen, setReworkOpen] = useState(false);
  const [reworkNote, setReworkNote] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [overrideHardGate, setOverrideHardGate] = useState(false);
  const [simulateStaleVersion, setSimulateStaleVersion] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Reset per-task override/form state when switching tasks
  useEffect(() => {
    setOverrideHardGate(false);
    setDecisionNote('');
    setReworkOpen(false);
    setReworkNote('');
    setSimulateStaleVersion(false);
    setActionFeedback(null);
  }, [task?.task_id, task?.version]);

  if (!task) {
    return (
      <section className="flex-1 flex items-center justify-center p-8 text-sm text-slate-500 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-950">
        Select a task from the registry or dispatch a new task to inspect CoreEngine state.
      </section>
    );
  }

  const stateStyle = TASK_STATE_STYLE[task.state];
  const isHitlActive = task.state === 'HUMAN_REQUIRED';
  const allowedSet = new Set(task.allowed_files);
  const diffFiles = task.patch?.diff_files ?? [];
  const outOfScopeFiles = diffFiles.filter((f) => !allowedSet.has(f));
  const scopeBlocked = diffFiles.length > 0 && outOfScopeFiles.length > 0;

  const passed = task.patch?.tests.passed ?? 0;
  const failed = task.patch?.tests.failed ?? 0;
  const totalTests = passed + failed;
  const testsPass = totalTests > 0 && failed === 0;
  const passPct = totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0;

  const hasHardSecurityGateFailure =
    scopeBlocked ||
    (task.patch !== null && !testsPass) ||
    task.escalation_reasons.includes('SCOPE_VIOLATION') ||
    task.escalation_reasons.includes('TEST_FAILURE');

  // Hardening #3: Lock APPROVE & MERGE on SCOPE VIOLATION or TEST GATE FAILED unless override + non-empty note
  const approveLockedByHardGate =
    hasHardSecurityGateFailure && (!overrideHardGate || decisionNote.trim().length === 0);

  const effectiveConfidence = task.gates?.effective_confidence ?? task.verdict?.confidence ?? null;
  const threshold = task.gates?.threshold_used ?? policy.auto_merge_threshold;
  const isFallbackCapped =
    task.verdict?.engine_source === 'FallbackRules' || task.gates?.fallback_capped;

  const runAction = async (payload: unknown) => {
    setActionFeedback(null);
    const res = await onSubmitEvent(payload);
    setActionFeedback({ ok: res.accepted, message: res.message });
    if (res.accepted) {
      setReworkOpen(false);
      setReworkNote('');
      setDecisionNote('');
      setOverrideHardGate(false);
      setSimulateStaleVersion(false);
    }
  };

  const handleHumanDecision = async (decision: 'APPROVE' | 'REWORK' | 'CANCEL') => {
    const versionToSend = simulateStaleVersion ? Math.max(1, task.version - 1) : task.version;
    if (decision === 'APPROVE' && approveLockedByHardGate) {
      setActionFeedback({
        ok: false,
        message: t.tasks.overrideMissingHint,
      });
      return;
    }
    if (decision === 'REWORK' && !reworkNote.trim()) {
      setActionFeedback({
        ok: false,
        message: 'Rework instructions are required for human_decision REWORK.',
      });
      return;
    }
    const finalNote =
      decision === 'REWORK'
        ? reworkNote.trim()
        : decision === 'APPROVE' && hasHardSecurityGateFailure
          ? `[HARD_GATE_OVERRIDE] ${decisionNote.trim()}`
          : decisionNote.trim() || undefined;

    await runAction({
      type: 'human_decision',
      task_id: task.task_id,
      decision,
      expected_version: versionToSend,
      note: finalNote,
    });
  };

  return (
    <section className="flex-1 min-w-0 bg-slate-50 dark:bg-zinc-950 overflow-y-auto p-4 lg:p-5 space-y-4">
      {/* Task Header Bar */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-mono text-base font-bold text-slate-900 dark:text-zinc-100">
                {task.task_id}
              </h2>
              <span
                className={`font-mono text-[11px] font-semibold px-2 py-0.5 border ${stateStyle.text} ${stateStyle.bg} ${stateStyle.border}`}
              >
                {stateStyle.shortLabel}
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-zinc-500 tabular-nums">
                version {task.version}
              </span>
              <span className="text-slate-300 dark:text-zinc-700" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
                {formatUtcTime(task.updated_at)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-600 dark:text-zinc-400">
              <GitBranch className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
              <span className="truncate">
                {task.repo} <span className="text-slate-400 dark:text-zinc-600">@</span>{' '}
                <span className="text-cyan-700 dark:text-cyan-300">{task.branch}</span>
              </span>
            </div>
          </div>

          {/* Deterministic Proposal Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {(task.state === 'DISPATCHED' || task.state === 'REWORK') && (
              <button
                type="button"
                onClick={() =>
                  runAction({
                    type: 'worker_started',
                    task_id: task.task_id,
                    worker_id: 'worker-operator-sim',
                  })
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-cyan-400/60 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                {task.state === 'REWORK' ? 'Resume Worker' : 'Start Worker'}
              </button>
            )}

            {task.state === 'IN_PROGRESS' && (
              <button
                type="button"
                onClick={() =>
                  runAction({
                    type: 'patch_ready',
                    task_id: task.task_id,
                    diff_files: [...task.allowed_files],
                    tests: { passed: 18, failed: 0 },
                  })
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-amber-400/60 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Submit Clean Patch
              </button>
            )}

            {task.state === 'ARBITER_VALIDATING' && (
              <button
                type="button"
                onClick={() =>
                  runAction({
                    type: 'arbiter_verdict',
                    task_id: task.task_id,
                    verdict: 'APPROVE',
                    confidence: 0.92,
                    engine_source: 'GeminiArbiter',
                  })
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-emerald-400/60 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Run Arbiter (0.92)
              </button>
            )}

            {(task.state === 'DISPATCHED' ||
              task.state === 'IN_PROGRESS' ||
              task.state === 'REWORK') && (
              <button
                type="button"
                onClick={() =>
                  runAction({
                    type: 'cancel',
                    task_id: task.task_id,
                    reason: 'Operator cancelled from inspector',
                  })
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:border-slate-400 dark:hover:border-zinc-500 transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                {t.common.cancel}
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed border-t border-slate-200 dark:border-zinc-800/80 pt-2.5">
          {task.prompt}
        </p>

        {actionFeedback && (
          <div
            className={`px-3 py-2 text-xs font-mono border ${
              actionFeedback.ok
                ? 'border-emerald-300 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                : 'border-rose-300 dark:border-rose-500/45 bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300'
            }`}
          >
            {actionFeedback.message}
          </div>
        )}
      </div>

      {/* 1. Adaptive Interactive SVG FSM Pipeline */}
      <FsmDiagram task={task} theme={theme} t={t} />

      {/* 2. Evidence & Policy Gates Card */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
              {t.tasks.evidenceGatesTitle}
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500">
            LLM proposes · CoreEngine disposes
          </span>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-zinc-800">
          {/* Gate A: Scope Pinning Diff */}
          <div className="p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-zinc-200">
                <FileCode2 className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                <span>{t.tasks.scopeDiffTitle}</span>
              </div>
              {task.patch ? (
                scopeBlocked ? (
                  <span className="font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    SCOPE VIOLATION — BLOCKED ({outOfScopeFiles.length} unauthorized)
                  </span>
                ) : (
                  <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    SCOPE GATE PASS ({diffFiles.length}/{task.allowed_files.length} pinned)
                  </span>
                )
              ) : (
                <span className="font-mono text-[11px] text-slate-400 dark:text-zinc-500">
                  Awaiting patch_ready evidence
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-2.5 space-y-1.5">
                <div className="text-[11px] text-slate-500 dark:text-zinc-500">
                  allowed_files ({task.allowed_files.length})
                </div>
                <ul className="space-y-1">
                  {task.allowed_files.map((file) => (
                    <li
                      key={file}
                      className="text-slate-700 dark:text-zinc-300 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{file}</span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 shrink-0">
                        PINNED
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-2.5 space-y-1.5">
                <div className="text-[11px] text-slate-500 dark:text-zinc-500">
                  patch.diff_files ({diffFiles.length})
                </div>
                {diffFiles.length === 0 ? (
                  <div className="text-slate-400 dark:text-zinc-600 py-1">No diff submitted yet.</div>
                ) : (
                  <ul className="space-y-1">
                    {diffFiles.map((file) => {
                      const inScope = allowedSet.has(file);
                      return (
                        <li
                          key={file}
                          className={`flex items-center justify-between gap-2 px-1.5 py-0.5 ${
                            inScope
                              ? 'text-slate-800 dark:text-zinc-200'
                              : 'bg-rose-100 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/45 text-rose-800 dark:text-rose-200'
                          }`}
                        >
                          <span className="truncate">{file}</span>
                          {inScope ? (
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 shrink-0">
                              OK
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 shrink-0 whitespace-nowrap">
                              OUT OF SCOPE — BLOCKED
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Gate B: Test Suite Status */}
          <div className="p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-800 dark:text-zinc-200">
                {t.tasks.testGateTitle}
              </span>
              {task.patch ? (
                <span
                  className={`font-mono text-[11px] font-semibold tabular-nums ${
                    testsPass
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {testsPass ? 'TEST GATE PASS' : 'TEST GATE FAIL'} · {passed} passed / {failed}{' '}
                  failed
                </span>
              ) : (
                <span className="font-mono text-[11px] text-slate-400 dark:text-zinc-500">
                  Pending test report
                </span>
              )}
            </div>

            <div className="h-2.5 w-full bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 overflow-hidden flex">
              {totalTests > 0 ? (
                <>
                  <div
                    className="h-full bg-emerald-500 transition-all duration-200"
                    style={{ width: `${passPct}%` }}
                  />
                  {failed > 0 && (
                    <div
                      className="h-full bg-rose-500 transition-all duration-200"
                      style={{ width: `${100 - passPct}%` }}
                    />
                  )}
                </>
              ) : (
                <div className="h-full w-full bg-slate-200 dark:bg-zinc-900" />
              )}
            </div>
          </div>

          {/* Gate C: Arbiter Verdict Box */}
          <div className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-slate-800 dark:text-zinc-200">
                  {t.tasks.arbiterVerdictTitle}
                </span>
                {task.verdict && (
                  <span
                    className={`font-mono text-[11px] px-1.5 py-0.5 border ${
                      isFallbackCapped
                        ? 'border-amber-300 dark:border-amber-500/45 bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300'
                        : task.verdict.engine_source === 'GeminiArbiter'
                          ? 'border-cyan-300 dark:border-cyan-500/35 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300'
                          : 'border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    {isFallbackCapped
                      ? 'FallbackRules (cap 0.80)'
                      : task.verdict.engine_source}
                  </span>
                )}
              </div>

              {task.verdict ? (
                <span
                  className={`font-mono text-xs font-bold tabular-nums ${
                    task.verdict.verdict === 'APPROVE'
                      ? effectiveConfidence !== null && effectiveConfidence >= threshold
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                      : task.verdict.verdict === 'REWORK'
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {task.verdict.verdict} · conf {effectiveConfidence?.toFixed(2)} (threshold{' '}
                  {threshold.toFixed(2)})
                </span>
              ) : (
                <span className="font-mono text-[11px] text-slate-400 dark:text-zinc-500">
                  No arbiter verdict recorded
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="relative h-4 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                {effectiveConfidence !== null && (
                  <div
                    className={`h-full transition-all duration-200 ${
                      scopeBlocked || !testsPass
                        ? 'bg-rose-500/80'
                        : effectiveConfidence >= threshold
                          ? 'bg-emerald-500/80'
                          : 'bg-amber-500/80'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, effectiveConfidence * 100))}%` }}
                  />
                )}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-900 dark:bg-zinc-100 z-10"
                  style={{ left: `${Math.min(99, Math.max(1, threshold * 100))}%` }}
                  title={`Auto-Merge Threshold: ${threshold.toFixed(2)}`}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500 dark:text-zinc-500">
                <span>0.00</span>
                <span className="text-slate-700 dark:text-zinc-300">
                  Threshold {threshold.toFixed(2)}
                  {isFallbackCapped && task.verdict
                    ? ` · Raw ${task.verdict.raw_confidence.toFixed(2)} -> Capped 0.80`
                    : ''}
                </span>
                <span>1.00</span>
              </div>
            </div>

            {task.verdict?.fallback_reason && (
              <div className="p-2.5 border border-amber-300 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-500/10 text-xs font-mono text-amber-900 dark:text-amber-200">
                {task.verdict.fallback_reason}
              </div>
            )}

            {task.verdict?.rework_instructions && (
              <div className="p-2.5 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs font-mono text-amber-800 dark:text-amber-200/90">
                <span className="text-slate-500 dark:text-zinc-500">rework_instructions: </span>
                {task.verdict.rework_instructions}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Human-in-the-Loop (HITL) Decision Gate (Hardening #3) */}
      <div
        className={`border p-4 space-y-3.5 ${
          isHitlActive
            ? 'border-rose-400 dark:border-rose-500/55 bg-rose-50/70 dark:bg-rose-950/20'
            : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isHitlActive ? (
              <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
            )}
            <h3
              className={`text-xs font-semibold ${
                isHitlActive
                  ? 'text-rose-900 dark:text-rose-200'
                  : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              {t.tasks.hitlGateTitle}
            </h3>
          </div>

          <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums">
            TOCTOU Guard: expected_version = v{task.version}
          </span>
        </div>

        {isHitlActive ? (
          <>
            {/* Escalation Reasons */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono text-rose-700 dark:text-rose-300/80">
                Escalation Triggers ({task.escalation_reasons.length})
              </div>
              <div className="space-y-1.5">
                {task.escalation_reasons.map((reason) => {
                  const meta = ESCALATION_LABELS[reason];
                  return (
                    <div
                      key={reason}
                      className="flex items-start gap-2.5 p-2.5 border border-rose-300 dark:border-rose-500/35 bg-white dark:bg-zinc-950/90 text-xs"
                    >
                      <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="font-mono font-bold text-rose-700 dark:text-rose-300">
                          {meta.title}
                        </div>
                        <div className="text-slate-600 dark:text-zinc-400">{meta.detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hard Security Gate Override Guard */}
            {hasHardSecurityGateFailure && (
              <div className="p-3 border border-rose-400 dark:border-rose-500/50 bg-rose-100/70 dark:bg-rose-950/40 space-y-2">
                <label className="flex items-start gap-2.5 text-xs font-medium text-rose-900 dark:text-rose-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={overrideHardGate}
                    onChange={(e) => setOverrideHardGate(e.target.checked)}
                    className="mt-0.5 accent-rose-600"
                  />
                  <span>{t.tasks.overrideHardGateLabel}</span>
                </label>
                {approveLockedByHardGate && (
                  <p className="text-[11px] font-mono text-rose-700 dark:text-rose-300/90 pl-6">
                    {t.tasks.overrideMissingHint}
                  </p>
                )}
              </div>
            )}

            {/* Operator Audit Note & TOCTOU Simulation Toggle */}
            <div className="space-y-2">
              <input
                type="text"
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder={
                  hasHardSecurityGateFailure
                    ? t.tasks.auditNoteRequiredPlaceholder
                    : t.tasks.auditNotePlaceholder
                }
                className={`w-full px-3 py-2 text-xs font-mono bg-white dark:bg-zinc-950 border text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none ${
                  hasHardSecurityGateFailure && decisionNote.trim().length === 0
                    ? 'border-rose-400 dark:border-rose-500/60 focus:border-rose-500'
                    : 'border-slate-300 dark:border-zinc-800 focus:border-cyan-500'
                }`}
              />

              <label className="inline-flex items-center gap-2 text-[11px] font-mono text-slate-600 dark:text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={simulateStaleVersion}
                  onChange={(e) => setSimulateStaleVersion(e.target.checked)}
                  className="accent-rose-500"
                />
                <span>
                  Simulate TOCTOU race (send stale expected_version=v{Math.max(1, task.version - 1)}{' '}
                  -&gt; DLQ)
                </span>
              </label>
            </div>

            {/* Rework Instructions Drawer */}
            {reworkOpen && (
              <div className="space-y-2 p-3 border border-amber-400 dark:border-amber-500/40 bg-white dark:bg-zinc-950">
                <label
                  htmlFor="hitl-rework-instructions"
                  className="block text-[11px] font-mono text-amber-800 dark:text-amber-300"
                >
                  Rework Instructions (required by human_decision contract)
                </label>
                <textarea
                  id="hitl-rework-instructions"
                  rows={2}
                  value={reworkNote}
                  onChange={(e) => setReworkNote(e.target.value)}
                  placeholder="Revert changes to config/secrets.py and keep diff strictly inside allowed_files."
                  className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReworkOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleHumanDecision('REWORK')}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-amber-500 dark:bg-amber-400 text-white dark:text-zinc-950 hover:bg-amber-600 dark:hover:bg-amber-300 transition-colors cursor-pointer"
                  >
                    Send Rework Decision
                  </button>
                </div>
              </div>
            )}

            {/* HITL Primary Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={approveLockedByHardGate}
                onClick={() => handleHumanDecision('APPROVE')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors ${
                  approveLockedByHardGate
                    ? 'bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 cursor-not-allowed border border-slate-300 dark:border-zinc-700'
                    : 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-zinc-950 hover:bg-emerald-700 dark:hover:bg-emerald-400 cursor-pointer'
                }`}
              >
                {approveLockedByHardGate ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {t.tasks.approveMerge}
              </button>

              <button
                type="button"
                onClick={() => setReworkOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/25 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t.tasks.requestRework}
              </button>

              <button
                type="button"
                onClick={() => handleHumanDecision('CANCEL')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-rose-300 dark:border-rose-500/45 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                {t.tasks.cancelTask}
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-600 shrink-0" />
            <span>
              Decision controls unlock only when task enters{' '}
              <span className="font-mono text-slate-700 dark:text-zinc-300">HUMAN_REQUIRED</span>.
              Current state:{' '}
              <span className={`font-mono font-semibold ${stateStyle.text}`}>{task.state}</span>.
            </span>
          </div>
        )}
      </div>
    </section>
  );
};
