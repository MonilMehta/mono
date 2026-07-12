'use client';

import { useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import { ToolCard, ToolTextarea, ToolBar, EmptyState, ToolChip } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';
import { jsonToTypeScript, jsonToZod, sampleMock } from '@/lib/json-to-ts';

type OutputKind = 'typescript' | 'zod' | 'mock' | 'factory' | 'msw';

const OUTPUTS: { id: OutputKind; label: string }[] = [
  { id: 'typescript', label: 'TypeScript' },
  { id: 'zod', label: 'Zod' },
  { id: 'mock', label: 'Mock data' },
  { id: 'factory', label: 'Factory' },
  { id: 'msw', label: 'MSW' },
];

function toFactory(data: unknown, name: string): string {
  const mock = JSON.stringify(sampleMock(data), null, 2)
    .split('\n')
    .map((line, index) => (index === 0 ? line : `  ${line}`))
    .join('\n');
  return `export function create${name}(overrides: Partial<${name}> = {}): ${name} {\n  return {\n    ...(${mock} as ${name}),\n    ...overrides,\n  };\n}`;
}

function toMsw(data: unknown, name: string): string {
  const mock = JSON.stringify(sampleMock(data), null, 2);
  return `import { http, HttpResponse } from 'msw';\n\nexport const handlers = [\n  http.get('/api/${name.toLowerCase()}', () => {\n    return HttpResponse.json(${mock});\n  }),\n];`;
}

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
      const name = rootName.trim() || 'Root';
      switch (kind) {
        case 'typescript':
          return {
            text: jsonToTypeScript(data, { rootName: name, useInterface, optionalFields, readonly }),
            error: null,
          };
        case 'zod':
          return { text: jsonToZod(data, name), error: null };
        case 'mock':
          return { text: JSON.stringify(sampleMock(data), null, 2), error: null };
        case 'factory':
          return {
            text: `${jsonToTypeScript(data, { rootName: name, useInterface })}\n\n${toFactory(data, name)}`,
            error: null,
          };
        case 'msw':
          return { text: toMsw(data, name), error: null };
      }
    } catch (error) {
      return { text: '', error: error instanceof Error ? error.message : String(error) };
    }
  }, [input, rootName, useInterface, optionalFields, readonly, kind]);

  const outputLabel = OUTPUTS.find((output) => output.id === kind)?.label ?? 'Output';

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 bg-secondary/50 p-1 rounded-xl border border-border/40">
          {OUTPUTS.map((output) => (
            <ToolChip key={output.id} active={kind === output.id} onClick={() => setKind(output.id)}>
              {output.label}
            </ToolChip>
          ))}
        </div>
        <input
          value={rootName}
          onChange={(event) => setRootName(event.target.value)}
          placeholder="Root name"
          className="px-3 h-8 rounded-lg bg-secondary/50 text-sm font-mono border border-border/40 focus:outline-none w-36"
        />
        {kind === 'typescript' && (
          <>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={useInterface} onChange={(event) => setUseInterface(event.target.checked)} />
              interface
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={optionalFields} onChange={(event) => setOptionalFields(event.target.checked)} />
              optional
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={readonly} onChange={(event) => setReadonly(event.target.checked)} />
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
            placeholder={`{\n  "id": 1,\n  "email": "ada@example.com",\n  "roles": ["admin"]\n}`}
          />
          <ToolBar>
            <span className="text-xs text-muted-foreground">Paste an API JSON response</span>
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
              icon={Boxes}
              title="Schema and mocks, together"
              description="Paste JSON to generate types, Zod schemas, mock data, factories, or MSW handlers."
            />
          )}
          <ToolBar>
            <span className="text-xs text-muted-foreground">{outputLabel}</span>
            {result.text && <CopyButton text={result.text} size={14} />}
          </ToolBar>
        </ToolCard>
      </div>
    </div>
  );
}
