'use client';

import { useEffect, useState } from 'react';
import { ToolCard, ToolBar } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';

function formatRelative(date: Date): string {
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [86400000, 'day'],
    [3600000, 'hour'],
    [60000, 'minute'],
    [1000, 'second'],
  ];
  for (const [ms, unit] of units) {
    const n = Math.floor(abs / ms);
    if (n >= 1) return diff < 0 ? `${n} ${unit}${n > 1 ? 's' : ''} ago` : `in ${n} ${unit}${n > 1 ? 's' : ''}`;
  }
  return 'now';
}

export default function TimestampTool() {
  const [unixInput, setUnixInput] = useState('');
  const [isoInput, setIsoInput] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const unixMs = unixInput.trim() ? Number(unixInput.trim()) : null;
  const unixDate = unixMs !== null && !isNaN(unixMs)
    ? new Date(unixInput.trim().length <= 10 ? unixMs * 1000 : unixMs)
  : null;

  const isoDate = (() => {
    if (!isoInput.trim()) return null;
    const d = new Date(isoInput.trim());
    return isNaN(d.getTime()) ? null : d;
  })();

  return (
    <div className="space-y-6">
      <ToolCard className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Current time</p>
            <p className="text-2xl font-semibold font-mono">{now.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-2">{formatRelative(now)}</p>
          </div>
          <div className="text-right space-y-2">
            <CopyRow label="Unix (s)" value={Math.floor(now.getTime() / 1000).toString()} />
            <CopyRow label="Unix (ms)" value={now.getTime().toString()} />
            <CopyRow label="ISO" value={now.toISOString()} />
          </div>
        </div>
      </ToolCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ToolCard>
          <div className="p-4 border-b border-border/20">
            <p className="text-sm font-medium">Unix → Human</p>
            <p className="text-xs text-muted-foreground">Seconds or milliseconds</p>
          </div>
          <input
            value={unixInput}
            onChange={(e) => setUnixInput(e.target.value)}
            placeholder="1704067200 or 1704067200000"
            className="w-full px-6 py-4 bg-transparent font-mono text-sm focus:outline-none"
          />
          <ToolBar>
            {unixDate ? (
              <div className="text-xs space-y-1">
                <p className="text-accent">{unixDate.toLocaleString()}</p>
                <p className="text-muted-foreground">{formatRelative(unixDate)} · {unixDate.toISOString()}</p>
              </div>
            ) : unixInput ? (
              <span className="text-xs text-destructive">Invalid timestamp</span>
            ) : (
              <span className="text-xs text-muted-foreground">Enter unix timestamp</span>
            )}
          </ToolBar>
        </ToolCard>

        <ToolCard>
          <div className="p-4 border-b border-border/20">
            <p className="text-sm font-medium">ISO → Unix</p>
            <p className="text-xs text-muted-foreground">ISO 8601 date string</p>
          </div>
          <input
            value={isoInput}
            onChange={(e) => setIsoInput(e.target.value)}
            placeholder="2024-01-01T00:00:00.000Z"
            className="w-full px-6 py-4 bg-transparent font-mono text-sm focus:outline-none"
          />
          <ToolBar>
            {isoDate ? (
              <div className="flex gap-4 text-xs">
                <CopyRow label="s" value={Math.floor(isoDate.getTime() / 1000).toString()} />
                <CopyRow label="ms" value={isoDate.getTime().toString()} />
                <span className="text-muted-foreground">{formatRelative(isoDate)}</span>
              </div>
            ) : isoInput ? (
              <span className="text-xs text-destructive">Invalid date</span>
            ) : (
              <span className="text-xs text-muted-foreground">Enter ISO date</span>
            )}
          </ToolBar>
        </ToolCard>
      </div>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <code className="text-xs font-mono">{value}</code>
      <CopyButton text={value} size={12} />
    </div>
  );
}
