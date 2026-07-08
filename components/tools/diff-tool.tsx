'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, CheckSquare, Square } from 'lucide-react';
import { diffLines, diffWordsWithSpace } from 'diff';
import { ToolCard, ToolTextarea, ToolBar } from '@/components/tool-card';

type DiffPart = { type: 'same' | 'add' | 'remove'; text: string };
type DiffLine = { type: 'same' | 'add' | 'remove'; text: string; lineA?: number; lineB?: number; parts?: DiffPart[] };

function tryFormatJson(val: string) {
  if (!val.trim()) return val;
  try {
    const parsed = JSON.parse(val);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return val;
  }
}

function computeDiff(a: string, b: string): DiffLine[] {
  const result: DiffLine[] = [];
  const lines = diffLines(a, b);
  let lineA = 1, lineB = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const chunk = lines[i];
    const chunkLines = chunk.value.split('\n');
    if (chunkLines.length > 0 && chunkLines[chunkLines.length - 1] === '') {
      chunkLines.pop();
    }
    
    const nextChunk = (i + 1 < lines.length) ? lines[i + 1] : null;
    
    // Intra-line diff for 1-to-1 line replacements
    if (chunk.removed && nextChunk && nextChunk.added && chunkLines.length === 1) {
      const nextChunkLines = nextChunk.value.split('\n');
      if (nextChunkLines.length > 0 && nextChunkLines[nextChunkLines.length - 1] === '') {
        nextChunkLines.pop();
      }
      
      if (nextChunkLines.length === 1) {
        const removedText = chunkLines[0];
        const addedText = nextChunkLines[0];
        const wordDiff = diffWordsWithSpace(removedText, addedText);
        
        const remParts: DiffPart[] = wordDiff.filter(p => !p.added).map(p => ({ type: p.removed ? 'remove' : 'same', text: p.value }));
        const addParts: DiffPart[] = wordDiff.filter(p => !p.removed).map(p => ({ type: p.added ? 'add' : 'same', text: p.value }));
        
        result.push({ type: 'remove', text: removedText, lineA: lineA++, parts: remParts });
        result.push({ type: 'add', text: addedText, lineB: lineB++, parts: addParts });
        i++; // skip nextChunk
        continue;
      }
    }
    
    for (const text of chunkLines) {
      if (chunk.added) {
        result.push({ type: 'add', text, lineB: lineB++ });
      } else if (chunk.removed) {
        result.push({ type: 'remove', text, lineA: lineA++ });
      } else {
        result.push({ type: 'same', text, lineA: lineA++, lineB: lineB++ });
      }
    }
  }
  return result;
}

export default function DiffTool() {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [debouncedLeft, setDebouncedLeft] = useState('');
  const [debouncedRight, setDebouncedRight] = useState('');
  const [autoFormat, setAutoFormat] = useState(true);
  
  const [currentDiffIndex, setCurrentDiffIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedLeft(left), 300);
    return () => clearTimeout(t);
  }, [left]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedRight(right), 300);
    return () => clearTimeout(t);
  }, [right]);

  const diff = useMemo(() => {
    if (!debouncedLeft && !debouncedRight) return [];
    const a = autoFormat ? tryFormatJson(debouncedLeft) : debouncedLeft;
    const b = autoFormat ? tryFormatJson(debouncedRight) : debouncedRight;
    return computeDiff(a, b);
  }, [debouncedLeft, debouncedRight, autoFormat]);

  const diffBlocks = useMemo(() => {
    const blocks: number[] = [];
    let inBlock = false;
    diff.forEach((line, i) => {
      if (line.type !== 'same') {
        if (!inBlock) {
          blocks.push(i);
          inBlock = true;
        }
      } else {
        inBlock = false;
      }
    });
    return blocks;
  }, [diff]);

  useEffect(() => {
    setCurrentDiffIndex(-1);
  }, [diffBlocks]);

  useEffect(() => {
    lineRefs.current = lineRefs.current.slice(0, diff.length);
  }, [diff]);

  const stats = useMemo(() => ({
    added: diff.filter((d) => d.type === 'add').length,
    removed: diff.filter((d) => d.type === 'remove').length,
    same: diff.filter((d) => d.type === 'same').length,
  }), [diff]);

  const goToDiff = (dir: 1 | -1) => {
    if (diffBlocks.length === 0) return;
    let nextIndex = currentDiffIndex + dir;
    if (nextIndex < 0) nextIndex = diffBlocks.length - 1;
    if (nextIndex >= diffBlocks.length) nextIndex = 0;
    setCurrentDiffIndex(nextIndex);
    
    const lineIndex = diffBlocks[nextIndex];
    const el = lineRefs.current[lineIndex];
    if (el) {
       el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ToolCard minHeight="min-h-[400px] lg:min-h-[500px]">
          <div className="flex items-center justify-between gap-4 border-b border-border/50 bg-card px-6 py-5">
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">Before (A)</h3>
              <p className="mt-1 text-sm text-muted-foreground">Original JSON or text payload</p>
            </div>
          </div>
          <ToolTextarea value={left} onChange={setLeft} placeholder="Paste original content here..." />
        </ToolCard>
        <ToolCard minHeight="min-h-[400px] lg:min-h-[500px]">
          <div className="flex items-center justify-between gap-4 border-b border-border/50 bg-card px-6 py-5">
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">After (B)</h3>
              <p className="mt-1 text-sm text-muted-foreground">Updated JSON or text payload</p>
            </div>
          </div>
          <ToolTextarea value={right} onChange={setRight} placeholder="Paste updated content here..." />
        </ToolCard>
      </div>

      {(debouncedLeft || debouncedRight) && (
        <ToolCard>
          <ToolBar>
            <span className="text-xs text-muted-foreground flex items-center">
              <span className="text-destructive">−{stats.removed}</span>
              <span className="mx-2">·</span>
              <span className="text-accent">+{stats.added}</span>
              <span className="mx-2">·</span>
              {stats.same} unchanged
            </span>
            <button 
              onClick={() => setAutoFormat(!autoFormat)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 hover:bg-secondary transition-colors text-xs text-muted-foreground ml-4"
            >
              {autoFormat ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
              Auto-format JSON
            </button>
            {diffBlocks.length > 0 && (
              <div className="flex items-center gap-1.5 ml-auto border border-border/50 rounded-lg p-0.5">
                <span className="text-xs text-muted-foreground px-2">
                  {currentDiffIndex >= 0 ? currentDiffIndex + 1 : 0} / {diffBlocks.length}
                </span>
                <button
                  onClick={() => goToDiff(-1)}
                  className="p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95 transition-all"
                  title="Previous difference"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => goToDiff(1)}
                  className="p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95 transition-all"
                  title="Next difference"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            )}
          </ToolBar>
          <div ref={containerRef} className="overflow-auto max-h-[500px] p-4 font-mono text-xs leading-[1.6]">
            {diff.map((line, i) => {
              const isCurrentBlock = currentDiffIndex >= 0 && 
                i >= diffBlocks[currentDiffIndex] && 
                (currentDiffIndex === diffBlocks.length - 1 || i < diffBlocks[currentDiffIndex + 1]) &&
                line.type !== 'same';

              return (
                <div
                  key={i}
                  ref={(el) => { lineRefs.current[i] = el; }}
                  className={`flex gap-3 py-0.5 px-2 rounded border transition-colors ${
                    line.type === 'add' ? 'bg-accent/5 text-accent border-transparent' :
                    line.type === 'remove' ? 'bg-destructive/5 text-destructive border-transparent' : 'border-transparent text-foreground/80'
                  } ${isCurrentBlock ? '!border-primary/40 shadow-[inset_0_0_0_1px_rgba(var(--primary),0.2)]' : ''}`}
                >
                  <span className="w-4 shrink-0 opacity-50 select-none">
                    {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                  </span>
                  <span className="w-8 shrink-0 opacity-30 text-right select-none">{line.lineA ?? ''}</span>
                  <span className="w-8 shrink-0 opacity-30 text-right select-none">{line.lineB ?? ''}</span>
                  <span className="break-all whitespace-pre-wrap flex-1">
                    {line.parts ? (
                      line.parts.map((part, pi) => (
                        <span 
                          key={pi} 
                          className={
                            part.type === 'add' ? 'bg-accent/25 text-accent font-semibold rounded-[2px]' : 
                            part.type === 'remove' ? 'bg-destructive/25 text-destructive font-semibold rounded-[2px]' : ''
                          }
                        >
                          {part.text}
                        </span>
                      ))
                    ) : (
                      line.text || ' '
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </ToolCard>
      )}
    </div>
  );
}
