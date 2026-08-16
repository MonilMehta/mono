'use client';

import { Suspense, useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, X, Home } from 'lucide-react';
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
import MockApiTool from '@/components/tools/mock-api-tool';
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
  'mock-api': MockApiTool,
};

const NAV_GROUPS: { label: string; ids: ToolId[] }[] = [
  { label: 'Capture', ids: ['json', 'curl', 'mock-api', 'typegen', 'image', 'svg', 'csv'] },
  { label: 'Tools', ids: ['blurhash', 'color', 'app-asset', 'deeplink'] },
  { label: 'More', ids: ['base64', 'timestamp', 'url', 'diff', 'regex', 'log'] },
];
const NAV_TOOL_IDS = NAV_GROUPS.flatMap((group) => group.ids);

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
  const current = TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0];
  const activeToolRef = useRef<ToolId | null>(isHome ? null : current.id);

  const setTool = useCallback(
    (id: ToolId) => {
      activeToolRef.current = id;
      router.push(`/?tool=${id}`, { scroll: false });
      setSidebarOpen(false);
    },
    [router]
  );

  const goHome = useCallback(() => {
    activeToolRef.current = null;
    router.push('/', { scroll: false });
    setSidebarOpen(false);
  }, [router]);

  const ToolComponent = TOOL_COMPONENTS[current.id];

  useEffect(() => {
    activeToolRef.current = isHome ? null : current.id;
  }, [current.id, isHome]);

  const cycleTool = useCallback(
    (dir: 1 | -1) => {
      const activeId = activeToolRef.current;
      const currentIndex = activeId ? NAV_TOOL_IDS.indexOf(activeId) : dir === 1 ? -1 : 0;
      const nextIndex = (currentIndex + dir + NAV_TOOL_IDS.length) % NAV_TOOL_IDS.length;
      setTool(NAV_TOOL_IDS[nextIndex]);
    },
    [setTool]
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
          sidebarOpen ? 'w-[280px] translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${!sidebarOpen ? (railCollapsed ? 'lg:w-[72px]' : 'lg:w-[280px]') : ''}`}
      >
        {/* Brand */}
        <div
          className={`flex h-[64px] shrink-0 items-center ${
            railCollapsed ? 'justify-center px-2' : 'gap-3 px-5'
          }`}
        >
          <button onClick={goHome} className="flex min-w-0 items-center gap-3 text-left" title="Go to home">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-sidebar-foreground text-sidebar">
              <MonoLogo className="h-[18px] w-[18px]" />
            </div>
            {!railCollapsed && (
              <div className="min-w-0 flex-1 overflow-hidden">
                <h1
                  className="text-[28px] font-bold leading-none tracking-[-0.055em] text-sidebar-foreground"
                >
                  mono
                </h1>
              </div>
            )}
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-[3px] p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
          >
            <X size={15} />
          </button>
        </div>

        {/* Quick search */}
        {!railCollapsed && (
          <div className="px-4 pb-3">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex h-11 w-full items-center gap-3 rounded-[4px] border border-sidebar-border bg-white/[0.04] px-3 text-left text-sidebar-foreground/65 transition-colors hover:border-sidebar-foreground/50 hover:text-sidebar-foreground"
            >
              <Search size={17} className="shrink-0" />
              <span className="flex-1 text-[14px]">Find a tool</span>
              <kbd className="border border-sidebar-border bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-sidebar-foreground">⌘K</kbd>
            </button>
          </div>
        )}

        {railCollapsed && (
          <div className="px-2 pb-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex h-10 w-full items-center justify-center rounded-[3px] border border-sidebar-border bg-white/[0.04] text-sidebar-foreground/65 transition-colors hover:text-sidebar-foreground"
              title="Search (⌘K)"
            >
              <Search size={14} />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${railCollapsed ? 'px-2' : 'px-3'}`}>
          <div className="mb-4 space-y-0.5">
            <button
              onClick={goHome}
              title="Home"
              className={`group relative flex w-full items-center rounded-[3px] text-left transition-all duration-150 ${
                railCollapsed ? 'h-9 justify-center' : 'h-9 gap-3 px-3'
              } ${
                isHome
                  ? 'bg-sidebar-accent text-sidebar-foreground'
                  : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              {isHome && (
                <motion.span
                  layoutId="active-rail"
                  className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 bg-primary"
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center transition-colors ${
                isHome
                  ? 'text-primary'
                  : 'text-sidebar-foreground/62 group-hover:text-sidebar-foreground'
              }`}>
                <Home size={16} strokeWidth={isHome ? 2.25 : 1.85} />
              </span>
              {!railCollapsed && <span className={`truncate text-[13px] ${isHome ? 'font-semibold' : 'font-medium'}`}>Home</span>}
            </button>
          </div>
          {NAV_GROUPS.map((group, groupIndex) => {
            const tools = group.ids.map((id) => TOOLS.find((tool) => tool.id === id)).filter((tool): tool is (typeof TOOLS)[number] => Boolean(tool));
            return (
              <div key={group.label} className={`${groupIndex > 0 ? 'mt-3 border-t border-sidebar-border pt-3' : ''}`}>
                {!railCollapsed ? (
                  <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.05em] text-sidebar-foreground/55">
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
                          railCollapsed ? 'h-9 justify-center' : 'h-9 gap-3 px-3'
                        } ${
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-foreground'
                            : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="active-rail"
                            className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 bg-primary"
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          />
                        )}
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center transition-colors ${
                            isActive
                              ? 'text-primary'
                              : 'text-sidebar-foreground/62 group-hover:text-sidebar-foreground'
                          }`}
                        >
                          <Icon size={16} strokeWidth={isActive ? 2.25 : 1.85} />
                        </span>
                        {!railCollapsed && (
                          <span className={`truncate text-[13px] ${isActive ? 'font-semibold text-primary' : 'font-medium'}`}>
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
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className={`flex ${railCollapsed ? 'flex-col items-center gap-1' : 'items-center gap-1'}`}>
            <button
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-[3px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              title="Toggle theme"
            >
              <Moon size={14} className="dark:hidden" />
              <Sun size={14} className="hidden dark:block" />
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className={`hidden h-10 items-center justify-center rounded-[3px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex ${
                railCollapsed ? 'w-9' : 'flex-1 gap-2 px-2.5'
              }`}
              title={railCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
            >
              {railCollapsed ? (
                <PanelLeftOpen size={15} />
              ) : (
                <>
                  <PanelLeftClose size={15} />
                  <span className="text-sm font-medium">Collapse</span>
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
        className="fixed left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-[3px] border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[3px_3px_0_#a78bfa] lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col min-h-dvh">
        <main className={isHome ? 'flex-1 w-full' : 'mx-auto flex-1 w-full max-w-[1500px] px-4 pb-6 pt-16 sm:px-7 sm:py-8 lg:px-12 lg:py-10'}>
          <div key={isHome ? 'home' : current.id} className="tool-page-enter">
            {isHome ? <HomeDashboard /> : <ToolComponent />}
          </div>
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
