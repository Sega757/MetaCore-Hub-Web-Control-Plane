import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected control plane render exception.',
    };
  }

  componentDidCatch(error: Error): void {
    console.error('MetaCore Hub ErrorBoundary caught:', error);
  }

  handleRecover = (): void => {
    this.setState({ hasError: false, message: '' });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full border border-rose-400 dark:border-rose-500/40 bg-white dark:bg-zinc-900 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h1 className="text-base font-semibold">Control Plane Render Fault</h1>
            </div>
            <p className="text-sm text-slate-700 dark:text-zinc-300 font-mono break-words bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-3">
              {this.state.message}
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              CoreEngine state remains isolated from UI exceptions. Reset the view to continue.
            </p>
            <button
              type="button"
              onClick={this.handleRecover}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:opacity-90 transition-opacity cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Recover Control Plane
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
