import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Cpu,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import {
  generateDeterministicArbiterReply,
  type ArbiterChatMessage,
} from '../core/arbiterChat';
import type { Locale } from '../core/settings';
import type { EnginePolicy, SubmitResult, TaskRecord } from '../core/types';
import type { Dictionary } from '../i18n/translations';
import { formatUtcTime, TASK_STATE_STYLE } from './semantics';

interface ArbiterChatViewProps {
  tasks: TaskRecord[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  policy: EnginePolicy;
  simClockMs: number;
  hasGeminiApiKey: boolean;
  locale: Locale;
  t: Dictionary;
  onSubmitEvent: (rawEvent: unknown) => Promise<SubmitResult>;
}

export const ArbiterChatView: React.FC<ArbiterChatViewProps> = ({
  tasks,
  selectedTaskId,
  onSelectTask,
  policy,
  simClockMs,
  hasGeminiApiKey,
  locale,
  t,
  onSubmitEvent,
}) => {
  const activeTask = tasks.find((tk) => tk.task_id === selectedTaskId) ?? tasks[0] ?? null;
  const [input, setInput] = useState('');
  const [seq, setSeq] = useState(2);
  const [submittingProposalId, setSubmittingProposalId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ArbiterChatMessage[]>(() => [
    {
      id: 'CHAT-0001',
      role: 'arbiter',
      timestamp: simClockMs,
      taskId: activeTask?.task_id ?? null,
      content:
        locale === 'ru'
          ? 'Детерминированный Арбитр подключён к снимку CoreEngine. Выберите задачу выше или нажмите быструю команду для разбора блокировки, рисков патча или подготовки контракта.'
          : 'Deterministic Arbiter attached to CoreEngine snapshot. Pick a task above or click a quick command to inspect blocks, audit patch risks, or draft a contract proposal.',
    },
  ]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendQuery = (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    const userSeq = seq;
    const replySeq = seq + 1;
    setSeq(seq + 2);

    const userMsg: ArbiterChatMessage = {
      id: `CHAT-${String(userSeq).padStart(4, '0')}`,
      role: 'operator',
      timestamp: simClockMs,
      taskId: activeTask?.task_id ?? null,
      content: text,
    };

    const reply = generateDeterministicArbiterReply({
      query: text,
      task: activeTask,
      policy,
      locale,
      sequence: replySeq,
      nowMs: simClockMs + 500,
    });

    setMessages((prev) => [...prev, userMsg, reply]);
    setInput('');
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuery(input);
  };

  const handleDispatchProposal = async (msgId: string) => {
    const targetMsg = messages.find((m) => m.id === msgId);
    if (!targetMsg?.proposal || targetMsg.proposal.status === 'ACCEPTED') return;

    setSubmittingProposalId(targetMsg.proposal.id);
    const res = await onSubmitEvent(targetMsg.proposal.event);
    setSubmittingProposalId(null);

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.proposal) return m;
        return {
          ...m,
          proposal: {
            ...m.proposal,
            status: res.accepted ? 'ACCEPTED' : 'REJECTED',
            engineFeedback: res.message,
          },
        };
      })
    );

    if (res.accepted && res.task_id && targetMsg.proposal.event.type === 'dispatch_task') {
      onSelectTask(res.task_id);
    }
  };

  const quickChips = [
    t.chat.chips.explainBlock,
    t.chat.chips.genRework,
    t.chat.chips.auditRisks,
    t.chat.chips.planNewTask,
  ];

  return (
    <div className="flex-1 flex flex-col max-w-[1200px] w-full mx-auto p-4 sm:p-6 gap-4 min-h-0">
      {/* Top Chat Context Bar */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <label
              htmlFor="chat-task-select"
              className="text-xs font-medium text-slate-600 dark:text-zinc-400 whitespace-nowrap"
            >
              {t.chat.taskSelectorLabel}:
            </label>
            <select
              id="chat-task-select"
              value={activeTask?.task_id ?? ''}
              onChange={(e) => onSelectTask(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500 max-w-full"
            >
              {tasks.map((tk) => (
                <option key={tk.task_id} value={tk.task_id}>
                  {tk.task_id} · {tk.state} · {tk.branch}
                </option>
              ))}
            </select>
            {activeTask && (
              <span
                className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 border ${TASK_STATE_STYLE[activeTask.state].text} ${TASK_STATE_STYLE[activeTask.state].bg} ${TASK_STATE_STYLE[activeTask.state].border}`}
              >
                {activeTask.state}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold border ${
                hasGeminiApiKey
                  ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-cyan-300 dark:border-cyan-500/35 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300'
              }`}
            >
              {hasGeminiApiKey ? (
                <Sparkles className="w-3.5 h-3.5" />
              ) : (
                <Cpu className="w-3.5 h-3.5" />
              )}
              {hasGeminiApiKey ? t.chat.modeGeminiReady : t.chat.modeSimulation}
            </span>

            <button
              type="button"
              onClick={() =>
                setMessages([
                  {
                    id: 'CHAT-0001',
                    role: 'arbiter',
                    timestamp: simClockMs,
                    taskId: activeTask?.task_id ?? null,
                    content: t.chat.subtitle,
                  },
                ])
              }
              className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-zinc-800 cursor-pointer"
              title={t.chat.clearChat}
              aria-label={t.chat.clearChat}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Strict Architectural Invariant Banner */}
        <div className="px-3 py-2 border border-amber-300/70 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-[11px] font-mono text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span>{t.chat.invariantBanner}</span>
        </div>
      </div>

      {/* Chat Messages Viewport */}
      <div className="flex-1 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 flex flex-col min-h-[380px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isOp = msg.role === 'operator';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOp ? 'justify-end' : 'justify-start'}`}
              >
                {!isOp && (
                  <div className="w-7 h-7 border border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-500/10 flex items-center justify-center text-cyan-700 dark:text-cyan-400 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-2xl w-full sm:w-auto border p-3.5 space-y-2.5 ${
                    isOp
                      ? 'border-cyan-300 dark:border-cyan-500/40 bg-cyan-50/70 dark:bg-cyan-950/30'
                      : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 text-[10px] font-mono text-slate-500 dark:text-zinc-500 tabular-nums">
                    <span className="font-semibold text-slate-700 dark:text-zinc-300">
                      {isOp ? 'OPERATOR' : 'ARBITER'}
                      {msg.taskId ? ` · ${msg.taskId}` : ''}
                    </span>
                    <span>{formatUtcTime(msg.timestamp)}</span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-800 dark:text-zinc-200 leading-relaxed">
                    {msg.content}
                  </p>

                  {msg.bullets && msg.bullets.length > 0 && (
                    <ul className="space-y-1.5 border-t border-slate-200 dark:border-zinc-800 pt-2.5 text-xs font-mono text-slate-700 dark:text-zinc-300">
                      {msg.bullets.map((line, idx) => (
                        <li key={idx} className="leading-relaxed">
                          • {line}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Contract-validated CoreEngine Proposal Card */}
                  {msg.proposal && (
                    <div className="mt-2 p-3 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                        <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                          PROPOSAL: {String(msg.proposal.event.type)}
                        </span>
                        {msg.proposal.status === 'ACCEPTED' && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t.chat.proposalSubmitted}
                          </span>
                        )}
                        {msg.proposal.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 font-semibold">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            {t.chat.proposalRejected}
                          </span>
                        )}
                      </div>

                      <pre className="p-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-[11px] font-mono text-slate-700 dark:text-zinc-300 overflow-x-auto">
                        {JSON.stringify(msg.proposal.event, null, 2)}
                      </pre>

                      {msg.proposal.engineFeedback && (
                        <div
                          className={`text-[11px] font-mono px-2.5 py-1.5 border ${
                            msg.proposal.status === 'ACCEPTED'
                              ? 'border-emerald-300 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                              : 'border-rose-300 dark:border-rose-500/45 bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {msg.proposal.engineFeedback}
                        </div>
                      )}

                      {msg.proposal.status !== 'ACCEPTED' && (
                        <button
                          type="button"
                          disabled={submittingProposalId === msg.proposal.id}
                          onClick={() => handleDispatchProposal(msg.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-600 dark:bg-cyan-500 text-white dark:text-zinc-950 hover:bg-cyan-700 dark:hover:bg-cyan-400 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {t.chat.submitProposal}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isOp && (
                  <div className="w-7 h-7 border border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-900 flex items-center justify-center text-slate-600 dark:text-zinc-300 shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
          <div ref={scrollEndRef} />
        </div>

        {/* Quick Command Chips + Composer */}
        <div className="border-t border-slate-200 dark:border-zinc-800 p-3.5 space-y-3 bg-slate-50/70 dark:bg-zinc-950/80">
          <div className="flex flex-wrap gap-1.5">
            {quickChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => sendQuery(chip)}
                className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:border-cyan-500 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmitForm} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.chat.placeholder}
              className="flex-1 min-w-0 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-cyan-600 dark:bg-cyan-500 text-white dark:text-zinc-950 hover:bg-cyan-700 dark:hover:bg-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {t.chat.send}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
