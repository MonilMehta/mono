'use client';

import { useMemo, useState } from 'react';
import { FileCode2 } from 'lucide-react';
import { ToolCard, ToolTextarea, ToolBar, EmptyState, ToolChip } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';
import { jsonToTypeScript, jsonToZod } from '@/lib/json-to-ts';

type OutputKind = 'typescript' | 'zod';

export default function TypegenTool() {
  const [input, setInput] = useState('');
  const [rootName, setRootName] = useState('Root');
  const [useInterface, setUseInterface] = useState(true);
  const [optionalFields, setOptionalFields] = useState(false);
  const [readonly, setReadonly] = useState(false);
  const [kind, setKind] = useState<OutputKind>('typescript');

  const result = useMemo(() => {
    if (!input.trim()) return { text: '', error: null as string | null };
    try {
      const data = JSON.parse(input);
      if (kind === 'zod') {
        return { text: jsonToZod(data, rootName || 'Root'), error: null };
      }
      return {
        text: jsonToTypeScript(data, {
          rootName: rootName || 'Root',
          useInterface,
          optionalFields,
          readonly,
        }),
        error: null,
      };
    } catch (e) {
      return { text: '', error: e instanceof Error ? e.message : String(e) };
    }
  }, [input, rootName, useInterface, optionalFields, readonly, kind]);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl border border-border/40">
          {(['typescript', 'zod'] as const).map((k) => (
            <ToolChip key={k} active={kind === k} onClick={() => setKind(k)}>
              {k === 'typescript' ? 'TypeScript' : 'Zod'}
            </ToolChip>
          ))}
        </div>
        <input
          value={rootName}
          onChange={(e) => setRootName(e.target.value)}
          placeholder="Root name"
          className="px-3 h-8 rounded-lg bg-secondary/50 text-sm font-mono border border-border/40 focus:outline-none w-36"
        />
        {kind === 'typescript' && (
          <>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={useInterface} onChange={(e) => setUseInterface(e.target.checked)} />
              interface
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={optionalFields} onChange={(e) => setOptionalFields(e.target.checked)} />
              optional
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={readonly} onChange={(e) => setReadonly(e.target.checked)} />
              readonly
            </label>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ToolCard minHeight="min-h-80">
          <ToolTextarea
            value={input}
            onChange={setInput}
            placeholder={`{\n  "id": 1,\n  "name": "Ada",\n  "tags": ["math"]\n}`}
          />
          <ToolBar>
            <span className="text-xs text-muted-foreground">Paste JSON</span>
            {input && (
              <button onClick={() => setInput('')} className="text-xs text-muted-foreground hover:text-foreground">
                Clear
              </button>
            )}
          </ToolBar>
        </ToolCard>

        <ToolCard minHeight="min-h-80">
          {result.error ? (
            <div className="flex-1 p-5 text-sm text-destructive font-mono">{result.error}</div>
          ) : result.text ? (
            <pre className="flex-1 p-5 text-sm font-mono overflow-auto whitespace-pre-wrap leading-7">
              {result.text}
            </pre>
          ) : (
            <EmptyState
              icon={FileCode2}
              title="Types will show up here"
              description="Paste JSON on the left to generate TypeScript or Zod."
            />
          )}
          <ToolBar>
            <span className="text-xs text-muted-foreground">{kind === 'zod' ? 'Zod schema' : 'TS types'}</span>
            {result.text && <CopyButton text={result.text} size={14} />}
          </ToolBar>
        </ToolCard>
      </div>
    </div>
  );
}
