'use client';

import { useMemo, useState } from 'react';
import { ToolCard, ToolTextarea, ToolBar } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';
import { jsonToTypeScript, jsonToZod, sampleMock } from '@/lib/json-to-ts';

type Tab = 'types' | 'zod' | 'mock' | 'factory' | 'msw';

function toFactory(data: unknown, name = 'Root'): string {
  const mock = JSON.stringify(sampleMock(data), null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : `  ${line}`))
    .join('\n');
  return `export function create${name}(overrides: Partial<${name}> = {}): ${name} {\n  return {\n    ...(${mock} as ${name}),\n    ...overrides,\n  };\n}`;
}

function toMsw(data: unknown, name = 'Root'): string {
  const mock = JSON.stringify(sampleMock(data), null, 2);
  return `import { http, HttpResponse } from 'msw';\n\nexport const handlers = [\n  http.get('/api/${name.toLowerCase()}', () => {\n    return HttpResponse.json(${mock});\n  }),\n];`;
}

export default function MockerTool() {
  const [input, setInput] = useState('');
  const [rootName, setRootName] = useState('Root');
  const [tab, setTab] = useState<Tab>('types');

  const result = useMemo(() => {
    if (!input.trim()) return { text: '', error: null as string | null };
    try {
      const data = JSON.parse(input);
      const name = rootName.trim() || 'Root';
      switch (tab) {
        case 'types':
          return { text: jsonToTypeScript(data, { rootName: name, useInterface: true }), error: null };
        case 'zod':
          return { text: jsonToZod(data, name), error: null };
        case 'mock':
          return { text: JSON.stringify(sampleMock(data), null, 2), error: null };
        case 'factory':
          return {
            text: `${jsonToTypeScript(data, { rootName: name, useInterface: true })}\n\n${toFactory(data, name)}`,
            error: null,
          };
        case 'msw':
          return { text: toMsw(data, name), error: null };
      }
    } catch (e) {
      return { text: '', error: e instanceof Error ? e.message : String(e) };
    }
  }, [input, rootName, tab]);

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 bg-secondary/40 p-1.5 rounded-2xl border border-border/30">
          {(
            [
              ['types', 'Types'],
              ['zod', 'Zod'],
              ['mock', 'Mock'],
              ['factory', 'Factory'],
              ['msw', 'MSW'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold ${
                tab === id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={rootName}
          onChange={(e) => setRootName(e.target.value)}
          className="px-3 py-2 rounded-xl bg-secondary/50 text-sm font-mono border border-border/40 focus:outline-none w-36"
          placeholder="Root name"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ToolCard minHeight="min-h-80">
          <ToolTextarea
            value={input}
            onChange={setInput}
            placeholder={`{\n  "id": 1,\n  "email": "ada@example.com",\n  "roles": ["admin"]\n}`}
          />
          <ToolBar>
            <span className="text-xs text-muted-foreground">Paste API JSON response</span>
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
              result.text || <span className="text-muted-foreground/50">Generated output…</span>
            )}
          </pre>
          <ToolBar>
            <span className="text-xs text-muted-foreground">Ready to paste into your project</span>
            {result.text && <CopyButton text={result.text} size={14} />}
          </ToolBar>
        </ToolCard>
      </div>
    </div>
  );
}
