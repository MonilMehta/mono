'use client';

import { useMemo, useState } from 'react';
import { ToolCard, ToolTextarea, ToolBar } from '@/components/tool-card';

type DiffLine = { type: 'same' | 'add' | 'remove'; text: string; lineA?: number; lineB?: number };

function diffLines(a: string, b: string): DiffLine[] {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const result: DiffLine[] = [];

  // Simple LCS-based line diff
  const m = linesA.length, n = linesB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = linesA[i-1] === linesB[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);

  let i = m, j = n;
  const ops: { type: 'same' | 'add' | 'remove'; ai?: number; bj?: number }[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i-1] === linesB[j-1]) {
      ops.unshift({ type: 'same', ai: i-1, bj: j-1 }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.unshift({ type: 'add', bj: j-1 }); j--;
    } else {
      ops.unshift({ type: 'remove', ai: i-1 }); i--;
    }
  }

  for (const op of ops) {
    if (op.type === 'same') result.push({ type: 'same', text: linesA[op.ai!], lineA: op.ai! + 1, lineB: op.bj! + 1 });
    else if (op.type === 'remove') result.push({ type: 'remove', text: linesA[op.ai!], lineA: op.ai! + 1 });
    else result.push({ type: 'add', text: linesB[op.bj!], lineB: op.bj! + 1 });
  }
  return result;
}

export default function DiffTool() {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');

  const diff = useMemo(() => {
    if (!left && !right) return [];
    return diffLines(left, right);
  }, [left, right]);

  const stats = useMemo(() => ({
    added: diff.filter((d) => d.type === 'add').length,
    removed: diff.filter((d) => d.type === 'remove').length,
    same: diff.filter((d) => d.type === 'same').length,
  }), [diff]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ToolCard minHeight="min-h-[300px]">
          <div className="px-4 pt-4 text-xs font-medium text-muted-foreground">Before (A)</div>
          <ToolTextarea value={left} onChange={setLeft} placeholder="Original JSON or text..." />
        </ToolCard>
        <ToolCard minHeight="min-h-[300px]">
          <div className="px-4 pt-4 text-xs font-medium text-muted-foreground">After (B)</div>
          <ToolTextarea value={right} onChange={setRight} placeholder="Updated JSON or text..." />
        </ToolCard>
      </div>

      {(left || right) && (
        <ToolCard>
          <ToolBar>
            <span className="text-xs text-muted-foreground">
              <span className="text-destructive">−{stats.removed}</span>
              {' · '}
              <span className="text-accent">+{stats.added}</span>
              {' · '}
              {stats.same} unchanged
            </span>
          </ToolBar>
          <div className="overflow-auto max-h-[500px] p-4 font-mono text-xs">
            {diff.map((line, i) => (
              <div
                key={i}
                className={`flex gap-3 py-0.5 px-2 rounded ${
                  line.type === 'add' ? 'bg-accent/10 text-accent' :
                  line.type === 'remove' ? 'bg-destructive/10 text-destructive' : ''
                }`}
              >
                <span className="w-4 shrink-0 opacity-50">
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                </span>
                <span className="w-8 shrink-0 opacity-40 text-right">{line.lineA ?? ''}</span>
                <span className="w-8 shrink-0 opacity-40 text-right">{line.lineB ?? ''}</span>
                <span className="break-all">{line.text || ' '}</span>
              </div>
            ))}
          </div>
        </ToolCard>
      )}
    </div>
  );
}
