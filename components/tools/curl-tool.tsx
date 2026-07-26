'use client';

import { useMemo, useState } from 'react';
import { Terminal } from 'lucide-react';
import { ToolCard, ToolTextarea, ToolBar, EmptyState, ToolChip } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';
import { CodeHighlight } from '@/components/code-highlight';
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
    <div className="w-full space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TARGETS.map((t) => (
          <ToolChip key={t.id} active={target === t.id} onClick={() => setTarget(t.id)}>
            {t.label}
          </ToolChip>
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
          {result.error ? (
            <div className="flex-1 p-5 text-sm text-destructive font-mono">{result.error}</div>
          ) : result.text ? (
            <CodeHighlight
              code={result.text}
              language={target === 'python' ? 'python' : 'typescript'}
              className="flex-1 p-5"
            />
          ) : (
            <EmptyState
              icon={Terminal}
              title="Code will land here"
              description="Paste a curl command to generate fetch, Axios, Python, and more."
            />
          )}
          <ToolBar>
            <span className="text-xs text-muted-foreground">{TARGETS.find((t) => t.id === target)?.label}</span>
            {result.text && <CopyButton text={result.text} size={14} />}
          </ToolBar>
        </ToolCard>
      </div>
    </div>
  );
}
