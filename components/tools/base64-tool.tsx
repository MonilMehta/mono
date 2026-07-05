'use client';

import { useMemo, useState } from 'react';
import { ToolCard, ToolTextarea, ToolBar } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';

type Mode = 'encode' | 'decode';

export default function Base64Tool() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('decode');
  const [urlSafe, setUrlSafe] = useState(false);

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: '' };
    try {
      if (mode === 'encode') {
        const encoded = btoa(unescape(encodeURIComponent(input)));
        const result = urlSafe ? encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : encoded;
        return { output: result, error: '' };
      }
      let str = input.trim();
      if (urlSafe) str = str.replace(/-/g, '+').replace(/_/g, '/');
      const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
      const decoded = decodeURIComponent(escape(atob(padded)));
      return { output: decoded, error: '' };
    } catch {
      return { output: '', error: 'Invalid Base64 input' };
    }
  }, [input, mode, urlSafe]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ToolCard minHeight="min-h-[400px]">
        <div className="flex gap-2 p-4 pb-0">
          {(['decode', 'encode'] as const).map((m) => (
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
          <label className="flex items-center gap-2 ml-auto text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} className="rounded" />
            URL-safe
          </label>
        </div>
        <ToolTextarea
          value={input}
          onChange={setInput}
          placeholder={mode === 'decode' ? 'Paste Base64 string...' : 'Text to encode...'}
        />
        <ToolBar>
          <span className={`text-xs ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
            {error || `${input.length} chars`}
          </span>
        </ToolBar>
      </ToolCard>

      <ToolCard minHeight="min-h-[400px]">
        <div className="p-4 pb-0 flex justify-between items-center">
          <span className="text-xs font-medium text-muted-foreground">Output</span>
          {output && <CopyButton text={output} size={14} />}
        </div>
        <pre className="flex-1 p-6 text-sm font-mono whitespace-pre-wrap break-all overflow-auto text-foreground/80">
          {output || <span className="text-muted-foreground">Result appears here</span>}
        </pre>
      </ToolCard>
    </div>
  );
}
