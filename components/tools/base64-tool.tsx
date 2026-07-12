'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Binary, KeyRound, RefreshCw } from 'lucide-react';
import { ToolCard, ToolTextarea, ToolBar, EmptyState, ToolChip } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';
import JsonViewer from '@/components/json-viewer';

type WorkspaceTab = 'base64' | 'jwt' | 'uuid';
type Base64Mode = 'encode' | 'decode';

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'base64', label: 'Base64' },
  { id: 'jwt', label: 'JWT' },
  { id: 'uuid', label: 'UUID' },
];

export default function Base64Tool() {
  const [tab, setTab] = useState<WorkspaceTab>('base64');
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tool');

  useEffect(() => {
    if (requestedTab === 'jwt' || requestedTab === 'uuid' || requestedTab === 'base64') {
      setTab(requestedTab);
    }
  }, [requestedTab]);

  return (
    <div className="w-full space-y-4">
      <div className="flex w-fit flex-wrap gap-1 rounded-xl border border-border/40 bg-secondary/50 p-1">
        {TABS.map((item) => (
          <ToolChip key={item.id} active={tab === item.id} onClick={() => setTab(item.id)}>
            {item.label}
          </ToolChip>
        ))}
      </div>
      {tab === 'base64' ? <Base64Panel /> : tab === 'jwt' ? <JwtPanel /> : <UuidPanel />}
    </div>
  );
}

function Base64Panel() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Base64Mode>('decode');
  const [urlSafe, setUrlSafe] = useState(false);

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: '' };
    try {
      if (mode === 'encode') {
        const encoded = btoa(unescape(encodeURIComponent(input)));
        const result = urlSafe ? encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : encoded;
        return { output: result, error: '' };
      }
      let value = input.trim();
      if (urlSafe) value = value.replace(/-/g, '+').replace(/_/g, '/');
      const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
      return { output: decodeURIComponent(escape(atob(padded))), error: '' };
    } catch {
      return { output: '', error: 'Invalid Base64 input' };
    }
  }, [input, mode, urlSafe]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ToolCard minHeight="min-h-[400px]">
        <div className="flex gap-1.5 px-4 pt-4 pb-0">
          {(['decode', 'encode'] as const).map((item) => (
            <ToolChip key={item} active={mode === item} onClick={() => setMode(item)} className="capitalize">
              {item}
            </ToolChip>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={urlSafe} onChange={(event) => setUrlSafe(event.target.checked)} className="rounded" />
            URL-safe
          </label>
        </div>
        <ToolTextarea value={input} onChange={setInput} placeholder={mode === 'decode' ? 'Paste Base64 string...' : 'Text to encode...'} />
        <ToolBar>
          <span className={`text-xs ${error ? 'text-destructive' : 'text-muted-foreground'}`}>{error || `${input.length} chars`}</span>
        </ToolBar>
      </ToolCard>

      <ToolCard minHeight="min-h-[400px]">
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Output</span>
          {output && <CopyButton text={output} size={14} />}
        </div>
        {output ? (
          <pre className="flex-1 px-5 py-4 text-sm font-mono whitespace-pre-wrap break-all overflow-auto text-foreground/85 leading-7">{output}</pre>
        ) : (
          <EmptyState icon={Binary} title="No output yet" description={mode === 'decode' ? 'Paste Base64 on the left to decode it.' : 'Type text on the left to encode it.'} />
        )}
      </ToolCard>
    </div>
  );
}

function decodeBase64Url(value: string): string {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(atob(base64).split('').map((character) => `%${(`00${character.charCodeAt(0).toString(16)}`).slice(-2)}`).join(''));
}

function parseJwt(token: string) {
  const parts = token.trim().replace(/^Bearer\s+/i, '').split('.');
  if (parts.length !== 3) return { error: 'JWT must have 3 parts (header.payload.signature)' };
  try {
    return {
      header: JSON.parse(decodeBase64Url(parts[0])),
      payload: JSON.parse(decodeBase64Url(parts[1])),
      signature: parts[2],
    };
  } catch {
    return { error: 'Failed to decode JWT — invalid base64 or JSON' };
  }
}

function JwtPanel() {
  const [input, setInput] = useState('');
  const result = useMemo(() => (input.trim() ? parseJwt(input) : null), [input]);
  const expiry = result && 'payload' in result && result.payload && typeof result.payload === 'object'
    ? formatExpiry((result.payload as Record<string, unknown>).exp)
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ToolCard minHeight="min-h-[500px]">
        <ToolTextarea value={input} onChange={setInput} placeholder="Paste JWT token (eyJhbGciOiJIUzI1NiIs...)" />
        <ToolBar>
          <span className="text-xs text-muted-foreground">
            {result && 'error' in result ? <span className="flex items-center gap-1 text-destructive"><AlertCircle size={14} /> {result.error}</span> : result ? <span className="text-accent">Decoded · 3 parts</span> : 'Paste a Bearer token from DevTools or API logs'}
          </span>
          {input && <button onClick={() => setInput('')} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}
        </ToolBar>
      </ToolCard>

      <div className="space-y-4">
        {result && 'error' in result ? (
          <ToolCard className="p-6"><p className="text-sm text-destructive">{result.error}</p></ToolCard>
        ) : result && 'header' in result ? (
          <>
            {expiry && <div className={`rounded-2xl px-4 py-3 text-xs font-medium ${expiry.expired ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'}`}>{expiry.expired ? 'Expired' : 'Valid'} · exp: {expiry.label}</div>}
            <ToolCard className="p-6">
              <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">Header</h3><CopyButton text={JSON.stringify(result.header, null, 2)} size={14} /></div>
              <JsonViewer data={result.header} expandMode="all" />
            </ToolCard>
            <ToolCard className="p-6">
              <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">Payload</h3><CopyButton text={JSON.stringify(result.payload, null, 2)} size={14} /></div>
              <JsonViewer data={result.payload} expandMode="all" />
            </ToolCard>
            <ToolCard className="p-4">
              <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Signature (not verified)</span><CopyButton text={result.signature} size={14} /></div>
              <p className="mt-2 break-all text-xs font-mono text-muted-foreground">{result.signature}</p>
            </ToolCard>
          </>
        ) : (
          <ToolCard className="min-h-[500px]"><EmptyState icon={KeyRound} title="Waiting for a token" description="Paste a JWT on the left to decode its header and payload." /></ToolCard>
        )}
      </div>
    </div>
  );
}

function formatExpiry(value: unknown): { label: string; expired: boolean } | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return { label: date.toLocaleString(), expired: date < new Date() };
}

function UuidPanel() {
  const [uuids, setUuids] = useState<string[]>(() => [crypto.randomUUID()]);
  const [count, setCount] = useState(1);

  const regenerate = () => setUuids(Array.from({ length: count }, () => crypto.randomUUID()));

  return (
    <div className="max-w-2xl space-y-4">
      <ToolCard>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm text-muted-foreground">Count</label>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(event) => {
                const next = Number(event.target.value);
                setCount(Number.isFinite(next) ? Math.min(50, Math.max(1, next)) : 1);
              }}
              className="w-20 px-3 py-1.5 rounded-lg bg-secondary text-sm font-mono focus:outline-none"
            />
            <button onClick={regenerate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"><RefreshCw size={14} /> Generate</button>
          </div>
          <div className="space-y-2">
            {uuids.map((uuid, index) => <div key={`${uuid}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-secondary/50 font-mono text-sm"><span className="break-all">{uuid}</span><CopyButton text={uuid} size={14} /></div>)}
          </div>
        </div>
        <ToolBar>
          <span className="text-xs text-muted-foreground">UUID v4 · cryptographically random</span>
          {uuids.length > 1 && <CopyButton text={uuids.join('\n')} size={14} title="Copy all" />}
        </ToolBar>
      </ToolCard>
    </div>
  );
}
