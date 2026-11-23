import type { TaskState } from './types';

export const FSM_TRANSITIONS: Readonly<Record<TaskState, readonly TaskState[]>> = {
  DISPATCHED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['ARBITER_VALIDATING', 'FAILED', 'CANCELLED'],
  ARBITER_VALIDATING: ['MERGED', 'REWORK', 'HUMAN_REQUIRED'],
  REWORK: ['IN_PROGRESS', 'HUMAN_REQUIRED', 'CANCELLED'],
  HUMAN_REQUIRED: ['MERGED', 'IN_PROGRESS', 'CANCELLED'],
  MERGED: [],
  FAILED: [],
  CANCELLED: [],
} as const;

export const TERMINAL_STATES: ReadonlySet<TaskState> = new Set<TaskState>([
  'MERGED',
  'FAILED',
  'CANCELLED',
]);

export const ALL_TASK_STATES: readonly TaskState[] = [
  'DISPATCHED',
  'IN_PROGRESS',
  'ARBITER_VALIDATING',
  'REWORK',
  'HUMAN_REQUIRED',
  'MERGED',
  'FAILED',
  'CANCELLED',
] as const;

export function isTerminalState(state: TaskState): boolean {
  return TERMINAL_STATES.has(state);
}

export function canTransition(from: TaskState, to: TaskState): boolean {
  return FSM_TRANSITIONS[from].includes(to);
}

export function validateTransition(
  from: TaskState,
  to: TaskState
): { ok: true } | { ok: false; reason: string } {
  if (isTerminalState(from)) {
    return {
      ok: false,
      reason: `FSM terminal state violation: transitions out of '${from}' are strictly prohibited (attempted -> '${to}').`,
    };
  }
  if (!canTransition(from, to)) {
    const allowed = FSM_TRANSITIONS[from].join(', ');
    return {
      ok: false,
      reason: `Illegal FSM transition '${from}' -> '${to}'. Allowed targets: [${allowed}].`,
    };
  }
  return { ok: true };
}
