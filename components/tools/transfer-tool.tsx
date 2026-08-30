'use client';

import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { Check, Download, FileUp, LoaderCircle, RotateCcw, Send, Type } from 'lucide-react';
import { CopyButton } from '@/components/copy-button';
import { MAX_FILE_BYTES, MAX_TEXT_BYTES, normalizeTransferCode } from '@/lib/transfer-shared';

type SendKind = 'text' | 'file';
type Reservation = { code: string; uploadSecret: string; pathname: string };

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed.');
  return body as T;
}

export default function TransferTool() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sendKind, setSendKind] = useState<SendKind>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sendCode, setSendCode] = useState('');
  const [sendError, setSendError] = useState('');
  const [receiveCode, setReceiveCode] = useState('');
  const [receiving, setReceiving] = useState(false);
  const [receivedText, setReceivedText] = useState('');
  const [receivedFile, setReceivedFile] = useState('');
  const [receiveError, setReceiveError] = useState('');

  async function createTransfer() {
    setSending(true);
    setSendError('');
    setSendCode('');
    setProgress(0);
    try {
      if (sendKind === 'text') {
        const result = await responseJson<{ code: string }>(await fetch('/api/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'text', text }),
        }));
        setSendCode(result.code);
        return;
      }

      if (!file) throw new Error('Choose a file first.');
      const reservation = await responseJson<Reservation>(await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'file', name: file.name, size: file.size, contentType: file.type }),
      }));
      const blob = await upload(reservation.pathname, file, {
        access: 'private',
        handleUploadUrl: '/api/transfer/upload',
        clientPayload: JSON.stringify({ code: reservation.code, uploadSecret: reservation.uploadSecret }),
        contentType: file.type || 'application/octet-stream',
        multipart: file.size > 5 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      await responseJson(await fetch('/api/transfer/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reservation, pathname: blob.pathname }),
      }));
      setSendCode(reservation.code);
      setProgress(100);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not create transfer.');
    } finally {
      setSending(false);
    }
  }

  async function receiveTransfer() {
    const code = normalizeTransferCode(receiveCode);
    setReceiving(true);
    setReceiveError('');
    setReceivedText('');
    setReceivedFile('');
    try {
      const response = await fetch(`/api/transfer/${code}`, { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Could not receive transfer.');
      }
      if (response.headers.get('X-Transfer-Kind') === 'file') {
        const name = decodeURIComponent(response.headers.get('X-Transfer-Filename') || 'file');
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setReceivedFile(name);
      } else {
        setReceivedText(await response.text());
      }
    } catch (error) {
      setReceiveError(error instanceof Error ? error.message : 'Could not receive transfer.');
    } finally {
      setReceiving(false);
    }
  }

  function resetSend() {
    setSendCode('');
    setSendError('');
    setProgress(0);
    setText('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <header className="mb-7">
        <h2 className="text-[28px] font-bold leading-tight tracking-[-0.035em] text-foreground">Transfer</h2>
        <p className="mt-1 text-[16px] text-foreground/78">Send text or a file with a one-time code.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-panel flex min-h-[430px] flex-col overflow-hidden rounded-[4px] bg-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-[15px] font-bold">Send</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Transfers expire after 10 minutes and can be opened once.</p>
          </div>

          {sendCode ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[4px] border border-foreground bg-primary text-primary-foreground shadow-[3px_3px_0_var(--foreground)]">
                <Check size={21} />
              </div>
              <p className="text-[13px] font-semibold text-muted-foreground">Your one-time code</p>
              <div className="mt-3 flex items-center gap-3">
                <code className="text-[30px] font-bold tracking-[0.2em] text-foreground">{sendCode}</code>
                <CopyButton text={sendCode} title="Copy transfer code" />
              </div>
              <p className="mt-3 text-[12px] text-muted-foreground">Keep this page open only if you need the code again.</p>
              <button type="button" onClick={resetSend} className="mt-7 inline-flex items-center gap-2 text-[13px] font-semibold text-foreground hover:text-primary">
                <RotateCcw size={14} /> Send another
              </button>
            </div>
          ) : (
            <>
              <div className="flex border-b border-border px-5">
                {(['text', 'file'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => { setSendKind(kind); setSendError(''); }}
                    className={`flex items-center gap-2 border-b-[3px] px-1 py-4 text-[13px] font-semibold capitalize ${sendKind === kind ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
                  >
                    {kind === 'text' ? <Type size={14} /> : <FileUp size={14} />}{kind}
                  </button>
                ))}
              </div>
              <div className="flex flex-1 flex-col p-5">
                {sendKind === 'text' ? (
                  <>
                    <textarea
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      placeholder="Paste text here…"
                      aria-label="Text to transfer"
                      className="gum-input min-h-[210px] flex-1 resize-none p-4 font-mono text-[13px] leading-6 outline-none"
                    />
                    <p className="mt-2 text-right text-[11px] text-muted-foreground">{new Blob([text]).size.toLocaleString()} / {MAX_TEXT_BYTES.toLocaleString()} bytes</p>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex min-h-[235px] flex-1 flex-col items-center justify-center rounded-[4px] border border-dashed border-border bg-secondary/20 px-6 text-center hover:bg-secondary/40"
                  >
                    <FileUp size={25} className="mb-3 text-primary" />
                    <span className="text-[14px] font-semibold">{file?.name || 'Choose a file'}</span>
                    <span className="mt-1 text-[12px] text-muted-foreground">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : `Up to ${MAX_FILE_BYTES / 1024 / 1024} MB`}</span>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                  </button>
                )}
                {sending && sendKind === 'file' && (
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                  </div>
                )}
                {sendError && <p role="alert" className="mt-3 text-[12px] font-medium text-destructive">{sendError}</p>}
              </div>
              <div className="border-t border-border px-5 py-4">
                <button
                  type="button"
                  onClick={() => void createTransfer()}
                  disabled={sending || (sendKind === 'text' ? !text.trim() || new Blob([text]).size > MAX_TEXT_BYTES : !file || file.size > MAX_FILE_BYTES)}
                  className="gum-button inline-flex h-10 items-center gap-2 px-4 text-[13px] font-semibold disabled:opacity-40"
                >
                  {sending ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
                  {sending ? (sendKind === 'file' ? `Uploading ${progress}%` : 'Creating code') : 'Create code'}
                </button>
              </div>
            </>
          )}
        </section>

        <section className="surface-panel flex min-h-[430px] flex-col overflow-hidden rounded-[4px] bg-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-[15px] font-bold">Receive</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Opening a transfer consumes its code.</p>
          </div>
          <div className="flex flex-1 flex-col p-5">
            <label htmlFor="transfer-code" className="text-[12px] font-semibold text-foreground">Transfer code</label>
            <input
              id="transfer-code"
              value={receiveCode}
              onChange={(event) => setReceiveCode(normalizeTransferCode(event.target.value))}
              onKeyDown={(event) => { if (event.key === 'Enter' && receiveCode.length === 8) void receiveTransfer(); }}
              placeholder="XXXXXXXX"
              autoComplete="off"
              spellCheck={false}
              className="gum-input mt-2 h-14 px-4 text-center font-mono text-[22px] font-bold uppercase tracking-[0.2em] outline-none"
            />
            {receiveError && <p role="alert" className="mt-3 text-[12px] font-medium text-destructive">{receiveError}</p>}
            {receivedText && (
              <div className="mt-5 flex min-h-0 flex-1 flex-col rounded-[4px] border border-border bg-secondary/20">
                <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[12px] font-semibold">
                  Received text <CopyButton text={receivedText} title="Copy received text" />
                </div>
                <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[12px] leading-5">{receivedText}</pre>
              </div>
            )}
            {receivedFile && (
              <div className="mt-6 flex flex-1 flex-col items-center justify-center text-center">
                <Download size={28} className="mb-3 text-primary" />
                <p className="text-[14px] font-semibold">Downloaded {receivedFile}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">The one-time code is now used.</p>
              </div>
            )}
          </div>
          <div className="border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={() => void receiveTransfer()}
              disabled={receiving || receiveCode.length !== 8}
              className="gum-button inline-flex h-10 items-center gap-2 px-4 text-[13px] font-semibold disabled:opacity-40"
            >
              {receiving ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />}
              {receiving ? 'Receiving' : 'Receive'}
            </button>
          </div>
        </section>
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">Stored privately and encrypted in transit. Transfers are not end-to-end encrypted.</p>
    </div>
  );
}
