'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ChevronRight, Copy, Check } from 'lucide-react';
import { HighlightedText } from '@/components/highlighted-text';

const ARRAY_PAGE_SIZE = 100;

type ExpandMode = 'default' | 'all' | 'collapse';

interface TreeContextValue {
  searchQuery: string;
  expandMode: ExpandMode;
  copiedPath: string | null;
  setCopiedPath: (path: string | null) => void;
}

const TreeContext = createContext<TreeContextValue>({
  searchQuery: '',
  expandMode: 'default',
  copiedPath: null,
  setCopiedPath: () => {},
});

function matchesSearch(value: unknown, name: string | undefined, query: string): boolean {
  if (!query.trim()) return false;
  const q = query.toLowerCase();
  if (name && name.toLowerCase().includes(q)) return true;
  if (value === null) return 'null'.includes(q);
  if (typeof value === 'boolean') return value.toString().includes(q);
  if (typeof value === 'number') return value.toString().includes(q);
  if (typeof value === 'string') return value.toLowerCase().includes(q);
  return false;
}

function subtreeMatches(value: unknown, name: string | undefined, query: string): boolean {
  if (!query.trim()) return true;
  if (matchesSearch(value, name, query)) return true;
  if (Array.isArray(value)) {
    return value.some((item, idx) => subtreeMatches(item, String(idx), query));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).some(([k, v]) => subtreeMatches(v, k, query));
  }
  return false;
}

function buildPath(parentPath: string, name: string | undefined): string {
  if (!name) return parentPath || '$';
  if (parentPath === '$' || parentPath === '') {
    return /^\d+$/.test(name) ? `$.[${name}]` : `$.${name}`;
  }
  return /^\d+$/.test(name) ? `${parentPath}[${name}]` : `${parentPath}.${name}`;
}

interface JsonViewerProps {
  data: unknown;
  searchQuery?: string;
  expandMode?: ExpandMode;
  onExpandModeChange?: (mode: ExpandMode) => void;
}

export default function JsonViewer({
  data,
  searchQuery = '',
  expandMode = 'default',
}: JsonViewerProps) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  return (
    <TreeContext.Provider value={{ searchQuery, expandMode, copiedPath, setCopiedPath }}>
      <JsonNode value={data} path="$" depth={0} />
    </TreeContext.Provider>
  );
}

export type { ExpandMode };

interface JsonNodeProps {
  value: unknown;
  path: string;
  depth: number;
  name?: string;
}

const JsonNode: React.FC<JsonNodeProps> = ({ value, path, depth, name }) => {
  const { searchQuery, expandMode, copiedPath, setCopiedPath } = useContext(TreeContext);
  const hasSearch = searchQuery.trim().length > 0;
  const shouldAutoExpand = hasSearch && subtreeMatches(value, name, searchQuery);

  const [localExpanded, setLocalExpanded] = useState(depth < 2);

  const isExpanded =
    expandMode === 'all' ? true : expandMode === 'collapse' ? false : shouldAutoExpand || localExpanded;

  useEffect(() => {
    if (expandMode === 'default' && shouldAutoExpand) {
      setLocalExpanded(true);
    }
  }, [expandMode, shouldAutoExpand, searchQuery]);

  const toggleExpanded = () => {
    if (expandMode !== 'default') return;
    setLocalExpanded(!localExpanded);
  };

  const copyToClipboard = useCallback(
    (text: string, pathKey: string) => {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedPath(pathKey);
        setTimeout(() => setCopiedPath(null), 1500);
      });
    },
    [setCopiedPath]
  );

  const nodePath = buildPath(path === '$' && name ? '$' : path, name);
  const isMatch = matchesSearch(value, name, searchQuery);

  const PathActions = ({ copyValue, isObject }: { copyValue: unknown, isObject?: boolean }) => (
    <span className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          copyToClipboard(nodePath, `path-${nodePath}`);
        }}
        className="p-1 rounded-md bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center gap-1"
        title={`Copy path: ${nodePath}`}
      >
        {copiedPath === `path-${nodePath}` ? <Check size={10} className="text-accent" /> : <span className="text-[9px] font-medium">Path</span>}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const str = typeof copyValue === 'string' && !isObject ? copyValue : JSON.stringify(copyValue, null, 2);
          copyToClipboard(str, `val-${nodePath}`);
        }}
        className="p-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary flex items-center gap-1"
        title="Copy value"
      >
        {copiedPath === `val-${nodePath}` ? <Check size={10} className="text-primary" /> : <Copy size={10} />}
      </button>
    </span>
  );

  if (value === null) {
    return (
      <span className="text-xs group inline-flex items-center hover:bg-secondary/40 rounded-md px-1 -mx-1 transition-colors" title={nodePath}>
        {name && (
          <span className="text-foreground/90 font-semibold">
            <HighlightedText text={name} query={searchQuery} />:
          </span>
        )}
        <span className="text-muted-foreground/60 italic ml-1">null</span>
        <PathActions copyValue={null} />
      </span>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <span className="text-xs group inline-flex items-center hover:bg-secondary/40 rounded-md px-1 -mx-1 transition-colors" title={nodePath}>
        {name && (
          <span className="text-foreground/90 font-semibold">
            <HighlightedText text={name} query={searchQuery} />:
          </span>
        )}
        <span className="text-rose-500 dark:text-rose-400 ml-1">
          <HighlightedText text={value.toString()} query={searchQuery} />
        </span>
        <PathActions copyValue={value} />
      </span>
    );
  }

  if (typeof value === 'number') {
    return (
      <span className="text-xs group inline-flex items-center hover:bg-secondary/40 rounded-md px-1 -mx-1 transition-colors" title={nodePath}>
        {name && (
          <span className="text-foreground/90 font-semibold">
            <HighlightedText text={name} query={searchQuery} />:
          </span>
        )}
        <span className="text-amber-600 dark:text-amber-400 ml-1">
          <HighlightedText text={String(value)} query={searchQuery} />
        </span>
        <PathActions copyValue={value} />
      </span>
    );
  }

  if (typeof value === 'string') {
    const isLong = value.length > 120;
    const [showFull, setShowFull] = useState(false);
    const displayValue = isLong && !showFull ? value.substring(0, 117) + '...' : value;

    return (
      <span className="text-xs group inline-flex items-start flex-wrap hover:bg-secondary/40 rounded-md px-1 -mx-1 transition-colors py-0.5" title={nodePath}>
        {name && (
          <span className="text-foreground/90 font-semibold">
            <HighlightedText text={name} query={searchQuery} />:
          </span>
        )}
        <span className="text-emerald-600 dark:text-emerald-400 ml-1">
          &quot;<HighlightedText text={displayValue} query={searchQuery} />&quot;
        </span>
        {isLong && (
          <button
            type="button"
            onClick={() => setShowFull(!showFull)}
            className="ml-1 text-[10px] text-primary hover:underline"
          >
            {showFull ? 'less' : 'more'}
          </button>
        )}
        <PathActions copyValue={value} />
      </span>
    );
  }

  if (Array.isArray(value)) {
    return (
      <ArrayNode
        value={value}
        path={nodePath}
        depth={depth}
        name={name}
        isExpanded={isExpanded}
        onToggle={toggleExpanded}
        searchQuery={searchQuery}
      />
    );
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    const isEmpty = keys.length === 0;

    return (
      <div>
        <div
          onClick={toggleExpanded}
          className="flex items-center gap-2 cursor-pointer group transition-colors hover:bg-secondary/40 rounded-md px-1 -mx-1 py-0.5 text-xs w-full text-left"
          title={nodePath}
        >
          <ChevronRight
            size={14}
            className={`text-muted-foreground group-hover:text-foreground transition-transform shrink-0 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
          {name && (
            <span className="text-foreground/90 font-semibold">
              <HighlightedText text={name} query={searchQuery} />:
            </span>
          )}
          <span className="text-[10px] bg-secondary/50 text-muted-foreground px-1.5 py-0.5 rounded-md font-medium tracking-wide border border-border/50">
            {isEmpty ? 'empty' : `{ ${keys.length} item${keys.length === 1 ? '' : 's'} }`}
          </span>
          <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[200px] opacity-0 group-hover:opacity-100 transition-opacity">
            {nodePath}
          </span>
          <PathActions copyValue={value} isObject={true} />
        </div>
        {isExpanded && !isEmpty && (
          <div className="ml-2 border-l border-border/40 hover:border-primary/40 pl-3 py-0.5 transition-colors">
            {keys.map((key) => (
              <div key={key} className="py-0.5 font-mono">
                <JsonNode
                  value={(value as Record<string, unknown>)[key]}
                  path={nodePath}
                  depth={depth + 1}
                  name={key}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-xs text-muted-foreground">undefined</span>;
};

interface ArrayNodeProps {
  value: unknown[];
  path: string;
  depth: number;
  name?: string;
  isExpanded: boolean;
  onToggle: () => void;
  searchQuery: string;
  matchClass: string;
}

const ArrayNode: React.FC<ArrayNodeProps> = ({
  value,
  path,
  depth,
  name,
  isExpanded,
  onToggle,
  searchQuery,
}) => {
  const [visibleCount, setVisibleCount] = useState(ARRAY_PAGE_SIZE);
  const isEmpty = value.length === 0;
  const hasMore = value.length > visibleCount;

  useEffect(() => {
    setVisibleCount(ARRAY_PAGE_SIZE);
  }, [value]);

  return (
    <div>
      <div
        onClick={onToggle}
        className="flex items-center gap-2 cursor-pointer group transition-colors hover:bg-secondary/40 rounded-md px-1 -mx-1 py-0.5 text-xs w-full text-left"
        title={path}
      >
        <ChevronRight
          size={14}
          className={`text-muted-foreground group-hover:text-foreground transition-transform shrink-0 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
        {name && (
          <span className="text-foreground/90 font-semibold">
            <HighlightedText text={name} query={searchQuery} />:
          </span>
        )}
        <span className="text-[10px] bg-secondary/50 text-muted-foreground px-1.5 py-0.5 rounded-md font-medium tracking-wide border border-border/50">
          {isEmpty ? 'empty' : `[ ${value.length} item${value.length === 1 ? '' : 's'} ]`}
        </span>
        <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[200px] opacity-0 group-hover:opacity-100 transition-opacity">
          {path}
        </span>
        <span className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(path);
            }}
            className="p-1 rounded-md bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center gap-1"
            title={`Copy path: ${path}`}
          >
            <span className="text-[9px] font-medium">Path</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(JSON.stringify(value, null, 2));
            }}
            className="p-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary flex items-center gap-1"
            title="Copy array"
          >
            <Copy size={10} />
          </button>
        </span>
      </div>
      {isExpanded && !isEmpty && (
        <div className="ml-2 border-l border-border/40 hover:border-primary/40 pl-3 py-0.5 transition-colors">
          {value.slice(0, visibleCount).map((item, idx) => (
            <div key={idx} className="py-0.5 font-mono">
              <JsonNode value={item} path={path} depth={depth + 1} name={String(idx)} />
            </div>
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + ARRAY_PAGE_SIZE)}
              className="text-[10px] text-primary hover:underline mt-1 ml-1"
            >
              Show {Math.min(ARRAY_PAGE_SIZE, value.length - visibleCount)} more ({value.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
