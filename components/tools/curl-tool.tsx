'use client';

import { useMemo, useRef, useState } from 'react';
import { Activity, Code2, LoaderCircle, Play, Square, Terminal } from 'lucide-react';
import { CodeHighlight } from '@/components/code-highlight';
import { CopyButton } from '@/components/copy-button';
import { EmptyState, ToolBar, ToolCard, ToolChip, ToolTextarea } from '@/components/tool-card';
import {
  curlToAxios,
  curlToBrowserRequest,
  curlToFetch,
  curlToPython,
  curlToReactQuery,
  curlToRnFetch,
  curlToUndici,
  parseCurl,
  type ParsedCurl,
} from '@/lib/curl-parser';

type Mode = 'convert' | 'client';
type ResponseView = 'body' | 'headers';
type Target = 'fetch' | 'axios' | 'python' | 'undici' | 'react-query' | 'react-mutation' | 'rn';
type ClientResponse = {
  status: number;
  statusText: string;
  elapsed: number;
  size: number;
  body: string;
  headers: [string, string][];
};

const TARGETS: { id: Target; label: string }[] = [
  { id: 'fetch', label: 'fetch' },
  { id: 'axios', label: 'Axios' },
  { id: 'python', label: 'Python' },
  { id: 'undici', label: 'undici' },
  { id: 'react-query', label: 'React Query' },
  { id: 'react-mutation', label: 'RQ Mutation' },
  { id: 'rn', label: 'RN / Expo' },
];

function convertCurl(parsed: ParsedCurl, target: Target) {
  switch (target) {
    case 'fetch': return curlToFetch(parsed);
    case 'axios': return curlToAxios(parsed);
    case 'python': return curlToPython(parsed);
    case 'undici': return curlToUndici(parsed);
    case 'react-query': return curlToReactQuery(parsed, 'query');
    case 'react-mutation': return curlToReactQuery(parsed, 'mutation');
    case 'rn': return curlToRnFetch(parsed);
  }
}

export default function CurlTool() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('convert');
  const [target, setTarget] = useState<Target>('fetch');
  const [sending, setSending] = useState(false);
  const [clientError, setClientError] = useState('');
  const [clientResponse, setClientResponse] = useState<ClientResponse | null>(null);
  const [responseView, setResponseView] = useState<ResponseView>('body');
  const requestControllerRef = useRef<AbortController | null>(null);

  const parsedResult = useMemo(() => {
    if (!input.trim()) return { parsed: null, error: null as string | null };
    try {
      return { parsed: parseCurl(input), error: null };
    } catch (error) {
      return { parsed: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [input]);

  const conversion = useMemo(() => {
    if (!parsedResult.parsed) return { text: '', error: parsedResult.error };
    return { text: convertCurl(parsedResult.parsed, target), error: null };
  }, [parsedResult, target]);

  const browserRequest = useMemo(() => {
    if (!parsedResult.parsed) return { request: null, error: parsedResult.error };
    try {
      return { request: curlToBrowserRequest(parsedResult.parsed), error: null };
    } catch (error) {
      return { request: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [parsedResult]);

  function updateInput(value: string) {
    setInput(value);
    setClientError('');
    setClientResponse(null);
  }

  async function sendRequest() {
    if (!browserRequest.request) return;
    setSending(true);
    setClientError('');
    setClientResponse(null);
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const startedAt = performance.now();

    try {
      const response = await fetch(browserRequest.request.url, { ...browserRequest.request.init, signal: controller.signal });
      const rawBody = await response.text();
      let body = rawBody;
      try {
        body = JSON.stringify(JSON.parse(rawBody), null, 2);
      } catch {
        // Keep non-JSON responses as text.
      }
      setClientResponse({
        status: response.status,
        statusText: response.statusText,
        elapsed: Math.round(performance.now() - startedAt),
        size: new Blob([rawBody]).size,
        body,
        headers: Array.from(response.headers.entries()),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setClientError('Request cancelled.');
      } else {
        const message = error instanceof Error ? error.message : 'Request failed.';
        setClientError(message === 'Failed to fetch'
          ? 'Request blocked or unreachable. The API may not allow browser requests (CORS).'
          : message);
      }
    } finally {
      requestControllerRef.current = null;
      setSending(false);
    }
  }

  return (
    <div className="w-full">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.035em] text-foreground">cURL</h2>
          <p className="mt-1 text-[16px] text-foreground/78">Convert commands or run API requests directly in your browser.</p>
        </div>
        <div className="flex gap-1 rounded-[4px] border border-border bg-card p-1">
          <ToolChip active={mode === 'convert'} onClick={() => setMode('convert')} className="flex items-center gap-2">
            <Code2 size={14} /> Convert
          </ToolChip>
          <ToolChip active={mode === 'client'} onClick={() => setMode('client')} className="flex items-center gap-2">
            <Activity size={14} /> API Client
          </ToolChip>
        </div>
      </header>

      {mode === 'convert' ? (
        <Converter input={input} onInput={updateInput} target={target} onTarget={setTarget} text={conversion.text} error={conversion.error} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <ToolCard minHeight="min-h-[560px]">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-[15px] font-bold">Request</h3>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Paste a cURL command, then send it as a browser request.</p>
            </div>
            <ToolTextarea
              value={input}
              onChange={updateInput}
              placeholder={'curl \'https://api.example.com/users\' \\\n  -H \'Accept: application/json\''}
              className="min-h-[330px]"
            />
            <div className="border-t border-border px-5 py-4">
              {browserRequest.error ? (
                <p className="font-mono text-[12px] text-destructive">{browserRequest.error}</p>
              ) : parsedResult.parsed ? (
                <RequestSummary parsed={parsedResult.parsed} omittedHeaders={browserRequest.request?.omittedHeaders ?? []} />
              ) : (
                <p className="text-[12px] text-muted-foreground">Waiting for a cURL command.</p>
              )}
            </div>
            <ToolBar>
              <span className="text-[11px] text-muted-foreground">Requests follow browser CORS rules.</span>
              {sending ? (
                <button onClick={() => requestControllerRef.current?.abort()} className="inline-flex items-center gap-2 rounded-[4px] border border-border px-4 py-2 text-[13px] font-semibold hover:bg-secondary">
                  <Square size={12} /> Cancel
                </button>
              ) : (
                <button onClick={() => void sendRequest()} disabled={!browserRequest.request} className="gum-button inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold disabled:pointer-events-none disabled:opacity-40">
                  <Play size={14} /> Send
                </button>
              )}
            </ToolBar>
          </ToolCard>

          <ResponseCard sending={sending} error={clientError} response={clientResponse} view={responseView} onView={setResponseView} />
        </div>
      )}
    </div>
  );
}

function Converter({ input, onInput, target, onTarget, text, error }: {
  input: string;
  onInput: (value: string) => void;
  target: Target;
  onTarget: (target: Target) => void;
  text: string;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TARGETS.map((item) => <ToolChip key={item.id} active={target === item.id} onClick={() => onTarget(item.id)}>{item.label}</ToolChip>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ToolCard minHeight="min-h-80">
          <ToolTextarea
            value={input}
            onChange={onInput}
            placeholder={'curl \'https://api.example.com/users\' \\\n  -H \'Authorization: Bearer TOKEN\' \\\n  -H \'Content-Type: application/json\' \\\n  --data-raw \'{"name":"Ada"}\''}
          />
          <ToolBar>
            <span className="text-xs text-muted-foreground">Paste a cURL command</span>
            {input && <button onClick={() => onInput('')} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}
          </ToolBar>
        </ToolCard>
        <ToolCard minHeight="min-h-80">
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <span className="text-[13px] font-bold">{TARGETS.find((item) => item.id === target)?.label}</span>
            {text && <CopyButton text={text} label="Copy" size={14} className="inline-flex items-center gap-2 rounded-[4px] border border-border px-3 py-2 text-[12px] font-semibold hover:bg-secondary" />}
          </div>
          {error ? (
            <div className="flex-1 p-5 font-mono text-sm text-destructive">{error}</div>
          ) : text ? (
            <CodeHighlight code={text} language={target === 'python' ? 'python' : 'typescript'} className="flex-1 p-5" />
          ) : (
            <EmptyState icon={Terminal} title="Code will land here" description="Paste a cURL command to generate fetch, Axios, Python, and more." />
          )}
        </ToolCard>
      </div>
    </div>
  );
}

function RequestSummary({ parsed, omittedHeaders }: { parsed: ParsedCurl; omittedHeaders: string[] }) {
  return (
    <div className="space-y-2 text-[12px]">
      <div className="flex min-w-0 items-center gap-2">
        <span className="rounded-[3px] bg-primary px-2 py-1 font-mono font-bold text-primary-foreground">{parsed.method}</span>
        <span className="min-w-0 truncate font-mono text-foreground" title={parsed.url}>{parsed.url}</span>
      </div>
      <p className="text-muted-foreground">{Object.keys(parsed.headers).length} headers · {parsed.body === null ? 'No body' : `${new Blob([parsed.body]).size} B body`}</p>
      {omittedHeaders.length > 0 && <p className="text-amber-700 dark:text-amber-400">Browser omits: {omittedHeaders.join(', ')}</p>}
    </div>
  );
}

function ResponseCard({ sending, error, response, view, onView }: {
  sending: boolean;
  error: string;
  response: ClientResponse | null;
  view: ResponseView;
  onView: (view: ResponseView) => void;
}) {
  return (
    <ToolCard minHeight="min-h-[560px]">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-[15px] font-bold">Response</h3>
          {response && <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{response.status} {response.statusText} · {response.elapsed} ms · {response.size} B</p>}
        </div>
        {response && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <ToolChip active={view === 'body'} onClick={() => onView('body')}>Body</ToolChip>
              <ToolChip active={view === 'headers'} onClick={() => onView('headers')}>Headers</ToolChip>
            </div>
            {response.body && <CopyButton text={response.body} label="Copy" size={14} className="inline-flex items-center gap-2 rounded-[4px] border border-border px-3 py-2 text-[12px] font-semibold hover:bg-secondary" title="Copy response body" />}
          </div>
        )}
      </div>
      {sending ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={18} className="animate-spin" /> Sending request…</div>
      ) : error ? (
        <div className="flex-1 p-5 text-sm leading-6 text-destructive">{error}</div>
      ) : response ? (
        view === 'body' ? (
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-[13px] leading-6 text-foreground">{response.body || '(empty response)'}</pre>
        ) : (
          <div className="flex-1 overflow-auto p-5">
            {response.headers.map(([name, value]) => (
              <div key={name} className="grid gap-1 border-b border-border/40 py-2 text-[12px] sm:grid-cols-[180px_1fr]">
                <span className="font-mono font-semibold text-foreground">{name}</span>
                <span className="break-all font-mono text-muted-foreground">{value}</span>
              </div>
            ))}
          </div>
        )
      ) : (
        <EmptyState icon={Activity} title="No response yet" description="Send the request to inspect its status, timing, headers, and body." />
      )}
      <ToolBar>
        <span className="text-[11px] text-muted-foreground">Credentials are not sent automatically.</span>
      </ToolBar>
    </ToolCard>
  );
}
