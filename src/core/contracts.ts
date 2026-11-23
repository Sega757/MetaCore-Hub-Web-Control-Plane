import type {
  ArbiterSource,
  ArbiterVerdictValue,
  DlqErrorCode,
  EngineEvent,
  HumanDecisionValue,
} from './types';

export const FORBIDDEN_BRANCHES = new Set(['main', 'master', 'refs/heads/main', 'refs/heads/master']);

const VALID_ARBITER_VERDICTS = new Set<ArbiterVerdictValue>([
  'APPROVE',
  'REWORK',
  'ESCALATE_HUMAN',
]);

const VALID_ARBITER_SOURCES = new Set<ArbiterSource>([
  'RuleBasedArbiter',
  'GeminiArbiter',
  'FallbackRules',
]);

const VALID_HUMAN_DECISIONS = new Set<HumanDecisionValue>(['APPROVE', 'REWORK', 'CANCEL']);

export type ContractValidationResult =
  | { ok: true; event: EngineEvent }
  | { ok: false; code: DlqErrorCode; reason: string; task_id: string | null };

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function isSafeRepoPath(file: string): boolean {
  const trimmed = file.trim();
  if (!trimmed || trimmed.startsWith('/') || trimmed.includes('..') || trimmed.includes('\\')) {
    return false;
  }
  return true;
}

export function isForbiddenBranch(branch: string): boolean {
  return FORBIDDEN_BRANCHES.has(branch.trim().toLowerCase());
}

/**
 * Strict JSON Schema Draft 2020-12 equivalent runtime contract validator.
 * Any violation is rejected prior to FSM mutation and routed to engine.dlq.
 */
export function validateEventContract(raw: unknown): ContractValidationResult {
  if (!isRecord(raw)) {
    return {
      ok: false,
      code: 'SCHEMA_INVALID',
      reason: 'Event payload must be a JSON object.',
      task_id: null,
    };
  }

  const eventType = raw.type;
  const rawTaskId = typeof raw.task_id === 'string' && raw.task_id.trim() ? raw.task_id.trim() : null;

  if (!isNonEmptyString(eventType)) {
    return {
      ok: false,
      code: 'SCHEMA_INVALID',
      reason: 'Missing or invalid required field "type" (must be non-empty string).',
      task_id: rawTaskId,
    };
  }

  switch (eventType) {
    case 'dispatch_task': {
      if (!isNonEmptyString(raw.repo)) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: 'dispatch_task.repo must be a non-empty string.',
          task_id: rawTaskId,
        };
      }
      if (!isNonEmptyString(raw.branch)) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: 'dispatch_task.branch must be a non-empty string.',
          task_id: rawTaskId,
        };
      }
      const normalizedBranch = raw.branch.trim();
      if (isForbiddenBranch(normalizedBranch)) {
        return {
          ok: false,
          code: 'FORBIDDEN_BRANCH',
          reason: `Protected branch guard: dispatching tasks directly against '${normalizedBranch}' is strictly forbidden.`,
          task_id: rawTaskId,
        };
      }
      if (!isNonEmptyString(raw.prompt)) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: 'dispatch_task.prompt must be a non-empty string.',
          task_id: rawTaskId,
        };
      }
      if (!Array.isArray(raw.files) || raw.files.length === 0) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: 'dispatch_task.files must be a non-empty array of allowed file paths (Scope Pinning).',
          task_id: rawTaskId,
        };
      }
      const cleanedFiles: string[] = [];
      for (const f of raw.files) {
        if (!isNonEmptyString(f) || !isSafeRepoPath(f)) {
          return {
            ok: false,
            code: 'SCHEMA_INVALID',
            reason: `dispatch_task.files contains invalid or unsafe path "${String(f)}".`,
            task_id: rawTaskId,
          };
        }
        const trimmed = f.trim();
        if (!cleanedFiles.includes(trimmed)) {
          cleanedFiles.push(trimmed);
        }
      }
      return {
        ok: true,
        event: {
          type: 'dispatch_task',
          task_id: rawTaskId ?? undefined,
          repo: raw.repo.trim(),
          branch: normalizedBranch,
          prompt: raw.prompt.trim(),
          files: cleanedFiles,
        },
      };
    }

    case 'worker_started':
    case 'worker_activity':
    case 'worker_failed':
    case 'cancel': {
      if (!rawTaskId) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: `${eventType}.task_id must be a non-empty string.`,
          task_id: null,
        };
      }
      if (eventType === 'worker_started') {
        return {
          ok: true,
          event: {
            type: 'worker_started',
            task_id: rawTaskId,
            worker_id: typeof raw.worker_id === 'string' ? raw.worker_id.trim() : undefined,
          },
        };
      }
      if (eventType === 'worker_activity') {
        return {
          ok: true,
          event: {
            type: 'worker_activity',
            task_id: rawTaskId,
            note: typeof raw.note === 'string' ? raw.note.trim() : undefined,
          },
        };
      }
      if (eventType === 'worker_failed') {
        return {
          ok: true,
          event: {
            type: 'worker_failed',
            task_id: rawTaskId,
            error: typeof raw.error === 'string' ? raw.error.trim() : undefined,
          },
        };
      }
      return {
        ok: true,
        event: {
          type: 'cancel',
          task_id: rawTaskId,
          reason: typeof raw.reason === 'string' ? raw.reason.trim() : undefined,
        },
      };
    }

    case 'patch_ready': {
      if (!rawTaskId) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: 'patch_ready.task_id must be a non-empty string.',
          task_id: null,
        };
      }
      if (!Array.isArray(raw.diff_files) || raw.diff_files.length === 0) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: 'patch_ready.diff_files must be a non-empty array of modified file paths.',
          task_id: rawTaskId,
        };
      }
      const diffFiles: string[] = [];
      for (const df of raw.diff_files) {
        if (!isNonEmptyString(df)) {
          return {
            ok: false,
            code: 'SCHEMA_INVALID',
            reason: `patch_ready.diff_files contains invalid path "${String(df)}".`,
            task_id: rawTaskId,
          };
        }
        diffFiles.push(df.trim());
      }
      if (!isRecord(raw.tests)) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: 'patch_ready.tests must be an object with integer { passed, failed }.',
          task_id: rawTaskId,
        };
      }
      const { passed, failed } = raw.tests;
      if (
        typeof passed !== 'number' ||
        !Number.isInteger(passed) ||
        passed < 0 ||
        typeof failed !== 'number' ||
        !Number.isInteger(failed) ||
        failed < 0
      ) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: 'patch_ready.tests.passed and failed must be non-negative integers.',
          task_id: rawTaskId,
        };
      }
      return {
        ok: true,
        event: {
          type: 'patch_ready',
          task_id: rawTaskId,
          diff_files: diffFiles,
          tests: { passed, failed },
        },
      };
    }

    case 'arbiter_verdict': {
      if (!rawTaskId) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: 'arbiter_verdict.task_id must be a non-empty string.',
          task_id: null,
        };
      }
      if (
        typeof raw.verdict !== 'string' ||
        !VALID_ARBITER_VERDICTS.has(raw.verdict as ArbiterVerdictValue)
      ) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: `arbiter_verdict.verdict must be one of APPROVE | REWORK | ESCALATE_HUMAN (got "${String(raw.verdict)}").`,
          task_id: rawTaskId,
        };
      }
      if (
        typeof raw.confidence !== 'number' ||
        Number.isNaN(raw.confidence) ||
        !Number.isFinite(raw.confidence) ||
        raw.confidence < 0 ||
        raw.confidence > 1
      ) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: `arbiter_verdict.confidence must be a finite number in [0, 1] (got "${String(raw.confidence)}").`,
          task_id: rawTaskId,
        };
      }
      if (
        typeof raw.engine_source !== 'string' ||
        !VALID_ARBITER_SOURCES.has(raw.engine_source as ArbiterSource)
      ) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: `arbiter_verdict.engine_source must be RuleBasedArbiter | GeminiArbiter | FallbackRules.`,
          task_id: rawTaskId,
        };
      }
      const verdict = raw.verdict as ArbiterVerdictValue;
      if (verdict === 'REWORK' && !isNonEmptyString(raw.rework_instructions)) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: 'arbiter_verdict.rework_instructions is strictly required when verdict is REWORK.',
          task_id: rawTaskId,
        };
      }
      return {
        ok: true,
        event: {
          type: 'arbiter_verdict',
          task_id: rawTaskId,
          verdict,
          confidence: raw.confidence,
          rework_instructions:
            typeof raw.rework_instructions === 'string' && raw.rework_instructions.trim()
              ? raw.rework_instructions.trim()
              : undefined,
          engine_source: raw.engine_source as ArbiterSource,
          raw_confidence:
            typeof raw.raw_confidence === 'number' && Number.isFinite(raw.raw_confidence)
              ? raw.raw_confidence
              : raw.confidence,
          fallback_reason:
            typeof raw.fallback_reason === 'string' && raw.fallback_reason.trim()
              ? raw.fallback_reason.trim()
              : undefined,
        },
      };
    }

    case 'human_decision': {
      if (!rawTaskId) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: 'human_decision.task_id must be a non-empty string.',
          task_id: null,
        };
      }
      if (
        typeof raw.decision !== 'string' ||
        !VALID_HUMAN_DECISIONS.has(raw.decision as HumanDecisionValue)
      ) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: `human_decision.decision must be APPROVE | REWORK | CANCEL (got "${String(raw.decision)}").`,
          task_id: rawTaskId,
        };
      }
      if (
        typeof raw.expected_version !== 'number' ||
        !Number.isInteger(raw.expected_version) ||
        raw.expected_version < 1
      ) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: 'human_decision.expected_version must be a positive integer (TOCTOU guard).',
          task_id: rawTaskId,
        };
      }
      const decision = raw.decision as HumanDecisionValue;
      if (decision === 'REWORK' && !isNonEmptyString(raw.note)) {
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          reason: 'human_decision.note (rework instructions) is required when decision is REWORK.',
          task_id: rawTaskId,
        };
      }
      return {
        ok: true,
        event: {
          type: 'human_decision',
          task_id: rawTaskId,
          decision,
          expected_version: raw.expected_version,
          note: typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : undefined,
        },
      };
    }

    default:
      return {
        ok: false,
        code: 'SCHEMA_INVALID',
        reason: `Unknown event contract type "${eventType}".`,
        task_id: rawTaskId,
      };
  }
}
