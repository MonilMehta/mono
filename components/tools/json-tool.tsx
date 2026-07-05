'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy,
  Check,
  AlertCircle,
  Download,
  ChevronRight,
  Search,
  Upload,
  ChevronsDownUp,
  ChevronsUpDown,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import JsonViewer, { type ExpandMode } from '@/components/json-viewer';
import { HighlightedText } from '@/components/highlighted-text';
import { debounce } from '@/lib/debounce';
import {
  parseJson,
  computeStats,
  formatBytes,
  type JsonStats,
  type ParseError,
} from '@/lib/json-utils';

export default function JsonTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const [parseError, setParseError] = useState<ParseError | null>(null);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<JsonStats | null>(null);
  const [activeTab, setActiveTab] = useState<'formatted' | 'minified' | 'tree'>('tree');
  const [parsedData, setParsedData] = useState<unknown>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [expandMode, setExpandMode] = useState<ExpandMode>('default');
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skipDebounceRef = useRef(false);

  const validateJSON = useCallback((json: string) => {
    setIsValidating(true);
    const trimmed = json.trim();
    if (!trimmed) {
      setParseError(null);
      setStats(null);
      setParsedData(null);
      setOutput('');
      setIsValidating(false);
      return true;
    }

    const result = parseJson(trimmed);
    if (result.ok) {
      const formatted = JSON.stringify(result.data, null, 2);
      setParseError(null);
      setOutput(formatted);
      setParsedData(result.data);
      setStats(computeStats(json, result.data));
      setIsValidating(false);
      return true;
    }

    setParseError(result.error);
    setStats(null);
    setParsedData(null);
    setOutput('');
    setIsValidating(false);
    return false;
  }, []);

  const debouncedValidate = useMemo(
    () => debounce((json: string) => validateJSON(json), 300),
    [validateJSON]
  );

  useEffect(() => {
    return () => debouncedValidate.cancel();
  }, [debouncedValidate]);

  const handleInputChange = (value: string) => {
    setInput(value);
    if (!value.trim()) {
      debouncedValidate.cancel();
      setParseError(null);
      setStats(null);
      setParsedData(null);
      setOutput('');
      return;
    }
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false;
      validateJSON(value);
    } else {
      setIsValidating(true);
      debouncedValidate(value);
    }
  };

  const loadFileContent = (text: string) => {
    skipDebounceRef.current = true;
    setInput(text);
    validateJSON(text);
    if (text.trim()) setShowOutput(true);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      loadFileContent(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(output));
    element.setAttribute('download', 'data.json');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleExpandAll = () => setExpandMode('all');
  const handleCollapseAll = () => setExpandMode('collapse');
  const handleResetExpand = () => setExpandMode('default');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchQuery, activeTab]);

  useEffect(() => {
    if (!searchQuery) return;
    // Delay slightly to let React render the highlighted marks
    const timer = setTimeout(() => {
      const marks = document.querySelectorAll('.highlight-mark');
      marks.forEach((m) => m.removeAttribute('data-active'));
      if (marks.length > 0 && activeMatchIndex < marks.length) {
        const activeMark = marks[activeMatchIndex];
        activeMark.setAttribute('data-active', 'true');
        activeMark.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [searchQuery, activeMatchIndex, activeTab, expandMode]);

  const matchCount = useMemo(() => {
    if (!searchQuery.trim() || !parsedData) return 0;
    
    if (activeTab === 'tree') {
      let count = 0;
      const lowerQuery = searchQuery.toLowerCase();
      
      const countInStr = (str: string) => {
        const lower = str.toLowerCase();
        let c = 0;
        let idx = lower.indexOf(lowerQuery);
        while (idx !== -1) {
          c++;
          idx = lower.indexOf(lowerQuery, idx + lowerQuery.length);
        }
        return c;
      };

      const traverse = (val: unknown, name?: string) => {
        if (name) count += countInStr(name);
        if (val === null) count += countInStr('null');
        else if (typeof val === 'boolean') count += countInStr(val.toString());
        else if (typeof val === 'number') count += countInStr(String(val));
        else if (typeof val === 'string') count += countInStr(val);
        else if (Array.isArray(val)) {
          val.forEach((item, idx) => traverse(item, String(idx)));
        } else if (typeof val !== 'undefined' && typeof val === 'object') {
          Object.entries(val).forEach(([k, v]) => traverse(v, k));
        }
      };
      
      traverse(parsedData);
      return count;
    }
    
    const targetString = activeTab === 'minified' 
      ? JSON.stringify(parsedData) 
      : output;
      
    if (!targetString) return 0;
    
    const lowerTarget = targetString.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    let count = 0;
    let idx = lowerTarget.indexOf(lowerQuery);
    while (idx !== -1) {
      count++;
      idx = lowerTarget.indexOf(lowerQuery, idx + lowerQuery.length);
    }
    return count;
  }, [searchQuery, parsedData, activeTab, output]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (stats && !parseError) setShowOutput(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setInput('');
        setParseError(null);
        setStats(null);
        setParsedData(null);
        setOutput('');
        setShowOutput(false);
        setSearchInput('');
        setSearchQuery('');
        textareaRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && showOutput) {
        e.preventDefault();
        document.getElementById('json-search')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stats, parseError, showOutput]);

  const getOutputContent = () => {
    if (activeTab === 'tree' && parsedData) {
      return (
        <JsonViewer data={parsedData} searchQuery={searchQuery} expandMode={expandMode} />
      );
    }
    if (activeTab === 'minified' && parsedData) {
      const minified = JSON.stringify(parsedData);
      return (
        <pre className="text-sm font-mono whitespace-pre-wrap wrap-break-word leading-7">
          <code>
            <HighlightedText text={minified} query={searchQuery} />
          </code>
        </pre>
      );
    }
    return (
      <pre className="text-sm font-mono whitespace-pre-wrap wrap-break-word leading-7">
        <code>
          <HighlightedText text={output} query={searchQuery} />
        </code>
      </pre>
    );
  };

  const errorDisplay = parseError
    ? parseError.line
      ? `${parseError.message} (line ${parseError.line}, column ${parseError.column})`
      : parseError.message
    : '';

  return (
    <div className="w-full h-full max-w-5xl mx-auto">
      <AnimatePresence mode="wait">
        {!showOutput ? (
          <motion.div 
            key="input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col"
          >
            <div
              className={`surface-panel relative rounded-3xl overflow-hidden flex flex-col h-full min-h-96 lg:min-h-[640px] transition-colors duration-200 ${
                isDragging ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <AnimatePresence>
                {isDragging && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 bg-background/90 flex items-center justify-center pointer-events-none"
                  >
                    <div className="absolute inset-6 border-2 border-dashed border-primary/50 rounded-2xl animate-pulse"></div>
                    <motion.div 
                      animate={{ y: [0, -8, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      className="flex flex-col items-center gap-4 text-primary"
                    >
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <Upload size={36} />
                      </div>
                      <div className="text-center">
                        <span className="text-lg font-bold block mb-1 text-foreground">Drop JSON file</span>
                        <span className="text-sm text-muted-foreground font-medium">Release to instantly format & explore</span>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.txt,.log,application/json,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />

              <div className="flex items-center justify-between gap-4 border-b border-border/50 bg-card px-8 py-5">
                <div>
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">JSON input</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Paste a payload, drop a file, or upload JSON to format and inspect it.</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="hidden sm:inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-secondary/80 active:scale-95"
                  title="Upload JSON file"
                >
                  <Upload size={16} />
                  Upload
                </button>
              </div>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onPaste={() => {
                  setTimeout(() => {
                    if (textareaRef.current) {
                      skipDebounceRef.current = true;
                      const isValid = validateJSON(textareaRef.current.value);
                      if (isValid) setShowOutput(true);
                    }
                  }, 0);
                }}
                placeholder={`Paste JSON or drop a .json file...\n\n{\n  "name": "John",\n  "age": 30\n}`}
                className="flex-1 bg-background/35 p-8 font-mono text-base resize-none focus:outline-none placeholder-muted-foreground/55 leading-8"
              />

              <div className="border-t border-border/50 bg-card px-8 py-5 flex items-center justify-between gap-5">
                <div className="flex items-center gap-2 min-w-0">
                  {parseError && <AlertCircle size={16} className="text-destructive shrink-0" />}
                  {isValidating && !parseError && (
                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
                  )}
                  <span
                    className={`text-sm font-medium truncate ${
                      parseError ? 'text-destructive' : stats ? 'text-accent' : 'text-muted-foreground'
                    }`}
                  >
                    {parseError
                      ? errorDisplay
                      : stats
                        ? `Valid · ${stats.lines} lines · ${formatBytes(stats.size)}`
                        : 'Paste JSON or upload a file...'}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 rounded-xl hover:bg-secondary transition-all active:scale-95 text-muted-foreground hover:text-foreground"
                    title="Upload JSON file"
                  >
                    <Upload size={16} />
                  </button>
                  {input && stats && !parseError && (
                    <>
                      <button
                        onClick={() => handleCopy(output)}
                        className="p-2.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        title="Copy formatted JSON"
                      >
                        {copied ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
                      </button>
                      <button
                        onClick={handleDownload}
                        className="p-2.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        title="Download as JSON"
                      >
                        <Download size={16} />
                      </button>
                    </>
                  )}
                  {input && (
                    <button
                      onClick={() => {
                        setInput('');
                        setParseError(null);
                        setShowOutput(false);
                        setParsedData(null);
                        setStats(null);
                        setSearchQuery('');
                        debouncedValidate.cancel();
                      }}
                      className="p-2.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                      title="Clear all (⌘K)"
                    >
                      <X size={16} />
                    </button>
                  )}
                  {input && stats && !parseError && (
                    <button
                      onClick={() => setShowOutput(!showOutput)}
                      className="ml-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                      Format <ChevronRight size={14} className={`transition-transform ${showOutput ? 'rotate-90' : ''}`} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {stats && !parseError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="mt-8 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4"
              >
                <StatPill label="Size" value={formatBytes(stats.size)} />
                <StatPill label="Minified" value={formatBytes(stats.minSize)} />
                <StatPill label="Depth" value={stats.depth} />
                <StatPill label="Keys" value={stats.keys} />
                <StatPill label="Arrays" value={stats.arrays} />
                <StatPill label="Saved" value={`${stats.compression}%`} />
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="output"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col h-full min-h-96 lg:min-h-[640px] gap-6"
          >
            {!parseError && (
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-center gap-1 bg-secondary/40 p-1.5 rounded-2xl w-fit overflow-x-auto no-scrollbar shrink-0 border border-border/30">
                  {(['tree', 'formatted', 'minified'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-5 py-2.5 text-sm font-semibold rounded-xl capitalize whitespace-nowrap transition-all ${
                        activeTab === tab
                          ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                          : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/60'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center gap-2 w-full xl:w-auto">
                  <div className="relative group flex-1 xl:w-[260px]">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      id="json-search"
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (e.shiftKey) {
                            setActiveMatchIndex((prev) => (prev > 0 ? prev - 1 : matchCount - 1));
                          } else {
                            setActiveMatchIndex((prev) => (prev < matchCount - 1 ? prev + 1 : 0));
                          }
                        }
                      }}
                      placeholder="Search keys & values... (⌘F)"
                      className={`w-full pl-10 py-3 text-sm rounded-2xl bg-secondary/40 border border-border/30 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50 transition-all ${searchInput ? 'pr-[104px]' : 'pr-8'}`}
                    />
                    {searchInput && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <span className="text-[10px] font-semibold text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded-md mr-1">
                          {matchCount > 0 ? activeMatchIndex + 1 : 0}/{matchCount}
                        </span>
                        <button
                          onClick={() => setActiveMatchIndex((prev) => (prev > 0 ? prev - 1 : matchCount - 1))}
                          disabled={matchCount === 0}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          onClick={() => setActiveMatchIndex((prev) => (prev < matchCount - 1 ? prev + 1 : 0))}
                          disabled={matchCount === 0}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50"
                        >
                          <ChevronDown size={12} />
                        </button>
                        <div className="w-px h-3 bg-border mx-0.5"></div>
                        <button
                          onClick={() => {
                            setSearchInput('');
                            setSearchQuery('');
                          }}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 bg-secondary/40 p-1.5 rounded-2xl border border-border/30">
                    {activeTab === 'tree' && (
                      <>
                        <button
                          onClick={handleExpandAll}
                          className="p-2.5 rounded-xl hover:bg-background text-muted-foreground hover:text-foreground transition-all active:scale-95"
                          title="Expand all"
                        >
                          <ChevronsUpDown size={14} />
                        </button>
                        <button
                          onClick={handleCollapseAll}
                          className="p-2.5 rounded-xl hover:bg-background text-muted-foreground hover:text-foreground transition-all active:scale-95"
                          title="Collapse all"
                        >
                          <ChevronsDownUp size={14} />
                        </button>
                        {expandMode !== 'default' && (
                          <button
                            onClick={handleResetExpand}
                            className="px-3 py-2 rounded-xl text-xs font-medium hover:bg-background text-muted-foreground hover:text-foreground transition-all active:scale-95 hidden sm:block"
                          >
                            Reset
                          </button>
                        )}
                        <div className="w-px h-5 bg-border/50 mx-1"></div>
                      </>
                    )}
                    <button
                      onClick={() => handleCopy(output)}
                      className="p-2.5 rounded-xl hover:bg-background transition-all active:scale-95 text-muted-foreground hover:text-foreground"
                      title="Copy full JSON"
                    >
                      {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="p-2.5 rounded-xl hover:bg-background transition-all active:scale-95 text-muted-foreground hover:text-foreground"
                      title="Download JSON"
                    >
                      <Download size={14} />
                    </button>
                    <div className="w-px h-5 bg-border/50 mx-1 hidden sm:block"></div>
                    <button
                      onClick={() => {
                        setInput('');
                        setParseError(null);
                        setShowOutput(false);
                        setParsedData(null);
                        setStats(null);
                        setSearchInput('');
                        setSearchQuery('');
                        debouncedValidate.cancel();
                      }}
                      className="p-2.5 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all active:scale-95 hidden sm:block"
                      title="Clear & Edit (⌘K)"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 surface-panel rounded-3xl overflow-hidden flex flex-col transition-colors duration-200">
              <div className="flex-1 overflow-auto p-8">
                {parseError ? (
                  <div className="space-y-3">
                    <div className="text-sm text-destructive font-mono">{errorDisplay}</div>
                    {parseError.line && (
                      <ErrorSnippet input={input} line={parseError.line} column={parseError.column} />
                    )}
                  </div>
                ) : (
                  <div className="font-mono text-sm leading-7 text-foreground/85">
                    {getOutputContent()}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="surface-panel rounded-2xl px-4 py-4 text-center transition-colors duration-200 hover:border-primary/20"
    >
      <p className="text-xs text-muted-foreground font-semibold mb-1.5 uppercase tracking-[0.12em]">{label}</p>
      <p className="text-lg font-semibold text-primary">{value}</p>
    </div>
  );
}

function ErrorSnippet({ input, line, column }: { input: string; line: number; column?: number }) {
  const lines = input.split('\n');
  const start = Math.max(0, line - 3);
  const end = Math.min(lines.length, line + 2);
  const snippet = lines.slice(start, end);

  return (
    <pre className="text-sm font-mono bg-destructive/5 border border-destructive/20 rounded-2xl p-5 overflow-x-auto leading-7">
      {snippet.map((l, i) => {
        const lineNum = start + i + 1;
        const isErrorLine = lineNum === line;
        return (
          <div key={lineNum} className={isErrorLine ? 'text-destructive' : 'text-muted-foreground'}>
            <span className="inline-block w-8 text-right mr-3 opacity-50 select-none">{lineNum}</span>
            <span>{l}</span>
            {isErrorLine && column && (
              <div>
                <span className="inline-block w-8 mr-3" />
                <span>{' '.repeat(Math.max(0, column - 1))}^</span>
              </div>
            )}
          </div>
        );
      })}
    </pre>
  );
}
