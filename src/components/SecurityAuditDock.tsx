import React, { useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  GlobeLock,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from 'lucide-react';
import {
  DEFAULT_A2A_ALLOWLIST,
  simulateFetchCard,
  type A2AFetchCardResult,
} from '../core/a2a';
import type { AuditEntry, AuditVerificationResult, DlqEntry } from '../core/types';
import type { Dictionary } from '../i18n/translations';
import { formatUtcTime, shortHash, TASK_STATE_STYLE } from './semantics';

export type SecurityDockTab = 'AUDIT' | 'DLQ' | 'A2A';

interface SecurityAuditDockProps {
  activeTab: SecurityDockTab;
  onChangeTab: (tab: SecurityDockTab) => void;
  audit: AuditEntry[];
  verification: AuditVerificationResult;
  dlq: DlqEntry[];
  t: Dictionary;
  onVerifyChain: () => Promise<AuditVerificationResult>;
  onSimulateTamper: () => Promise<number | null>;
  onResetDemo: () => void;
}

const A2A_PRESET_URLS = [
  {
    label: 'AWS Metadata (SSRF)',
    url: 'http://169.254.169.254/latest/meta-data/',
    expected: 'BLOCK',
  },
  {
    label: 'Localhost 8080 (SSRF)',
    url: 'http://127.0.0.1:8080/agent-card.json',
    expected: 'BLOCK',
  },
  {
    label: 'Private 10.0.0.1 (SSRF)',
    url: 'http://10.0.0.1/internal/card.json',
    expected: 'BLOCK',
  },
  {
    label: 'Trusted Internal Agent',
    url: 'https://agents.metacore.internal/v0.3/agent-card.json',
    expected: 'ALLOW',
  },
] as const;

export const SecurityAuditDock: React.FC<SecurityAuditDockProps> = ({
  activeTab,
  onChangeTab,
  audit,
  verification,
  dlq,
  t,
  onVerifyChain,
  onSimulateTamper,
  onResetDemo,
}) => {
  const [expandedAuditIdx, setExpandedAuditIdx] = useState<number | null>(null);
  const [expandedDlqIds, setExpandedDlqIds] = useState<Record<string, boolean>>({});
  const [tamperNotice, setTamperNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // A2A Hardening Lab State
  const [a2aUrl, setA2aUrl] = useState<string>(
    'https://agents.metacore.internal/v0.3/agent-card.json'
  );
  const [allowlist, setAllowlist] = useState<string[]>([...DEFAULT_A2A_ALLOWLIST]);
  const [newDomain, setNewDomain] = useState('');
  const [stripExtensionsHeader, setStripExtensionsHeader] = useState(false);
  const [a2aResult, setA2aResult] = useState<A2AFetchCardResult>(() =>
    simulateFetchCard('https://agents.metacore.internal/v0.3/agent-card.json', {
      allowlist: DEFAULT_A2A_ALLOWLIST,
      simulateProxyStripHeader: false,
    })
  );

  const handleVerify = async () => {
    setVerifying(true);
    const res = await onVerifyChain();
    setVerifying(false);
    if (res.valid) {
      setTamperNotice(`Full SHA-256 verification passed across ${res.total} chain links.`);
    } else {
      setTamperNotice(
        `TAMPER DETECTED at audit index #${res.first_broken_index}! Hash mismatch broke chain continuity.`
      );
      if (res.first_broken_index !== null) {
        setExpandedAuditIdx(res.first_broken_index);
      }
    }
  };

  const handleTamper = async () => {
    const idx = await onSimulateTamper();
    if (idx !== null) {
      setTamperNotice(
        `Silently altered 1 character in historical audit entry #${idx}. Click "Verify Chain" to detect.`
      );
    }
  };

  const handleExportAuditJson = () => {
    const payload = {
      exported_at_utc: new Date().toISOString(),
      verification,
      entries: audit,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `metacore-audit-chain-${audit.length}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const runFetchCard = (urlOverride?: string, stripOverride?: boolean, listOverride?: string[]) => {
    const targetUrl = urlOverride ?? a2aUrl;
    const targetStrip = stripOverride ?? stripExtensionsHeader;
    const targetList = listOverride ?? allowlist;
    const res = simulateFetchCard(targetUrl, {
      allowlist: targetList,
      simulateProxyStripHeader: targetStrip,
    });
    setA2aResult(res);
  };

  const handleAddAllowlistDomain = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newDomain.trim().toLowerCase();
    if (!cleaned || allowlist.includes(cleaned)) return;
    const next = [...allowlist, cleaned];
    setAllowlist(next);
    setNewDomain('');
    runFetchCard(a2aUrl, stripExtensionsHeader, next);
  };

  const handleRemoveAllowlistDomain = (domain: string) => {
    const next = allowlist.filter((d) => d !== domain);
    setAllowlist(next);
    runFetchCard(a2aUrl, stripExtensionsHeader, next);
  };

  const reversedAudit = [...audit].reverse();

  return (
    <section className="flex-1 flex flex-col max-w-[1440px] w-full mx-auto p-4 sm:p-6 gap-4">
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col">
        {/* Tab Header */}
        <div className="px-3 sm:px-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => onChangeTab('AUDIT')}
              className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'AUDIT'
                  ? 'border-emerald-500 text-slate-900 dark:text-zinc-100'
                  : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              {t.security.tabAudit}{' '}
              <span className="font-mono text-[11px] text-slate-400 dark:text-zinc-500 ml-1 tabular-nums">
                ({audit.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => onChangeTab('DLQ')}
              className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'DLQ'
                  ? 'border-rose-500 text-slate-900 dark:text-zinc-100'
                  : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              {t.security.tabDlq}{' '}
              <span
                className={`font-mono text-[11px] ml-1 tabular-nums ${
                  dlq.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-zinc-500'
                }`}
              >
                ({dlq.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => onChangeTab('A2A')}
              className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'A2A'
                  ? 'border-cyan-500 text-slate-900 dark:text-zinc-100'
                  : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              {t.security.tabA2a}
            </button>
          </div>

          {activeTab === 'AUDIT' && (
            <div className="flex flex-wrap items-center gap-2 py-2">
              <button
                type="button"
                disabled={verifying}
                onClick={handleVerify}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 dark:bg-emerald-500 text-white dark:text-zinc-950 hover:bg-emerald-700 dark:hover:bg-emerald-400 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {verifying ? t.security.verifying : t.security.verifyChain}
              </button>

              <button
                type="button"
                onClick={handleTamper}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-rose-300 dark:border-rose-500/45 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors cursor-pointer"
              >
                <ShieldOff className="w-3.5 h-3.5" />
                {t.security.simulateTamper}
              </button>

              <button
                type="button"
                onClick={handleExportAuditJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {t.security.exportJson}
              </button>

              {!verification.valid && (
                <button
                  type="button"
                  onClick={() => {
                    setTamperNotice(null);
                    setExpandedAuditIdx(null);
                    onResetDemo();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-cyan-400 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t.security.resetCleanChain}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab 1: Tamper-Evident Audit Log (Hardening #2: Mobile 2nd-line hash + click to expand full JSON & full SHA-256) */}
        {activeTab === 'AUDIT' && (
          <div className="p-4 sm:p-5 space-y-3">
            <div
              className={`px-3.5 py-2.5 border flex flex-wrap items-center justify-between gap-2 text-xs font-mono ${
                verification.valid
                  ? 'border-emerald-300 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                  : 'border-rose-400 dark:border-rose-500/55 bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {verification.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span>
                  {verification.valid
                    ? `AUDIT VALID · Web Crypto SHA-256 chain intact (${audit.length} links)`
                    : `TAMPER DETECTED · Broken at #${verification.first_broken_index} (expected ${shortHash(
                        verification.expected_hash ?? '',
                        12
                      )} != actual ${shortHash(verification.actual_hash ?? '', 12)})`}
                </span>
              </div>
              {tamperNotice && (
                <span className="text-[11px] text-slate-600 dark:text-zinc-300">{tamperNotice}</span>
              )}
            </div>

            <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-500">
              {t.security.clickRowToInspect}
            </div>

            <div className="border border-slate-200 dark:border-zinc-800 divide-y divide-slate-200 dark:divide-zinc-800/80 max-h-[480px] overflow-y-auto">
              {reversedAudit.map((entry) => {
                const isBrokenLink =
                  !verification.valid &&
                  verification.first_broken_index !== null &&
                  entry.index === verification.first_broken_index;
                const isDownstreamBroken =
                  !verification.valid &&
                  verification.first_broken_index !== null &&
                  entry.index > verification.first_broken_index;
                const isExpanded = expandedAuditIdx === entry.index;

                return (
                  <div
                    key={entry.index}
                    className={
                      isBrokenLink
                        ? 'bg-rose-100/80 dark:bg-rose-500/20'
                        : isDownstreamBroken
                          ? 'bg-rose-50/50 dark:bg-rose-950/20'
                          : 'bg-white dark:bg-zinc-950'
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedAuditIdx((prev) => (prev === entry.index ? null : entry.index))
                      }
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition-colors cursor-pointer"
                    >
                      {/* Desktop Single-Row / Mobile Stacked 2-Line Layout */}
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 text-xs font-mono tabular-nums">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                          )}

                          <span
                            className={
                              isBrokenLink
                                ? 'text-rose-700 dark:text-rose-400 font-bold'
                                : 'text-slate-400 dark:text-zinc-500'
                            }
                          >
                            {isBrokenLink ? `!#${entry.index}` : `#${entry.index}`}
                          </span>

                          <span className="text-slate-500 dark:text-zinc-400">
                            {formatUtcTime(entry.timestamp)}
                          </span>

                          <span className="font-bold text-slate-900 dark:text-zinc-100">
                            {entry.task_id}
                          </span>

                          <span className="text-cyan-700 dark:text-cyan-300">
                            {entry.event_type}
                          </span>

                          {entry.state_after !== 'NONE' && (
                            <span className={TASK_STATE_STYLE[entry.state_after].text}>
                              {entry.state_after}
                            </span>
                          )}
                        </div>

                        {/* Hash link: right-aligned on desktop, clean 2nd line on mobile */}
                        <div className="pl-6 md:pl-0 text-[11px] whitespace-nowrap shrink-0">
                          <span className="text-slate-400 dark:text-zinc-500">
                            {shortHash(entry.prev_hash)}
                          </span>
                          <span className="text-slate-400 dark:text-zinc-600 mx-1.5">-&gt;</span>
                          <span
                            className={
                              isBrokenLink
                                ? 'text-rose-700 dark:text-rose-300 font-bold'
                                : 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            }
                          >
                            {shortHash(entry.hash)}
                          </span>
                        </div>
                      </div>

                      <div className="pl-6 mt-1 text-xs font-sans text-slate-600 dark:text-zinc-300 truncate">
                        {entry.summary}
                      </div>
                    </button>

                    {/* Expanded Full SHA-256 Hashes + Canonical JSON */}
                    {isExpanded && (
                      <div className="px-4 pb-3.5 pt-2 bg-slate-50 dark:bg-zinc-900/60 border-t border-slate-200 dark:border-zinc-800 space-y-2.5 text-[11px] font-mono">
                        <div className="space-y-1">
                          <div className="text-slate-500 dark:text-zinc-400 font-sans font-semibold">
                            {t.security.fullHashesTitle}
                          </div>
                          <div className="p-2.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1 break-all">
                            <div>
                              <span className="text-slate-400 dark:text-zinc-500">prev_hash: </span>
                              <span className="text-slate-700 dark:text-zinc-300">
                                {entry.prev_hash}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 dark:text-zinc-500">hash:      </span>
                              <span
                                className={
                                  isBrokenLink
                                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                                    : 'text-emerald-700 dark:text-emerald-400'
                                }
                              >
                                {entry.hash}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 dark:text-zinc-500">digest:    </span>
                              <span className="text-cyan-700 dark:text-cyan-300">
                                {entry.payload_digest}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-slate-500 dark:text-zinc-400 font-sans font-semibold">
                            {t.security.canonicalRecordTitle}
                          </div>
                          <pre className="p-2.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 overflow-x-auto">
                            {JSON.stringify(entry, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Dead-Letter Queue (engine.dlq) */}
        {activeTab === 'DLQ' && (
          <div className="p-4 sm:p-5 space-y-3">
            {dlq.length === 0 ? (
              <div className="border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/30 p-6 text-center space-y-1">
                <div className="text-xs font-semibold text-slate-800 dark:text-zinc-300">
                  Dead-Letter Queue is empty
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-500">
                  Run &quot;Inject Invalid Event (DLQ)&quot; in Chaos Lab or dispatch on branch{' '}
                  <span className="font-mono text-rose-600 dark:text-rose-400">main</span> to
                  inspect contract rejection.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-zinc-800 divide-y divide-slate-200 dark:divide-zinc-800 max-h-[480px] overflow-y-auto">
                {dlq.map((item) => {
                  const expanded = Boolean(expandedDlqIds[item.id]);
                  return (
                    <div key={item.id} className="bg-white dark:bg-zinc-950">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDlqIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                        }
                        className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-900/60 flex flex-wrap items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          {expanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                          )}
                          <span className="font-mono text-xs font-bold text-rose-700 dark:text-rose-400 shrink-0">
                            {item.id}
                          </span>
                          <span className="font-mono text-[11px] px-1.5 py-0.5 border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 shrink-0">
                            {item.code}
                          </span>
                          <span className="text-xs text-slate-700 dark:text-zinc-200 truncate">
                            {item.reason}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 dark:text-zinc-500 tabular-nums shrink-0">
                          {item.task_id && <span>{item.task_id}</span>}
                          <span>{formatUtcTime(item.timestamp)}</span>
                        </div>
                      </button>
                      {expanded && (
                        <div className="px-4 pb-3 pt-1 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-200 dark:border-zinc-800/80">
                          <div className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 mb-1">
                            Rejected Raw JSON Payload (0 FSM state mutation)
                          </div>
                          <pre className="p-2.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-[11px] font-mono text-rose-800 dark:text-rose-200/90 overflow-x-auto">
                            {JSON.stringify(item.raw_payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: A2A Hardening Lab (metacore.a2a) */}
        {activeTab === 'A2A' && (
          <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 space-y-3.5">
              <div className="border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40 p-3.5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  <GlobeLock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>A2A fetch_card() SSRF &amp; Extension Guard</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={a2aUrl}
                    onChange={(e) => setA2aUrl(e.target.value)}
                    placeholder="https://agents.metacore.internal/v0.3/card.json"
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => runFetchCard()}
                    className="px-3 py-1.5 text-xs font-semibold bg-cyan-600 dark:bg-cyan-500 text-white dark:text-zinc-950 hover:bg-cyan-700 dark:hover:bg-cyan-400 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    fetch_card()
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {A2A_PRESET_URLS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => {
                        setA2aUrl(preset.url);
                        runFetchCard(preset.url);
                      }}
                      className={`px-2 py-1 text-[11px] font-mono border transition-colors cursor-pointer ${
                        preset.expected === 'BLOCK'
                          ? 'border-rose-300 dark:border-rose-500/35 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20'
                          : 'border-cyan-300 dark:border-cyan-500/35 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-500/20'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-slate-800 dark:text-zinc-200">
                      Simulate Proxy Stripping X-A2A-Extensions
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Tests fail-fast{' '}
                      <span className="font-mono text-slate-700 dark:text-zinc-300">
                        require_extension_confirmed()
                      </span>{' '}
                      with zero legacy downgrade.
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={stripExtensionsHeader}
                    onClick={() => {
                      const next = !stripExtensionsHeader;
                      setStripExtensionsHeader(next);
                      runFetchCard(a2aUrl, next);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-mono font-semibold border shrink-0 cursor-pointer ${
                      stripExtensionsHeader
                        ? 'border-rose-400 dark:border-rose-500/50 bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300'
                        : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    {stripExtensionsHeader ? 'STRIP ON' : 'STRIP OFF'}
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40 p-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  SSRF Domain Allowlist ({allowlist.length})
                </div>
                <form onSubmit={handleAddAllowlistDomain} className="flex gap-2">
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="Add trusted hostname (e.g. a2a.prod.corp)"
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </form>
                <div className="space-y-1">
                  {allowlist.map((domain) => (
                    <div
                      key={domain}
                      className="flex items-center justify-between px-2.5 py-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-mono text-slate-700 dark:text-zinc-300"
                    >
                      <span>{domain}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAllowlistDomain(domain)}
                        className="text-slate-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                        aria-label={`Remove ${domain}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40 p-4 space-y-3.5">
              <div
                className={`p-3 border text-xs font-mono flex items-start gap-2.5 ${
                  a2aResult.ok
                    ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                    : 'border-rose-300 dark:border-rose-500/50 bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-200'
                }`}
              >
                {a2aResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 min-w-0">
                  <div className="font-bold">
                    {a2aResult.ok
                      ? 'A2A OK · SSRF Verified & X-A2A-Extensions Confirmed'
                      : `${a2aResult.errorCode} (Stage: ${a2aResult.stage})`}
                  </div>
                  <div className="text-[11px] break-words">
                    {a2aResult.ok ? a2aResult.ssrf.reason : a2aResult.errorMessage}
                  </div>
                </div>
              </div>

              {a2aResult.ok && a2aResult.cardV03 && a2aResult.cardV10 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                      Incoming Agent Card (v0.3)
                    </div>
                    <pre className="p-3 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-[11px] font-mono text-slate-600 dark:text-zinc-400 overflow-x-auto max-h-64">
                      {JSON.stringify(a2aResult.cardV03, null, 2)}
                    </pre>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-mono text-cyan-700 dark:text-cyan-300">
                      Promoted Canonical Card (v1.0)
                    </div>
                    <pre className="p-3 bg-white dark:bg-zinc-950 border border-cyan-300 dark:border-cyan-500/35 text-[11px] font-mono text-cyan-900 dark:text-cyan-200 overflow-x-auto max-h-64">
                      {JSON.stringify(a2aResult.cardV10, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2 text-xs font-mono">
                  <div className="text-slate-500 dark:text-zinc-400">
                    Fail-Fast Enforcement Trace:
                  </div>
                  <div className="text-slate-800 dark:text-zinc-300">
                    1. SSRF Guard:{' '}
                    <span
                      className={
                        a2aResult.ssrf.allowed
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }
                    >
                      {a2aResult.ssrf.category}
                    </span>
                  </div>
                  <div className="text-slate-800 dark:text-zinc-300">
                    2. X-A2A-Extensions Header:{' '}
                    <span
                      className={
                        a2aResult.responseHeaders['X-A2A-Extensions']
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }
                    >
                      {a2aResult.responseHeaders['X-A2A-Extensions'] ?? 'MISSING / NOT REACHED'}
                    </span>
                  </div>
                  <div className="text-slate-800 dark:text-zinc-300">
                    3. Agent Card Promotion:{' '}
                    <span className="text-rose-600 dark:text-rose-400">
                      ABORTED (no silent legacy fallback)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
