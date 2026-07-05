'use client';

import { useMemo, useState } from 'react';
import { ToolCard, ToolTextarea, ToolBar } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';

type Mode = 'encode' | 'decode' | 'parse';

export default function UrlTool() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('decode');

  const { output, error, parsed } = useMemo(() => {
    if (!input.trim()) return { output: '', error: '', parsed: null };
    try {
      if (mode === 'encode') {
        return { output: encodeURIComponent(input), error: '', parsed: null };
      }
      if (mode === 'decode') {
        return { output: decodeURIComponent(input.replace(/\+/g, ' ')), error: '', parsed: null };
      }
      const url = new URL(input.startsWith('http') ? input : `https://${input}`);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });
      return {
        output: JSON.stringify({ origin: url.origin, pathname: url.pathname, params }, null, 2),
        error: '',
        parsed: { origin: url.origin, pathname: url.pathname, params },
      };
    } catch {
      return { output: '', error: mode === 'parse' ? 'Invalid URL' : 'Invalid encoded string', parsed: null };
    }
  }, [input, mode]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ToolCard minHeight="min-h-[400px]">
        <div className="flex gap-2 p-4 pb-0 flex-wrap">
          {(['decode', 'encode', 'parse'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${
                mode === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <ToolTextarea
          value={input}
          onChange={setInput}
          placeholder={
            mode === 'parse'
              ? 'https://api.example.com/users?id=123&filter=active'
              : mode === 'decode'
                ? 'Hello%20World%21'
                : 'Hello World!'
          }
        />
        <ToolBar>
          <span className={`text-xs ${error ? 'text-destructive' : 'text-muted-foreground'}`}>{error || 'Ready'}</span>
        </ToolBar>
      </ToolCard>

      <ToolCard minHeight="min-h-[400px]">
        <div className="p-4 pb-0 flex justify-between items-center">
          <span className="text-xs font-medium text-muted-foreground">
            {mode === 'parse' ? 'Parsed URL' : 'Output'}
          </span>
          {output && <CopyButton text={output} size={14} />}
        </div>
        {parsed ? (
          <div className="p-6 space-y-4 overflow-auto flex-1">
            <Field label="Origin" value={parsed.origin} />
            <Field label="Path" value={parsed.pathname} />
            <div>
              <p className="text-xs text-muted-foreground mb-2">Query params</p>
              {Object.keys(parsed.params).length === 0 ? (
                <p className="text-xs text-muted-foreground">None</p>
              ) : (
                Object.entries(parsed.params).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs font-mono py-1 border-b border-border/30">
                    <span className="text-primary font-medium">{k}</span>
                    <span className="text-muted-foreground">=</span>
                    <span>{v}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <pre className="flex-1 p-6 text-sm font-mono whitespace-pre-wrap break-all overflow-auto text-foreground/80">
            {output || <span className="text-muted-foreground">Result appears here</span>}
          </pre>
        )}
      </ToolCard>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-mono">{value}</p>
      </div>
      <CopyButton text={value} size={14} />
    </div>
  );
}
