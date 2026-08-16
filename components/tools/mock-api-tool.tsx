'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ExternalLink, Link2, LoaderCircle, Plus, Send } from 'lucide-react';
import { CopyButton } from '@/components/copy-button';
import { encodeMockConfig, MOCK_METHODS, type MockConfig, type MockMethod } from '@/lib/mock-api';

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
      const url = `${origin}/mock/${cleanRoute}?config=${encodeMockConfig({ v: 1, responses })}`;
      return { url, curl: `curl -X ${method} '${url}'`, error: '' };
    } catch (error) { return { url: '', curl: '', error: error instanceof Error ? error.message : 'Invalid response.' }; }
  }, [bodies, cleanRoute, method, origin, statuses]);

  async function sendRequest() {
    if (!result.url) return;
    setSending(true); setTestResult(null); const startedAt = performance.now();
    try { const response = await fetch(result.url, { method }); setTestResult({ status: response.status, body: prettyJson(await response.text()), elapsed: Math.round(performance.now() - startedAt) }); }
    catch (error) { setTestResult({ error: error instanceof Error ? error.message : 'Request failed.' }); }
    finally { setSending(false); }
  }
  function chooseMethod(nextMethod: MockMethod) { setMethod(nextMethod); setTestResult(null); }

  return <div className="w-full max-w-[1280px]">
    <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
      <div><div className="flex items-center gap-3"><h2 className="text-[25px] font-semibold tracking-[-0.04em] text-foreground">Mock API</h2><span className="flex items-center gap-2 text-[13px] text-foreground/85"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />No setup required</span></div><p className="mt-3 text-[15px] text-muted-foreground">Create mock endpoints and share them instantly.</p></div>
      <div className="flex items-center gap-6 pt-1 text-[14px] text-foreground"><button type="button" className="inline-flex items-center gap-2 hover:text-muted-foreground"><BookOpen size={18} strokeWidth={1.8} />Docs</button><CopyButton text={result.url} label="Share" icon={<Link2 size={18} strokeWidth={1.8} />} title="Copy shareable endpoint URL" className="inline-flex items-center gap-2 text-[14px] text-foreground hover:text-muted-foreground" /><button type="button" onClick={() => { setRoute('new-endpoint'); setMethod('GET'); setTestResult(null); }} className="inline-flex h-11 items-center gap-2 rounded-[4px] bg-foreground px-4 text-[14px] font-medium text-background hover:opacity-90"><Plus size={18} />New Endpoint</button></div>
    </header>
    <section className="border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center"><select value={method} onChange={(event) => chooseMethod(event.target.value as MockMethod)} aria-label="Request method" className={`h-12 w-[126px] shrink-0 rounded-[4px] border border-border bg-card px-3 text-[14px] font-semibold outline-none focus:border-foreground ${METHOD_COLORS[method]}`}>{MOCK_METHODS.map((item) => <option key={item} value={item}>{item}</option>)}</select><span className="hidden h-8 w-px bg-border sm:block" /><div className="flex min-w-0 flex-1 items-center font-mono text-[14px]"><span className="shrink-0 text-muted-foreground">{displayOrigin}/mock/</span><input value={route} onChange={(event) => { setRoute(event.target.value); setTestResult(null); }} aria-label="Mock API route" className="min-w-0 flex-1 bg-transparent pl-0.5 text-foreground outline-none" /></div><div className="flex items-center gap-4"><CopyButton text={result.url} label="Copy" title="Copy endpoint URL" className="inline-flex items-center gap-2 text-[14px] text-foreground hover:text-muted-foreground" /><span className="h-7 w-px bg-border" /><a href={result.url || '#'} target="_blank" rel="noreferrer" aria-label="Open endpoint" className="text-foreground hover:text-muted-foreground"><ExternalLink size={19} strokeWidth={1.8} /></a></div></div>
      <div className="flex items-center justify-between border-b border-border px-5 pt-4"><div className="flex gap-10">{MOCK_METHODS.map((item) => <button key={item} type="button" onClick={() => chooseMethod(item)} className={`flex gap-7 border-b-2 pb-4 text-[14px] font-medium ${method === item ? `border-orange-500 ${METHOD_COLORS[item]}` : 'border-transparent text-foreground/85 hover:text-foreground'}`}><span>{item}</span><span className={item === 'POST' ? 'text-emerald-700 dark:text-emerald-400' : item === 'PATCH' ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-700 dark:text-emerald-400'}>{statuses[item]}</span></button>)}</div><button type="button" className="hidden items-center gap-2 pb-4 text-[14px] text-foreground sm:inline-flex"><Plus size={17} />Add method</button></div>
      <div className="px-5 pt-7"><div className="mb-5 flex items-center justify-between gap-4"><div className="flex items-center gap-7"><span className="text-[15px] font-semibold">Response body</span><select aria-label="Response content type" className="h-10 rounded-[4px] border border-border bg-card px-3 text-[13px] text-foreground outline-none"><option>application/json</option></select></div><label className="flex items-center gap-3 text-[14px] text-foreground">Status<select value={statuses[method]} onChange={(event) => { setStatuses((current) => ({ ...current, [method]: Number(event.target.value) })); setTestResult(null); }} aria-label={`${method} response status`} className="h-10 w-[84px] rounded-[4px] border border-border bg-card px-3 text-[13px] outline-none">{STATUS_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><div className="flex min-h-[390px] overflow-hidden rounded-[4px] border border-border bg-card"><div className="hidden w-12 shrink-0 border-r border-border bg-secondary/15 py-3 text-right font-mono text-[12px] leading-6 text-muted-foreground/70 sm:block">{bodies[method].split('\n').map((_, index) => <div key={index} className="pr-3">{index + 1}</div>)}</div><textarea value={bodies[method]} onChange={(event) => { setBodies((current) => ({ ...current, [method]: event.target.value })); setTestResult(null); }} aria-label={`${method} JSON response`} spellCheck={false} className="min-h-[390px] w-full resize-y bg-transparent px-4 py-3 font-mono text-[13px] leading-6 text-foreground outline-none" /></div><div className={`flex items-center gap-2 py-4 text-[13px] ${validBodies[method] ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}><span className={`h-2.5 w-2.5 rounded-full ${validBodies[method] ? 'bg-emerald-600' : 'bg-destructive'}`} />{validBodies[method] ? 'Valid JSON' : 'Invalid JSON'}</div></div>
      {testResult && <div className="border-t border-border px-5 py-4"><div className="mb-2 flex items-center justify-between text-[13px]"><span className="font-semibold">Last response</span>{'status' in testResult && <span className="text-emerald-700 dark:text-emerald-400">{testResult.status} · {testResult.elapsed} ms</span>}</div><pre className="whitespace-pre-wrap break-words bg-secondary/20 p-3 font-mono text-[12px] leading-5">{'error' in testResult ? testResult.error : testResult.body || '(empty response)'}</pre></div>}
      <div className="flex items-center gap-3 border-t border-border px-5 py-3"><button type="button" onClick={() => void sendRequest()} disabled={!result.url || sending} className="inline-flex h-10 items-center gap-2 rounded-[4px] bg-foreground px-4 text-[13px] font-medium text-background disabled:opacity-40">{sending ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}{sending ? 'Sending' : 'Send request'}</button><code className="hidden min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground sm:block">{result.curl || result.error}</code>{result.curl && <CopyButton text={result.curl} size={14} title="Copy cURL command" />}</div>
    </section>
  </div>;
}
