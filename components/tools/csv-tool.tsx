'use client';

import { useMemo, useState } from 'react';
import { Table2 } from 'lucide-react';
import { ToolCard, ToolTextarea, ToolBar, EmptyState, ToolChip } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';
import {
  csvToJson,
  detectDelimiter,
  jsonToCsv,
  jsonToMarkdownTable,
  type Delimiter,
} from '@/lib/csv-utils';

type Mode = 'csv-to-json' | 'json-to-csv' | 'json-to-md';

export default function CsvTool() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('csv-to-json');
  const [delimiter, setDelimiter] = useState<Delimiter | 'auto'>('auto');

  const result = useMemo(() => {
    if (!input.trim()) return { ok: true as const, text: '', error: null as string | null };
    try {
      if (mode === 'csv-to-json') {
        const delim = delimiter === 'auto' ? detectDelimiter(input) : delimiter;
        const data = csvToJson(input, delim);
        return { ok: true as const, text: JSON.stringify(data, null, 2), error: null };
      }
      const parsed = JSON.parse(input);
      if (mode === 'json-to-csv') {
        const delim = delimiter === 'auto' ? ',' : delimiter;
        return { ok: true as const, text: jsonToCsv(parsed, delim), error: null };
      }
      return { ok: true as const, text: jsonToMarkdownTable(parsed), error: null };
    } catch (e) {
      return { ok: false as const, text: '', error: e instanceof Error ? e.message : String(e) };
    }
  }, [input, mode, delimiter]);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['csv-to-json', 'CSV → JSON'],
            ['json-to-csv', 'JSON → CSV'],
            ['json-to-md', 'JSON → Markdown'],
          ] as const
        ).map(([id, label]) => (
          <ToolChip key={id} active={mode === id} onClick={() => setMode(id)}>
            {label}
          </ToolChip>
        ))}
        {mode !== 'json-to-md' && (
          <select
            value={delimiter}
            onChange={(e) => setDelimiter(e.target.value as Delimiter | 'auto')}
            className="ml-auto px-3 h-8 rounded-lg bg-secondary/60 text-xs border border-border/40 focus:outline-none"
          >
            <option value="auto">Delimiter: auto</option>
            <option value=",">Comma (,)</option>
            <option value={"\t"}>Tab (TSV)</option>
            <option value=";">Semicolon (;)</option>
          </select>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ToolCard minHeight="min-h-80">
          <ToolTextarea
            value={input}
            onChange={setInput}
            placeholder={
              mode === 'csv-to-json'
                ? 'name,age,city\nAda,36,London\nGrace,41,NYC'
                : '[{"name":"Ada","age":36},{"name":"Grace","age":41}]'
            }
          />
          <ToolBar>
            <span className="text-xs text-muted-foreground">
              {mode === 'csv-to-json' ? 'Paste CSV or TSV' : 'Paste JSON array of objects'}
            </span>
            {input && (
              <button
                onClick={() => setInput('')}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
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
              icon={Table2}
              title="Output ready when you are"
              description="Paste data on the left to convert between CSV, JSON, and Markdown."
            />
          )}
          <ToolBar>
            <span className="text-xs text-muted-foreground">
              {result.ok && result.text
                ? `${result.text.split('\n').length} lines`
                : 'Waiting for input'}
            </span>
            {result.ok && result.text && <CopyButton text={result.text} size={14} />}
          </ToolBar>
        </ToolCard>
      </div>
    </div>
  );
}
