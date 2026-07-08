'use client';

import { useMemo, useState } from 'react';
import { ToolCard, ToolTextarea, ToolBar } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';
import { parseLogs, groupErrors, type LogLevel } from '@/lib/log-utils';

const LEVELS: (LogLevel | 'all')[] = ['all', 'error', 'warn', 'info', 'debug', 'other'];

const levelColor: Record<LogLevel, string> = {
  error: 'text-destructive',
  warn: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
  debug: 'text-muted-foreground',
  other: 'text-foreground/80',
};

export default function LogTool() {
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [showGroups, setShowGroups] = useState(false);

  const entries = useMemo(() => (input.trim() ? parseLogs(input) : []), [input]);
  const filtered = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.level === filter)),
    [entries, filter]
  );
  const groups = useMemo(() => groupErrors(entries), [entries]);

  return (
    <div className="w-full space-y-4">
      <ToolCard minHeight="min-h-48">
        <ToolTextarea
          value={input}
          onChange={setInput}
          placeholder={`2024-01-15T10:22:01Z INFO Server started\n2024-01-15T10:22:05Z ERROR Failed to connect {"host":"db","code":"ECONNREFUSED"}\n    at connect (/app/db.js:42:11)\n2024-01-15T10:22:06Z WARN Retrying…`}
        />
        <ToolBar>
          <span className="text-xs text-muted-foreground">
            {entries.length ? `${entries.length} entries` : 'Paste messy logs'}
          </span>
          {input && (
            <button onClick={() => setInput('')} className="text-xs text-muted-foreground hover:text-foreground">
              Clear
            </button>
          )}
        </ToolBar>
      </ToolCard>

      {entries.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => setFilter(l)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize ${
                  filter === l ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'
                }`}
              >
                {l}
                {l !== 'all' && (
                  <span className="ml-1 opacity-70">
                    {entries.filter((e) => e.level === l).length}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => setShowGroups((v) => !v)}
              className={`ml-auto px-3 py-1.5 rounded-xl text-xs font-semibold ${
                showGroups ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'
              }`}
            >
              Error groups ({groups.length})
            </button>
          </div>

          {showGroups && groups.length > 0 && (
            <ToolCard minHeight="min-h-0">
              <div className="p-5 space-y-2">
                {groups.map((g, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 text-sm font-mono">
                    <span className="text-destructive break-all">{g.message}</span>
                    <span className="text-xs text-muted-foreground shrink-0">×{g.count}</span>
                  </div>
                ))}
              </div>
            </ToolCard>
          )}

          <ToolCard minHeight="min-h-64">
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {filtered.map((e, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 font-mono text-xs space-y-1"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground/60">L{e.line}</span>
                    {e.timestamp && (
                      <span className="text-violet-600 dark:text-violet-400">{e.timestamp}</span>
                    )}
                    <span className={`uppercase font-semibold ${levelColor[e.level]}`}>{e.level}</span>
                  </div>
                  <div className={levelColor[e.level]}>{e.message}</div>
                  {e.json != null && (
                    <pre className="text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">
                      {JSON.stringify(e.json, null, 2)}
                    </pre>
                  )}
                  {e.stack && (
                    <pre className="text-muted-foreground whitespace-pre-wrap opacity-80">{e.stack}</pre>
                  )}
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground p-4">No entries for this filter.</p>
              )}
            </div>
            <ToolBar>
              <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
              <CopyButton
                text={filtered.map((e) => e.raw).join('\n')}
                size={14}
                title="Copy filtered"
              />
            </ToolBar>
          </ToolCard>
        </>
      )}
    </div>
  );
}
