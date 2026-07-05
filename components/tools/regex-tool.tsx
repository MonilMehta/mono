'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { ToolCard, ToolTextarea, ToolBar } from '@/components/tool-card';
import { HighlightedText } from '@/components/highlighted-text';

export default function RegexTool() {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [testStr, setTestStr] = useState('');
  const [error, setError] = useState('');

  const { matches, regex } = useMemo(() => {
    if (!pattern) return { matches: [], regex: null };
    try {
      const re = new RegExp(pattern, flags);
      setError('');
      if (!testStr) return { matches: [], regex: re };
      const found: { match: string; index: number }[] = [];
      if (flags.includes('g')) {
        let m;
        while ((m = re.exec(testStr)) !== null) {
          found.push({ match: m[0], index: m.index });
          if (m[0].length === 0) re.lastIndex++;
        }
      } else {
        const m = re.exec(testStr);
        if (m) found.push({ match: m[0], index: m.index });
      }
      return { matches: found, regex: re };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid regex');
      return { matches: [], regex: null };
    }
  }, [pattern, flags, testStr]);

  const highlighted = useMemo(() => {
    if (!testStr || !matches.length) return testStr;
    const parts: ReactNode[] = [];
    let last = 0;
    matches.forEach((m, i) => {
      if (m.index > last) parts.push(<span key={`t${i}`}>{testStr.slice(last, m.index)}</span>);
      parts.push(
        <mark key={`m${i}`} className="bg-accent/30 rounded px-0.5">{m.match}</mark>
      );
      last = m.index + m.match.length;
    });
    if (last < testStr.length) parts.push(<span key="end">{testStr.slice(last)}</span>);
    return parts;
  }, [testStr, matches]);

  const FLAG_OPTIONS = ['g', 'i', 'm', 's', 'u'];

  return (
    <div className="space-y-4">
      <ToolCard className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Pattern</label>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-muted-foreground font-mono">/</span>
              <input
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="[a-z]+@\w+\.\w+"
                className="flex-1 px-3 py-2 rounded-lg bg-secondary font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-muted-foreground font-mono">/{flags}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Flags</label>
            <div className="flex gap-1 mt-1">
              {FLAG_OPTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFlags((prev) => prev.includes(f) ? prev.replace(f, '') : prev + f)}
                  className={`w-8 h-8 rounded-lg text-xs font-mono font-medium ${
                    flags.includes(f) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
        {error && (
          <p className="text-xs text-destructive mt-2 flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </p>
        )}
      </ToolCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ToolCard minHeight="min-h-[300px]">
          <div className="px-4 pt-4 text-xs font-medium text-muted-foreground">Test string</div>
          <ToolTextarea
            value={testStr}
            onChange={setTestStr}
            placeholder="String to test against..."
            mono={false}
          />
        </ToolCard>

        <ToolCard minHeight="min-h-[300px]">
          <ToolBar>
            <span className="text-xs text-muted-foreground">
              {matches.length} match{matches.length !== 1 ? 'es' : ''}
            </span>
          </ToolBar>
          <div className="p-6 text-sm font-mono whitespace-pre-wrap break-words overflow-auto flex-1">
            {testStr ? (
              matches.length > 0 ? highlighted : <HighlightedText text={testStr} query="" />
            ) : (
              <span className="text-muted-foreground">Matches highlighted here</span>
            )}
          </div>
          {matches.length > 0 && (
            <div className="border-t border-border/20 p-4 space-y-1 max-h-32 overflow-auto">
              {matches.map((m, i) => (
                <div key={i} className="text-xs font-mono flex gap-3">
                  <span className="text-muted-foreground w-6">#{i + 1}</span>
                  <span className="text-accent">{JSON.stringify(m.match)}</span>
                  <span className="text-muted-foreground">@ {m.index}</span>
                </div>
              ))}
            </div>
          )}
        </ToolCard>
      </div>
    </div>
  );
}
