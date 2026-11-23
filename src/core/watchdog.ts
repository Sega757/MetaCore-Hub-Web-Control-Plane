import type { EnginePolicy, WatchdogState } from './types';

export const DEFAULT_MAX_NUDGES = 2;

export function createInitialWatchdogState(nowMs: number): WatchdogState {
  return {
    status: 'HEALTHY',
    elapsed_sec: 0,
    nudge_count: 0,
    max_nudges: DEFAULT_MAX_NUDGES,
    circuit_breaker: 'CLOSED',
    last_activity_at: nowMs,
    last_nudge_at: null,
  };
}

export function resetWatchdogOnActivity(state: WatchdogState, nowMs: number): WatchdogState {
  return {
    ...state,
    status: 'HEALTHY',
    elapsed_sec: 0,
    nudge_count: 0,
    last_activity_at: nowMs,
    last_nudge_at: null,
  };
}

export function resetCircuitBreaker(state: WatchdogState, nowMs: number): WatchdogState {
  return {
    status: 'HEALTHY',
    elapsed_sec: 0,
    nudge_count: 0,
    max_nudges: state.max_nudges,
    circuit_breaker: 'CLOSED',
    last_activity_at: nowMs,
    last_nudge_at: null,
  };
}

export interface WatchdogTickOutcome {
  next: WatchdogState;
  emittedEvent: 'NONE' | 'NUDGE_L1' | 'NUDGE_L2' | 'CIRCUIT_OPEN';
}

/**
 * Deterministic stall progression:
 * - 0 .. stall_timeout_sec        -> HEALTHY (nudge 0/2)
 * - > stall_timeout_sec           -> NUDGE_L1 (Continue, nudge 1/2)
 * - > 2 * stall_timeout_sec       -> NUDGE_L2 (Diagnostic, nudge 2/2)
 * - > 3 * stall_timeout_sec       -> CIRCUIT_OPEN (isolates worker, escalates task)
 */
export function advanceWatchdog(
  current: WatchdogState,
  deltaSec: number,
  policy: EnginePolicy,
  nowMs: number
): WatchdogTickOutcome {
  if (current.circuit_breaker === 'OPEN' || deltaSec <= 0) {
    return { next: current, emittedEvent: 'NONE' };
  }

  const timeout = Math.max(10, policy.stall_timeout_sec);
  const nextElapsed = Math.round((current.elapsed_sec + deltaSec) * 10) / 10;

  // Threshold 3: Circuit Breaker OPEN after 2 unanswered nudges
  if (nextElapsed >= timeout * 3) {
    return {
      next: {
        ...current,
        status: 'CIRCUIT_OPEN',
        elapsed_sec: nextElapsed,
        nudge_count: 2,
        circuit_breaker: 'OPEN',
        last_nudge_at: nowMs,
      },
      emittedEvent: 'CIRCUIT_OPEN',
    };
  }

  // Threshold 2: Nudge Level 2 (Diagnostic)
  if (nextElapsed >= timeout * 2) {
    const crossed = current.nudge_count < 2;
    return {
      next: {
        ...current,
        status: 'NUDGE_L2',
        elapsed_sec: nextElapsed,
        nudge_count: 2,
        last_nudge_at: crossed ? nowMs : current.last_nudge_at,
      },
      emittedEvent: crossed ? 'NUDGE_L2' : 'NONE',
    };
  }

  // Threshold 1: Nudge Level 1 (Continue)
  if (nextElapsed >= timeout) {
    const crossed = current.nudge_count < 1;
    return {
      next: {
        ...current,
        status: 'NUDGE_L1',
        elapsed_sec: nextElapsed,
        nudge_count: 1,
        last_nudge_at: crossed ? nowMs : current.last_nudge_at,
      },
      emittedEvent: crossed ? 'NUDGE_L1' : 'NONE',
    };
  }

  return {
    next: {
      ...current,
      status: 'HEALTHY',
      elapsed_sec: nextElapsed,
    },
    emittedEvent: 'NONE',
  };
}
