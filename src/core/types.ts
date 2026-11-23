export type TaskState =
  | 'DISPATCHED'
  | 'IN_PROGRESS'
  | 'ARBITER_VALIDATING'
  | 'REWORK'
  | 'HUMAN_REQUIRED'
  | 'MERGED'
  | 'FAILED'
  | 'CANCELLED';

export type ArbiterSource = 'RuleBasedArbiter' | 'GeminiArbiter' | 'FallbackRules';
export type ArbiterVerdictValue = 'APPROVE' | 'REWORK' | 'ESCALATE_HUMAN';
export type HumanDecisionValue = 'APPROVE' | 'REWORK' | 'CANCEL';
export type SimSpeed = 1 | 10 | 60;

export interface EnginePolicy {
  auto_merge_threshold: number;
  max_rework: number;
  hitl_mode: boolean;
  stall_timeout_sec: number;
}

export interface TestSuiteEvidence {
  passed: number;
  failed: number;
}

export interface DispatchTaskEvent {
  type: 'dispatch_task';
  task_id?: string;
  repo: string;
  branch: string;
  prompt: string;
  files: string[];
}

export interface WorkerStartedEvent {
  type: 'worker_started';
  task_id: string;
  worker_id?: string;
}

export interface WorkerActivityEvent {
  type: 'worker_activity';
  task_id: string;
  note?: string;
}

export interface WorkerFailedEvent {
  type: 'worker_failed';
  task_id: string;
  error?: string;
}

export interface CancelEvent {
  type: 'cancel';
  task_id: string;
  reason?: string;
}

export interface PatchReadyEvent {
  type: 'patch_ready';
  task_id: string;
  diff_files: string[];
  tests: TestSuiteEvidence;
}

export interface ArbiterVerdictEvent {
  type: 'arbiter_verdict';
  task_id: string;
  verdict: ArbiterVerdictValue;
  confidence: number;
  rework_instructions?: string;
  engine_source: ArbiterSource;
  raw_confidence?: number;
  fallback_reason?: string;
}

export interface HumanDecisionEvent {
  type: 'human_decision';
  task_id: string;
  decision: HumanDecisionValue;
  expected_version: number;
  note?: string;
}

export type EngineEvent =
  | DispatchTaskEvent
  | WorkerStartedEvent
  | WorkerActivityEvent
  | WorkerFailedEvent
  | CancelEvent
  | PatchReadyEvent
  | ArbiterVerdictEvent
  | HumanDecisionEvent;

export type EscalationReason =
  | 'SCOPE_VIOLATION'
  | 'TEST_FAILURE'
  | 'LOW_CONFIDENCE'
  | 'HITL_MODE'
  | 'MAX_REWORK_EXCEEDED'
  | 'ARBITER_FALLBACK'
  | 'ARBITER_ESCALATED'
  | 'CIRCUIT_BREAKER_OPEN';

export interface GateEvaluation {
  scope_pass: boolean;
  out_of_scope_files: string[];
  tests_pass: boolean;
  confidence_pass: boolean;
  hitl_pass: boolean;
  threshold_used: number;
  effective_confidence: number;
  fallback_capped: boolean;
  can_auto_merge: boolean;
}

export type WatchdogStatus = 'HEALTHY' | 'NUDGE_L1' | 'NUDGE_L2' | 'CIRCUIT_OPEN';

export interface WatchdogState {
  status: WatchdogStatus;
  elapsed_sec: number;
  nudge_count: number;
  max_nudges: number;
  circuit_breaker: 'CLOSED' | 'OPEN';
  last_activity_at: number;
  last_nudge_at: number | null;
}

export interface StateTransitionRecord {
  from: TaskState | null;
  to: TaskState;
  timestamp: number;
  event_type: string;
  note: string;
}

export interface TaskPatchSnapshot {
  diff_files: string[];
  tests: TestSuiteEvidence;
  submitted_at: number;
}

export interface TaskVerdictSnapshot {
  verdict: ArbiterVerdictValue;
  confidence: number;
  raw_confidence: number;
  engine_source: ArbiterSource;
  rework_instructions?: string;
  fallback_reason?: string;
  decided_at: number;
}

export interface TaskRecord {
  task_id: string;
  version: number;
  repo: string;
  branch: string;
  prompt: string;
  allowed_files: string[];
  state: TaskState;
  rework_count: number;
  created_at: number;
  updated_at: number;
  patch: TaskPatchSnapshot | null;
  verdict: TaskVerdictSnapshot | null;
  gates: GateEvaluation | null;
  escalation_reasons: EscalationReason[];
  watchdog: WatchdogState;
  history: StateTransitionRecord[];
  last_human_note?: string;
}

export interface AuditEntry {
  index: number;
  timestamp: number;
  task_id: string;
  event_type: string;
  state_after: TaskState | 'NONE';
  summary: string;
  payload_digest: string;
  prev_hash: string;
  hash: string;
  tampered_marker?: boolean;
}

export interface AuditVerificationResult {
  valid: boolean;
  total: number;
  first_broken_index: number | null;
  expected_hash: string | null;
  actual_hash: string | null;
  verified_at: number;
}

export type DlqErrorCode =
  | 'SCHEMA_INVALID'
  | 'FORBIDDEN_BRANCH'
  | 'INVALID_FSM_TRANSITION'
  | 'TASK_NOT_FOUND'
  | 'TOCTOU_VERSION_MISMATCH'
  | 'CIRCUIT_BREAKER_ISOLATED';

export interface DlqEntry {
  id: string;
  timestamp: number;
  code: DlqErrorCode;
  reason: string;
  task_id: string | null;
  raw_payload: unknown;
}

export type ChaosScenarioId =
  | 'HAPPY_PATH'
  | 'SCOPE_ESCAPE'
  | 'GEMINI_FALLBACK'
  | 'REWORK_OVERFLOW'
  | 'WATCHDOG_STALL'
  | 'INJECT_INVALID_DLQ';

export interface SubmitResult {
  accepted: boolean;
  task_id: string | null;
  state_after: TaskState | null;
  message: string;
  dlq_entry?: DlqEntry;
}

export interface ChaosRunResult {
  scenario: ChaosScenarioId;
  task_id: string | null;
  outcome: string;
  steps_executed: number;
  timestamp: number;
}

export interface EngineSnapshot {
  tasks: TaskRecord[];
  policy: EnginePolicy;
  audit: AuditEntry[];
  audit_verification: AuditVerificationResult;
  dlq: DlqEntry[];
  sim_speed: SimSpeed;
  sim_clock_ms: number;
  transport_mode: 'SIMULATION' | 'DAEMON';
  daemon_url: string;
}
