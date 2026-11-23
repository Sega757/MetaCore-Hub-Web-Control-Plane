import React, { useState } from 'react';
import { Clock, GitBranch, RefreshCw } from 'lucide-react';
import type { EnginePolicy, TaskRecord } from '../core/types';
import type { Dictionary } from '../i18n/translations';
import { getWatchdogEffectiveDisplay, TASK_STATE_STYLE } from './semantics';

interface TaskRegistryProps {
  tasks: TaskRecord[];
  policy: EnginePolicy;
  selectedTaskId: string | null;
  t: Dictionary;
  onSelectTask: (taskId: string) => void;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'HITL' | 'TERMINAL';

export const TaskRegistry: React.FC<TaskRegistryProps> = ({
  tasks,
  policy,
  selectedTaskId,
  t,
  onSelectTask,
}) => {
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') {
      return (
        task.state === 'DISPATCHED' ||
        task.state === 'IN_PROGRESS' ||
        task.state === 'ARBITER_VALIDATING' ||
        task.state === 'REWORK'
      );
    }
    if (filter === 'HITL') {
      return task.state === 'HUMAN_REQUIRED';
    }
    return task.state === 'MERGED' || task.state === 'FAILED' || task.state === 'CANCELLED';
  });

  const counts = {
    ALL: tasks.length,
    ACTIVE: tasks.filter(
      (tk) =>
        tk.state === 'DISPATCHED' ||
        tk.state === 'IN_PROGRESS' ||
        tk.state === 'ARBITER_VALIDATING' ||
        tk.state === 'REWORK'
    ).length,
    HITL: tasks.filter((tk) => tk.state === 'HUMAN_REQUIRED').length,
    TERMINAL: tasks.filter(
      (tk) => tk.state === 'MERGED' || tk.state === 'FAILED' || tk.state === 'CANCELLED'
    ).length,
  };

  return (
    <section className="flex flex-col h-full border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      {/* Header & Filter Bar */}
      <div className="p-3.5 border-b border-slate-200 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-800 dark:text-zinc-200 tracking-wide">
            {t.tasks.registryTitle}
          </h2>
          <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-zinc-500">
            {filteredTasks.length} / {tasks.length}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-zinc-900 p-0.5 border border-slate-200 dark:border-zinc-800">
          {(
            [
              { id: 'ALL', label: t.tasks.filterAll },
              { id: 'ACTIVE', label: t.tasks.filterActive },
              { id: 'HITL', label: t.tasks.filterHitl },
              { id: 'TERMINAL', label: t.tasks.filterDone },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`py-1 px-1 text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                {tab.label}{' '}
                <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-500 tabular-nums">
                  {counts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-zinc-800/80">
        {filteredTasks.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-zinc-500">
            {t.tasks.noTasksMatch}
          </div>
        ) : (
          filteredTasks.map((task) => {
            const style = TASK_STATE_STYLE[task.state];
            const wd = getWatchdogEffectiveDisplay(task, policy.stall_timeout_sec);
            const isSelected = task.task_id === selectedTaskId;

            return (
              <button
                key={task.task_id}
                type="button"
                onClick={() => onSelectTask(task.task_id)}
                className={`w-full text-left p-3.5 transition-colors cursor-pointer block ${
                  isSelected
                    ? 'bg-cyan-50/70 dark:bg-zinc-900 ring-1 ring-inset ring-cyan-500/50'
                    : 'bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900/50'
                }`}
              >
                {/* Line 1: Task ID + State */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100">
                      {task.task_id}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-500 tabular-nums">
                      v{task.version}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 border whitespace-nowrap ${style.text} ${style.bg} ${style.border}`}
                  >
                    {style.shortLabel}
                  </span>
                </div>

                {/* Line 2: Repo @ Branch */}
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-zinc-400 truncate">
                  <GitBranch className="w-3 h-3 shrink-0 text-slate-400 dark:text-zinc-500" />
                  <span className="truncate">
                    {task.repo.split('/').pop()} @{' '}
                    <span className="text-slate-800 dark:text-zinc-200">{task.branch}</span>
                  </span>
                </div>

                {/* Line 3: Prompt preview */}
                <p className="mt-1.5 text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {task.prompt}
                </p>

                {/* Line 4: Rework + Exact Watchdog Status */}
                <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-zinc-500">
                  <span
                    className={`inline-flex items-center gap-1 ${
                      task.rework_count >= policy.max_rework
                        ? 'text-rose-600 dark:text-rose-400'
                        : task.rework_count > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-500 dark:text-zinc-400'
                    }`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Rework {task.rework_count}/{policy.max_rework}
                  </span>

                  <span className={`inline-flex items-center gap-1 ${wd.textClass}`}>
                    <Clock className="w-3 h-3" />
                    {wd.compactLabel}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
};
