import type { Locale } from '../core/settings';

export type NavSectionId = 'overview' | 'tasks' | 'chat' | 'watchdog' | 'security' | 'settings';

export interface Dictionary {
  nav: Record<NavSectionId, string>;
  navSubtitle: Record<NavSectionId, string>;
  common: {
    dispatchTask: string;
    simulation: string;
    daemon: string;
    auditValid: string;
    auditTampered: string;
    hitlBadge: string;
    policySummary: string;
    editPolicy: string;
    threshold: string;
    maxRework: string;
    hitlMode: string;
    stallTimeout: string;
    simClock: string;
    on: string;
    off: string;
    dark: string;
    light: string;
    cancel: string;
    resetDemo: string;
    inspectTask: string;
  };
  overview: {
    kpiTotalTasks: string;
    kpiActiveSubtitle: string;
    kpiAutoMergeRate: string;
    kpiEscalations: string;
    kpiHumanSubtitle: string;
    kpiAvgConfidence: string;
    kpiDlqAudit: string;
    chartFsmDist: string;
    chartMergeVsHitl: string;
    chartDlqDynamics: string;
    chartConfidenceVsThreshold: string;
    fleetWatchdogTitle: string;
    noDlqViolations: string;
    autoMergedLabel: string;
    humanEscalatedLabel: string;
    inFlightLabel: string;
    terminalOtherLabel: string;
  };
  tasks: {
    registryTitle: string;
    filterAll: string;
    filterActive: string;
    filterHitl: string;
    filterDone: string;
    noTasksMatch: string;
    fsmPipeline: string;
    fsmClickHint: string;
    evidenceGatesTitle: string;
    scopeDiffTitle: string;
    testGateTitle: string;
    arbiterVerdictTitle: string;
    hitlGateTitle: string;
    overrideHardGateLabel: string;
    overrideMissingHint: string;
    auditNotePlaceholder: string;
    auditNoteRequiredPlaceholder: string;
    approveMerge: string;
    requestRework: string;
    cancelTask: string;
    watchdogPausedHitl: string;
    watchdogStoppedTerminal: string;
  };
  chat: {
    title: string;
    subtitle: string;
    taskSelectorLabel: string;
    modeSimulation: string;
    modeGeminiReady: string;
    invariantBanner: string;
    placeholder: string;
    send: string;
    submitProposal: string;
    proposalSubmitted: string;
    proposalRejected: string;
    clearChat: string;
    chips: {
      explainBlock: string;
      genRework: string;
      auditRisks: string;
      planNewTask: string;
    };
  };
  watchdog: {
    monitorTitle: string;
    nudgeCounter: string;
    circuitBreaker: string;
    sendHeartbeat: string;
    manualResetBreaker: string;
    chaosLabTitle: string;
    chaosLabDesc: string;
    selectTaskHint: string;
  };
  security: {
    tabAudit: string;
    tabDlq: string;
    tabA2a: string;
    verifyChain: string;
    verifying: string;
    simulateTamper: string;
    exportJson: string;
    resetCleanChain: string;
    clickRowToInspect: string;
    fullHashesTitle: string;
    canonicalRecordTitle: string;
  };
  settings: {
    appearanceTitle: string;
    appearanceDesc: string;
    themeLabel: string;
    languageLabel: string;
    secretsTitle: string;
    secretsDesc: string;
    geminiKeyLabel: string;
    secondaryKeyLabel: string;
    daemonTokenLabel: string;
    storageModeLabel: string;
    storageMemory: string;
    storageSession: string;
    storageWarning: string;
    exportEnv: string;
    clearSecrets: string;
    secretsCleared: string;
    envExported: string;
    transportTitle: string;
    transportDesc: string;
    modeLocalSim: string;
    modeRemoteDaemon: string;
    daemonUrlLabel: string;
    testConnection: string;
    testing: string;
    connectDaemon: string;
    policyTitle: string;
    policyDesc: string;
  };
}

export const TRANSLATIONS: Record<Locale, Dictionary> = {
  ru: {
    nav: {
      overview: 'Обзор и метрики',
      tasks: 'Задачи и инспектор',
      chat: 'Чат с Арбитром',
      watchdog: 'Watchdog и Chaos Lab',
      security: 'Аудит, DLQ и A2A',
      settings: 'Настройки',
    },
    navSubtitle: {
      overview: 'Состояние конвейера FSM, гейты мёржа и целостность цепочки',
      tasks: 'Реестр задач, схема FSM, Evidence Gates и HITL-шлюз',
      chat: 'Интерактивный анализ задач и предложения в CoreEngine',
      watchdog: 'Мониторинг простоев воркеров, Circuit Breaker и инъекция сбоев',
      security: 'SHA-256 аудит-лог, Dead-Letter Queue и A2A SSRF-харденинг',
      settings: 'Тема, язык, секреты (.env), транспорт демона и политика движка',
    },
    common: {
      dispatchTask: 'Новая задача',
      simulation: 'SIMULATION',
      daemon: 'DAEMON',
      auditValid: 'SHA-256 VALID',
      auditTampered: 'TAMPERED',
      hitlBadge: 'HITL',
      policySummary: 'Политика CoreEngine',
      editPolicy: 'Изменить',
      threshold: 'Порог',
      maxRework: 'Max Rework',
      hitlMode: 'HITL',
      stallTimeout: 'Таймаут',
      simClock: 'Часы',
      on: 'ВКЛ',
      off: 'ВЫКЛ',
      dark: 'Тёмная',
      light: 'Светлая',
      cancel: 'Отмена',
      resetDemo: 'Сброс демо',
      inspectTask: 'Открыть',
    },
    overview: {
      kpiTotalTasks: 'Всего задач',
      kpiActiveSubtitle: 'В работе / проверке',
      kpiAutoMergeRate: 'Доля Auto-Merge',
      kpiEscalations: 'Эскалации HITL',
      kpiHumanSubtitle: 'Требуют решения оператора',
      kpiAvgConfidence: 'Средний Confidence',
      kpiDlqAudit: 'Нарушения DLQ / Аудит',
      chartFsmDist: 'Распределение задач по состояниям FSM',
      chartMergeVsHitl: 'Соотношение Auto-Merge vs эскалации HITL',
      chartDlqDynamics: 'Нарушения контрактов (DLQ) и события аудита',
      chartConfidenceVsThreshold: 'Уверенность Арбитра (Confidence) vs порог мёржа',
      fleetWatchdogTitle: 'Статус Watchdog по задачам',
      noDlqViolations: 'Нарушений контракта в DLQ пока нет — все события валидны.',
      autoMergedLabel: 'MERGED',
      humanEscalatedLabel: 'HUMAN_REQUIRED',
      inFlightLabel: 'В работе',
      terminalOtherLabel: 'FAILED / CANCELLED',
    },
    tasks: {
      registryTitle: 'Реестр задач',
      filterAll: 'Все',
      filterActive: 'Активные',
      filterHitl: 'HITL',
      filterDone: 'Готово',
      noTasksMatch: 'Нет задач по выбранному фильтру.',
      fsmPipeline: 'Детерминированный пайплайн FSM',
      fsmClickHint: 'Клик по узлу показывает время входа',
      evidenceGatesTitle: 'Evidence Gates и политика мёржа',
      scopeDiffTitle: 'Scope Pinning Diff (Белый список файлов)',
      testGateTitle: 'Test Suite Gate',
      arbiterVerdictTitle: 'Вердикт Арбитра',
      hitlGateTitle: 'Шлюз решения оператора (HITL Decision Gate)',
      overrideHardGateLabel: 'Override hard security gate (подтверждаю ручное переопределение защитного гейта)',
      overrideMissingHint: 'Кнопка APPROVE & MERGE заблокирована: при активном SCOPE VIOLATION или TEST GATE FAILED требуется чекбокс Override и непустой audit note.',
      auditNotePlaceholder: 'Комментарий аудита для APPROVE или CANCEL (опционально)...',
      auditNoteRequiredPlaceholder: 'Обязательное обоснование Override для SHA-256 аудит-лога...',
      approveMerge: 'APPROVE & MERGE',
      requestRework: 'REQUEST REWORK',
      cancelTask: 'CANCEL TASK',
      watchdogPausedHitl: 'PAUSED (Awaiting HITL)',
      watchdogStoppedTerminal: 'STOPPED (Terminal)',
    },
    chat: {
      title: 'Чат с Арбитром',
      subtitle: 'Инвариант: Арбитр только предлагает — CoreEngine валидирует контракт и управляет FSM.',
      taskSelectorLabel: 'Контекст задачи',
      modeSimulation: 'SIMULATION ARBITER · Детерминированный анализ',
      modeGeminiReady: 'GEMINI API KEY ЗАДАН · Готов к живому вызову',
      invariantBanner: 'Любое действие из чата проходит проверку схемы, таблицы FSM и пишется в SHA-256 аудит-лог. Прямой перевод в MERGED из чата запрещён.',
      placeholder: 'Спросите о блокировке, рисках патча, реворке или плане новой задачи...',
      send: 'Отправить',
      submitProposal: 'Отправить предложение в CoreEngine',
      proposalSubmitted: 'Принято CoreEngine',
      proposalRejected: 'Отклонено в DLQ',
      clearChat: 'Очистить диалог',
      chips: {
        explainBlock: 'Объясни причину блокировки',
        genRework: 'Сформируй инструкции на Rework',
        auditRisks: 'Проверь риски патча',
        planNewTask: 'Предложи план новой задачи',
      },
    },
    watchdog: {
      monitorTitle: 'Монитор Watchdog',
      nudgeCounter: 'Счётчик Nudge',
      circuitBreaker: 'Circuit Breaker',
      sendHeartbeat: 'Отправить worker_activity (Heartbeat)',
      manualResetBreaker: 'Manual Reset Breaker',
      chaosLabTitle: 'Chaos & Verification Lab',
      chaosLabDesc: 'Детерминированные сценарии инъекции сбоев для проверки инвариантов CoreEngine, fallback-среза, Watchdog и DLQ.',
      selectTaskHint: 'Выберите задачу в реестре или запустите сценарий — при необходимости создастся новая задача.',
    },
    security: {
      tabAudit: 'SHA-256 Аудит-лог',
      tabDlq: 'Dead-Letter Queue',
      tabA2a: 'A2A Hardening Lab',
      verifyChain: 'Verify Chain',
      verifying: 'Проверка...',
      simulateTamper: 'Simulate Tamper',
      exportJson: 'Экспорт JSON',
      resetCleanChain: 'Сбросить чистую цепочку',
      clickRowToInspect: 'Нажмите на строку для просмотра полных SHA-256 хэшей и JSON',
      fullHashesTitle: 'Криптографическая связка SHA-256',
      canonicalRecordTitle: 'Каноническая запись аудита (JSON)',
    },
    settings: {
      appearanceTitle: 'Внешний вид и локализация',
      appearanceDesc: 'Настройки контрастной темы и языка интерфейса панели управления.',
      themeLabel: 'Цветовая тема',
      languageLabel: 'Язык интерфейса',
      secretsTitle: 'API Keys & Providers (Безопасный ввод)',
      secretsDesc: 'Конфигурация ключей без ручного редактирования .env. Экспортируйте готовый файл для локального Python-демона.',
      geminiKeyLabel: 'Gemini API Key',
      secondaryKeyLabel: 'Anthropic / OpenAI Key (Опционально)',
      daemonTokenLabel: 'Daemon Bearer Token',
      storageModeLabel: 'Режим хранения секретов',
      storageMemory: 'Только в памяти (Memory Only — безопаснее)',
      storageSession: 'Session Storage (до закрытия вкладки)',
      storageWarning: 'Ключи никогда не отправляются на сторонние серверы. В режиме Memory Only они удаляются сразу при перезагрузке страницы.',
      exportEnv: 'Export .env',
      clearSecrets: 'Clear All Secrets',
      secretsCleared: 'Все секреты очищены из памяти и Session Storage.',
      envExported: 'Файл .env сформирован и скачан для локального запуска Python-демона.',
      transportTitle: 'Транспорт и подключение к демону',
      transportDesc: 'Переключение между автономным симулятором CoreEngine и реальным Python-демоном (REST / WebSocket).',
      modeLocalSim: 'Локальный симулятор (Simulation)',
      modeRemoteDaemon: 'Удалённый Python-демон',
      daemonUrlLabel: 'Базовый URL демона',
      testConnection: 'Проверить связь',
      testing: 'Проверка /health...',
      connectDaemon: 'Подключиться к демону',
      policyTitle: 'Политика движка по умолчанию',
      policyDesc: 'Все изменения политики применяются детерминированно и фиксируются в SHA-256 аудит-логе.',
    },
  },
  en: {
    nav: {
      overview: 'Overview & Metrics',
      tasks: 'Tasks & Inspector',
      chat: 'Arbiter Chat',
      watchdog: 'Watchdog & Chaos Lab',
      security: 'Audit, DLQ & A2A',
      settings: 'Settings',
    },
    navSubtitle: {
      overview: 'FSM pipeline telemetry, merge gates, and cryptographic chain health',
      tasks: 'Task registry, SVG FSM diagram, Evidence Gates, and HITL Decision Gate',
      chat: 'Interactive task diagnostics and schema-validated CoreEngine proposals',
      watchdog: 'Worker stall monitor, Circuit Breaker isolation, and Chaos Lab',
      security: 'SHA-256 audit log, Dead-Letter Queue, and A2A SSRF hardening',
      settings: 'Theme, language, safe API key export (.env), transport, and EnginePolicy',
    },
    common: {
      dispatchTask: 'Dispatch Task',
      simulation: 'SIMULATION',
      daemon: 'DAEMON',
      auditValid: 'SHA-256 VALID',
      auditTampered: 'TAMPERED',
      hitlBadge: 'HITL',
      policySummary: 'EnginePolicy',
      editPolicy: 'Configure',
      threshold: 'Threshold',
      maxRework: 'Max Rework',
      hitlMode: 'HITL',
      stallTimeout: 'Timeout',
      simClock: 'Clock',
      on: 'ON',
      off: 'OFF',
      dark: 'Dark',
      light: 'Light',
      cancel: 'Cancel',
      resetDemo: 'Reset Demo',
      inspectTask: 'Inspect',
    },
    overview: {
      kpiTotalTasks: 'Total Tasks',
      kpiActiveSubtitle: 'Active in pipeline',
      kpiAutoMergeRate: 'Auto-Merge Share',
      kpiEscalations: 'HITL Escalations',
      kpiHumanSubtitle: 'Awaiting operator decision',
      kpiAvgConfidence: 'Avg Confidence',
      kpiDlqAudit: 'DLQ Violations / Audit',
      chartFsmDist: 'Task Distribution by FSM State',
      chartMergeVsHitl: 'Auto-Merge vs Human Escalation Ratio',
      chartDlqDynamics: 'DLQ Contract Violations & Audit Activity',
      chartConfidenceVsThreshold: 'Arbiter Confidence vs Auto-Merge Threshold',
      fleetWatchdogTitle: 'Fleet Watchdog Status',
      noDlqViolations: 'Zero DLQ violations recorded — all submitted contracts passed validation.',
      autoMergedLabel: 'MERGED',
      humanEscalatedLabel: 'HUMAN_REQUIRED',
      inFlightLabel: 'In Flight',
      terminalOtherLabel: 'FAILED / CANCELLED',
    },
    tasks: {
      registryTitle: 'Task Registry',
      filterAll: 'All',
      filterActive: 'Active',
      filterHitl: 'HITL',
      filterDone: 'Done',
      noTasksMatch: 'No tasks match this filter.',
      fsmPipeline: 'Deterministic FSM Pipeline',
      fsmClickHint: 'Click any node to inspect entry timestamp',
      evidenceGatesTitle: 'Evidence & Merge Policy Gates',
      scopeDiffTitle: 'Scope Pinning Diff (Allowed Whitelist)',
      testGateTitle: 'Test Suite Gate',
      arbiterVerdictTitle: 'Arbiter Verdict',
      hitlGateTitle: 'Human-in-the-Loop (HITL) Decision Gate',
      overrideHardGateLabel: 'Override hard security gate (acknowledge manual bypass of Scope/Test block)',
      overrideMissingHint: 'APPROVE & MERGE is locked while SCOPE VIOLATION or TEST GATE FAILED is active. Check Override and enter a non-empty audit note.',
      auditNotePlaceholder: 'Optional audit note for APPROVE or CANCEL...',
      auditNoteRequiredPlaceholder: 'Required override justification for SHA-256 audit log...',
      approveMerge: 'APPROVE & MERGE',
      requestRework: 'REQUEST REWORK',
      cancelTask: 'CANCEL TASK',
      watchdogPausedHitl: 'PAUSED (Awaiting HITL)',
      watchdogStoppedTerminal: 'STOPPED (Terminal)',
    },
    chat: {
      title: 'Arbiter Chat',
      subtitle: 'Invariant: Arbiter proposes; schema-validating CoreEngine disposes.',
      taskSelectorLabel: 'Task Context',
      modeSimulation: 'SIMULATION ARBITER · Deterministic Engine',
      modeGeminiReady: 'GEMINI API KEY SET · Ready for Live Model',
      invariantBanner: 'Every proposal sent from chat passes strict schema validation, FSM transition checks, and SHA-256 audit logging. Direct MERGED mutation is forbidden.',
      placeholder: 'Ask about block reasons, patch risks, rework instructions, or a new task plan...',
      send: 'Send',
      submitProposal: 'Submit Proposal to CoreEngine',
      proposalSubmitted: 'Accepted by CoreEngine',
      proposalRejected: 'Rejected to DLQ',
      clearChat: 'Clear Chat',
      chips: {
        explainBlock: 'Explain block reason',
        genRework: 'Generate Rework instructions',
        auditRisks: 'Audit patch risks',
        planNewTask: 'Propose new task plan',
      },
    },
    watchdog: {
      monitorTitle: 'Watchdog Monitor',
      nudgeCounter: 'Nudge Counter',
      circuitBreaker: 'Circuit Breaker',
      sendHeartbeat: 'Send Worker Activity Heartbeat',
      manualResetBreaker: 'Manual Reset Breaker',
      chaosLabTitle: 'Chaos & Verification Lab',
      chaosLabDesc: 'Execute deterministic fault-injection scenarios against CoreEngine to verify gate enforcement, fallback cap, watchdog isolation, and DLQ capture.',
      selectTaskHint: 'Run against the selected task or auto-dispatch a fresh scenario task.',
    },
    security: {
      tabAudit: 'Tamper-Evident Audit Log',
      tabDlq: 'Dead-Letter Queue',
      tabA2a: 'A2A Hardening Lab',
      verifyChain: 'Verify Chain',
      verifying: 'Verifying...',
      simulateTamper: 'Simulate Tamper',
      exportJson: 'Export JSON',
      resetCleanChain: 'Reset Clean Chain',
      clickRowToInspect: 'Click any row to inspect full SHA-256 hashes and canonical JSON',
      fullHashesTitle: 'Cryptographic SHA-256 Chain Link',
      canonicalRecordTitle: 'Canonical Audit Entry (JSON)',
    },
    settings: {
      appearanceTitle: 'Appearance & Localization',
      appearanceDesc: 'Switch dark/light engineering themes and interface language.',
      themeLabel: 'Color Theme',
      languageLabel: 'Interface Language',
      secretsTitle: 'API Keys & Providers (Safe Input)',
      secretsDesc: 'Configure provider keys without manually editing .env files. Export a ready-to-run .env for the local Python daemon.',
      geminiKeyLabel: 'Gemini API Key',
      secondaryKeyLabel: 'Anthropic / OpenAI Key (Optional)',
      daemonTokenLabel: 'Daemon Bearer Token',
      storageModeLabel: 'Secret Storage Mode',
      storageMemory: 'Memory Only (Safest)',
      storageSession: 'Session Storage (Cleared on tab close)',
      storageWarning: 'Keys are never sent to external third-party servers. In Memory Only mode they are wiped immediately on page refresh.',
      exportEnv: 'Export .env',
      clearSecrets: 'Clear All Secrets',
      secretsCleared: 'All secrets wiped from memory and Session Storage.',
      envExported: '.env configuration downloaded for local Python daemon startup.',
      transportTitle: 'Transport & Daemon Connection',
      transportDesc: 'Toggle between autonomous Local Simulation Engine and a live Python daemon (REST / WebSocket).',
      modeLocalSim: 'Local Simulation Engine',
      modeRemoteDaemon: 'Remote Python Daemon',
      daemonUrlLabel: 'Daemon Base URL',
      testConnection: 'Test Connection',
      testing: 'Checking /health...',
      connectDaemon: 'Connect Daemon',
      policyTitle: 'Engine Policy Defaults',
      policyDesc: 'Policy updates take effect deterministically and are recorded in the SHA-256 audit log.',
    },
  },
};
