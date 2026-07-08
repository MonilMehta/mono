'use client';

import { Suspense, useCallback, useEffect, useState, type ComponentType } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Menu, X, Command, Search, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { ThemeProvider, useTheme } from '@/components/theme-provider';
import { CommandPalette } from '@/components/command-palette';
import { TOOLS, TOOL_CATEGORIES, type ToolId } from '@/lib/tools-registry';
import JsonTool from '@/components/tools/json-tool';
import JwtTool from '@/components/tools/jwt-tool';
import Base64Tool from '@/components/tools/base64-tool';
import UrlTool from '@/components/tools/url-tool';
import TimestampTool from '@/components/tools/timestamp-tool';
import UuidTool from '@/components/tools/uuid-tool';
import ColorTool from '@/components/tools/color-tool';
import DiffTool from '@/components/tools/diff-tool';
import RegexTool from '@/components/tools/regex-tool';
import DeeplinkTool from '@/components/tools/deeplink-tool';
import ImageTool from '@/components/tools/image-tool';
import SvgTool from '@/components/tools/svg-tool';
import BlurhashTool from '@/components/tools/blurhash-tool';
import AppAssetTool from '@/components/tools/app-asset-tool';

const TOOL_COMPONENTS: Record<ToolId, ComponentType> = {
  json: JsonTool,
  jwt: JwtTool,
  base64: Base64Tool,
  url: UrlTool,
  timestamp: TimestampTool,
  uuid: UuidTool,
  color: ColorTool,
  diff: DiffTool,
  regex: RegexTool,
  deeplink: DeeplinkTool,
  image: ImageTool,
  svg: SvgTool,
  blurhash: BlurhashTool,
  'app-asset': AppAssetTool,
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

function DevToolboxInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTool = (searchParams.get('tool') as ToolId) || 'json';
  const { isDark, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const setTool = useCallback(
    (id: ToolId) => {
      router.push(id === 'json' ? '/' : `/?tool=${id}`, { scroll: false });
    },
    [router]
  );

  const current = TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0];
  const ToolComponent = TOOL_COMPONENTS[current.id];
  const currentIndex = TOOLS.findIndex((t) => t.id === current.id);

  const cycleTool = useCallback(
    (dir: 1 | -1) => {
      const next = TOOLS[(currentIndex + dir + TOOLS.length) % TOOLS.length];
      setTool(next.id);
    },
    [currentIndex, setTool]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'k' || e.key === '/')) {
        e.preventDefault();
        setPaletteOpen((p) => !p);
        return;
      }
      if (isEditableTarget(e.target)) return;
      if (mod && e.key === ']') {
        e.preventDefault();
        cycleTool(1);
      } else if (mod && e.key === '[') {
        e.preventDefault();
        cycleTool(-1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cycleTool]);

  return (
    <div className="min-h-screen text-foreground flex">
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={setTool}
        onToggleTheme={toggleTheme}
        isDark={isDark}
      />

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen transition-all duration-300 border-r border-sidebar-border/70 bg-sidebar/82 shadow-[18px_0_60px_-44px_rgb(0_0_0/0.75)] backdrop-blur-2xl flex flex-col ${
          sidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0 lg:w-20 w-72'
        }`}
      >
        <div className={`p-5 border-b border-sidebar-border/70 flex items-center justify-between transition-all ${!sidebarOpen ? 'lg:p-0 lg:py-6 lg:justify-center' : ''}`}>
          <div className={`flex items-center gap-4 ${!sidebarOpen ? 'lg:justify-center' : ''}`}>
            <div className="w-11 h-11 flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="Mono logo" className="w-9 h-9 object-contain" />
            </div>
            <div className={`overflow-hidden transition-all duration-300 flex items-center h-11 ${!sidebarOpen ? 'w-0 opacity-0 lg:hidden' : 'w-[170px] opacity-100'}`}>
              <h1 className="text-3xl font-bold tracking-tight text-sidebar-foreground leading-none" style={{ fontFamily: 'var(--font-playfair), serif', fontStyle: 'italic' }}>mono</h1>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-muted-foreground hover:bg-sidebar-accent active:scale-95 transition-all rounded-xl">
            <X size={16} />
          </button>
        </div>
        <nav className={`flex-1 overflow-y-auto p-3 space-y-6 mt-2 ${!sidebarOpen ? 'lg:p-3 lg:space-y-3' : ''}`}>
          {TOOL_CATEGORIES.map((cat) => {
            const tools = TOOLS.filter((t) => t.category === cat.id);
            if (!tools.length) return null;
            
            return (
              <div key={cat.id} className="mb-2">
                <p className={`text-xs font-semibold text-muted-foreground uppercase tracking-[0.16em] px-3 mb-2.5 ${!sidebarOpen ? 'lg:hidden' : ''}`}>
                  {cat.label}
                </p>
                <div className="space-y-1.5">
                  {tools.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = current.id === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => setTool(tool.id)}
                        title={!sidebarOpen ? tool.label : undefined}
                        className={`relative w-full flex items-center gap-3.5 py-3.5 rounded-2xl text-left transition-all active:scale-[0.99] ${!sidebarOpen ? 'lg:justify-center px-3 lg:px-0' : 'px-4'}`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="active-tool-pill"
                            className="absolute inset-0 bg-sidebar-accent border border-primary/25 shadow-sm rounded-2xl"
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                          />
                        )}
                        {!isActive && <span className="absolute inset-0 rounded-2xl opacity-0 transition-opacity hover:opacity-100 bg-sidebar-accent/70" />}
                        <Icon
                          size={20}
                          className={`shrink-0 relative z-10 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                        />
                        <span className={`text-sm font-semibold relative z-10 ${isActive ? 'text-sidebar-foreground' : 'text-sidebar-foreground/85'} ${!sidebarOpen ? 'lg:hidden' : ''}`}>
                          {tool.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="hidden lg:flex p-4 border-t border-sidebar-border/70">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`w-full flex items-center p-3 rounded-2xl text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all active:scale-95 ${!sidebarOpen ? 'justify-center' : 'justify-end'}`}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/86 backdrop-blur-2xl px-5 sm:px-8 py-5 flex items-center justify-between gap-5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-xl hover:bg-secondary text-muted-foreground shrink-0 active:scale-95 transition-all"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.16em] mb-1.5">
                {TOOL_CATEGORIES.find((c) => c.id === current.category)?.label}
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-0.04em] truncate leading-tight">{current.label}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setPaletteOpen(true)}
              className="surface-muted flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/25 transition-all active:scale-95"
            >
              <Search size={14} />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-md bg-background/80 text-foreground/70 ring-1 ring-border/60">⌘K</kbd>
            </button>
            <button
              onClick={toggleTheme}
              className="surface-muted p-3 rounded-2xl transition-all active:scale-95 text-muted-foreground hover:text-foreground hover:border-primary/25"
              title="Toggle theme"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8 lg:p-10 max-w-7xl w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-3xl leading-8">{current.description}</p>
              <ToolComponent />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export function DevToolbox() {
  return (
    <ThemeProvider>
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <DevToolboxInner />
      </Suspense>
    </ThemeProvider>
  );
}
