'use client';

import { Suspense, useCallback, useEffect, useState, type ComponentType } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, X, Home, Timer } from 'lucide-react';
import { ThemeProvider, useTheme } from '@/components/theme-provider';
import { CommandPalette } from '@/components/command-palette';
import { MonoLogo } from '@/components/mono-logo';
import { TOOLS, type ToolId } from '@/lib/tools-registry';
import JsonTool from '@/components/tools/json-tool';
import Base64Tool from '@/components/tools/base64-tool';
import UrlTool from '@/components/tools/url-tool';
import TimestampTool from '@/components/tools/timestamp-tool';
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
import LogTool from '@/components/tools/log-tool';
import { HomeDashboard } from '@/components/home-dashboard';

const TOOL_COMPONENTS: Record<ToolId, ComponentType> = {
  json: JsonTool,
  base64: Base64Tool,
  url: UrlTool,
  timestamp: TimestampTool,
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
  log: LogTool,
};

const NAV_GROUPS: { label: string; ids: ToolId[] }[] = [
  { label: 'Capture', ids: ['json', 'curl', 'typegen', 'image', 'svg', 'csv'] },
  { label: 'Tools', ids: ['blurhash', 'color', 'app-asset', 'deeplink'] },
  { label: 'More', ids: ['base64', 'timestamp', 'url', 'diff', 'regex', 'log'] },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

function AppShellInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedTool = searchParams.get('tool');
  const isHome = requestedTool === null;
  const activeTool: ToolId = requestedTool === 'mocker' ? 'typegen' : requestedTool === 'jwt' || requestedTool === 'uuid' ? 'base64' : requestedTool === 'stack' ? 'log' : (requestedTool as ToolId) || 'json';
  const { isDark, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const setTool = useCallback(
    (id: ToolId) => {
      router.push(`/?tool=${id}`, { scroll: false });
      setSidebarOpen(false);
    },
    [router]
  );

  const goHome = useCallback(() => {
    router.push('/', { scroll: false });
    setSidebarOpen(false);
  }, [router]);

  const goFocus = useCallback(() => {
    router.push('/focus');
    setSidebarOpen(false);
  }, [router]);

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
        className={`sidebar-rail fixed left-0 top-0 z-40 flex h-dvh flex-col border-r border-sidebar-border transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:sticky ${
          sidebarOpen ? 'w-[260px] translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${!sidebarOpen ? (railCollapsed ? 'lg:w-[64px]' : 'lg:w-[260px]') : ''}`}
      >
        {/* Brand */}
        <div
          className={`flex h-[54px] shrink-0 items-center ${
            railCollapsed ? 'justify-center px-2' : 'px-4 gap-3'
          }`}
        >
          <button onClick={goHome} className="flex min-w-0 items-center gap-3 text-left" title="Go to home">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-foreground text-background shadow-sm">
              <MonoLogo className="h-4 w-4" />
            </div>
            {!railCollapsed && (
              <div className="min-w-0 flex-1 overflow-hidden">
                <h1
                  className="text-[20px] font-semibold leading-none tracking-[-0.035em] text-sidebar-foreground"
                  style={{ fontFamily: 'var(--font-playfair), serif', fontStyle: 'italic' }}
                >
                  mono
                </h1>
              </div>
            )}
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-muted-foreground hover:bg-sidebar-accent rounded-lg"
          >
            <X size={15} />
          </button>
        </div>

        {/* Quick search */}
        {!railCollapsed && (
          <div className="px-3 pb-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex h-8 w-full items-center gap-2.5 rounded-[3px] border border-sidebar-border bg-background/45 px-2.5 text-left text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
            >
              <Search size={13} className="shrink-0 opacity-70" />
              <span className="flex-1 font-mono text-[10px] uppercase tracking-[0.06em]">Find a tool</span>
              <kbd className="border border-border bg-secondary/70 px-1.5 py-0.5 font-mono text-[8px]">⌘K</kbd>
            </button>
          </div>
        )}

        {railCollapsed && (
          <div className="px-2 pb-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex h-8 w-full items-center justify-center rounded-[3px] border border-sidebar-border bg-background/45 text-muted-foreground transition-colors hover:text-foreground"
              title="Search (⌘K)"
            >
              <Search size={14} />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-2 ${railCollapsed ? 'px-2' : 'px-2.5'}`}>
          <div className="mb-4 space-y-0.5">
            <button
              onClick={goHome}
              title="Home"
              className={`group relative flex w-full items-center rounded-[3px] text-left transition-all duration-150 ${
                railCollapsed ? 'h-9 justify-center' : 'h-8 gap-2 px-2'
              } ${
                isHome
                  ? 'bg-sidebar-accent text-sidebar-foreground'
                  : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
              }`}
            >
              {isHome && (
                <motion.span
                  layoutId="active-rail"
                  className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-primary"
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center transition-colors ${
                isHome
                  ? 'text-primary'
                  : 'text-muted-foreground group-hover:text-foreground'
              }`}>
                <Home size={14} strokeWidth={isHome ? 2.25 : 1.85} />
              </span>
              {!railCollapsed && <span className={`truncate text-[11px] ${isHome ? 'font-semibold' : 'font-medium'}`}>Studio wall</span>}
            </button>
            <button
              onClick={goFocus}
              title="Focus room"
              className={`group relative flex w-full items-center rounded-[3px] text-left text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground ${
                railCollapsed ? 'h-9 justify-center' : 'h-8 gap-2 px-2'
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground transition-colors group-hover:text-foreground">
                <Timer size={14} strokeWidth={1.85} />
              </span>
              {!railCollapsed && <span className="truncate text-[11px] font-medium">Focus room</span>}
            </button>
          </div>
          {NAV_GROUPS.map((group, groupIndex) => {
            const tools = group.ids.map((id) => TOOLS.find((tool) => tool.id === id)).filter((tool): tool is (typeof TOOLS)[number] => Boolean(tool));
            return (
              <div key={group.label} className={`${groupIndex > 0 ? 'mt-5 border-t border-sidebar-border/55 pt-4' : ''}`}>
                {!railCollapsed ? (
                  <p className="mb-1.5 px-2 font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground/65">
                    {group.label}
                  </p>
                ) : (
                  groupIndex > 0 && <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border/70" />
                )}
                <div className="space-y-0.5">
                  {tools.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = !isHome && current.id === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => setTool(tool.id)}
                        title={tool.label}
                        className={`group relative flex w-full items-center rounded-[3px] text-left transition-all duration-150 ${
                          railCollapsed ? 'h-9 justify-center' : 'h-8 gap-2 px-2'
                        } ${
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-foreground'
                            : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="active-rail"
                            className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-primary"
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          />
                        )}
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center transition-colors ${
                            isActive
                              ? 'text-primary'
                              : 'text-muted-foreground group-hover:text-foreground'
                          }`}
                        >
                          <Icon size={14} strokeWidth={isActive ? 2.25 : 1.85} />
                        </span>
                        {!railCollapsed && (
                          <span className={`truncate text-[11px] ${isActive ? 'font-semibold' : 'font-medium'}`}>
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
        <div className="shrink-0 border-t border-sidebar-border/60 p-2.5">
          <div className={`flex ${railCollapsed ? 'flex-col items-center gap-1' : 'items-center gap-1'}`}>
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-[3px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              title="Toggle theme"
            >
              <Moon size={14} className="dark:hidden" />
              <Sun size={14} className="hidden dark:block" />
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className={`hidden h-8 items-center justify-center rounded-[3px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground lg:flex ${
                railCollapsed ? 'w-9' : 'flex-1 gap-2 px-2.5'
              }`}
              title={railCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
            >
              {railCollapsed ? (
                <PanelLeftOpen size={15} />
              ) : (
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

      <button
        onClick={() => setSidebarOpen(true)}
        className="surface-muted fixed left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-[3px] text-muted-foreground shadow-sm hover:text-foreground lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col min-h-dvh">
        <main className={isHome ? 'flex-1 w-full' : 'flex-1 w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8'}>
          <AnimatePresence mode="wait">
            <motion.div
              key={isHome ? 'home' : current.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {isHome ? <HomeDashboard /> : <ToolComponent />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <ThemeProvider>
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <AppShellInner />
      </Suspense>
    </ThemeProvider>
  );
}
