'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ToolCard, ToolTextarea, ToolBar, EmptyState, ToolChip } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';
import { parseLogs, groupErrors, type LogLevel } from '@/lib/log-utils';
import { formatCleanStack, parseStackTrace } from '@/lib/stack-utils';

type WorkspaceTab = 'logs' | 'stack';

const LEVELS: (LogLevel | 'all')[] = ['all', 'error', 'warn', 'info', 'debug', 'other'];

const levelColor: Record<LogLevel, string> = {
  error: 'text-destructive',
  warn: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
  debug: 'text-muted-foreground',
  other: 'text-foreground/80',
};

export default function LogTool() {
  const [tab, setTab] = useState<WorkspaceTab>('logs');
  const searchParams = useSearchParams();
  const requestedTool = searchParams.get('tool');

  useEffect(() => {
    setTab(requestedTool === 'stack' ? 'stack' : 'logs');
  }, [requestedTool]);

  return (
    <div className="w-full space-y-4">
      <div className="flex w-fit gap-1 rounded-xl border border-border/40 bg-secondary/50 p-1">
        <ToolChip active={tab === 'logs'} onClick={() => setTab('logs')}>Logs</ToolChip>
        <ToolChip active={tab === 'stack'} onClick={() => setTab('stack')}>Stack Trace</ToolChip>
      </div>
      {tab === 'logs' ? <LogsPanel /> : <StackPanel />}
    </div>
  );
}

function LogsPanel() {
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [showGroups, setShowGroups] = useState(false);
  const entries = useMemo(() => (input.trim() ? parseLogs(input) : []), [input]);
  const filtered = useMemo(() => (filter === 'all' ? entries : entries.filter((entry) => entry.level === filter)), [entries, filter]);
  const groups = useMemo(() => groupErrors(entries), [entries]);

  return (
    <div className="w-full space-y-4">
      <ToolCard minHeight="min-h-48">
        <ToolTextarea value={input} onChange={setInput} placeholder={`2024-01-15T10:22:01Z INFO Server started\n2024-01-15T10:22:05Z ERROR Failed to connect {"host":"db","code":"ECONNREFUSED"}\n    at connect (/app/db.js:42:11)\n2024-01-15T10:22:06Z WARN Retrying…`} />
        <ToolBar>
          <span className="text-xs text-muted-foreground">{entries.length ? `${entries.length} entries` : 'Paste messy logs'}</span>
          {input && <button onClick={() => setInput('')} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}
        </ToolBar>
      </ToolCard>

      {entries.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {LEVELS.map((level) => (
              <button key={level} onClick={() => setFilter(level)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize ${filter === level ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'}`}>
                {level}{level !== 'all' && <span className="ml-1 opacity-70">{entries.filter((entry) => entry.level === level).length}</span>}
              </button>
            ))}
            <button onClick={() => setShowGroups((value) => !value)} className={`ml-auto px-3 py-1.5 rounded-xl text-xs font-semibold ${showGroups ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'}`}>Error groups ({groups.length})</button>
          </div>

          {showGroups && groups.length > 0 && (
            <ToolCard minHeight="min-h-0"><div className="p-5 space-y-2">{groups.map((group, index) => <div key={index} className="flex items-start justify-between gap-4 text-sm font-mono"><span className="text-destructive break-all">{group.message}</span><span className="text-xs text-muted-foreground shrink-0">×{group.count}</span></div>)}</div></ToolCard>
          )}

          <ToolCard minHeight="min-h-64">
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {filtered.map((entry, index) => (
                <div key={index} className="rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 font-mono text-xs space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-muted-foreground/60">L{entry.line}</span>{entry.timestamp && <span className="text-violet-600 dark:text-violet-400">{entry.timestamp}</span>}<span className={`uppercase font-semibold ${levelColor[entry.level]}`}>{entry.level}</span></div>
                  <div className={levelColor[entry.level]}>{entry.message}</div>
                  {entry.json != null && <pre className="text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">{JSON.stringify(entry.json, null, 2)}</pre>}
                  {entry.stack && <pre className="text-muted-foreground whitespace-pre-wrap opacity-80">{entry.stack}</pre>}
                </div>
              ))}
              {filtered.length === 0 && <p className="text-sm text-muted-foreground p-4">No entries for this filter.</p>}
            </div>
            <ToolBar><span className="text-xs text-muted-foreground">{filtered.length} shown</span><CopyButton text={filtered.map((entry) => entry.raw).join('\n')} size={14} title="Copy filtered" /></ToolBar>
          </ToolCard>
        </>
      )}
    </div>
  );
}

function StackPanel() {
  const [input, setInput] = useState('');
  const [appOnly, setAppOnly] = useState(true);
  const [compact, setCompact] = useState(false);
  const parsed = useMemo(() => (input.trim() ? parseStackTrace(input) : null), [input]);
  const cleaned = useMemo(() => (parsed ? formatCleanStack(parsed, appOnly) : ''), [parsed, appOnly]);
  const frames = parsed ? (appOnly ? parsed.frames.filter((frame) => frame.isApp) : parsed.frames) : [];

  return (
    <div className="w-full space-y-4">
      <ToolCard minHeight="min-h-48">
        <ToolTextarea value={input} onChange={setInput} placeholder={`TypeError: Cannot read properties of undefined (reading 'map')\n    at UserList (/app/src/components/UserList.tsx:42:18)\n    at renderWithHooks (/app/node_modules/react-dom/cjs/react-dom.development.js:15486:18)\n    at processChild (/app/node_modules/react-dom/cjs/react-dom.development.js:21000:14)`} />
        <ToolBar><span className="text-xs text-muted-foreground">Paste a JS / RN / Next stack trace</span>{input && <button onClick={() => setInput('')} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}</ToolBar>
      </ToolCard>

      {parsed && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={appOnly} onChange={(event) => setAppOnly(event.target.checked)} />App frames only</label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} />Compact</label>
            <span className="ml-auto text-xs text-muted-foreground">{parsed.frames.filter((frame) => frame.isApp).length} app · {parsed.frames.filter((frame) => frame.isNodeModules).length} node_modules · {parsed.frames.length} total</span>
          </div>
          <ToolCard minHeight="min-h-0">
            <div className="border-b border-border/40 p-5"><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Error</p><p className="whitespace-pre-wrap font-mono text-sm text-destructive">{parsed.errorMessage}</p></div>
            <div className="flex-1 overflow-auto p-4 space-y-1.5">
              {frames.map((frame, index) => (
                <div key={index} className={`rounded-lg px-3 py-2 font-mono text-xs ${frame.isApp ? 'bg-primary/5 text-foreground' : frame.isNodeModules ? 'bg-secondary/40 text-muted-foreground' : 'bg-secondary/20 text-muted-foreground/70'}`}>
                  {compact ? <FrameLocation frame={frame} /> : <>{frame.functionName && <span className="text-amber-700 dark:text-amber-400">{frame.functionName} </span>}<span className="text-muted-foreground"><FrameLocation frame={frame} /></span>{frame.isNodeModules && <span className="ml-2 text-[10px] uppercase tracking-wide opacity-60">deps</span>}</>}
                </div>
              ))}
              {frames.length === 0 && <p className="p-2 text-sm text-muted-foreground">No frames match the current filter.</p>}
            </div>
            <ToolBar><span className="text-xs text-muted-foreground">Clean stack</span>{cleaned && <CopyButton text={cleaned} size={14} />}</ToolBar>
          </ToolCard>
        </>
      )}
    </div>
  );
}

function FrameLocation({ frame }: { frame: { file: string | null; line: number | null; column: number | null } }) {
  return <>{frame.file}{frame.line != null && <span className="text-primary">:{frame.line}{frame.column != null ? `:${frame.column}` : ''}</span>}</>;
}
