'use client';

import { useMemo, useState } from 'react';
import { ToolCard, ToolTextarea, ToolBar } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';
import { parseStackTrace, formatCleanStack } from '@/lib/stack-utils';

export default function StackTool() {
  const [input, setInput] = useState('');
  const [appOnly, setAppOnly] = useState(true);
  const [compact, setCompact] = useState(false);

  const parsed = useMemo(() => (input.trim() ? parseStackTrace(input) : null), [input]);
  const cleaned = useMemo(
    () => (parsed ? formatCleanStack(parsed, appOnly) : ''),
    [parsed, appOnly]
  );

  const frames = parsed
    ? appOnly
      ? parsed.frames.filter((f) => f.isApp)
      : parsed.frames
    : [];

  return (
    <div className="max-w-4xl space-y-4">
      <ToolCard minHeight="min-h-48">
        <ToolTextarea
          value={input}
          onChange={setInput}
          placeholder={`TypeError: Cannot read properties of undefined (reading 'map')\n    at UserList (/app/src/components/UserList.tsx:42:18)\n    at renderWithHooks (/app/node_modules/react-dom/cjs/react-dom.development.js:15486:18)\n    at processChild (/app/node_modules/react-dom/cjs/react-dom.development.js:21000:14)`}
        />
        <ToolBar>
          <span className="text-xs text-muted-foreground">Paste a JS / RN / Next stack trace</span>
          {input && (
            <button onClick={() => setInput('')} className="text-xs text-muted-foreground hover:text-foreground">
              Clear
            </button>
          )}
        </ToolBar>
      </ToolCard>

      {parsed && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={appOnly} onChange={(e) => setAppOnly(e.target.checked)} />
              App frames only
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
              Compact
            </label>
            <span className="text-xs text-muted-foreground ml-auto">
              {parsed.frames.filter((f) => f.isApp).length} app ·{' '}
              {parsed.frames.filter((f) => f.isNodeModules).length} node_modules ·{' '}
              {parsed.frames.length} total
            </span>
          </div>

          <ToolCard minHeight="min-h-0">
            <div className="p-5 border-b border-border/40">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Error
              </p>
              <p className="font-mono text-sm text-destructive whitespace-pre-wrap">{parsed.errorMessage}</p>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-1.5">
              {frames.map((f, i) => (
                <div
                  key={i}
                  className={`font-mono text-xs rounded-lg px-3 py-2 ${
                    f.isApp
                      ? 'bg-primary/5 text-foreground'
                      : f.isNodeModules
                        ? 'bg-secondary/40 text-muted-foreground'
                        : 'bg-secondary/20 text-muted-foreground/70'
                  }`}
                >
                  {compact ? (
                    <span>
                      {f.file}
                      {f.line != null && (
                        <span className="text-primary">
                          :{f.line}
                          {f.column != null ? `:${f.column}` : ''}
                        </span>
                      )}
                    </span>
                  ) : (
                    <>
                      {f.functionName && (
                        <span className="text-amber-700 dark:text-amber-400">{f.functionName} </span>
                      )}
                      <span className="text-muted-foreground">
                        {f.file}
                        {f.line != null && (
                          <span className="text-primary">
                            :{f.line}
                            {f.column != null ? `:${f.column}` : ''}
                          </span>
                        )}
                      </span>
                      {f.isNodeModules && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide opacity-60">deps</span>
                      )}
                    </>
                  )}
                </div>
              ))}
              {frames.length === 0 && (
                <p className="text-sm text-muted-foreground p-2">No frames match the current filter.</p>
              )}
            </div>
            <ToolBar>
              <span className="text-xs text-muted-foreground">Clean stack</span>
              {cleaned && <CopyButton text={cleaned} size={14} />}
            </ToolBar>
          </ToolCard>
        </>
      )}
    </div>
  );
}
