'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, KeyRound } from 'lucide-react';
import { ToolCard, ToolTextarea, ToolBar, EmptyState } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';
import JsonViewer from '@/components/json-viewer';

function decodeBase64Url(str: string): string {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

function parseJwt(token: string) {
  const parts = token.trim().split('.');
  if (parts.length !== 3) return { error: 'JWT must have 3 parts (header.payload.signature)' };

  try {
    const header = JSON.parse(decodeBase64Url(parts[0]));
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return { header, payload, signature: parts[2] };
  } catch {
    return { error: 'Failed to decode JWT — invalid base64 or JSON' };
  }
}

export default function JwtTool() {
  const [input, setInput] = useState('');

  const result = useMemo(() => (input.trim() ? parseJwt(input) : null), [input]);

  const expiry = result && 'payload' in result && result.payload
    ? formatExpiry(result.payload.exp as number | undefined)
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ToolCard minHeight="min-h-[500px]">
        <ToolTextarea
          value={input}
          onChange={setInput}
          placeholder="Paste JWT token (eyJhbGciOiJIUzI1NiIs...)"
        />
        <ToolBar>
          <span className="text-xs text-muted-foreground">
            {result && 'error' in result ? (
              <span className="text-destructive flex items-center gap-1">
                <AlertCircle size={14} /> {result.error}
              </span>
            ) : result ? (
              <span className="text-accent">Decoded · 3 parts</span>
            ) : (
              'Paste a Bearer token from DevTools or API logs'
            )}
          </span>
          {input && (
            <button onClick={() => setInput('')} className="text-xs text-muted-foreground hover:text-foreground">
              Clear
            </button>
          )}
        </ToolBar>
      </ToolCard>

      <div className="space-y-4">
        {result && 'error' in result ? (
          <ToolCard className="p-6">
            <p className="text-sm text-destructive">{result.error}</p>
          </ToolCard>
        ) : result && 'header' in result ? (
          <>
            {expiry && (
              <div
                className={`rounded-2xl px-4 py-3 text-xs font-medium ${
                  expiry.expired ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'
                }`}
              >
                {expiry.expired ? 'Expired' : 'Valid'} · exp: {expiry.label}
              </div>
            )}
            <ToolCard className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Header</h3>
                <CopyButton text={JSON.stringify(result.header, null, 2)} size={14} />
              </div>
              <JsonViewer data={result.header} expandMode="all" />
            </ToolCard>
            <ToolCard className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Payload</h3>
                <CopyButton text={JSON.stringify(result.payload, null, 2)} size={14} />
              </div>
              <JsonViewer data={result.payload} expandMode="all" />
            </ToolCard>
            <ToolCard className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Signature (not verified)</span>
                <CopyButton text={result.signature} size={14} />
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-2 break-all">{result.signature}</p>
            </ToolCard>
          </>
        ) : (
          <ToolCard className="min-h-[500px]">
            <EmptyState
              icon={KeyRound}
              title="Waiting for a token"
              description="Paste a JWT on the left to decode its header and payload."
            />
          </ToolCard>
        )}
      </div>
    </div>
  );
}

function formatExpiry(exp?: number): { label: string; expired: boolean } | null {
  if (!exp) return null;
  const date = new Date(exp * 1000);
  return { label: date.toLocaleString(), expired: date < new Date() };
}
