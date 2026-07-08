'use client';

import { useMemo, useState } from 'react';
import { ToolCard, ToolTextarea, ToolBar } from '@/components/tool-card';
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
        <div className="flex gap-1 bg-secondary/40 p-1 rounded-2xl border border-border/30">
          {(['typescript', 'zod'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize ${
                kind === k ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {k === 'typescript' ? 'TypeScript' : 'Zod'}
            </button>
          ))}
        </div>
        <input
          value={rootName}
          onChange={(e) => setRootName(e.target.value)}
          placeholder="Root name"
          className="px-3 py-2 rounded-xl bg-secondary/50 text-sm font-mono border border-border/40 focus:outline-none w-36"
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
          <pre className="flex-1 p-7 text-sm font-mono overflow-auto whitespace-pre-wrap leading-7">
            {result.error ? (
              <span className="text-destructive">{result.error}</span>
            ) : (
              result.text || <span className="text-muted-foreground/50">Types appear here…</span>
            )}
          </pre>
          <ToolBar>
            <span className="text-xs text-muted-foreground">{kind === 'zod' ? 'Zod schema' : 'TS types'}</span>
            {result.text && <CopyButton text={result.text} size={14} />}
          </ToolBar>
        </ToolCard>
      </div>
    </div>
  );
}
