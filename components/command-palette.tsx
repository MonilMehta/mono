'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, Moon, Sun } from 'lucide-react';
import { TOOLS, TOOL_CATEGORIES, type ToolDef, type ToolId } from '@/lib/tools-registry';
import { fuzzyScore } from '@/lib/fuzzy';
import { HighlightedText } from '@/components/highlighted-text';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelect: (id: ToolId) => void;
  onToggleTheme: () => void;
  isDark: boolean;
}

interface RankedTool {
  tool: ToolDef;
  score: number;
}

export function CommandPalette({ open, onClose, onSelect, onToggleTheme, isDark }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo<RankedTool[]>(() => {
    if (!query.trim()) {
      return TOOLS.map((tool) => ({ tool, score: 0 }));
    }
    const ranked = TOOLS.map((tool) => {
      const haystacks = [tool.label, tool.description, ...(tool.keywords ?? [])];
      const scores = haystacks.map((h) => fuzzyScore(query, h)).filter((s): s is number => s !== null);
      return { tool, score: scores.length ? Math.max(...scores) : -Infinity };
    }).filter((r) => r.score !== -Infinity);
    return ranked.sort((a, b) => b.score - a.score);
  }, [query]);

  const grouped = useMemo(() => {
    if (query.trim()) return null;
    return TOOL_CATEGORIES
      .map((cat) => ({ cat, tools: results.filter((r) => r.tool.category === cat.id) }))
      .filter((g) => g.tools.length > 0);
  }, [query, results]);

  const flatList = grouped ? grouped.flatMap((g) => g.tools) : results;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % Math.max(flatList.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + Math.max(flatList.length, 1)) % Math.max(flatList.length, 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatList[activeIndex];
        if (item) {
          onSelect(item.tool.id);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, flatList, activeIndex, onSelect, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="palette"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-100 flex items-start justify-center bg-black/65 px-4 pt-[14vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="surface-panel flex max-h-[68vh] w-full max-w-xl flex-col overflow-hidden rounded-[4px]"
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-4">
              <Search size={16} className="text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tools…"
                className="flex-1 bg-transparent text-[15px] focus:outline-none placeholder:text-muted-foreground/50"
              />
              <kbd className="shrink-0 rounded-[3px] border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">esc</kbd>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto p-2">
              {flatList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No tools found</p>
              ) : grouped ? (
                grouped.map((group) => (
                  <div key={group.cat.id} className="mb-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em] px-2.5 py-1.5">
                      {group.cat.label}
                    </p>
                    {group.tools.map((r) => {
                      const idx = flatList.indexOf(r);
                      return (
                        <ResultRow
                          key={r.tool.id}
                          tool={r.tool}
                          index={idx}
                          active={idx === activeIndex}
                          query={query}
                          onHover={() => setActiveIndex(idx)}
                          onSelect={() => {
                            onSelect(r.tool.id);
                            onClose();
                          }}
                        />
                      );
                    })}
                  </div>
                ))
              ) : (
                flatList.map((r, idx) => (
                  <ResultRow
                    key={r.tool.id}
                    tool={r.tool}
                    index={idx}
                    active={idx === activeIndex}
                    query={query}
                    onHover={() => setActiveIndex(idx)}
                    onSelect={() => {
                      onSelect(r.tool.id);
                      onClose();
                    }}
                  />
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border bg-card px-4 py-3">
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ArrowUp size={11} />
                  <ArrowDown size={11} /> navigate
                </span>
                <span className="flex items-center gap-1">
                  <CornerDownLeft size={11} /> select
                </span>
              </div>
              <button
                onClick={onToggleTheme}
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {isDark ? <Sun size={12} /> : <Moon size={12} />}
                {isDark ? 'Light' : 'Dark'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ResultRow({
  tool,
  index,
  active,
  query,
  onHover,
  onSelect,
}: {
  tool: ToolDef;
  index: number;
  active: boolean;
  query: string;
  onHover: () => void;
  onSelect: () => void;
}) {
  const Icon = tool.icon;
  return (
    <button
      data-index={index}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-[4px] px-2.5 py-2 text-left transition-colors ${
        active ? 'bg-secondary text-foreground' : 'text-foreground hover:bg-secondary/60'
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border ${
          active ? 'border-foreground bg-primary text-primary-foreground' : 'border-border bg-secondary text-muted-foreground'
        }`}
      >
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">
          <HighlightedText text={tool.label} query={query} />
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{tool.description}</p>
      </div>
      {active && (
        <kbd className="hidden rounded-[3px] border border-border bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">↵</kbd>
      )}
    </button>
  );
}
