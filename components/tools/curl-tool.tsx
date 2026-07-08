'use client';

import { useMemo, useState } from 'react';
import { ToolCard, ToolTextarea, ToolBar } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';
import {
  parseCurl,
  curlToFetch,
  curlToAxios,
  curlToPython,
  curlToUndici,
  curlToReactQuery,
  curlToRnFetch,
} from '@/lib/curl-parser';

type Target =
  | 'fetch'
  | 'axios'
  | 'python'
  | 'undici'
  | 'react-query'
  | 'react-mutation'
  | 'rn';

const TARGETS: { id: Target; label: string }[] = [
  { id: 'fetch', label: 'fetch' },
  { id: 'axios', label: 'Axios' },
  { id: 'python', label: 'Python' },
  { id: 'undici', label: 'undici' },
  { id: 'react-query', label: 'React Query' },
  { id: 'react-mutation', label: 'RQ Mutation' },
  { id: 'rn', label: 'RN / Expo' },
];

export default function CurlTool() {
  const [input, setInput] = useState('');
  const [target, setTarget] = useState<Target>('fetch');

  const result = useMemo(() => {
    if (!input.trim()) return { text: '', error: null as string | null };
    try {
      const parsed = parseCurl(input);
      switch (target) {
        case 'fetch':
          return { text: curlToFetch(parsed), error: null };
        case 'axios':
          return { text: curlToAxios(parsed), error: null };
        case 'python':
          return { text: curlToPython(parsed), error: null };
        case 'undici':
          return { text: curlToUndici(parsed), error: null };
        case 'react-query':
          return { text: curlToReactQuery(parsed, 'query'), error: null };
        case 'react-mutation':
          return { text: curlToReactQuery(parsed, 'mutation'), error: null };
        case 'rn':
          return { text: curlToRnFetch(parsed), error: null };
      }
    } catch (e) {
      return { text: '', error: e instanceof Error ? e.message : String(e) };
    }
  }, [input, target]);

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap gap-1 bg-secondary/40 p-1.5 rounded-2xl border border-border/30 w-fit">
        {TARGETS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTarget(t.id)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              target === t.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ToolCard minHeight="min-h-80">
          <ToolTextarea
            value={input}
            onChange={setInput}
            placeholder={`curl 'https://api.example.com/users' \\\n  -H 'Authorization: Bearer TOKEN' \\\n  -H 'Content-Type: application/json' \\\n  --data-raw '{"name":"Ada"}'`}
          />
          <ToolBar>
            <span className="text-xs text-muted-foreground">Paste a curl command</span>
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
              result.text || <span className="text-muted-foreground/50">Generated code appears here…</span>
            )}
          </pre>
          <ToolBar>
            <span className="text-xs text-muted-foreground">{TARGETS.find((t) => t.id === target)?.label}</span>
            {result.text && <CopyButton text={result.text} size={14} />}
          </ToolBar>
        </ToolCard>
      </div>
    </div>
  );
}
