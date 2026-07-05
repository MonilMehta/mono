'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ToolCard, ToolBar } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';

function generateUuid(): string {
  return crypto.randomUUID();
}

export default function UuidTool() {
  const [uuids, setUuids] = useState<string[]>([generateUuid()]);
  const [count, setCount] = useState(1);

  const regenerate = () => {
    setUuids(Array.from({ length: count }, () => generateUuid()));
  };

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
              onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value))))}
              className="w-20 px-3 py-1.5 rounded-lg bg-secondary text-sm font-mono focus:outline-none"
            />
            <button
              onClick={regenerate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
            >
              <RefreshCw size={14} /> Generate
            </button>
          </div>

          <div className="space-y-2">
            {uuids.map((id, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-secondary/50 font-mono text-sm"
              >
                <span className="break-all">{id}</span>
                <CopyButton text={id} size={14} />
              </div>
            ))}
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
