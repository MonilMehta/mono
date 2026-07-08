'use client';

import { Suspense, useCallback, useEffect, useState, type ComponentType } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Menu, X, Search, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
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
import CsvTool from '@/components/tools/csv-tool';
import TypegenTool from '@/components/tools/typegen-tool';
import CurlTool from '@/components/tools/curl-tool';
import MockerTool from '@/components/tools/mocker-tool';
import LogTool from '@/components/tools/log-tool';
import StackTool from '@/components/tools/stack-tool';

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
  csv: CsvTool,
  typegen: TypegenTool,
  curl: CurlTool,
  mocker: MockerTool,
  log: LogTool,
  stack: StackTool,
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
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const setTool = useCallback(
    (id: ToolId) => {
      router.push(id === 'json' ? '/' : `/?tool=${id}`, { scroll: false });
      setSidebarOpen(false);
    },
    [router]
  );

  const current = TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0];
  const ToolComponent = TOOL_COMPONENTS[current.id];
  const currentIndex = TOOLS.findIndex((t) => t.id === current.id);
  const categoryLabel = TOOL_CATEGORIES.find((c) => c.id === current.category)?.label;
  const CurrentIcon = current.icon;

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
      } else if (mod && e.key === 'b') {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cycleTool]);

  const railCollapsed = collapsed && !sidebarOpen;

  return (
    <div className="min-h-screen text-foreground flex app-shell">
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={setTool}
        onToggleTheme={toggleTheme}
        isDark={isDark}
      />

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-dvh sidebar-rail border-r border-sidebar-border/80 flex flex-col transition-[width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          sidebarOpen ? 'translate-x-0 w-[248px]' : '-translate-x-full lg:translate-x-0'
        } ${!sidebarOpen ? (railCollapsed ? 'lg:w-[68px]' : 'lg:w-[248px]') : ''}`}
      >
        {/* Brand */}
        <div
          className={`h-14 shrink-0 flex items-center border-b border-sidebar-border/70 ${
            railCollapsed ? 'justify-center px-2' : 'px-4 gap-3'
          }`}
        >
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Mono" className="w-7 h-7 object-contain" />
          </div>
          {!railCollapsed && (
            <div className="min-w-0 flex-1 flex items-baseline gap-2 overflow-hidden">
              <h1
                className="text-xl font-bold tracking-tight text-sidebar-foreground leading-none"
                style={{ fontFamily: 'var(--font-playfair), serif', fontStyle: 'italic' }}
              >
                mono
              </h1>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wide">toolbox</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-muted-foreground hover:bg-sidebar-accent rounded-lg"
          >
            <X size={15} />
          </button>
        </div>

        {/* Quick search */}
        {!railCollapsed && (
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={() => setPaletteOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-sidebar-border/70 bg-background/40 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors text-left"
            >
              <Search size={13} className="shrink-0 opacity-70" />
              <span className="text-xs flex-1">Search tools…</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary/80 ring-1 ring-border/50 font-mono">⌘K</kbd>
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-3 ${railCollapsed ? 'px-2' : 'px-2.5'}`}>
          {TOOL_CATEGORIES.map((cat) => {
            const tools = TOOLS.filter((t) => t.category === cat.id);
            if (!tools.length) return null;

            return (
              <div key={cat.id} className="mb-4 last:mb-0">
                {!railCollapsed && (
                  <p className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-[0.14em] px-2.5 mb-1.5">
                    {cat.label}
                  </p>
                )}
                {railCollapsed && (
                  <div className="mx-auto mb-1.5 h-px w-5 bg-sidebar-border/80 first:hidden" />
                )}
                <div className="space-y-0.5">
                  {tools.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = current.id === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => setTool(tool.id)}
                        title={tool.label}
                        className={`group relative w-full flex items-center rounded-xl text-left transition-colors ${
                          railCollapsed ? 'justify-center h-10' : 'gap-2.5 px-2.5 h-9'
                        } ${
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-foreground'
                            : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="active-rail"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-primary"
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                          />
                        )}
                        <Icon
                          size={16}
                          strokeWidth={isActive ? 2.25 : 1.75}
                          className={`shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
                        />
                        {!railCollapsed && (
                          <span className={`text-[13px] truncate ${isActive ? 'font-semibold' : 'font-medium'}`}>
                            {tool.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`shrink-0 border-t border-sidebar-border/70 p-2 ${railCollapsed ? '' : 'px-2.5'}`}>
          <div className={`flex ${railCollapsed ? 'flex-col items-center gap-1' : 'items-center gap-1'}`}>
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
              title="Toggle theme"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className={`hidden lg:flex items-center justify-center h-9 rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors ${
                railCollapsed ? 'w-9' : 'flex-1 gap-2 px-2.5'
              }`}
              title={railCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
            >
              {railCollapsed ? <PanelLeftOpen size={15} /> : (
                <>
                  <PanelLeftClose size={15} />
                  <span className="text-xs font-medium">Collapse</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[2px] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col min-h-dvh">
        <header className="sticky top-0 z-20 h-14 border-b border-border/60 bg-background/75 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-secondary text-muted-foreground shrink-0"
            >
              <Menu size={18} />
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <CurrentIcon size={15} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-semibold tracking-tight truncate leading-none">{current.label}</h2>
                  {categoryLabel && (
                    <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded-md">
                      {categoryLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5 hidden sm:block">{current.description}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setPaletteOpen(true)}
              className="surface-muted flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Search size={13} />
              <span className="hidden md:inline">Search</span>
              <kbd className="hidden md:inline-block text-[10px] px-1.5 py-0.5 rounded-md bg-background/80 font-mono ring-1 ring-border/50">⌘K</kbd>
            </button>
            <button
              onClick={toggleTheme}
              className="lg:hidden p-2 rounded-xl surface-muted text-muted-foreground hover:text-foreground"
              title="Toggle theme"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 w-full max-w-[1200px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
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
