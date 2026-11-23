/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from './components/AppShell';
import { ArbiterChatView } from './components/ArbiterChatView';
import { CoreEngineInspector } from './components/CoreEngineInspector';
import { DispatchTaskModal } from './components/DispatchTaskModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OverviewDashboard } from './components/OverviewDashboard';
import { SecurityAuditDock, type SecurityDockTab } from './components/SecurityAuditDock';
import { SettingsView } from './components/SettingsView';
import { TaskRegistry } from './components/TaskRegistry';
import { WatchdogChaosPanel } from './components/WatchdogChaosPanel';
import {
  clearStoredSecrets,
  EMPTY_SECRETS,
  loadPreferences,
  loadSessionSecrets,
  persistSecrets,
  savePreferences,
  type AppPreferences,
  type SecretCredentials,
} from './core/settings';
import {
  HttpDaemonTransport,
  LocalSimulationTransport,
  type DaemonTransport,
} from './core/transport';
import type {
  ChaosRunResult,
  ChaosScenarioId,
  EnginePolicy,
  EngineSnapshot,
  SimSpeed,
  SubmitResult,
} from './core/types';
import { TRANSLATIONS, type NavSectionId } from './i18n/translations';

function ControlPlaneApp() {
  const transportRef = useRef<DaemonTransport>(new LocalSimulationTransport());
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [activeSection, setActiveSection] = useState<NavSectionId>('overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>('TSK-1002');
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dockTab, setDockTab] = useState<SecurityDockTab>('AUDIT');
  const [lastChaosResult, setLastChaosResult] = useState<ChaosRunResult | null>(null);
  const [runningScenario, setRunningScenario] = useState<ChaosScenarioId | null>(null);

  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const [secrets, setSecrets] = useState<SecretCredentials>(() =>
    loadSessionSecrets(loadPreferences().secretStorageMode)
  );

  // Sync Tailwind v4 `.dark` root class with theme preference
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    savePreferences(preferences);
  }, [preferences]);

  // Keep secret storage mode synchronized (Memory Only clears sessionStorage immediately)
  useEffect(() => {
    persistSecrets(secrets, preferences.secretStorageMode);
  }, [secrets, preferences.secretStorageMode]);

  const bindTransport = useCallback(async (transport: DaemonTransport) => {
    transportRef.current.dispose();
    transportRef.current = transport;
    const unsubscribe = transport.subscribe((nextSnap) => {
      setSnapshot(nextSnap);
    });
    const initial = await transport.init();
    setSnapshot(initial);
    setSelectedTaskId((prev) => {
      if (prev && initial.tasks.some((tk) => tk.task_id === prev)) {
        return prev;
      }
      return initial.tasks[0]?.task_id ?? null;
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    const sim = new LocalSimulationTransport();
    transportRef.current = sim;
    cleanup = sim.subscribe((nextSnap) => {
      if (!cancelled) setSnapshot(nextSnap);
    });

    void sim.init().then((initial) => {
      if (cancelled) return;
      setSnapshot(initial);
      const hasTsk1002 = initial.tasks.some((tk) => tk.task_id === 'TSK-1002');
      setSelectedTaskId(hasTsk1002 ? 'TSK-1002' : (initial.tasks[0]?.task_id ?? null));
    });

    return () => {
      cancelled = true;
      cleanup?.();
      sim.dispose();
    };
  }, []);

  // Deterministic 1-second watchdog tick loop
  useEffect(() => {
    const timer = window.setInterval(() => {
      void transportRef.current.tickWatchdog(1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleUpdatePreferences = useCallback((patch: Partial<AppPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleUpdateSecrets = useCallback((patch: Partial<SecretCredentials>) => {
    setSecrets((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleClearAllSecrets = useCallback(() => {
    clearStoredSecrets();
    setSecrets({ ...EMPTY_SECRETS });
  }, []);

  const handleSubmitEvent = useCallback(async (rawEvent: unknown): Promise<SubmitResult> => {
    return transportRef.current.submitEvent(rawEvent);
  }, []);

  const handleUpdatePolicy = useCallback((patch: Partial<EnginePolicy>) => {
    void transportRef.current.updatePolicy(patch);
  }, []);

  const handleSetSimSpeed = useCallback((speed: SimSpeed) => {
    transportRef.current.setSimSpeed(speed);
  }, []);

  const handleRunChaos = useCallback(
    async (scenario: ChaosScenarioId) => {
      setRunningScenario(scenario);
      try {
        const res = await transportRef.current.runChaosScenario(
          scenario,
          selectedTaskId ?? undefined
        );
        setLastChaosResult(res);
        if (res.task_id) {
          setSelectedTaskId(res.task_id);
        }
        if (scenario === 'INJECT_INVALID_DLQ') {
          setDockTab('DLQ');
        }
      } finally {
        setRunningScenario(null);
      }
    },
    [selectedTaskId]
  );

  const handleResetBreaker = useCallback((taskId: string) => {
    void transportRef.current.resetBreaker(taskId);
  }, []);

  const handleSendHeartbeat = useCallback((taskId: string) => {
    void transportRef.current.submitEvent({
      type: 'worker_activity',
      task_id: taskId,
      note: 'Manual operator heartbeat ping',
    });
  }, []);

  const handleVerifyChain = useCallback(async () => {
    return transportRef.current.verifyAuditChain();
  }, []);

  const handleSimulateTamper = useCallback(async () => {
    const res = await transportRef.current.simulateAuditTamper();
    return res.tamperedIndex;
  }, []);

  const handleResetDemo = useCallback(() => {
    void transportRef.current.resetSimulation().then((snap) => {
      setSelectedTaskId(
        snap.tasks.some((tk) => tk.task_id === 'TSK-1002')
          ? 'TSK-1002'
          : (snap.tasks[0]?.task_id ?? null)
      );
      setLastChaosResult(null);
    });
  }, []);

  const handleConnectDaemon = useCallback(
    async (url: string, bearerToken: string): Promise<{ ok: boolean; message: string }> => {
      const daemon = new HttpDaemonTransport(url, bearerToken);
      const ping = await daemon.ping();
      if (!ping.ok) {
        return { ok: false, message: ping.message };
      }
      try {
        await bindTransport(daemon);
        return { ok: true, message: 'Connected to Python CoreEngine daemon.' };
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to initialize daemon transport',
        };
      }
    },
    [bindTransport]
  );

  const handleSwitchToSimulation = useCallback(() => {
    void bindTransport(new LocalSimulationTransport());
  }, [bindTransport]);

  const handleInspectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setActiveSection('tasks');
  }, []);

  const t = TRANSLATIONS[preferences.locale];

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 flex items-center justify-center font-mono text-xs">
        Initializing deterministic CoreEngine &amp; SHA-256 audit chain...
      </div>
    );
  }

  const selectedTask =
    snapshot.tasks.find((tk) => tk.task_id === selectedTaskId) ?? snapshot.tasks[0] ?? null;

  return (
    <AppShell
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      drawerOpen={drawerOpen}
      onSetDrawerOpen={setDrawerOpen}
      snapshot={snapshot}
      theme={preferences.theme}
      locale={preferences.locale}
      t={t}
      onToggleTheme={() =>
        handleUpdatePreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })
      }
      onToggleLocale={() =>
        handleUpdatePreferences({ locale: preferences.locale === 'ru' ? 'en' : 'ru' })
      }
      onOpenDispatch={() => setDispatchOpen(true)}
    >
      {activeSection === 'overview' && (
        <OverviewDashboard
          snapshot={snapshot}
          t={t}
          onInspectTask={handleInspectTask}
          onOpenSecurity={() => setActiveSection('security')}
          onOpenWatchdog={() => setActiveSection('watchdog')}
        />
      )}

      {activeSection === 'tasks' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-88px)]">
          <div className="lg:col-span-4 xl:col-span-3 min-h-[280px]">
            <TaskRegistry
              tasks={snapshot.tasks}
              policy={snapshot.policy}
              selectedTaskId={selectedTask?.task_id ?? null}
              t={t}
              onSelectTask={setSelectedTaskId}
            />
          </div>
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col min-w-0">
            <CoreEngineInspector
              task={selectedTask}
              policy={snapshot.policy}
              theme={preferences.theme}
              t={t}
              onSubmitEvent={handleSubmitEvent}
            />
          </div>
        </div>
      )}

      {activeSection === 'chat' && (
        <ArbiterChatView
          tasks={snapshot.tasks}
          selectedTaskId={selectedTask?.task_id ?? null}
          onSelectTask={setSelectedTaskId}
          policy={snapshot.policy}
          simClockMs={snapshot.sim_clock_ms}
          hasGeminiApiKey={secrets.geminiApiKey.trim().length > 0}
          locale={preferences.locale}
          t={t}
          onSubmitEvent={handleSubmitEvent}
        />
      )}

      {activeSection === 'watchdog' && (
        <WatchdogChaosPanel
          tasks={snapshot.tasks}
          task={selectedTask}
          policy={snapshot.policy}
          lastChaosResult={lastChaosResult}
          runningScenario={runningScenario}
          t={t}
          onSelectTask={setSelectedTaskId}
          onRunChaos={handleRunChaos}
          onResetBreaker={handleResetBreaker}
          onSendHeartbeat={handleSendHeartbeat}
          onInspectTask={handleInspectTask}
        />
      )}

      {activeSection === 'security' && (
        <SecurityAuditDock
          activeTab={dockTab}
          onChangeTab={setDockTab}
          audit={snapshot.audit}
          verification={snapshot.audit_verification}
          dlq={snapshot.dlq}
          t={t}
          onVerifyChain={handleVerifyChain}
          onSimulateTamper={handleSimulateTamper}
          onResetDemo={handleResetDemo}
        />
      )}

      {activeSection === 'settings' && (
        <SettingsView
          preferences={preferences}
          secrets={secrets}
          policy={snapshot.policy}
          simSpeed={snapshot.sim_speed}
          transportMode={snapshot.transport_mode}
          t={t}
          onUpdatePreferences={handleUpdatePreferences}
          onUpdateSecrets={handleUpdateSecrets}
          onClearAllSecrets={handleClearAllSecrets}
          onUpdatePolicy={handleUpdatePolicy}
          onSetSimSpeed={handleSetSimSpeed}
          onConnectDaemon={handleConnectDaemon}
          onSwitchToSimulation={handleSwitchToSimulation}
        />
      )}

      <DispatchTaskModal
        open={dispatchOpen}
        onClose={() => setDispatchOpen(false)}
        onSubmitEvent={handleSubmitEvent}
        onTaskCreated={(id) => {
          setSelectedTaskId(id);
          setActiveSection('tasks');
        }}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ControlPlaneApp />
    </ErrorBoundary>
  );
}
