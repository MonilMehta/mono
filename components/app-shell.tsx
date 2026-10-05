'use client';

import { Suspense, useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, X, Home, ChevronDown } from 'lucide-react';
import { ThemeProvider, useTheme } from '@/components/theme-provider';
import { CommandPalette } from '@/components/command-palette';
import { MonoLogo } from '@/components/mono-logo';
import { TOOLS, type ToolId } from '@/lib/tools-registry';
import { HomeDashboard } from '@/components/home-dashboard';

const TOOL_COMPONENTS: Record<ToolId, ComponentType> = {
  json: dynamic(() => import('@/components/tools/json-tool')),
  markdown: dynamic(() => import('@/components/tools/markdown-tool')),
  base64: dynamic(() => import('@/components/tools/base64-tool')),
  url: dynamic(() => import('@/components/tools/url-tool')),
  timestamp: dynamic(() => import('@/components/tools/timestamp-tool')),
  color: dynamic(() => import('@/components/tools/color-tool')),
  diff: dynamic(() => import('@/components/tools/diff-tool')),
  regex: dynamic(() => import('@/components/tools/regex-tool')),
  deeplink: dynamic(() => import('@/components/tools/deeplink-tool')),
  image: dynamic(() => import('@/components/tools/image-tool')),
  svg: dynamic(() => import('@/components/tools/svg-tool')),
  blurhash: dynamic(() => import('@/components/tools/blurhash-tool')),
  'app-asset': dynamic(() => import('@/components/tools/app-asset-tool')),
  csv: dynamic(() => import('@/components/tools/csv-tool')),
  typegen: dynamic(() => import('@/components/tools/typegen-tool')),
  curl: dynamic(() => import('@/components/tools/curl-tool')),
  log: dynamic(() => import('@/components/tools/log-tool')),
  'mock-api': dynamic(() => import('@/components/tools/mock-api-tool')),
  transfer: dynamic(() => import('@/components/tools/transfer-tool')),
};

const NAV_GROUPS: { label: string; ids: ToolId[] }[] = [
  { label: 'Everyday', ids: ['json', 'markdown', 'curl', 'image'] },
  { label: 'Build & share', ids: ['typegen', 'mock-api', 'transfer', 'csv'] },
  { label: 'Design', ids: ['svg', 'color', 'blurhash', 'app-asset', 'deeplink'] },
  { label: 'Utilities', ids: ['base64', 'timestamp', 'url', 'diff', 'regex', 'log'] },
];
const NAV_TOOL_IDS = NAV_GROUPS.flatMap((group) => group.ids);
const TAB_USAGE_KEY = 'mono-tab-usage';
const TAB_USAGE_THRESHOLD = 5;

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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Everyday: true });
  const current = TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0];
  const activeToolRef = useRef<ToolId | null>(isHome ? null : current.id);
  const startupChecked = useRef(false);
  const lastCountedTab = useRef<string | null>(null);

  useEffect(() => {
    try {
      let saved: unknown = {};
      try {
        saved = JSON.parse(sessionStorage.getItem(TAB_USAGE_KEY) ?? '{}');
      } catch {
        // Replace malformed counts on the next visit.
      }
      const counts: Record<string, number> = {};
      for (const id of ['home', ...NAV_TOOL_IDS]) {
        const count = saved && typeof saved === 'object' ? (saved as Record<string, unknown>)[id] : undefined;
        counts[id] = typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : 0;
      }
      if (!startupChecked.current) {
        startupChecked.current = true;
        if (isHome) {
          const favorite = Object.keys(counts).reduce((best, id) => counts[id] > counts[best] ? id : best, 'home');
          if (favorite !== 'home' && counts[favorite] > TAB_USAGE_THRESHOLD) {
            // Skip counting the home screen while startup navigation completes.
            lastCountedTab.current = 'home';
            router.replace(`/?tool=${favorite}`, { scroll: false });
            return;
          }
        }
      }
      const tab = isHome ? 'home' : current.id;
      if (lastCountedTab.current === tab) return;
      lastCountedTab.current = tab;
      counts[tab] += 1;
      sessionStorage.setItem(TAB_USAGE_KEY, JSON.stringify(counts));
    } catch {
      // Navigation still works when browser storage is unavailable.
      startupChecked.current = true;
    }
  }, [current.id, isHome, router]);

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
    <div className={`min-h-screen text-foreground flex app-shell ${isHome ? 'app-shell-home' : ''}`}>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={setTool}
        onToggleTheme={toggleTheme}
        isDark={isDark}
      />

      <aside aria-label="Main navigation" className={`sidebar-rail fixed left-0 top-0 z-40 flex h-dvh shrink-0 flex-col lg:sticky transition-[width,transform] duration-200 ${sidebarOpen ? 'w-[232px] translate-x-0' : '-translate-x-full lg:translate-x-0'} ${!sidebarOpen ? (railCollapsed ? 'lg:w-[72px]' : 'lg:w-[232px]') : ''}`}>
        <div className={`sidebar-brand ${railCollapsed ? 'is-collapsed' : ''}`}>
          <button onClick={goHome} className="sidebar-logo" aria-label="Mono home"><span><MonoLogo className="h-[17px] w-[17px]" /></span>{!railCollapsed && <strong>mono</strong>}</button>
          <button onClick={() => setSidebarOpen(false)} className="sidebar-icon-button sidebar-close-button" aria-label="Close sidebar"><X size={17} /></button>
        </div>
        <div className={`sidebar-top ${railCollapsed ? 'is-collapsed' : ''}`}>
          <button onClick={() => setPaletteOpen(true)} className={`sidebar-search ${railCollapsed ? 'is-collapsed' : ''}`} aria-label="Find a tool"><Search size={16} />{!railCollapsed && <><span>Find a tool</span><kbd>⌘ K</kbd></>}</button>
          <button onClick={goHome} title="My tasks" aria-current={isHome ? 'page' : undefined} className={`sidebar-home ${isHome ? 'is-selected' : ''}`}><Home size={18} strokeWidth={1.7} />{!railCollapsed && <span>My tasks</span>}</button>
        </div>
        <nav aria-label="Tools" className={`sidebar-nav ${railCollapsed ? 'is-collapsed' : ''}`}>
          {NAV_GROUPS.map((group) => {
            const tools = group.ids.map((id) => TOOLS.find((tool) => tool.id === id)).filter((tool): tool is (typeof TOOLS)[number] => Boolean(tool));
            const hasActiveTool = !isHome && group.ids.includes(current.id);
            const expanded = railCollapsed || hasActiveTool || openGroups[group.label];
            return <div key={group.label} className="sidebar-group">
              {!railCollapsed && <button className="sidebar-group-heading" aria-expanded={Boolean(expanded)} onClick={() => setOpenGroups((groups) => ({ ...groups, [group.label]: !expanded }))}><span>{group.label}</span><ChevronDown size={13} className={expanded ? '' : '-rotate-90'} /></button>}
              {expanded && <div className="sidebar-group-items">{tools.map((tool) => {
                const Icon = tool.icon;
                const isActive = !isHome && current.id === tool.id;
                return <button key={tool.id} onClick={() => setTool(tool.id)} title={tool.label} aria-current={isActive ? 'page' : undefined} className={`sidebar-tool ${isActive ? 'is-selected' : ''}`}><Icon size={16} strokeWidth={1.7} />{!railCollapsed && <span>{tool.label}</span>}{isActive && !railCollapsed && <span className="sidebar-selected-dot" />}</button>;
              })}</div>}
            </div>;
          })}
        </nav>
        <div className={`sidebar-footer ${railCollapsed ? 'is-collapsed' : ''}`}>
          <button onClick={toggleTheme} className="sidebar-theme" aria-label="Toggle theme" title="Toggle theme">{isDark ? <Moon size={16} /> : <Sun size={16} />}{!railCollapsed && <span>{isDark ? 'Dark' : 'Light'}</span>}</button>
          <button onClick={() => setCollapsed((value) => !value)} className="sidebar-icon-button hidden lg:flex" aria-label={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={railCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}>{railCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>
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
        className="sidebar-mobile-toggle fixed left-3 top-3 z-30 flex h-10 w-10 items-center justify-center lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Main */}
      <div className={`flex-1 min-w-0 flex flex-col ${isHome ? 'min-h-0' : 'min-h-dvh'}`}>
        <main className={isHome ? 'home-main' : 'tool-workspace mx-auto flex-1 w-full max-w-[1500px] px-4 pb-6 pt-16 sm:px-7 sm:py-8 lg:px-9 lg:py-7'}>
          {!isHome && !['json', 'markdown', 'curl', 'mock-api', 'transfer'].includes(current.id) && (
            <header className="tool-heading">
              <h1>{current.label}</h1>
              <p>{current.description}</p>
            </header>
          )}
          <div key={isHome ? 'home' : current.id} className={isHome ? 'home-page' : undefined}>
            {isHome ? <HomeDashboard /> : <ToolComponent />}
          </div>
        </main>
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ThemeProvider>
        <AppShellInner />
      </ThemeProvider>
    </Suspense>
  );
}
