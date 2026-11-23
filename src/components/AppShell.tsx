import React from 'react';
import {
  Activity,
  AlertOctagon,
  BarChart3,
  CheckCircle2,
  Cpu,
  Globe,
  Layers,
  Menu,
  MessageSquareCode,
  Moon,
  Plus,
  Radio,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import type { Locale, ThemeMode } from '../core/settings';
import type { EngineSnapshot } from '../core/types';
import type { Dictionary, NavSectionId } from '../i18n/translations';

interface AppShellProps {
  activeSection: NavSectionId;
  onSelectSection: (section: NavSectionId) => void;
  drawerOpen: boolean;
  onSetDrawerOpen: (open: boolean) => void;
  snapshot: EngineSnapshot;
  theme: ThemeMode;
  locale: Locale;
  t: Dictionary;
  onToggleTheme: () => void;
  onToggleLocale: () => void;
  onOpenDispatch: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: readonly { id: NavSectionId; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { id: 'overview', icon: BarChart3 },
    { id: 'tasks', icon: Layers },
    { id: 'chat', icon: MessageSquareCode },
    { id: 'watchdog', icon: Activity },
    { id: 'security', icon: ShieldCheck },
    { id: 'settings', icon: Settings },
  ];

export const AppShell: React.FC<AppShellProps> = ({
  activeSection,
  onSelectSection,
  drawerOpen,
  onSetDrawerOpen,
  snapshot,
  theme,
  locale,
  t,
  onToggleTheme,
  onToggleLocale,
  onOpenDispatch,
  children,
}) => {
  const humanRequiredCount = snapshot.tasks.filter((task) => task.state === 'HUMAN_REQUIRED').length;
  const dlqCount = snapshot.dlq.length;
  const auditValid = snapshot.audit_verification.valid;

  const handleNavClick = (id: NavSectionId) => {
    onSelectSection(id);
    onSetDrawerOpen(false);
  };

  const renderSidebarNav = () => (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800">
      {/* Brand Lockup */}
      <div className="h-14 px-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => handleNavClick('overview')}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-7 h-7 border border-cyan-600/35 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-500/10 flex items-center justify-center text-cyan-700 dark:text-cyan-400">
            <Cpu className="w-4 h-4" />
          </div>
          <span className="font-mono text-sm font-bold tracking-wider text-slate-900 dark:text-zinc-100 whitespace-nowrap">
            METACORE HUB
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSetDrawerOpen(false)}
          className="lg:hidden p-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto" aria-label="Primary navigation">
        {NAV_ITEMS.map(({ id, icon: Icon }) => {
          const isActive = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleNavClick(id)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-cyan-50 dark:bg-cyan-500/12 text-cyan-900 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-500/40 font-semibold'
                  : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:text-slate-900 dark:hover:text-zinc-100 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive
                      ? 'text-cyan-700 dark:text-cyan-400'
                      : 'text-slate-400 dark:text-zinc-500'
                  }`}
                />
                <span className="truncate">{t.nav[id]}</span>
              </span>

              {id === 'tasks' && humanRequiredCount > 0 && (
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 tabular-nums shrink-0">
                  {humanRequiredCount}
                </span>
              )}

              {id === 'security' && (dlqCount > 0 || !auditValid) && (
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 tabular-nums shrink-0">
                  {!auditValid ? '!' : dlqCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Bottom Quick Controls (Theme & Locale) */}
      <div className="p-3 border-t border-slate-200 dark:border-zinc-800 space-y-2.5 bg-slate-50/70 dark:bg-zinc-900/30">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.common.light}</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-600" />
                <span>{t.common.dark}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleLocale}
            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono font-semibold border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>{locale.toUpperCase()}</span>
          </button>
        </div>

        <div className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 flex items-center justify-between px-0.5">
          <span>CoreEngine FSM</span>
          <span className="tabular-nums">
            {snapshot.tasks.length} tasks · {snapshot.audit.length} links
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-60 xl:w-64 shrink-0 sticky top-0 h-screen">
        {renderSidebarNav()}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => onSetDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl">
            {renderSidebarNav()}
          </div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Compact 56px Sticky Top Bar */}
        <header className="h-14 sticky top-0 z-30 border-b border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xs px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Burger (mobile) + Active Section Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => onSetDrawerOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h1 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
              {t.nav[activeSection]}
            </h1>
          </div>

          {/* Right: Compact Status Indicators + Dispatch CTA */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Transport Badge */}
            <button
              type="button"
              onClick={() => onSelectSection('settings')}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                snapshot.transport_mode === 'DAEMON'
                  ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-cyan-300 dark:border-cyan-500/35 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300'
              }`}
              title="Transport Settings"
            >
              <Radio className="w-3 h-3" />
              {snapshot.transport_mode === 'DAEMON' ? t.common.daemon : t.common.simulation}
            </button>

            {/* SHA-256 Audit Badge */}
            <button
              type="button"
              onClick={() => onSelectSection('security')}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                auditValid
                  ? 'border-emerald-300 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-rose-400 dark:border-rose-500/55 bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300'
              }`}
              title="Audit Chain Status"
            >
              {auditValid ? (
                <CheckCircle2 className="w-3 h-3 shrink-0" />
              ) : (
                <AlertOctagon className="w-3 h-3 shrink-0 animate-pulse" />
              )}
              <span className="hidden md:inline">
                {auditValid ? t.common.auditValid : t.common.auditTampered}
              </span>
              <span className="md:hidden">{auditValid ? 'SHA OK' : 'TAMPER'}</span>
            </button>

            {/* Pulsing HITL Alert Badge when > 0 */}
            {humanRequiredCount > 0 && (
              <button
                type="button"
                onClick={() => onSelectSection('tasks')}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-bold border border-rose-400 dark:border-rose-500/55 bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 whitespace-nowrap cursor-pointer"
                title="Tasks awaiting Human-in-the-Loop decision"
              >
                <AlertOctagon className="w-3 h-3 text-rose-600 dark:text-rose-400 animate-pulse" />
                <span>
                  {t.common.hitlBadge} {humanRequiredCount}
                </span>
              </button>
            )}

            {/* + Dispatch Task CTA */}
            <button
              type="button"
              onClick={onOpenDispatch}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold bg-cyan-600 dark:bg-cyan-500 text-white dark:text-zinc-950 hover:bg-cyan-700 dark:hover:bg-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">{t.common.dispatchTask}</span>
              <span className="sm:hidden">Task</span>
            </button>
          </div>
        </header>

        {/* Non-sticky Compact Policy Summary Strip (hidden on Settings page where full controls live) */}
        {activeSection !== 'settings' && (
          <div className="border-b border-slate-200 dark:border-zinc-800/80 bg-slate-100/70 dark:bg-zinc-900/40 px-3 sm:px-5 py-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] font-mono tabular-nums text-slate-600 dark:text-zinc-400">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 font-sans font-medium text-slate-700 dark:text-zinc-300">
                <SlidersHorizontal className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                {t.common.policySummary}:
              </span>
              <span>
                {t.common.hitlMode}{' '}
                <strong
                  className={
                    snapshot.policy.hitl_mode
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-800 dark:text-zinc-200'
                  }
                >
                  {snapshot.policy.hitl_mode ? t.common.on : t.common.off}
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-zinc-700">
                ·
              </span>
              <span>
                {t.common.threshold}{' '}
                <strong className="text-cyan-700 dark:text-cyan-300">
                  {snapshot.policy.auto_merge_threshold.toFixed(2)}
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-zinc-700">
                ·
              </span>
              <span>
                {t.common.maxRework}{' '}
                <strong className="text-amber-700 dark:text-amber-300">
                  {snapshot.policy.max_rework}
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-zinc-700 hidden sm:inline">
                ·
              </span>
              <span className="hidden sm:inline">
                {t.common.stallTimeout}{' '}
                <strong className="text-slate-800 dark:text-zinc-200">
                  {snapshot.policy.stall_timeout_sec}s
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-zinc-700 hidden sm:inline">
                ·
              </span>
              <span className="hidden sm:inline">
                {t.common.simClock}{' '}
                <strong className="text-cyan-700 dark:text-cyan-300">{snapshot.sim_speed}x</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => onSelectSection('settings')}
              className="text-cyan-700 dark:text-cyan-400 hover:underline font-sans font-medium cursor-pointer"
            >
              {t.common.editPolicy}
            </button>
          </div>
        )}

        {/* Active Section Viewport */}
        <main className="flex-1 min-w-0 flex flex-col">{children}</main>
      </div>
    </div>
  );
};
