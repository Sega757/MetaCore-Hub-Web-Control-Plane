import React, { useState } from 'react';
import { AlertTriangle, Plus, ShieldAlert, X } from 'lucide-react';
import { isForbiddenBranch } from '../core/contracts';
import type { SubmitResult } from '../core/types';

interface DispatchTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitEvent: (rawEvent: unknown) => Promise<SubmitResult>;
  onTaskCreated: (taskId: string) => void;
}

export const DispatchTaskModal: React.FC<DispatchTaskModalProps> = ({
  open,
  onClose,
  onSubmitEvent,
  onTaskCreated,
}) => {
  const [repo, setRepo] = useState('Sega757/Metacore-Hub');
  const [branch, setBranch] = useState('feat/evidence-gate-check');
  const [prompt, setPrompt] = useState(
    'Implement deterministic schema check for arbiter confidence range and add regression tests.'
  );
  const [files, setFiles] = useState<string[]>([
    'src/metacore/contracts.py',
    'tests/test_contracts.py',
  ]);
  const [fileInput, setFileInput] = useState('');
  const [errorResult, setErrorResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const branchForbidden = isForbiddenBranch(branch);

  const handleAddFile = () => {
    const trimmed = fileInput.trim();
    if (!trimmed) return;
    if (!files.includes(trimmed)) {
      setFiles((prev) => [...prev, trimmed]);
    }
    setFileInput('');
  };

  const handleRemoveFile = (target: string) => {
    setFiles((prev) => prev.filter((f) => f !== target));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorResult(null);

    const res = await onSubmitEvent({
      type: 'dispatch_task',
      repo,
      branch,
      prompt,
      files,
    });

    setSubmitting(false);
    if (!res.accepted) {
      setErrorResult(
        `Rejected by CoreEngine -> recorded in ${res.dlq_entry?.id ?? 'DLQ'}: ${res.message}`
      );
      return;
    }

    if (res.task_id) {
      onTaskCreated(res.task_id);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Dispatch Task"
    >
      <div className="w-full max-w-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 overflow-hidden shadow-xl">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Dispatch Task Event
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Validated against dispatch_task contract with Scope Pinning and branch guard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="dispatch-repo"
                className="block text-xs text-slate-700 dark:text-zinc-300"
              >
                Repository
              </label>
              <input
                id="dispatch-repo"
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="dispatch-branch"
                className="block text-xs text-slate-700 dark:text-zinc-300"
              >
                Target Branch
              </label>
              <input
                id="dispatch-branch"
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                required
                className={`w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-zinc-900 border text-slate-900 dark:text-zinc-100 focus:outline-none ${
                  branchForbidden
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-slate-300 dark:border-zinc-700 focus:border-cyan-500'
                }`}
              />
            </div>
          </div>

          {branchForbidden && (
            <div className="p-2.5 border border-rose-300 dark:border-rose-500/45 bg-rose-50 dark:bg-rose-500/15 text-xs font-mono text-rose-800 dark:text-rose-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>
                Branch &quot;{branch.trim()}&quot; is strictly forbidden by contract. Submitting
                will route this event directly to <span className="font-bold">engine.dlq</span>{' '}
                without creating a task.
              </span>
            </div>
          )}

          {/* Allowed Files (Scope Pinning) */}
          <div className="space-y-1.5">
            <label
              htmlFor="dispatch-file-input"
              className="block text-xs text-slate-700 dark:text-zinc-300"
            >
              Allowed Files (Scope Pinning Whitelist)
            </label>
            <div className="flex gap-2">
              <input
                id="dispatch-file-input"
                type="text"
                value={fileInput}
                onChange={(e) => setFileInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddFile();
                  }
                }}
                placeholder="src/metacore/new_module.py"
                className="flex-1 px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleAddFile}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Pin File
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {files.length === 0 ? (
                <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
                  Warning: empty allowed_files fails schema validation (-&gt; DLQ).
                </span>
              ) : (
                files.map((file) => (
                  <span
                    key={file}
                    className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200"
                  >
                    {file}
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(file)}
                      className="text-slate-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                      aria-label={`Remove ${file}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="dispatch-prompt"
              className="block text-xs text-slate-700 dark:text-zinc-300"
            >
              Task Specification Prompt
            </label>
            <textarea
              id="dispatch-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {errorResult && (
            <div className="p-2.5 border border-rose-300 dark:border-rose-500/50 bg-rose-50 dark:bg-rose-500/15 text-xs font-mono text-rose-800 dark:text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{errorResult}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium border border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                branchForbidden
                  ? 'bg-rose-600 dark:bg-rose-500 text-white dark:text-zinc-950 hover:bg-rose-700 dark:hover:bg-rose-400'
                  : 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-zinc-950 hover:bg-cyan-700 dark:hover:bg-cyan-400'
              }`}
            >
              {branchForbidden
                ? 'Test Protected Branch Guard (-> DLQ)'
                : submitting
                  ? 'Dispatching...'
                  : 'Submit dispatch_task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
