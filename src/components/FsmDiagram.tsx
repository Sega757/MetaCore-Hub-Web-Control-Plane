import React, { useMemo, useState } from 'react';
import type { ThemeMode } from '../core/settings';
import type { TaskRecord, TaskState } from '../core/types';
import type { Dictionary } from '../i18n/translations';
import { formatUtcTime, TASK_STATE_STYLE } from './semantics';

interface FsmDiagramProps {
  task: TaskRecord;
  theme: ThemeMode;
  t: Dictionary;
}

interface NodeLayout {
  state: TaskState;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Desktop Horizontal Pipeline (>= 640px)
const DESKTOP_NODES: readonly NodeLayout[] = [
  { state: 'DISPATCHED', label: 'DISPATCHED', x: 18, y: 38, w: 120, h: 40 },
  { state: 'IN_PROGRESS', label: 'IN_PROGRESS', x: 182, y: 38, w: 126, h: 40 },
  { state: 'ARBITER_VALIDATING', label: 'ARBITER_VALIDATING', x: 356, y: 38, w: 164, h: 40 },
  { state: 'MERGED', label: 'MERGED', x: 572, y: 38, w: 112, h: 40 },
  { state: 'REWORK', label: 'REWORK', x: 182, y: 124, w: 126, h: 38 },
  { state: 'HUMAN_REQUIRED', label: 'HUMAN_REQUIRED', x: 368, y: 124, w: 148, h: 38 },
  { state: 'FAILED', label: 'FAILED', x: 18, y: 124, w: 112, h: 38 },
  { state: 'CANCELLED', label: 'CANCELLED', x: 572, y: 124, w: 112, h: 38 },
] as const;

interface EdgeDef {
  from: TaskState;
  to: TaskState;
  path: string;
}

const DESKTOP_EDGES: readonly EdgeDef[] = [
  { from: 'DISPATCHED', to: 'IN_PROGRESS', path: 'M 138 58 L 180 58' },
  { from: 'IN_PROGRESS', to: 'ARBITER_VALIDATING', path: 'M 308 58 L 354 58' },
  { from: 'ARBITER_VALIDATING', to: 'MERGED', path: 'M 520 58 L 570 58' },
  { from: 'ARBITER_VALIDATING', to: 'REWORK', path: 'M 404 78 L 404 100 L 260 100 L 260 122' },
  { from: 'REWORK', to: 'IN_PROGRESS', path: 'M 225 124 L 225 80' },
  { from: 'ARBITER_VALIDATING', to: 'HUMAN_REQUIRED', path: 'M 442 78 L 442 122' },
  { from: 'REWORK', to: 'HUMAN_REQUIRED', path: 'M 308 143 L 366 143' },
  { from: 'HUMAN_REQUIRED', to: 'MERGED', path: 'M 516 135 L 548 135 L 548 70 L 570 70' },
  { from: 'HUMAN_REQUIRED', to: 'IN_PROGRESS', path: 'M 384 124 L 384 108 L 288 108 L 288 80' },
  { from: 'HUMAN_REQUIRED', to: 'CANCELLED', path: 'M 516 148 L 570 148' },
  { from: 'IN_PROGRESS', to: 'FAILED', path: 'M 198 78 L 198 102 L 74 102 L 74 122' },
  { from: 'DISPATCHED', to: 'CANCELLED', path: 'M 78 38 L 78 16 L 628 16 L 628 122' },
] as const;

// Mobile Vertical Pipeline (< 640px) — fits 320px+ viewports with zero horizontal clipping
const MOBILE_NODES: readonly NodeLayout[] = [
  { state: 'DISPATCHED', label: 'DISPATCHED', x: 96, y: 12, w: 148, h: 34 },
  { state: 'IN_PROGRESS', label: 'IN_PROGRESS', x: 96, y: 74, w: 148, h: 34 },
  { state: 'ARBITER_VALIDATING', label: 'ARBITER_VALIDATING', x: 86, y: 136, w: 168, h: 34 },
  { state: 'REWORK', label: 'REWORK', x: 16, y: 204, w: 126, h: 34 },
  { state: 'HUMAN_REQUIRED', label: 'HUMAN_REQUIRED', x: 176, y: 204, w: 148, h: 34 },
  { state: 'FAILED', label: 'FAILED', x: 12, y: 280, w: 96, h: 34 },
  { state: 'MERGED', label: 'MERGED', x: 122, y: 280, w: 96, h: 34 },
  { state: 'CANCELLED', label: 'CANCELLED', x: 232, y: 280, w: 96, h: 34 },
] as const;

const MOBILE_EDGES: readonly EdgeDef[] = [
  { from: 'DISPATCHED', to: 'IN_PROGRESS', path: 'M 170 46 L 170 72' },
  { from: 'IN_PROGRESS', to: 'ARBITER_VALIDATING', path: 'M 170 108 L 170 134' },
  { from: 'ARBITER_VALIDATING', to: 'REWORK', path: 'M 126 170 L 126 186 L 79 186 L 79 202' },
  { from: 'ARBITER_VALIDATING', to: 'HUMAN_REQUIRED', path: 'M 214 170 L 214 186 L 250 186 L 250 202' },
  { from: 'ARBITER_VALIDATING', to: 'MERGED', path: 'M 170 170 L 170 278' },
  { from: 'REWORK', to: 'IN_PROGRESS', path: 'M 42 204 L 42 91 L 94 91' },
  { from: 'REWORK', to: 'HUMAN_REQUIRED', path: 'M 142 221 L 174 221' },
  { from: 'HUMAN_REQUIRED', to: 'MERGED', path: 'M 218 238 L 218 258 L 182 258 L 182 278' },
  { from: 'HUMAN_REQUIRED', to: 'CANCELLED', path: 'M 280 238 L 280 278' },
  { from: 'HUMAN_REQUIRED', to: 'IN_PROGRESS', path: 'M 294 204 L 294 91 L 246 91' },
  { from: 'IN_PROGRESS', to: 'FAILED', path: 'M 96 100 L 22 100 L 22 278' },
  { from: 'DISPATCHED', to: 'CANCELLED', path: 'M 244 29 L 318 29 L 318 278' },
] as const;

export const FsmDiagram: React.FC<FsmDiagramProps> = ({ task, theme, t }) => {
  const [inspectedState, setInspectedState] = useState<TaskState | null>(null);
  const isDark = theme === 'dark';

  const visitedStates = useMemo(() => {
    const map = new Map<
      TaskState,
      { firstAt: number; lastAt: number; visits: number; note: string }
    >();
    for (const h of task.history) {
      const existing = map.get(h.to);
      if (!existing) {
        map.set(h.to, { firstAt: h.timestamp, lastAt: h.timestamp, visits: 1, note: h.note });
      } else {
        map.set(h.to, {
          firstAt: existing.firstAt,
          lastAt: h.timestamp,
          visits: existing.visits + 1,
          note: h.note,
        });
      }
    }
    return map;
  }, [task.history]);

  const traversedEdges = useMemo(() => {
    const set = new Set<string>();
    for (const h of task.history) {
      if (h.from) {
        set.add(`${h.from}->${h.to}`);
      }
    }
    return set;
  }, [task.history]);

  const activeNodeState = inspectedState ?? task.state;
  const activeNodeInfo = visitedStates.get(activeNodeState);

  const idleEdgeStroke = isDark ? '#27272a' : '#cbd5e1';
  const traversedEdgeStroke = isDark ? '#22d3ee' : '#0891b2';
  const arrowIdleFill = isDark ? '#3f3f46' : '#94a3b8';

  const renderSvg = (
    viewBox: string,
    nodes: readonly NodeLayout[],
    edges: readonly EdgeDef[],
    markerSuffix: string,
    fontSize: number
  ) => (
    <svg
      viewBox={viewBox}
      className="w-full h-auto select-none"
      role="img"
      aria-label={`FSM state diagram for ${task.task_id}, currently in ${task.state}`}
    >
      <defs>
        <marker
          id={`arrow-idle-${markerSuffix}`}
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 7 4 L 0 7 z" fill={arrowIdleFill} />
        </marker>
        <marker
          id={`arrow-traversed-${markerSuffix}`}
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 7 4 L 0 7 z" fill={traversedEdgeStroke} />
        </marker>
      </defs>

      {edges.map((edge) => {
        const key = `${edge.from}->${edge.to}`;
        const hit = traversedEdges.has(key);
        return (
          <path
            key={key}
            d={edge.path}
            fill="none"
            stroke={hit ? traversedEdgeStroke : idleEdgeStroke}
            strokeWidth={hit ? 1.75 : 1.1}
            strokeDasharray={hit ? undefined : '3 3'}
            markerEnd={
              hit
                ? `url(#arrow-traversed-${markerSuffix})`
                : `url(#arrow-idle-${markerSuffix})`
            }
          />
        );
      })}

      {nodes.map((node) => {
        const style = TASK_STATE_STYLE[node.state];
        const isCurrent = task.state === node.state;
        const isVisited = visitedStates.has(node.state);
        const isSelected = activeNodeState === node.state;

        const strokeColor = isDark ? style.svgStrokeDark : style.svgStrokeLight;
        const activeFill = isDark ? style.svgFillDark : style.svgFillLight;
        const activeText = isDark ? style.svgTextDark : style.svgTextLight;
        const visitedFill = isDark ? '#18181b' : '#f8fafc';
        const unvisitedFill = isDark ? '#09090b' : '#ffffff';
        const idleBorder = isDark ? '#27272a' : '#cbd5e1';
        const selectedBorder = isDark ? '#a1a1aa' : '#475569';
        const visitedText = isDark ? '#e4e4e7' : '#1e293b';
        const unvisitedText = isDark ? '#71717a' : '#94a3b8';

        return (
          <g
            key={node.state}
            onClick={() => setInspectedState(node.state)}
            className="cursor-pointer"
          >
            {isCurrent && (
              <rect
                x={node.x - 3}
                y={node.y - 3}
                width={node.w + 6}
                height={node.h + 6}
                rx={3}
                fill="none"
                stroke={strokeColor}
                strokeOpacity={0.45}
                strokeWidth={2}
              />
            )}
            <rect
              x={node.x}
              y={node.y}
              width={node.w}
              height={node.h}
              rx={2}
              fill={isCurrent ? activeFill : isVisited ? visitedFill : unvisitedFill}
              stroke={
                isCurrent
                  ? strokeColor
                  : isSelected
                    ? selectedBorder
                    : isVisited
                      ? strokeColor
                      : idleBorder
              }
              strokeOpacity={isCurrent ? 1 : isVisited ? 0.65 : 1}
              strokeWidth={isCurrent ? 1.75 : 1}
            />
            <text
              x={node.x + node.w / 2}
              y={node.y + node.h / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="JetBrains Mono, monospace"
              fontSize={fontSize}
              fontWeight={isCurrent ? 700 : 500}
              fill={isCurrent ? activeText : isVisited ? visitedText : unvisitedText}
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );

  return (
    <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
      <div className="px-3.5 py-2 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
          {t.tasks.fsmPipeline}
        </span>
        <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500">
          {t.tasks.fsmClickHint}
        </span>
      </div>

      {/* Desktop horizontal pipeline */}
      <div className="hidden sm:block p-2.5">
        {renderSvg('0 0 704 180', DESKTOP_NODES, DESKTOP_EDGES, 'desktop', 10.5)}
      </div>

      {/* Mobile vertical pipeline (zero clipping on narrow viewports) */}
      <div className="sm:hidden p-2">
        {renderSvg('0 0 340 328', MOBILE_NODES, MOBILE_EDGES, 'mobile', 9.5)}
      </div>

      {/* Inspected Node Timestamp Readout */}
      <div className="px-3.5 py-2 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-slate-500 dark:text-zinc-500">Node:</span>
          <span className={`font-semibold ${TASK_STATE_STYLE[activeNodeState].text}`}>
            {activeNodeState}
          </span>
          {activeNodeInfo ? (
            <>
              <span className="text-slate-300 dark:text-zinc-700">·</span>
              <span className="text-slate-700 dark:text-zinc-300 tabular-nums">
                {formatUtcTime(activeNodeInfo.lastAt)}
              </span>
              {activeNodeInfo.visits > 1 && (
                <span className="text-amber-600 dark:text-amber-400">
                  ({activeNodeInfo.visits}x)
                </span>
              )}
            </>
          ) : (
            <>
              <span className="text-slate-300 dark:text-zinc-700">·</span>
              <span className="text-slate-400 dark:text-zinc-500">Not traversed</span>
            </>
          )}
        </div>
        {activeNodeInfo && (
          <span className="text-slate-600 dark:text-zinc-400 truncate max-w-full sm:max-w-[360px]">
            {activeNodeInfo.note}
          </span>
        )}
      </div>
    </div>
  );
};
