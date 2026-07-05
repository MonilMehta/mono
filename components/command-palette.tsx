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

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-100 bg-background/35 backdrop-blur-md flex items-start justify-center pt-[12vh] px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="surface-panel w-full max-w-2xl rounded-3xl overflow-hidden flex flex-col max-h-[74vh]"
          style={{
            boxShadow: '0 28px 80px -24px color-mix(in oklch, var(--foreground) 42%, transparent)',
          }}
        >
          <div className="flex items-center gap-4 px-5 py-5 border-b border-border/40 bg-secondary/25">
            <Search size={20} className="text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools..."
              className="flex-1 bg-transparent text-lg focus:outline-none placeholder:text-muted-foreground/50"
            />
            <kbd className="text-xs px-2 py-1 rounded-md bg-background/80 text-muted-foreground ring-1 ring-border/60 shrink-0">esc</kbd>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-3">
            {flatList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No tools found</p>
            ) : grouped ? (
              grouped.map((group) => (
                <div key={group.cat.id} className="mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.16em] px-3 py-2">
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
                        onSelect={() => { onSelect(r.tool.id); onClose(); }}
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
                  onSelect={() => { onSelect(r.tool.id); onClose(); }}
                />
              ))
            )}
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-border/40 bg-secondary/30">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><ArrowUp size={12} /><ArrowDown size={12} /> navigate</span>
              <span className="flex items-center gap-1.5"><CornerDownLeft size={12} /> select</span>
            </div>
            <button
              onClick={onToggleTheme}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
              {isDark ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ResultRow({
  tool, index, active, query, onHover, onSelect,
}: {
  tool: ToolDef; index: number; active: boolean; query: string; onHover: () => void; onSelect: () => void;
}) {
  const Icon = tool.icon;
  return (
    <button
      data-index={index}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={`w-full flex items-center gap-4 px-3.5 py-3.5 rounded-2xl text-left transition-all ${
        active ? 'bg-secondary text-foreground shadow-sm ring-1 ring-primary/20' : 'text-foreground hover:bg-secondary/70'
      }`}
    >
      <div className={`p-2.5 rounded-xl ${active ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'bg-secondary text-muted-foreground'}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold">
          <HighlightedText text={tool.label} query={query} />
        </p>
        <p className="text-sm text-muted-foreground truncate leading-6">{tool.description}</p>
      </div>
    </button>
  );
}
