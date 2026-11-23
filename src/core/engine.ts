import { TamperEvidentAuditLog } from './audit';
import { validateEventContract } from './contracts';
import { isTerminalState, validateTransition } from './fsm';
import type {
  ArbiterVerdictEvent,
  AuditVerificationResult,
  ChaosRunResult,
  ChaosScenarioId,
  DlqEntry,
  DlqErrorCode,
  EnginePolicy,
  EngineSnapshot,
  EscalationReason,
  GateEvaluation,
  HumanDecisionEvent,
  PatchReadyEvent,
  SimSpeed,
  SubmitResult,
  TaskRecord,
  TaskState,
} from './types';
import {
  advanceWatchdog,
  createInitialWatchdogState,
  resetCircuitBreaker,
  resetWatchdogOnActivity,
} from './watchdog';

export const DEFAULT_POLICY: EnginePolicy = {
  auto_merge_threshold: 0.85,
  max_rework: 3,
  hitl_mode: false,
  stall_timeout_sec: 120,
};

export const FALLBACK_CONFIDENCE_CAP = 0.8;

// Deterministic initial virtual epoch: 2026-11-22T09:00:00.000Z
const BASE_SIM_EPOCH_MS = 1795338000000;

export function evaluateMergeGates(
  task: TaskRecord,
  verdict: ArbiterVerdictEvent,
  policy: EnginePolicy
): { gates: GateEvaluation; escalationReasons: EscalationReason[] } {
  const allowedSet = new Set(task.allowed_files);
  const diffFiles = task.patch?.diff_files ?? [];
  const outOfScopeFiles = diffFiles.filter((file) => !allowedSet.has(file));
  const scopePass = diffFiles.length > 0 && outOfScopeFiles.length === 0;

  const passedTests = task.patch?.tests.passed ?? 0;
  const failedTests = task.patch?.tests.failed ?? 0;
  const testsPass = failedTests === 0 && passedTests > 0;

  const fallbackCapped = verdict.engine_source === 'FallbackRules';
  const effectiveConfidence = fallbackCapped
    ? Math.min(verdict.confidence, FALLBACK_CONFIDENCE_CAP)
    : verdict.confidence;

  const confidencePass = effectiveConfidence >= policy.auto_merge_threshold;
  const hitlPass = !policy.hitl_mode;

  const canAutoMerge =
    verdict.verdict === 'APPROVE' && scopePass && testsPass && confidencePass && hitlPass;

  const escalationReasons: EscalationReason[] = [];
  if (!scopePass) escalationReasons.push('SCOPE_VIOLATION');
  if (!testsPass) escalationReasons.push('TEST_FAILURE');
  if (fallbackCapped) escalationReasons.push('ARBITER_FALLBACK');
  if (!confidencePass) escalationReasons.push('LOW_CONFIDENCE');
  if (!hitlPass) escalationReasons.push('HITL_MODE');
  if (verdict.verdict === 'ESCALATE_HUMAN') escalationReasons.push('ARBITER_ESCALATED');

  return {
    gates: {
      scope_pass: scopePass,
      out_of_scope_files: outOfScopeFiles,
      tests_pass: testsPass,
      confidence_pass: confidencePass,
      hitl_pass: hitlPass,
      threshold_used: policy.auto_merge_threshold,
      effective_confidence: effectiveConfidence,
      fallback_capped: fallbackCapped,
      can_auto_merge: canAutoMerge,
    },
    escalationReasons,
  };
}

export class CoreEngine {
  private tasks = new Map<string, TaskRecord>();
  private taskOrder: string[] = [];
  private policy: EnginePolicy = { ...DEFAULT_POLICY };
  private audit = new TamperEvidentAuditLog();
  private dlq: DlqEntry[] = [];
  private simSpeed: SimSpeed = 1;
  private simClockMs: number = BASE_SIM_EPOCH_MS;
  private nextTaskSeq = 1001;
  private nextDlqSeq = 1;
  private initialized = false;

  async initializeWithDemoData(): Promise<EngineSnapshot> {
    if (this.initialized) {
      return this.getSnapshot();
    }
    this.initialized = true;
    await this.seedInitialTasks();
    return this.getSnapshot();
  }

  async reset(): Promise<EngineSnapshot> {
    this.tasks.clear();
    this.taskOrder = [];
    this.policy = { ...DEFAULT_POLICY };
    this.audit.clear();
    this.dlq = [];
    this.simSpeed = 1;
    this.simClockMs = BASE_SIM_EPOCH_MS;
    this.nextTaskSeq = 1001;
    this.nextDlqSeq = 1;
    this.initialized = true;
    await this.seedInitialTasks();
    return this.getSnapshot();
  }

  private advanceClock(deltaMs: number): number {
    this.simClockMs += deltaMs;
    return this.simClockMs;
  }

  private allocateTaskId(): string {
    const id = `TSK-${this.nextTaskSeq}`;
    this.nextTaskSeq += 1;
    return id;
  }

  private allocateDlqId(): string {
    const id = `DLQ-${String(this.nextDlqSeq).padStart(4, '0')}`;
    this.nextDlqSeq += 1;
    return id;
  }

  private async seedInitialTasks(): Promise<void> {
    // 1. TSK-1001: Active IN_PROGRESS worker task
    await this.submitEvent({
      type: 'dispatch_task',
      repo: 'Sega757/Metacore-Hub',
      branch: 'feat/fsm-strict-guards',
      prompt: 'Enforce strict transition guards on REWORK -> HUMAN_REQUIRED overflow path and add unit tests.',
      files: ['src/metacore/fsm.py', 'tests/test_fsm_guards.py'],
    });
    this.advanceClock(9000);
    await this.submitEvent({
      type: 'worker_started',
      task_id: 'TSK-1001',
      worker_id: 'worker-alpha-01',
    });
    this.advanceClock(14000);
    await this.submitEvent({
      type: 'worker_activity',
      task_id: 'TSK-1001',
      note: 'Applying patch diff to src/metacore/fsm.py',
    });

    // 2. TSK-1002: HUMAN_REQUIRED due to Scope Violation (Arbiter gave 0.99 APPROVE, Engine blocked!)
    this.advanceClock(12000);
    await this.submitEvent({
      type: 'dispatch_task',
      repo: 'Sega757/Metacore-Hub',
      branch: 'fix/arbiter-json-parser',
      prompt: 'Harden GeminiArbiter JSON parser against malformed payloads without touching config files.',
      files: ['src/metacore/arbiter.py', 'tests/test_arbiter.py'],
    });
    this.advanceClock(6000);
    await this.submitEvent({
      type: 'worker_started',
      task_id: 'TSK-1002',
      worker_id: 'worker-beta-02',
    });
    this.advanceClock(28000);
    await this.submitEvent({
      type: 'patch_ready',
      task_id: 'TSK-1002',
      diff_files: ['src/metacore/arbiter.py', 'tests/test_arbiter.py', 'config/secrets.py'],
      tests: { passed: 19, failed: 0 },
    });
    this.advanceClock(5000);
    await this.submitEvent({
      type: 'arbiter_verdict',
      task_id: 'TSK-1002',
      verdict: 'APPROVE',
      confidence: 0.99,
      engine_source: 'GeminiArbiter',
    });

    // 3. TSK-1003: Successfully MERGED task (all evidence gates green)
    this.advanceClock(11000);
    await this.submitEvent({
      type: 'dispatch_task',
      repo: 'Sega757/Metacore-Hub',
      branch: 'feat/sha256-audit-chain',
      prompt: 'Implement deterministic canonical JSON serialization for SHA-256 append-only audit chain.',
      files: ['src/metacore/audit.py', 'tests/test_audit_chain.py'],
    });
    this.advanceClock(7000);
    await this.submitEvent({
      type: 'worker_started',
      task_id: 'TSK-1003',
      worker_id: 'worker-gamma-03',
    });
    this.advanceClock(31000);
    await this.submitEvent({
      type: 'patch_ready',
      task_id: 'TSK-1003',
      diff_files: ['src/metacore/audit.py', 'tests/test_audit_chain.py'],
      tests: { passed: 24, failed: 0 },
    });
    this.advanceClock(4000);
    await this.submitEvent({
      type: 'arbiter_verdict',
      task_id: 'TSK-1003',
      verdict: 'APPROVE',
      confidence: 0.94,
      engine_source: 'GeminiArbiter',
    });

    // Give TSK-1001 24s of elapsed watchdog time so the monitor immediately shows live telemetry
    const t1 = this.tasks.get('TSK-1001');
    if (t1) {
      t1.watchdog = {
        ...t1.watchdog,
        elapsed_sec: 24,
      };
    }

    await this.audit.verify(this.simClockMs);
  }

  private async pushDlq(
    code: DlqErrorCode,
    reason: string,
    rawPayload: unknown,
    taskId: string | null
  ): Promise<DlqEntry> {
    const now = this.advanceClock(1000);
    const entry: DlqEntry = {
      id: this.allocateDlqId(),
      timestamp: now,
      code,
      reason,
      task_id: taskId,
      raw_payload: rawPayload,
    };
    this.dlq.unshift(entry);

    await this.audit.append({
      timestamp: now,
      task_id: taskId ?? 'SYSTEM',
      event_type: `dlq.${code.toLowerCase()}`,
      state_after: taskId && this.tasks.has(taskId) ? this.tasks.get(taskId)!.state : 'NONE',
      summary: `DLQ rejected (${code}): ${reason}`,
      payload: { dlq_id: entry.id, code, reason },
    });

    return entry;
  }

  private transitionTask(
    task: TaskRecord,
    nextState: TaskState,
    eventType: string,
    note: string,
    now: number
  ): void {
    const prevState = task.state;
    task.state = nextState;
    task.version += 1;
    task.updated_at = now;
    task.history.push({
      from: prevState,
      to: nextState,
      timestamp: now,
      event_type: eventType,
      note,
    });
  }

  /**
   * Single deterministic entry point for all state-changing proposals.
   * Contract -> Lookup -> Isolation Check -> FSM Check -> Evidence Gates -> Audit Append.
   */
  async submitEvent(rawEvent: unknown): Promise<SubmitResult> {
    const contractCheck = validateEventContract(rawEvent);
    if (!contractCheck.ok) {
      const dlqEntry = await this.pushDlq(
        contractCheck.code,
        contractCheck.reason,
        rawEvent,
        contractCheck.task_id
      );
      return {
        accepted: false,
        task_id: contractCheck.task_id,
        state_after: null,
        message: contractCheck.reason,
        dlq_entry: dlqEntry,
      };
    }

    const event = contractCheck.event;
    const now = this.advanceClock(1000);

    // 1. dispatch_task creates a new task in DISPATCHED
    if (event.type === 'dispatch_task') {
      const taskId = event.task_id && !this.tasks.has(event.task_id) ? event.task_id : this.allocateTaskId();
      const newTask: TaskRecord = {
        task_id: taskId,
        version: 1,
        repo: event.repo,
        branch: event.branch,
        prompt: event.prompt,
        allowed_files: [...event.files],
        state: 'DISPATCHED',
        rework_count: 0,
        created_at: now,
        updated_at: now,
        patch: null,
        verdict: null,
        gates: null,
        escalation_reasons: [],
        watchdog: createInitialWatchdogState(now),
        history: [
          {
            from: null,
            to: 'DISPATCHED',
            timestamp: now,
            event_type: 'dispatch_task',
            note: `Dispatched on ${event.repo} @ ${event.branch} (${event.files.length} pinned files)`,
          },
        ],
      };

      this.tasks.set(taskId, newTask);
      this.taskOrder.unshift(taskId);

      await this.audit.append({
        timestamp: now,
        task_id: taskId,
        event_type: 'dispatch_task',
        state_after: 'DISPATCHED',
        summary: `Dispatched ${event.repo}@${event.branch} with ${event.files.length} pinned files`,
        payload: event,
      });

      return {
        accepted: true,
        task_id: taskId,
        state_after: 'DISPATCHED',
        message: `Task ${taskId} dispatched to FSM.`,
      };
    }

    // All other events require an existing task
    const task = this.tasks.get(event.task_id);
    if (!task) {
      const dlqEntry = await this.pushDlq(
        'TASK_NOT_FOUND',
        `Task "${event.task_id}" does not exist in CoreEngine registry.`,
        rawEvent,
        event.task_id
      );
      return {
        accepted: false,
        task_id: event.task_id,
        state_after: null,
        message: dlqEntry.reason,
        dlq_entry: dlqEntry,
      };
    }

    // Reject worker events when circuit breaker is OPEN (worker isolated until manual reset)
    if (
      task.watchdog.circuit_breaker === 'OPEN' &&
      (event.type === 'worker_started' ||
        event.type === 'worker_activity' ||
        event.type === 'patch_ready')
    ) {
      const dlqEntry = await this.pushDlq(
        'CIRCUIT_BREAKER_ISOLATED',
        `Worker for ${task.task_id} is isolated (Circuit Breaker OPEN). Manual operator reset required.`,
        rawEvent,
        task.task_id
      );
      return {
        accepted: false,
        task_id: task.task_id,
        state_after: task.state,
        message: dlqEntry.reason,
        dlq_entry: dlqEntry,
      };
    }

    switch (event.type) {
      case 'worker_started': {
        const fsmCheck = validateTransition(task.state, 'IN_PROGRESS');
        if (!fsmCheck.ok) {
          const dlqEntry = await this.pushDlq(
            'INVALID_FSM_TRANSITION',
            fsmCheck.reason,
            rawEvent,
            task.task_id
          );
          return {
            accepted: false,
            task_id: task.task_id,
            state_after: task.state,
            message: fsmCheck.reason,
            dlq_entry: dlqEntry,
          };
        }
        task.watchdog = resetWatchdogOnActivity(task.watchdog, now);
        this.transitionTask(
          task,
          'IN_PROGRESS',
          'worker_started',
          `Worker ${event.worker_id ?? 'sim-worker'} claimed task`,
          now
        );
        await this.audit.append({
          timestamp: now,
          task_id: task.task_id,
          event_type: 'worker_started',
          state_after: task.state,
          summary: `Worker started (${event.worker_id ?? 'sim-worker'}) -> IN_PROGRESS`,
          payload: event,
        });
        return {
          accepted: true,
          task_id: task.task_id,
          state_after: task.state,
          message: `Task ${task.task_id} moved to IN_PROGRESS.`,
        };
      }

      case 'worker_activity': {
        if (task.state !== 'IN_PROGRESS') {
          const dlqEntry = await this.pushDlq(
            'INVALID_FSM_TRANSITION',
            `worker_activity is only accepted in IN_PROGRESS (current state: '${task.state}').`,
            rawEvent,
            task.task_id
          );
          return {
            accepted: false,
            task_id: task.task_id,
            state_after: task.state,
            message: dlqEntry.reason,
            dlq_entry: dlqEntry,
          };
        }
        task.watchdog = resetWatchdogOnActivity(task.watchdog, now);
        task.updated_at = now;
        await this.audit.append({
          timestamp: now,
          task_id: task.task_id,
          event_type: 'worker_activity',
          state_after: task.state,
          summary: event.note
            ? `Heartbeat: ${event.note}`
            : 'Worker heartbeat received; watchdog timer reset',
          payload: event,
        });
        return {
          accepted: true,
          task_id: task.task_id,
          state_after: task.state,
          message: `Watchdog reset for ${task.task_id}.`,
        };
      }

      case 'worker_failed': {
        const fsmCheck = validateTransition(task.state, 'FAILED');
        if (!fsmCheck.ok) {
          const dlqEntry = await this.pushDlq(
            'INVALID_FSM_TRANSITION',
            fsmCheck.reason,
            rawEvent,
            task.task_id
          );
          return {
            accepted: false,
            task_id: task.task_id,
            state_after: task.state,
            message: fsmCheck.reason,
            dlq_entry: dlqEntry,
          };
        }
        this.transitionTask(
          task,
          'FAILED',
          'worker_failed',
          event.error ?? 'Worker reported fatal execution failure',
          now
        );
        await this.audit.append({
          timestamp: now,
          task_id: task.task_id,
          event_type: 'worker_failed',
          state_after: 'FAILED',
          summary: `Worker failed: ${event.error ?? 'fatal error'}`,
          payload: event,
        });
        return {
          accepted: true,
          task_id: task.task_id,
          state_after: 'FAILED',
          message: `Task ${task.task_id} marked FAILED.`,
        };
      }

      case 'cancel': {
        const fsmCheck = validateTransition(task.state, 'CANCELLED');
        if (!fsmCheck.ok) {
          const dlqEntry = await this.pushDlq(
            'INVALID_FSM_TRANSITION',
            fsmCheck.reason,
            rawEvent,
            task.task_id
          );
          return {
            accepted: false,
            task_id: task.task_id,
            state_after: task.state,
            message: fsmCheck.reason,
            dlq_entry: dlqEntry,
          };
        }
        this.transitionTask(
          task,
          'CANCELLED',
          'cancel',
          event.reason ?? 'Cancelled via control plane event',
          now
        );
        await this.audit.append({
          timestamp: now,
          task_id: task.task_id,
          event_type: 'cancel',
          state_after: 'CANCELLED',
          summary: `Task cancelled: ${event.reason ?? 'operator request'}`,
          payload: event,
        });
        return {
          accepted: true,
          task_id: task.task_id,
          state_after: 'CANCELLED',
          message: `Task ${task.task_id} cancelled.`,
        };
      }

      case 'patch_ready': {
        return this.handlePatchReady(task, event, rawEvent, now);
      }

      case 'arbiter_verdict': {
        return this.handleArbiterVerdict(task, event, rawEvent, now);
      }

      case 'human_decision': {
        return this.handleHumanDecision(task, event, rawEvent, now);
      }
    }
  }

  private async handlePatchReady(
    task: TaskRecord,
    event: PatchReadyEvent,
    rawEvent: unknown,
    now: number
  ): Promise<SubmitResult> {
    const fsmCheck = validateTransition(task.state, 'ARBITER_VALIDATING');
    if (!fsmCheck.ok) {
      const dlqEntry = await this.pushDlq(
        'INVALID_FSM_TRANSITION',
        fsmCheck.reason,
        rawEvent,
        task.task_id
      );
      return {
        accepted: false,
        task_id: task.task_id,
        state_after: task.state,
        message: fsmCheck.reason,
        dlq_entry: dlqEntry,
      };
    }

    task.watchdog = resetWatchdogOnActivity(task.watchdog, now);
    task.patch = {
      diff_files: [...event.diff_files],
      tests: { ...event.tests },
      submitted_at: now,
    };
    task.verdict = null;
    task.gates = null;
    task.escalation_reasons = [];

    this.transitionTask(
      task,
      'ARBITER_VALIDATING',
      'patch_ready',
      `Patch submitted (${event.diff_files.length} files, tests ${event.tests.passed} passed / ${event.tests.failed} failed)`,
      now
    );

    await this.audit.append({
      timestamp: now,
      task_id: task.task_id,
      event_type: 'patch_ready',
      state_after: 'ARBITER_VALIDATING',
      summary: `Patch ready: ${event.diff_files.length} files, tests ${event.tests.passed}/${event.tests.failed}`,
      payload: event,
    });

    return {
      accepted: true,
      task_id: task.task_id,
      state_after: 'ARBITER_VALIDATING',
      message: `Patch accepted for ${task.task_id}; awaiting arbiter verdict.`,
    };
  }

  private async handleArbiterVerdict(
    task: TaskRecord,
    event: ArbiterVerdictEvent,
    rawEvent: unknown,
    now: number
  ): Promise<SubmitResult> {
    if (task.state !== 'ARBITER_VALIDATING') {
      const dlqEntry = await this.pushDlq(
        'INVALID_FSM_TRANSITION',
        `arbiter_verdict requires state 'ARBITER_VALIDATING' (current: '${task.state}').`,
        rawEvent,
        task.task_id
      );
      return {
        accepted: false,
        task_id: task.task_id,
        state_after: task.state,
        message: dlqEntry.reason,
        dlq_entry: dlqEntry,
      };
    }

    const { gates, escalationReasons } = evaluateMergeGates(task, event, this.policy);

    task.verdict = {
      verdict: event.verdict,
      confidence: gates.effective_confidence,
      raw_confidence: event.raw_confidence ?? event.confidence,
      engine_source: event.engine_source,
      rework_instructions: event.rework_instructions,
      fallback_reason: event.fallback_reason,
      decided_at: now,
    };
    task.gates = gates;

    let targetState: TaskState;
    let summaryNote: string;
    let finalReasons: EscalationReason[] = [];

    if (event.verdict === 'APPROVE') {
      if (gates.can_auto_merge) {
        targetState = 'MERGED';
        summaryNote = `All evidence gates passed (conf ${gates.effective_confidence.toFixed(2)} >= ${this.policy.auto_merge_threshold.toFixed(2)}) -> MERGED`;
      } else {
        targetState = 'HUMAN_REQUIRED';
        finalReasons = escalationReasons;
        summaryNote = `CoreEngine blocked auto-merge despite APPROVE (${finalReasons.join(', ')}) -> HUMAN_REQUIRED`;
      }
    } else if (event.verdict === 'REWORK') {
      const nextReworkCount = task.rework_count + 1;
      if (nextReworkCount > this.policy.max_rework) {
        task.rework_count = nextReworkCount;
        targetState = 'HUMAN_REQUIRED';
        finalReasons = ['MAX_REWORK_EXCEEDED'];
        summaryNote = `Rework overflow (${nextReworkCount}/${this.policy.max_rework}) -> forced HUMAN_REQUIRED`;
      } else {
        task.rework_count = nextReworkCount;
        targetState = 'REWORK';
        summaryNote = `Arbiter requested REWORK (${nextReworkCount}/${this.policy.max_rework}): ${event.rework_instructions ?? ''}`;
      }
    } else {
      targetState = 'HUMAN_REQUIRED';
      finalReasons = escalationReasons.includes('ARBITER_ESCALATED')
        ? escalationReasons
        : ['ARBITER_ESCALATED', ...escalationReasons];
      summaryNote = `Arbiter escalated to human operator -> HUMAN_REQUIRED`;
    }

    const fsmCheck = validateTransition(task.state, targetState);
    if (!fsmCheck.ok) {
      const dlqEntry = await this.pushDlq(
        'INVALID_FSM_TRANSITION',
        fsmCheck.reason,
        rawEvent,
        task.task_id
      );
      return {
        accepted: false,
        task_id: task.task_id,
        state_after: task.state,
        message: fsmCheck.reason,
        dlq_entry: dlqEntry,
      };
    }

    task.escalation_reasons = finalReasons;
    this.transitionTask(task, targetState, 'arbiter_verdict', summaryNote, now);

    await this.audit.append({
      timestamp: now,
      task_id: task.task_id,
      event_type: 'arbiter_verdict',
      state_after: targetState,
      summary: summaryNote,
      payload: {
        verdict: event.verdict,
        engine_source: event.engine_source,
        effective_confidence: gates.effective_confidence,
        can_auto_merge: gates.can_auto_merge,
        escalation_reasons: finalReasons,
      },
    });

    return {
      accepted: true,
      task_id: task.task_id,
      state_after: targetState,
      message: summaryNote,
    };
  }

  private async handleHumanDecision(
    task: TaskRecord,
    event: HumanDecisionEvent,
    rawEvent: unknown,
    now: number
  ): Promise<SubmitResult> {
    if (task.state !== 'HUMAN_REQUIRED') {
      const dlqEntry = await this.pushDlq(
        'INVALID_FSM_TRANSITION',
        `human_decision is only valid when task is in 'HUMAN_REQUIRED' (current: '${task.state}').`,
        rawEvent,
        task.task_id
      );
      return {
        accepted: false,
        task_id: task.task_id,
        state_after: task.state,
        message: dlqEntry.reason,
        dlq_entry: dlqEntry,
      };
    }

    // TOCTOU / Optimistic concurrency version guard
    if (event.expected_version !== task.version) {
      const dlqEntry = await this.pushDlq(
        'TOCTOU_VERSION_MISMATCH',
        `TOCTOU guard rejected human_decision: expected_version=${event.expected_version}, actual task version=${task.version}.`,
        rawEvent,
        task.task_id
      );
      return {
        accepted: false,
        task_id: task.task_id,
        state_after: task.state,
        message: dlqEntry.reason,
        dlq_entry: dlqEntry,
      };
    }

    const targetMap: Record<HumanDecisionEvent['decision'], TaskState> = {
      APPROVE: 'MERGED',
      REWORK: 'IN_PROGRESS',
      CANCEL: 'CANCELLED',
    };
    const targetState = targetMap[event.decision];

    const fsmCheck = validateTransition(task.state, targetState);
    if (!fsmCheck.ok) {
      const dlqEntry = await this.pushDlq(
        'INVALID_FSM_TRANSITION',
        fsmCheck.reason,
        rawEvent,
        task.task_id
      );
      return {
        accepted: false,
        task_id: task.task_id,
        state_after: task.state,
        message: fsmCheck.reason,
        dlq_entry: dlqEntry,
      };
    }

    if (event.decision === 'REWORK') {
      task.rework_count += 1;
      task.watchdog = resetCircuitBreaker(task.watchdog, now);
      if (task.verdict) {
        task.verdict = {
          ...task.verdict,
          rework_instructions: event.note ?? task.verdict.rework_instructions,
        };
      }
    }

    task.last_human_note = event.note;
    if (event.decision === 'APPROVE' || event.decision === 'CANCEL') {
      task.escalation_reasons = [];
    }

    const noteText =
      event.decision === 'APPROVE'
        ? `HITL Operator approved & merged (v${event.expected_version})${event.note ? `: ${event.note}` : ''}`
        : event.decision === 'REWORK'
          ? `HITL Operator requested rework (v${event.expected_version}): ${event.note ?? 'Rework requested'}`
          : `HITL Operator cancelled task (v${event.expected_version})${event.note ? `: ${event.note}` : ''}`;

    this.transitionTask(task, targetState, 'human_decision', noteText, now);

    await this.audit.append({
      timestamp: now,
      task_id: task.task_id,
      event_type: 'human_decision',
      state_after: targetState,
      summary: noteText,
      payload: event,
    });

    return {
      accepted: true,
      task_id: task.task_id,
      state_after: targetState,
      message: noteText,
    };
  }

  async updatePolicy(patch: Partial<EnginePolicy>): Promise<EngineSnapshot> {
    const nextPolicy: EnginePolicy = {
      auto_merge_threshold:
        patch.auto_merge_threshold !== undefined
          ? Math.min(0.99, Math.max(0.5, Math.round(patch.auto_merge_threshold * 100) / 100))
          : this.policy.auto_merge_threshold,
      max_rework:
        patch.max_rework !== undefined
          ? Math.min(10, Math.max(1, Math.round(patch.max_rework)))
          : this.policy.max_rework,
      hitl_mode: patch.hitl_mode !== undefined ? Boolean(patch.hitl_mode) : this.policy.hitl_mode,
      stall_timeout_sec:
        patch.stall_timeout_sec !== undefined
          ? Math.min(600, Math.max(15, Math.round(patch.stall_timeout_sec)))
          : this.policy.stall_timeout_sec,
    };

    this.policy = nextPolicy;
    const now = this.advanceClock(500);

    await this.audit.append({
      timestamp: now,
      task_id: 'POLICY',
      event_type: 'policy_updated',
      state_after: 'NONE',
      summary: `Policy updated: threshold=${nextPolicy.auto_merge_threshold.toFixed(2)}, max_rework=${nextPolicy.max_rework}, hitl=${nextPolicy.hitl_mode ? 'ON' : 'OFF'}, stall=${nextPolicy.stall_timeout_sec}s`,
      payload: nextPolicy,
    });

    return this.getSnapshot();
  }

  setSimSpeed(speed: SimSpeed): void {
    this.simSpeed = speed;
  }

  /**
   * Advances Watchdog timers for all active (IN_PROGRESS / REWORK) tasks.
   */
  async tickWatchdog(deltaRealSec: number): Promise<boolean> {
    const scaledDelta = deltaRealSec * this.simSpeed;
    if (scaledDelta <= 0) return false;

    const now = this.advanceClock(Math.round(scaledDelta * 1000));
    let changed = false;

    for (const taskId of this.taskOrder) {
      const task = this.tasks.get(taskId);
      if (!task) continue;
      if (task.state !== 'IN_PROGRESS' && task.state !== 'REWORK') continue;
      if (task.watchdog.circuit_breaker === 'OPEN') continue;

      const tick = advanceWatchdog(task.watchdog, scaledDelta, this.policy, now);
      task.watchdog = tick.next;
      changed = true;

      if (tick.emittedEvent === 'NUDGE_L1') {
        await this.audit.append({
          timestamp: now,
          task_id: task.task_id,
          event_type: 'watchdog.nudge_l1',
          state_after: task.state,
          summary: `Watchdog Nudge L1 (Continue) emitted after ${Math.round(tick.next.elapsed_sec)}s idle`,
          payload: { task_id: task.task_id, nudge: 1, elapsed_sec: tick.next.elapsed_sec },
        });
      } else if (tick.emittedEvent === 'NUDGE_L2') {
        await this.audit.append({
          timestamp: now,
          task_id: task.task_id,
          event_type: 'watchdog.nudge_l2',
          state_after: task.state,
          summary: `Watchdog Nudge L2 (Diagnostic) emitted after ${Math.round(tick.next.elapsed_sec)}s idle`,
          payload: { task_id: task.task_id, nudge: 2, elapsed_sec: tick.next.elapsed_sec },
        });
      } else if (tick.emittedEvent === 'CIRCUIT_OPEN') {
        // Honor strict FSM table: REWORK -> HUMAN_REQUIRED, IN_PROGRESS -> FAILED
        const targetState: TaskState = task.state === 'REWORK' ? 'HUMAN_REQUIRED' : 'FAILED';
        task.escalation_reasons = Array.from(
          new Set<EscalationReason>([...task.escalation_reasons, 'CIRCUIT_BREAKER_OPEN'])
        );
        this.transitionTask(
          task,
          targetState,
          'watchdog.circuit_open',
          `Circuit Breaker OPEN after 2 unanswered nudges (${Math.round(tick.next.elapsed_sec)}s stall). Worker isolated.`,
          now
        );
        await this.audit.append({
          timestamp: now,
          task_id: task.task_id,
          event_type: 'watchdog.circuit_open',
          state_after: targetState,
          summary: `Circuit Breaker OPEN -> ${targetState}; worker isolated until manual reset`,
          payload: { task_id: task.task_id, elapsed_sec: tick.next.elapsed_sec, target: targetState },
        });
      }
    }

    return changed;
  }

  async resetWatchdogBreaker(taskId: string): Promise<EngineSnapshot> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return this.getSnapshot();
    }
    const now = this.advanceClock(1000);
    task.watchdog = resetCircuitBreaker(task.watchdog, now);
    task.escalation_reasons = task.escalation_reasons.filter((r) => r !== 'CIRCUIT_BREAKER_OPEN');
    task.updated_at = now;

    await this.audit.append({
      timestamp: now,
      task_id: task.task_id,
      event_type: 'watchdog.breaker_reset',
      state_after: task.state,
      summary: `Operator manually reset Circuit Breaker -> CLOSED for ${task.task_id}`,
      payload: { task_id: task.task_id },
    });

    return this.getSnapshot();
  }

  async verifyAuditChain(): Promise<AuditVerificationResult> {
    const now = this.advanceClock(250);
    return this.audit.verify(now);
  }

  async simulateAuditTamper(targetIndex?: number): Promise<{ tamperedIndex: number | null; snapshot: EngineSnapshot }> {
    const tamperedIndex = this.audit.simulateTamper(targetIndex);
    return {
      tamperedIndex,
      snapshot: this.getSnapshot(),
    };
  }

  /**
   * 6 Deterministic Chaos & Verification Lab runners.
   */
  async runChaosScenario(
    scenario: ChaosScenarioId,
    selectedTaskId?: string
  ): Promise<ChaosRunResult> {
    const selected = selectedTaskId ? this.tasks.get(selectedTaskId) : undefined;
    const canReuseSelected =
      selected &&
      !isTerminalState(selected.state) &&
      selected.watchdog.circuit_breaker === 'CLOSED' &&
      (selected.state === 'DISPATCHED' || selected.state === 'IN_PROGRESS');

    switch (scenario) {
      case 'HAPPY_PATH': {
        let taskId: string;
        let steps = 0;

        if (canReuseSelected && selected) {
          taskId = selected.task_id;
          if (selected.state === 'DISPATCHED') {
            await this.submitEvent({
              type: 'worker_started',
              task_id: taskId,
              worker_id: 'worker-chaos-happy',
            });
            steps += 1;
          }
        } else {
          const disp = await this.submitEvent({
            type: 'dispatch_task',
            repo: 'Sega757/Metacore-Hub',
            branch: `feat/happy-path-${this.nextTaskSeq}`,
            prompt: 'Add deterministic retry jitter guard inside allowed scope with full unit test coverage.',
            files: ['src/metacore/retry.py', 'tests/test_retry.py'],
          });
          taskId = disp.task_id!;
          steps += 1;
          await this.submitEvent({
            type: 'worker_started',
            task_id: taskId,
            worker_id: 'worker-chaos-happy',
          });
          steps += 1;
        }

        const task = this.tasks.get(taskId)!;
        await this.submitEvent({
          type: 'patch_ready',
          task_id: taskId,
          diff_files: [...task.allowed_files],
          tests: { passed: 22, failed: 0 },
        });
        steps += 1;

        const verdictRes = await this.submitEvent({
          type: 'arbiter_verdict',
          task_id: taskId,
          verdict: 'APPROVE',
          confidence: 0.94,
          engine_source: 'GeminiArbiter',
        });
        steps += 1;

        return {
          scenario,
          task_id: taskId,
          outcome:
            verdictRes.state_after === 'MERGED'
              ? `${taskId} passed all evidence gates (conf 0.94) -> MERGED`
              : `${taskId} held in ${verdictRes.state_after} by active policy (${verdictRes.message})`,
          steps_executed: steps,
          timestamp: this.simClockMs,
        };
      }

      case 'SCOPE_ESCAPE': {
        let taskId: string;
        let steps = 0;

        if (canReuseSelected && selected) {
          taskId = selected.task_id;
          if (selected.state === 'DISPATCHED') {
            await this.submitEvent({
              type: 'worker_started',
              task_id: taskId,
              worker_id: 'worker-rogue-09',
            });
            steps += 1;
          }
        } else {
          const disp = await this.submitEvent({
            type: 'dispatch_task',
            repo: 'Sega757/Metacore-Hub',
            branch: `fix/scope-escape-${this.nextTaskSeq}`,
            prompt: 'Refactor session TTL validator inside src/auth/session.py only.',
            files: ['src/auth/session.py', 'tests/test_session.py'],
          });
          taskId = disp.task_id!;
          steps += 1;
          await this.submitEvent({
            type: 'worker_started',
            task_id: taskId,
            worker_id: 'worker-rogue-09',
          });
          steps += 1;
        }

        const task = this.tasks.get(taskId)!;
        await this.submitEvent({
          type: 'patch_ready',
          task_id: taskId,
          diff_files: [...task.allowed_files, 'config/secrets.py'],
          tests: { passed: 16, failed: 0 },
        });
        steps += 1;

        await this.submitEvent({
          type: 'arbiter_verdict',
          task_id: taskId,
          verdict: 'APPROVE',
          confidence: 0.99,
          engine_source: 'GeminiArbiter',
        });
        steps += 1;

        return {
          scenario,
          task_id: taskId,
          outcome: `BLOCKED 0.99 APPROVE on ${taskId}: config/secrets.py violated Scope Pinning -> HUMAN_REQUIRED`,
          steps_executed: steps,
          timestamp: this.simClockMs,
        };
      }

      case 'GEMINI_FALLBACK': {
        let taskId: string;
        let steps = 0;

        if (canReuseSelected && selected) {
          taskId = selected.task_id;
          if (selected.state === 'DISPATCHED') {
            await this.submitEvent({
              type: 'worker_started',
              task_id: taskId,
              worker_id: 'worker-fallback-04',
            });
            steps += 1;
          }
        } else {
          const disp = await this.submitEvent({
            type: 'dispatch_task',
            repo: 'Sega757/Metacore-Hub',
            branch: `feat/arbiter-fallback-${this.nextTaskSeq}`,
            prompt: 'Optimize token budget estimator in arbiter client.',
            files: ['src/metacore/budget.py', 'tests/test_budget.py'],
          });
          taskId = disp.task_id!;
          steps += 1;
          await this.submitEvent({
            type: 'worker_started',
            task_id: taskId,
            worker_id: 'worker-fallback-04',
          });
          steps += 1;
        }

        const task = this.tasks.get(taskId)!;
        await this.submitEvent({
          type: 'patch_ready',
          task_id: taskId,
          diff_files: [...task.allowed_files],
          tests: { passed: 14, failed: 0 },
        });
        steps += 1;

        // First log the malformed Gemini JSON rejection in DLQ to show exact contract defense
        await this.submitEvent({
          type: 'arbiter_verdict',
          task_id: taskId,
          verdict: 'APPROVE',
          confidence: 'MALFORMED_NAN_JSON',
          engine_source: 'GeminiArbiter',
        });
        steps += 1;

        // CoreEngine deterministically invokes FallbackRules and caps confidence at 0.80
        const fallbackRes = await this.submitEvent({
          type: 'arbiter_verdict',
          task_id: taskId,
          verdict: 'APPROVE',
          confidence: 0.95,
          raw_confidence: 0.95,
          engine_source: 'FallbackRules',
          fallback_reason:
            'GeminiArbiter returned malformed JSON; fell back to RuleBasedArbiter with strict 0.80 confidence cap.',
        });
        steps += 1;

        return {
          scenario,
          task_id: taskId,
          outcome: `Gemini JSON fault -> FallbackRules capped confidence 0.95 -> 0.80 -> ${fallbackRes.state_after}`,
          steps_executed: steps,
          timestamp: this.simClockMs,
        };
      }

      case 'REWORK_OVERFLOW': {
        let taskId: string;
        let steps = 0;

        if (canReuseSelected && selected) {
          taskId = selected.task_id;
          if (selected.state === 'DISPATCHED') {
            await this.submitEvent({
              type: 'worker_started',
              task_id: taskId,
              worker_id: 'worker-loop-07',
            });
            steps += 1;
          }
        } else {
          const disp = await this.submitEvent({
            type: 'dispatch_task',
            repo: 'Sega757/Metacore-Hub',
            branch: `fix/rework-overflow-${this.nextTaskSeq}`,
            prompt: 'Fix edge-case deadlock in async queue consumer.',
            files: ['src/metacore/queue.py', 'tests/test_queue.py'],
          });
          taskId = disp.task_id!;
          steps += 1;
          await this.submitEvent({
            type: 'worker_started',
            task_id: taskId,
            worker_id: 'worker-loop-07',
          });
          steps += 1;
        }

        const task = this.tasks.get(taskId)!;
        const cyclesNeeded = Math.max(1, this.policy.max_rework - task.rework_count + 1);

        for (let i = 1; i <= cyclesNeeded; i++) {
          const currentTask = this.tasks.get(taskId)!;
          if (currentTask.state === 'REWORK') {
            await this.submitEvent({
              type: 'worker_started',
              task_id: taskId,
              worker_id: 'worker-loop-07',
            });
            steps += 1;
          }
          await this.submitEvent({
            type: 'patch_ready',
            task_id: taskId,
            diff_files: [...currentTask.allowed_files],
            tests: { passed: 11, failed: 2 },
          });
          steps += 1;
          await this.submitEvent({
            type: 'arbiter_verdict',
            task_id: taskId,
            verdict: 'REWORK',
            confidence: 0.62,
            engine_source: 'RuleBasedArbiter',
            rework_instructions: `Rework cycle #${i}: 2 queue concurrency tests still failing; release lock before await.`,
          });
          steps += 1;
        }

        const finalTask = this.tasks.get(taskId)!;
        return {
          scenario,
          task_id: taskId,
          outcome: `Rework limit exceeded (${finalTask.rework_count}/${this.policy.max_rework}) on ${taskId} -> forced HUMAN_REQUIRED`,
          steps_executed: steps,
          timestamp: this.simClockMs,
        };
      }

      case 'WATCHDOG_STALL': {
        let taskId: string;
        let steps = 0;

        if (canReuseSelected && selected) {
          taskId = selected.task_id;
          if (selected.state === 'DISPATCHED') {
            await this.submitEvent({
              type: 'worker_started',
              task_id: taskId,
              worker_id: 'worker-stalled-05',
            });
            steps += 1;
          }
        } else {
          const disp = await this.submitEvent({
            type: 'dispatch_task',
            repo: 'Sega757/Metacore-Hub',
            branch: `feat/watchdog-stall-${this.nextTaskSeq}`,
            prompt: 'Run static graph verification over workflow DAG definitions.',
            files: ['src/metacore/dag.py', 'tests/test_dag.py'],
          });
          taskId = disp.task_id!;
          steps += 1;
          await this.submitEvent({
            type: 'worker_started',
            task_id: taskId,
            worker_id: 'worker-stalled-05',
          });
          steps += 1;
        }

        const task = this.tasks.get(taskId)!;
        const timeout = this.policy.stall_timeout_sec;
        const originalSpeed = this.simSpeed;
        this.simSpeed = 1;

        // Step deterministically through L1 -> L2 -> Circuit Breaker OPEN
        const stepDelays = [
          Math.max(1, timeout - task.watchdog.elapsed_sec + 2),
          timeout,
          timeout,
        ];
        for (const sec of stepDelays) {
          if (task.watchdog.circuit_breaker === 'OPEN') break;
          await this.tickWatchdog(sec);
          steps += 1;
        }
        this.simSpeed = originalSpeed;

        return {
          scenario,
          task_id: taskId,
          outcome: `Watchdog escalated ${taskId}: Nudge L1 -> Nudge L2 -> Circuit Breaker OPEN (${task.state})`,
          steps_executed: steps,
          timestamp: this.simClockMs,
        };
      }

      case 'INJECT_INVALID_DLQ': {
        // 1. Protected branch attack ("main")
        await this.submitEvent({
          type: 'dispatch_task',
          repo: 'Sega757/Metacore-Hub',
          branch: 'main',
          prompt: 'Direct hotfix commit to main branch',
          files: ['src/metacore/engine.py'],
        });

        // 2. Illegal FSM transition or schema-violating arbiter verdict
        const targetId = selectedTaskId ?? this.taskOrder[0] ?? 'TSK-1003';
        await this.submitEvent({
          type: 'arbiter_verdict',
          task_id: targetId,
          verdict: 'REWORK',
          confidence: 1.45,
          engine_source: 'GeminiArbiter',
        });

        return {
          scenario,
          task_id: targetId,
          outcome: `Injected 2 hostile payloads (branch 'main' + invalid verdict schema) -> captured in engine.dlq; 0 FSM mutations`,
          steps_executed: 2,
          timestamp: this.simClockMs,
        };
      }
    }
  }

  getSnapshot(
    transportMode: 'SIMULATION' | 'DAEMON' = 'SIMULATION',
    daemonUrl = 'http://127.0.0.1:8787'
  ): EngineSnapshot {
    const orderedTasks = this.taskOrder
      .map((id) => this.tasks.get(id))
      .filter((t): t is TaskRecord => t !== undefined)
      .map((t) => ({
        ...t,
        allowed_files: [...t.allowed_files],
        escalation_reasons: [...t.escalation_reasons],
        watchdog: { ...t.watchdog },
        patch: t.patch
          ? {
              ...t.patch,
              diff_files: [...t.patch.diff_files],
              tests: { ...t.patch.tests },
            }
          : null,
        verdict: t.verdict ? { ...t.verdict } : null,
        gates: t.gates
          ? {
              ...t.gates,
              out_of_scope_files: [...t.gates.out_of_scope_files],
            }
          : null,
        history: t.history.map((h) => ({ ...h })),
      }));

    return {
      tasks: orderedTasks,
      policy: { ...this.policy },
      audit: this.audit.getEntries(),
      audit_verification: this.audit.getLastVerification(),
      dlq: this.dlq.map((d) => ({ ...d })),
      sim_speed: this.simSpeed,
      sim_clock_ms: this.simClockMs,
      transport_mode: transportMode,
      daemon_url: daemonUrl,
    };
  }
}
