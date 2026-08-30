'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Link, LoaderCircle, Send } from 'lucide-react';
import { CopyButton } from '@/components/copy-button';
import { MOCK_METHODS, MOCK_TTL_SECONDS, type MockConfig, type MockMethod } from '@/lib/mock-api';

const INITIAL_BODIES: Record<MockMethod, string> = {
  GET: '{\n  "items": []\n}',
  POST: '{\n  "created": true\n}',
  PATCH: '{\n  "updated": true\n}',
};
const STATUS_OPTIONS = [200, 201, 202, 204, 400, 404, 500];
const METHOD_COLORS: Record<MockMethod, string> = { GET: 'text-foreground', POST: 'text-emerald-700 dark:text-emerald-400', PATCH: 'text-orange-600 dark:text-orange-400' };
type TestResult = { status: number; body: string; elapsed: number } | { error: string };

function prettyJson(value: string) { try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; } }

export default function MockApiTool() {
  const [origin, setOrigin] = useState('');
  const [route, setRoute] = useState('todos');
  const [method, setMethod] = useState<MockMethod>('PATCH');
  const [bodies, setBodies] = useState(INITIAL_BODIES);
  const [statuses, setStatuses] = useState<Record<MockMethod, number>>({ GET: 200, POST: 201, PATCH: 200 });
  const [endpoint, setEndpoint] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);
  const cleanRoute = route.split('/').filter(Boolean).map(encodeURIComponent).join('/') || 'todos';
  const displayOrigin = origin || 'https://mono.monilmehta.com';
  const validBodies = Object.fromEntries(MOCK_METHODS.map((item) => { try { JSON.parse(bodies[item]); return [item, true]; } catch { return [item, false]; } })) as Record<MockMethod, boolean>;
  const result = useMemo(() => {
    try {
      const responses = Object.fromEntries(MOCK_METHODS.map((item) => {
        if (!Number.isInteger(statuses[item]) || statuses[item] < 200 || statuses[item] > 599) throw new Error(`${item} status must be between 200 and 599.`);
        try { return [item, { status: statuses[item], body: JSON.parse(bodies[item]) }]; } catch { throw new Error(`${item} response must be valid JSON.`); }
      })) as MockConfig['responses'];
      return { config: { v: 1, responses } as MockConfig, error: '' };
    } catch (error) { return { config: null, error: error instanceof Error ? error.message : 'Invalid response.' }; }
  }, [bodies, statuses]);

  useEffect(() => {
    setEndpoint('');
    setCreateError('');
    setTestResult(null);
  }, [bodies, cleanRoute, statuses]);

  async function createEndpoint() {
    if (!result.config) throw new Error(result.error || 'Invalid response.');
    setCreating(true); setCreateError('');
    try {
      const response = await fetch('/api/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.config),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not create endpoint.');
      const url = `${origin}/mock/${cleanRoute}?id=${body.id}`;
      setEndpoint(url);
      return url;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create endpoint.';
      setCreateError(message);
      throw error;
    } finally { setCreating(false); }
  }

  async function sendRequest() {
    if (!result.config) return;
    setSending(true); setTestResult(null); const startedAt = performance.now();
    try { const response = await fetch(endpoint || await createEndpoint(), { method }); setTestResult({ status: response.status, body: prettyJson(await response.text()), elapsed: Math.round(performance.now() - startedAt) }); }
    catch (error) { setTestResult({ error: error instanceof Error ? error.message : 'Request failed.' }); }
    finally { setSending(false); }
  }
  function chooseMethod(nextMethod: MockMethod) { setMethod(nextMethod); setTestResult(null); }

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <header className="mb-7">
        <h2 className="text-[28px] font-bold leading-tight tracking-[-0.035em] text-foreground">Mock API</h2>
        <p className="mt-1 text-[16px] text-foreground/78">
          Configure JSON responses for a shareable mock endpoint.
        </p>
      </header>

      <section className="surface-panel overflow-hidden rounded-[4px] bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:p-5">
          <span className="text-[13px] font-semibold text-foreground">Endpoint</span>
          <div className="gum-input flex min-w-0 flex-1 items-center overflow-hidden px-3 py-2.5 font-mono text-[13px]">
            <span className="shrink-0 text-muted-foreground">{displayOrigin}/mock/</span>
            <input
              value={route}
              onChange={(event) => {
                setRoute(event.target.value);
                setTestResult(null);
              }}
              aria-label="Mock API route"
              className="min-w-20 flex-1 bg-transparent pl-0.5 text-foreground outline-none"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {endpoint ? (
              <>
                <CopyButton
                  text={endpoint}
                  label="Copy URL"
                  title="Copy endpoint URL"
                  className="inline-flex items-center gap-2 rounded-[4px] border border-border px-3 py-2 text-[13px] font-medium text-foreground hover:bg-secondary"
                />
                <a
                  href={endpoint}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open endpoint"
                  title="Open endpoint"
                  className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-border text-foreground hover:bg-secondary"
                >
                  <ExternalLink size={16} />
                </a>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void createEndpoint().catch(() => {})}
                disabled={!result.config || creating}
                className="inline-flex h-9 items-center gap-2 rounded-[4px] border border-border px-3 text-[13px] font-medium text-foreground hover:bg-secondary disabled:opacity-40"
              >
                {creating ? <LoaderCircle size={14} className="animate-spin" /> : <Link size={14} />}
                {creating ? 'Creating' : 'Create URL'}
              </button>
            )}
          </div>
        </div>
        {(endpoint || createError) && (
          <div className={`border-b border-border px-4 py-2.5 font-mono text-[11px] sm:px-5 ${createError ? 'text-destructive' : 'text-muted-foreground'}`}>
            {createError || `${endpoint} · expires in ${MOCK_TTL_SECONDS / 3_600} hours`}
          </div>
        )}

        <div className="overflow-x-auto border-b border-border px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-5">
          <div className="flex min-w-max gap-8">
            {MOCK_METHODS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => chooseMethod(item)}
                className={`flex items-center gap-2 border-b-[3px] py-4 text-[13px] font-semibold transition-colors ${
                  method === item
                    ? `border-primary ${METHOD_COLORS[item]}`
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{item}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{statuses[item]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-bold text-foreground">Response</h3>
              <p className="mt-0.5 text-[12px] text-muted-foreground">JSON body returned for {method} requests.</p>
            </div>
            <label className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              Status
              <select
                value={statuses[method]}
                onChange={(event) => {
                  setStatuses((current) => ({ ...current, [method]: Number(event.target.value) }));
                  setTestResult(null);
                }}
                aria-label={`${method} response status`}
                className="h-9 w-[78px] rounded-[4px] border border-border bg-card px-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/40"
              >
                {STATUS_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>

          <div className="flex min-h-[410px] overflow-hidden rounded-[4px] border border-border bg-card">
            <div className="hidden w-12 shrink-0 border-r border-border bg-secondary/20 py-4 text-right font-mono text-[12px] leading-7 text-muted-foreground sm:block">
              {bodies[method].split('\n').map((_, index) => <div key={index} className="pr-3">{index + 1}</div>)}
            </div>
            <textarea
              value={bodies[method]}
              onChange={(event) => {
                setBodies((current) => ({ ...current, [method]: event.target.value }));
                setTestResult(null);
              }}
              aria-label={`${method} JSON response`}
              spellCheck={false}
              className="min-h-[410px] w-full resize-y bg-transparent px-4 py-4 font-mono text-[13px] leading-7 text-foreground outline-none"
            />
          </div>

          <div className={`flex items-center gap-2 pt-3 text-[12px] font-medium ${validBodies[method] ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>
            <span className={`h-2 w-2 rounded-full ${validBodies[method] ? 'bg-emerald-600' : 'bg-destructive'}`} />
            {validBodies[method] ? 'Valid JSON' : 'Invalid JSON'}
          </div>
        </div>

        {testResult && (
          <div className="border-t border-border px-4 py-4 sm:px-5">
            <div className="mb-2 flex items-center justify-between text-[13px]">
              <span className="font-bold">Response preview</span>
              {'status' in testResult && (
                <span className="font-mono text-[12px] text-emerald-700 dark:text-emerald-400">
                  {testResult.status} · {testResult.elapsed} ms
                </span>
              )}
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words border border-border bg-secondary/20 p-3 font-mono text-[12px] leading-5">
              {'error' in testResult ? testResult.error : testResult.body || '(empty response)'}
            </pre>
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-border px-4 py-4 sm:px-5">
          <button
            type="button"
            onClick={() => void sendRequest()}
            disabled={!result.config || sending || creating}
            className="gum-button inline-flex h-10 shrink-0 items-center gap-2 px-4 text-[13px] font-semibold disabled:opacity-40"
          >
            {sending ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? 'Sending' : 'Test endpoint'}
          </button>
          <code className={`hidden min-w-0 flex-1 truncate font-mono text-[11px] ${result.error ? 'text-destructive' : 'text-muted-foreground'} sm:block`}>
            {endpoint ? `curl -X ${method} '${endpoint}'` : result.error || 'Creates a short endpoint automatically'}
          </code>
          {endpoint && <CopyButton text={`curl -X ${method} '${endpoint}'`} size={14} title="Copy cURL command" />}
        </div>
      </section>
    </div>
  );
}
