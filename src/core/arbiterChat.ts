import type { Locale } from './settings';
import type { EnginePolicy, TaskRecord } from './types';

export interface ChatProposal {
  id: string;
  label: string;
  description: string;
  event: Record<string, unknown>;
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  engineFeedback?: string;
}

export interface ArbiterChatMessage {
  id: string;
  role: 'operator' | 'arbiter';
  timestamp: number;
  taskId: string | null;
  content: string;
  bullets?: string[];
  proposal?: ChatProposal;
}

/**
 * Deterministic Arbiter response generator (zero Math.random()).
 * Inspects real TaskRecord evidence, gates, watchdog, and policy to produce
 * actionable engineering analysis and contract-valid proposals.
 * Never mutates FSM directly and never proposes direct MERGED bypasses.
 */
export function generateDeterministicArbiterReply(params: {
  query: string;
  task: TaskRecord | null;
  policy: EnginePolicy;
  locale: Locale;
  sequence: number;
  nowMs: number;
}): ArbiterChatMessage {
  const { query, task, policy, locale, sequence, nowMs } = params;
  const q = query.toLowerCase();
  const isRu = locale === 'ru';
  const msgId = `CHAT-${String(sequence).padStart(4, '0')}`;

  // Guard: refuse attempts to force direct MERGED transition from chat
  if (
    q.includes('force merge') ||
    q.includes('сразу merge') ||
    q.includes('переведи в merged') ||
    q.includes('direct merge')
  ) {
    return {
      id: msgId,
      role: 'arbiter',
      timestamp: nowMs,
      taskId: task?.task_id ?? null,
      content: isRu
        ? 'Отказ по архитектурному инварианту: Арбитр и чат не имеют права напрямую переводить задачу в MERGED. Решение о мёрже принимает только CoreEngine после прохождения Evidence Gates либо оператор в HITL Decision Gate (с TOCTOU expected_version).'
        : 'Refused by CoreEngine invariant: Arbiter Chat cannot directly transition any task to MERGED. State transitions are owned exclusively by CoreEngine after Evidence Gates or explicit operator approval in the HITL Decision Gate.',
      bullets: isRu
        ? [
            'Инвариант: The LLM proposes; deterministic CoreEngine disposes.',
            'Для ручного одобрения перейдите в «Задачи и инспектор» -> HITL Decision Gate.',
          ]
        : [
            'Invariant: The LLM proposes; deterministic CoreEngine disposes.',
            'Use Tasks & Inspector -> HITL Decision Gate for operator-signed approval.',
          ],
    };
  }

  // 1. Propose a new task plan (dispatch_task contract proposal)
  if (
    q.includes('план новой задачи') ||
    q.includes('новую задачу') ||
    q.includes('new task') ||
    q.includes('propose') ||
    q.includes('dispatch')
  ) {
    const branchSuffix = `feat/hardening-gate-${100 + sequence}`;
    const proposalEvent = {
      type: 'dispatch_task',
      repo: task?.repo ?? 'Sega757/Metacore-Hub',
      branch: branchSuffix,
      prompt: isRu
        ? 'Добавить детерминированную проверку контракта patch_ready на path traversal и покрыть unit-тестами.'
        : 'Add deterministic path-traversal validation to patch_ready contract and cover with unit tests.',
      files: ['src/metacore/contracts.py', 'tests/test_contracts.py'],
    };

    return {
      id: msgId,
      role: 'arbiter',
      timestamp: nowMs,
      taskId: task?.task_id ?? null,
      content: isRu
        ? `Подготовлен черновик безопасной задачи в ветке ${branchSuffix} со строгим Scope Pinning (2 файла). Ветки main/master исключены.`
        : `Prepared a contract-compliant dispatch_task proposal on branch ${branchSuffix} with strict Scope Pinning (2 files). Protected branches main/master are excluded.`,
      bullets: isRu
        ? [
            `Репозиторий: ${proposalEvent.repo} @ ${proposalEvent.branch}`,
            `allowed_files: ${proposalEvent.files.join(', ')}`,
            'После отправки CoreEngine проверит JSON-контракт, создаст задачу в DISPATCHED и запишет звено в SHA-256 аудит.',
          ]
        : [
            `Repository: ${proposalEvent.repo} @ ${proposalEvent.branch}`,
            `allowed_files: ${proposalEvent.files.join(', ')}`,
            'Submitting validates the contract in CoreEngine, creates a DISPATCHED task, and appends a SHA-256 audit link.',
          ],
      proposal: {
        id: `PROP-${sequence}`,
        label: isRu ? 'Отправить dispatch_task в CoreEngine' : 'Submit dispatch_task to CoreEngine',
        description: `${proposalEvent.repo} @ ${proposalEvent.branch} (${proposalEvent.files.length} pinned files)`,
        event: proposalEvent,
        status: 'PENDING',
      },
    };
  }

  if (!task) {
    return {
      id: msgId,
      role: 'arbiter',
      timestamp: nowMs,
      taskId: null,
      content: isRu
        ? 'Выберите задачу в селекторе выше, чтобы проанализировать её Evidence Gates, риски патча или сформировать инструкции на Rework.'
        : 'Select a task from the selector above to inspect Evidence Gates, patch risks, or generate Rework instructions.',
    };
  }

  const outOfScope = task.gates?.out_of_scope_files ?? [];
  const passed = task.patch?.tests.passed ?? 0;
  const failed = task.patch?.tests.failed ?? 0;

  // 2. Generate Rework Instructions + actionable CoreEngine proposal
  if (q.includes('rework') || q.includes('реворк') || q.includes('инструкц')) {
    const instructionsParts: string[] = [];
    if (outOfScope.length > 0) {
      instructionsParts.push(
        isRu
          ? `Откатите изменения вне allowed_files (${outOfScope.join(', ')}) и оставьте правки строго в [${task.allowed_files.join(', ')}].`
          : `Revert out-of-scope edits (${outOfScope.join(', ')}) and restrict diff strictly to [${task.allowed_files.join(', ')}].`
      );
    }
    if (failed > 0 || (task.patch && passed === 0)) {
      instructionsParts.push(
        isRu
          ? `Исправьте ${failed} упавших тестов и убедитесь, что Test Gate проходит с failed=0 и passed>0.`
          : `Fix ${failed} failing test(s) and ensure Test Gate passes with failed=0 and passed>0.`
      );
    }
    if (task.gates?.fallback_capped) {
      instructionsParts.push(
        isRu
          ? 'Перезапустите проверку в чистом JSON-формате без синтаксических искажений ответа арбитра.'
          : 'Re-run verification with clean schema-compliant diff evidence after FallbackRules cap.'
      );
    }
    if (instructionsParts.length === 0) {
      instructionsParts.push(
        isRu
          ? `Уточните краевые случаи в ${task.allowed_files[0] ?? 'целевом модуле'} и добавьте регрессионный тест перед повторной подачей patch_ready.`
          : `Tighten edge-case handling in ${task.allowed_files[0] ?? 'target module'} and add a regression test before resubmitting patch_ready.`
      );
    }

    const instructionsText = instructionsParts.join(' ');
    const canSubmitHumanRework = task.state === 'HUMAN_REQUIRED';
    const canSubmitArbiterRework = task.state === 'ARBITER_VALIDATING';

    const proposal: ChatProposal | undefined = canSubmitHumanRework
      ? {
          id: `PROP-${sequence}`,
          label: isRu
            ? `Отправить human_decision (REWORK, v${task.version})`
            : `Submit human_decision (REWORK, v${task.version})`,
          description: instructionsText,
          event: {
            type: 'human_decision',
            task_id: task.task_id,
            decision: 'REWORK',
            expected_version: task.version,
            note: instructionsText,
          },
          status: 'PENDING',
        }
      : canSubmitArbiterRework
        ? {
            id: `PROP-${sequence}`,
            label: isRu
              ? 'Отправить arbiter_verdict (REWORK)'
              : 'Submit arbiter_verdict (REWORK)',
            description: instructionsText,
            event: {
              type: 'arbiter_verdict',
              task_id: task.task_id,
              verdict: 'REWORK',
              confidence: 0.72,
              engine_source: 'RuleBasedArbiter',
              rework_instructions: instructionsText,
            },
            status: 'PENDING',
          }
        : undefined;

    return {
      id: msgId,
      role: 'arbiter',
      timestamp: nowMs,
      taskId: task.task_id,
      content: isRu
        ? `Сформированы детерминированные инструкции на Rework для ${task.task_id} (текущий статус: ${task.state}, реворков: ${task.rework_count}/${policy.max_rework}):`
        : `Generated deterministic Rework instructions for ${task.task_id} (state: ${task.state}, reworks: ${task.rework_count}/${policy.max_rework}):`,
      bullets: [
        instructionsText,
        proposal
          ? isRu
            ? 'Предложение готово к отправке в CoreEngine с проверкой контракта и TOCTOU-версии.'
            : 'Proposal is ready for contract-validated submission to CoreEngine.'
          : isRu
            ? `Задача сейчас в состоянии ${task.state}: прямой переход в REWORK не разрешён таблицей FSM (допустимо из HUMAN_REQUIRED или ARBITER_VALIDATING).`
            : `Task is currently in ${task.state}: FSM table only allows REWORK submission from HUMAN_REQUIRED or ARBITER_VALIDATING.`,
      ],
      proposal,
    };
  }

  // 3. Audit Patch Risks
  if (q.includes('риск') || q.includes('risk') || q.includes('патч') || q.includes('patch')) {
    const riskBullets: string[] = [];
    if (!task.patch) {
      riskBullets.push(
        isRu
          ? 'Патч (patch_ready) ещё не поступал в CoreEngine. Активных изменений диффа нет.'
          : 'No patch_ready evidence submitted yet. Zero diff files to audit.'
      );
    } else {
      riskBullets.push(
        outOfScope.length > 0
          ? isRu
            ? `КРИТИЧЕСКИЙ РИСК (Scope Escape): затронуты файлы вне белого списка — ${outOfScope.join(', ')}. Авто-мёрж жёстко заблокирован.`
            : `CRITICAL RISK (Scope Escape): modified files outside allowed_files — ${outOfScope.join(', ')}. Auto-merge hard-blocked.`
          : isRu
            ? `Scope Pinning OK: все ${task.patch.diff_files.length} изменённых файлов входят в allowed_files.`
            : `Scope Pinning OK: all ${task.patch.diff_files.length} diff files are inside allowed_files.`
      );
      riskBullets.push(
        failed > 0 || passed === 0
          ? isRu
            ? `ВЫСОКИЙ РИСК (Test Gate): тесты ${passed} passed / ${failed} failed. Требуется починка до мёржа.`
            : `HIGH RISK (Test Gate): test report shows ${passed} passed / ${failed} failed. Must fix before merge.`
          : isRu
            ? `Test Gate OK: ${passed} тестов пройдено, 0 ошибок.`
            : `Test Gate OK: ${passed} tests passed, 0 failed.`
      );
      if (task.verdict) {
        riskBullets.push(
          isRu
            ? `Уверенность Арбитра: ${task.verdict.confidence.toFixed(2)} (источник: ${task.verdict.engine_source}, порог политики: ${policy.auto_merge_threshold.toFixed(2)}).`
            : `Arbiter Confidence: ${task.verdict.confidence.toFixed(2)} (source: ${task.verdict.engine_source}, policy threshold: ${policy.auto_merge_threshold.toFixed(2)}).`
        );
      }
    }

    return {
      id: msgId,
      role: 'arbiter',
      timestamp: nowMs,
      taskId: task.task_id,
      content: isRu
        ? `Аудит рисков патча для ${task.task_id} (${task.repo} @ ${task.branch}):`
        : `Patch risk audit for ${task.task_id} (${task.repo} @ ${task.branch}):`,
      bullets: riskBullets,
    };
  }

  // 4. Explain Block Reason / General Task Diagnostics (default)
  const reasons = task.escalation_reasons;
  const bullets: string[] = [];

  if (reasons.length > 0) {
    for (const r of reasons) {
      if (r === 'SCOPE_VIOLATION') {
        bullets.push(
          isRu
            ? `SCOPE_VIOLATION: воркер изменил [${outOfScope.join(', ')}] вне разрешённого списка [${task.allowed_files.join(', ')}]. CoreEngine заблокировал мёрж даже при высоком confidence.`
            : `SCOPE_VIOLATION: worker touched [${outOfScope.join(', ')}] outside allowed_files [${task.allowed_files.join(', ')}]. CoreEngine overrode arbiter confidence.`
        );
      } else if (r === 'TEST_FAILURE') {
        bullets.push(
          isRu
            ? `TEST_FAILURE: отчёт тестов (${passed} passed / ${failed} failed) не прошёл Test Gate.`
            : `TEST_FAILURE: test suite (${passed} passed / ${failed} failed) failed the mandatory Test Gate.`
        );
      } else if (r === 'ARBITER_FALLBACK') {
        bullets.push(
          isRu
            ? `ARBITER_FALLBACK: GeminiArbiter вернул битый JSON; FallbackRules срезал confidence до 0.80 (ниже порога ${policy.auto_merge_threshold.toFixed(2)}).`
            : `ARBITER_FALLBACK: GeminiArbiter faulted; FallbackRules capped confidence at 0.80 (below threshold ${policy.auto_merge_threshold.toFixed(2)}).`
        );
      } else if (r === 'LOW_CONFIDENCE') {
        bullets.push(
          isRu
            ? `LOW_CONFIDENCE: итоговый confidence ${task.verdict?.confidence.toFixed(2) ?? 'N/A'} < порога ${policy.auto_merge_threshold.toFixed(2)}.`
            : `LOW_CONFIDENCE: effective confidence ${task.verdict?.confidence.toFixed(2) ?? 'N/A'} < threshold ${policy.auto_merge_threshold.toFixed(2)}.`
        );
      } else if (r === 'MAX_REWORK_EXCEEDED') {
        bullets.push(
          isRu
            ? `MAX_REWORK_EXCEEDED: число реворков (${task.rework_count}) превысило лимит политики (${policy.max_rework}).`
            : `MAX_REWORK_EXCEEDED: rework count (${task.rework_count}) exceeded policy limit (${policy.max_rework}).`
        );
      } else if (r === 'HITL_MODE') {
        bullets.push(
          isRu
            ? 'HITL_MODE: в EnginePolicy включён ручной режим; авто-мёрж отключён для всех задач.'
            : 'HITL_MODE: EnginePolicy.hitl_mode is active; all APPROVE verdicts route through human review.'
        );
      } else if (r === 'CIRCUIT_BREAKER_OPEN') {
        bullets.push(
          isRu
            ? 'CIRCUIT_BREAKER_OPEN: воркер не отвечал после 2 nudge Watchdog и был изолирован до ручного сброса.'
            : 'CIRCUIT_BREAKER_OPEN: worker stalled past 2 Watchdog nudges and is isolated until manual reset.'
        );
      } else {
        bullets.push(r);
      }
    }
  } else {
    bullets.push(
      isRu
        ? `Текущее состояние FSM: ${task.state} (версия v${task.version}, реворков: ${task.rework_count}/${policy.max_rework}).`
        : `Current FSM state: ${task.state} (version v${task.version}, reworks: ${task.rework_count}/${policy.max_rework}).`
    );
    bullets.push(
      isRu
        ? `Разрешённые файлы (Scope Pinning): ${task.allowed_files.join(', ')}.`
        : `Pinned files (Scope Pinning): ${task.allowed_files.join(', ')}.`
    );
    if (task.state === 'MERGED') {
      bullets.push(
        isRu
          ? 'Блокировок нет: задача прошла все Evidence Gates и находится в терминальном состоянии MERGED.'
          : 'No blocks active: task satisfied all Evidence Gates and reached terminal state MERGED.'
      );
    } else if (task.state === 'IN_PROGRESS') {
      bullets.push(
        isRu
          ? `Воркер активен (Watchdog: ${Math.floor(task.watchdog.elapsed_sec)}s / ${policy.stall_timeout_sec}s до Nudge L1).`
          : `Worker active (Watchdog: ${Math.floor(task.watchdog.elapsed_sec)}s / ${policy.stall_timeout_sec}s to Nudge L1).`
      );
    }
  }

  return {
    id: msgId,
    role: 'arbiter',
    timestamp: nowMs,
    taskId: task.task_id,
    content:
      reasons.length > 0
        ? isRu
          ? `Диагностика блокировки для ${task.task_id} (${task.state}): зафиксировано ${reasons.length} оснований эскалации.`
          : `Block diagnostics for ${task.task_id} (${task.state}): ${reasons.length} escalation trigger(s) active.`
        : isRu
          ? `Сводка CoreEngine по задаче ${task.task_id}:`
          : `CoreEngine diagnostic summary for ${task.task_id}:`,
    bullets,
  };
}
