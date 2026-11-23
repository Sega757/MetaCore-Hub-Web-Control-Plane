import { CoreEngine } from './engine';
import type {
  AuditVerificationResult,
  ChaosRunResult,
  ChaosScenarioId,
  EnginePolicy,
  EngineSnapshot,
  SimSpeed,
  SubmitResult,
} from './types';

export type SnapshotListener = (snapshot: EngineSnapshot) => void;

export interface DaemonTransport {
  readonly mode: 'SIMULATION' | 'DAEMON';
  init(): Promise<EngineSnapshot>;
  getSnapshot(): EngineSnapshot;
  subscribe(listener: SnapshotListener): () => void;
  submitEvent(rawEvent: unknown): Promise<SubmitResult>;
  updatePolicy(patch: Partial<EnginePolicy>): Promise<EngineSnapshot>;
  setSimSpeed(speed: SimSpeed): void;
  tickWatchdog(deltaRealSec: number): Promise<void>;
  resetBreaker(taskId: string): Promise<EngineSnapshot>;
  verifyAuditChain(): Promise<AuditVerificationResult>;
  simulateAuditTamper(targetIndex?: number): Promise<{ tamperedIndex: number | null; snapshot: EngineSnapshot }>;
  runChaosScenario(scenario: ChaosScenarioId, targetTaskId?: string): Promise<ChaosRunResult>;
  resetSimulation(): Promise<EngineSnapshot>;
  dispose(): void;
}

/**
 * Autonomous zero-dependency deterministic simulation transport.
 * Runs CoreEngine strictly in-process with identical contract, FSM, gate,
 * watchdog, and SHA-256 audit semantics as the Python daemon.
 */
export class LocalSimulationTransport implements DaemonTransport {
  readonly mode = 'SIMULATION' as const;
  private engine = new CoreEngine();
  private listeners = new Set<SnapshotListener>();

  private emit(): void {
    const snap = this.engine.getSnapshot('SIMULATION');
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  async init(): Promise<EngineSnapshot> {
    const snap = await this.engine.initializeWithDemoData();
    this.emit();
    return snap;
  }

  getSnapshot(): EngineSnapshot {
    return this.engine.getSnapshot('SIMULATION');
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async submitEvent(rawEvent: unknown): Promise<SubmitResult> {
    const result = await this.engine.submitEvent(rawEvent);
    this.emit();
    return result;
  }

  async updatePolicy(patch: Partial<EnginePolicy>): Promise<EngineSnapshot> {
    const snap = await this.engine.updatePolicy(patch);
    this.emit();
    return snap;
  }

  setSimSpeed(speed: SimSpeed): void {
    this.engine.setSimSpeed(speed);
    this.emit();
  }

  async tickWatchdog(deltaRealSec: number): Promise<void> {
    const changed = await this.engine.tickWatchdog(deltaRealSec);
    if (changed) {
      this.emit();
    }
  }

  async resetBreaker(taskId: string): Promise<EngineSnapshot> {
    const snap = await this.engine.resetWatchdogBreaker(taskId);
    this.emit();
    return snap;
  }

  async verifyAuditChain(): Promise<AuditVerificationResult> {
    const result = await this.engine.verifyAuditChain();
    this.emit();
    return result;
  }

  async simulateAuditTamper(
    targetIndex?: number
  ): Promise<{ tamperedIndex: number | null; snapshot: EngineSnapshot }> {
    const result = await this.engine.simulateAuditTamper(targetIndex);
    this.emit();
    return result;
  }

  async runChaosScenario(
    scenario: ChaosScenarioId,
    targetTaskId?: string
  ): Promise<ChaosRunResult> {
    const result = await this.engine.runChaosScenario(scenario, targetTaskId);
    this.emit();
    return result;
  }

  async resetSimulation(): Promise<EngineSnapshot> {
    const snap = await this.engine.reset();
    this.emit();
    return snap;
  }

  dispose(): void {
    this.listeners.clear();
  }
}

/**
 * Production REST + WebSocket transport adapter for connecting to a live
 * Sega757/Metacore-Hub Python daemon (FastAPI / Uvicorn).
 */
export class HttpDaemonTransport implements DaemonTransport {
  readonly mode = 'DAEMON' as const;
  private readonly baseUrl: string;
  private readonly bearerToken: string;
  private listeners = new Set<SnapshotListener>();
  private ws: WebSocket | null = null;
  private latestSnapshot: EngineSnapshot | null = null;

  constructor(baseUrl = 'http://localhost:8000', bearerToken = '') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.bearerToken = bearerToken.trim();
  }

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json', ...extra };
    if (this.bearerToken) {
      headers.Authorization = `Bearer ${this.bearerToken}`;
    }
    return headers;
  }

  private emit(snap: EngineSnapshot): void {
    this.latestSnapshot = {
      ...snap,
      transport_mode: 'DAEMON',
      daemon_url: this.baseUrl,
    };
    for (const listener of this.listeners) {
      listener(this.latestSnapshot);
    }
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; message: string; endpoint: string }> {
    const started = performance.now();
    const candidates = [`${this.baseUrl}/health`, `${this.baseUrl}/api/v1/health`];
    let lastError = 'Unable to reach Python daemon. Ensure uvicorn/metacore daemon is running.';

    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: this.authHeaders(),
        });
        const latencyMs = Math.round(performance.now() - started);
        if (res.ok) {
          return {
            ok: true,
            latencyMs,
            endpoint: url,
            message: `Python CoreEngine daemon healthy at ${url}`,
          };
        }
        lastError = `HTTP ${res.status} from ${url}`;
      } catch (err) {
        lastError =
          err instanceof Error
            ? `${err.message} (${url} unreachable — is the local daemon running?)`
            : `Connection refused (${url})`;
      }
    }

    return {
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      endpoint: candidates[0],
      message: lastError,
    };
  }

  async init(): Promise<EngineSnapshot> {
    const res = await fetch(`${this.baseUrl}/api/v1/snapshot`, {
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Daemon snapshot fetch failed (HTTP ${res.status})`);
    }
    const snap = (await res.json()) as EngineSnapshot;
    this.connectWebSocket();
    this.emit(snap);
    return this.latestSnapshot!;
  }

  private connectWebSocket(): void {
    if (typeof WebSocket === 'undefined') return;
    try {
      const wsUrl = this.baseUrl.replace(/^http/i, 'ws') + '/ws/events';
      this.ws = new WebSocket(wsUrl);
      this.ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(String(evt.data)) as EngineSnapshot;
          if (parsed && Array.isArray(parsed.tasks)) {
            this.emit(parsed);
          }
        } catch {
          // Ignore non-snapshot frames
        }
      };
    } catch {
      // Fallback to REST polling if WebSocket blocked
    }
  }

  getSnapshot(): EngineSnapshot {
    if (!this.latestSnapshot) {
      throw new Error('HttpDaemonTransport not initialized');
    }
    return this.latestSnapshot;
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async submitEvent(rawEvent: unknown): Promise<SubmitResult> {
    const res = await fetch(`${this.baseUrl}/api/v1/events`, {
      method: 'POST',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(rawEvent),
    });
    const result = (await res.json()) as SubmitResult;
    await this.refreshSnapshot();
    return result;
  }

  async updatePolicy(patch: Partial<EnginePolicy>): Promise<EngineSnapshot> {
    const res = await fetch(`${this.baseUrl}/api/v1/policy`, {
      method: 'PATCH',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch),
    });
    const snap = (await res.json()) as EngineSnapshot;
    this.emit(snap);
    return this.latestSnapshot!;
  }

  setSimSpeed(_speed: SimSpeed): void {
    // Live daemon runs on real monotonic wall clock
  }

  async tickWatchdog(_deltaRealSec: number): Promise<void> {
    // Watchdog loop is daemon-owned on the server
  }

  async resetBreaker(taskId: string): Promise<EngineSnapshot> {
    const res = await fetch(`${this.baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}/reset-breaker`, {
      method: 'POST',
      headers: this.authHeaders(),
    });
    const snap = (await res.json()) as EngineSnapshot;
    this.emit(snap);
    return this.latestSnapshot!;
  }

  async verifyAuditChain(): Promise<AuditVerificationResult> {
    const res = await fetch(`${this.baseUrl}/api/v1/audit/verify`, {
      method: 'POST',
      headers: this.authHeaders(),
    });
    const verification = (await res.json()) as AuditVerificationResult;
    await this.refreshSnapshot();
    return verification;
  }

  async simulateAuditTamper(
    targetIndex?: number
  ): Promise<{ tamperedIndex: number | null; snapshot: EngineSnapshot }> {
    const res = await fetch(`${this.baseUrl}/api/v1/audit/simulate-tamper`, {
      method: 'POST',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ index: targetIndex }),
    });
    const data = (await res.json()) as { tamperedIndex: number | null; snapshot: EngineSnapshot };
    this.emit(data.snapshot);
    return data;
  }

  async runChaosScenario(
    scenario: ChaosScenarioId,
    targetTaskId?: string
  ): Promise<ChaosRunResult> {
    const res = await fetch(`${this.baseUrl}/api/v1/chaos/${encodeURIComponent(scenario)}`, {
      method: 'POST',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ task_id: targetTaskId }),
    });
    const result = (await res.json()) as ChaosRunResult;
    await this.refreshSnapshot();
    return result;
  }

  async resetSimulation(): Promise<EngineSnapshot> {
    return this.refreshSnapshot();
  }

  private async refreshSnapshot(): Promise<EngineSnapshot> {
    const res = await fetch(`${this.baseUrl}/api/v1/snapshot`, {
      headers: this.authHeaders(),
    });
    const snap = (await res.json()) as EngineSnapshot;
    this.emit(snap);
    return this.latestSnapshot!;
  }

  dispose(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }
}
