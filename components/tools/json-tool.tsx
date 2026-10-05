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
  Braces,
  ListTree,
  Minimize2,
} from 'lucide-react';
import JsonViewer, { type ExpandMode } from '@/components/json-viewer';
import { CodeHighlight } from '@/components/code-highlight';
import {
  parseJson,
  parseJsonWithRepair,
  computeStats,
  computeLightweightStats,
  formatBytes,
  deleteAtPath,
  extractRootArrayFields,
  flattenJson,
  queryJsonPath,
  removeJsonKey,
  renameJsonKey,
  sortJsonKeys,
  unflattenJson,
  type JsonStats,
  type ParseError,
} from '@/lib/json-utils';

const LARGE_PAYLOAD_CHARS = 1_000_000;
const LARGE_PAYLOAD_KEYS = 5_000;
const MANUAL_VALIDATION_CHARS = 5_000_000;
const JSON_VIEWS = [
  { id: 'tree', label: 'Tree', description: 'Explore', icon: ListTree },
  { id: 'formatted', label: 'Formatted', description: 'Readable', icon: Braces },
  { id: 'minified', label: 'Minified', description: 'Compact', icon: Minimize2 },
] as const;

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
  const [requiresManualValidation, setRequiresManualValidation] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);
  const [workspacePanel, setWorkspacePanel] = useState<'query' | 'transform' | null>(null);
  const [queryInput, setQueryInput] = useState('$');
  const [queryRequest, setQueryRequest] = useState<string | null>(null);
  const [transformError, setTransformError] = useState('');
  const [extractFields, setExtractFields] = useState('');
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [removeKey, setRemoveKey] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipDebounceRef = useRef(false);

  const validateJSON = useCallback((json: string) => {
    setIsValidating(true);
    setRequiresManualValidation(false);
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
      const isLargeInput = json.length > LARGE_PAYLOAD_CHARS;
      const formatted = isLargeInput ? json : JSON.stringify(result.data, null, 2);
      const nextStats = isLargeInput ? computeLightweightStats(json) : computeStats(json, result.data);
      setRepairFailed(false);
      setParseError(null);
      setOutput(formatted);
      setParsedData(result.data);
      setStats(nextStats);
      if (nextStats.isLarge || nextStats.keys > LARGE_PAYLOAD_KEYS) {
        setActiveTab('formatted');
        setSearchInput('');
        setSearchQuery('');
      }
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

  const cancelScheduledValidation = useCallback(() => {
    if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    validationTimerRef.current = null;
  }, []);

  const scheduleValidation = useCallback((json: string) => {
    cancelScheduledValidation();
    setIsValidating(true);
    validationTimerRef.current = setTimeout(
      () => validateJSON(json),
      json.length > LARGE_PAYLOAD_CHARS ? 700 : 300
    );
  }, [cancelScheduledValidation, validateJSON]);

  useEffect(() => cancelScheduledValidation, [cancelScheduledValidation]);

  const handleInputChange = (value: string) => {
    setInput(value);
    setRepairFailed(false);
    if (!value.trim()) {
      cancelScheduledValidation();
      setParseError(null);
      setStats(null);
      setParsedData(null);
      setOutput('');
      setRequiresManualValidation(false);
      return;
    }
    if (value.length > MANUAL_VALIDATION_CHARS) {
      cancelScheduledValidation();
      setRequiresManualValidation(true);
      setIsValidating(false);
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
      scheduleValidation(value);
    }
  };

  const loadFileContent = (text: string) => {
    cancelScheduledValidation();
    skipDebounceRef.current = true;
    setInput(text);
    setRepairFailed(false);
    if (text.length > MANUAL_VALIDATION_CHARS) {
      setRequiresManualValidation(true);
      setIsValidating(false);
      setParseError(null);
      setStats(null);
      setParsedData(null);
      setOutput('');
      return;
    }
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
    const url = URL.createObjectURL(new Blob([output], { type: 'application/json;charset=utf-8' }));
    element.setAttribute('href', url);
    element.setAttribute('download', 'data.json');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

  const handleExpandAll = () => setExpandMode('all');
  const handleCollapseAll = () => setExpandMode('collapse');
  const handleResetExpand = () => setExpandMode('default');

  const handleTreeDelete = useCallback(
    (path: string) => {
      if (!parsedData) return;
      const newData = deleteAtPath(parsedData, path);
      const formatted = JSON.stringify(newData, null, 2);
      skipDebounceRef.current = true;
      setParsedData(newData);
      setOutput(formatted);
      setInput(formatted);
      setStats(computeStats(formatted, newData));
    },
    [parsedData]
  );

  const isLargePayload = input.length > LARGE_PAYLOAD_CHARS || Boolean(stats?.isLarge) || Boolean(stats && stats.keys > LARGE_PAYLOAD_KEYS);
  const canRenderTree = Boolean(stats && !isLargePayload);

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
    if (!searchQuery.trim() || !stats || isLargePayload) return 0;
    
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
  }, [searchQuery, parsedData, activeTab, output, stats, isLargePayload]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (requiresManualValidation) {
          const isValid = validateJSON(input);
          if (isValid) setShowOutput(true);
        } else if (stats && !parseError) setShowOutput(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setInput('');
        setRepairFailed(false);
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
  }, [input, parseError, requiresManualValidation, stats, showOutput, validateJSON]);

  const queryResult = useMemo(() => {
    if (!queryRequest || !stats) return null;
    try {
      return { matches: queryJsonPath(parsedData, queryRequest, 100), error: '' };
    } catch (error) {
      return { matches: [], error: error instanceof Error ? error.message : 'Invalid query' };
    }
  }, [parsedData, queryRequest, stats]);

  const applyParsedData = useCallback((nextData: unknown) => {
    const formatted = JSON.stringify(nextData, null, 2);
    cancelScheduledValidation();
    skipDebounceRef.current = true;
    setInput(formatted);
    setOutput(formatted);
    setParsedData(nextData);
    setStats(computeStats(formatted, nextData));
    setParseError(null);
  }, [cancelScheduledValidation]);

  const tryRepair = () => {
    const repaired = parseJsonWithRepair(input.trim());
    if (!repaired.ok) {
      setRepairFailed(true);
      return;
    }
    loadFileContent(JSON.stringify(repaired.data, null, 2));
  };

  const runTransform = (operation: 'sort' | 'flatten' | 'unflatten' | 'extract' | 'rename' | 'remove') => {
    if (!stats) return;
    try {
      const nextData =
        operation === 'sort' ? sortJsonKeys(parsedData) :
        operation === 'flatten' ? flattenJson(parsedData) :
        operation === 'unflatten' ? unflattenJson(parsedData) :
        operation === 'extract' ? extractRootArrayFields(parsedData, extractFields.split(',')) :
        operation === 'rename' ? renameJsonKey(parsedData, renameFrom, renameTo) :
        removeJsonKey(parsedData, removeKey);
      applyParsedData(nextData);
      setTransformError('');
    } catch (error) {
      setTransformError(error instanceof Error ? error.message : 'Could not transform this payload');
    }
  };

  const getOutputContent = () => {
    if (activeTab === 'tree' && canRenderTree) {
      return (
        <JsonViewer
          data={parsedData}
          searchQuery={searchQuery}
          expandMode={expandMode}
          onDelete={handleTreeDelete}
        />
      );
    }
    if (activeTab === 'minified' && stats && !isLargePayload) {
      const minified = JSON.stringify(parsedData);
      return (
        <CodeHighlight
          code={minified}
          language="json"
          searchQuery={searchQuery}
          showLineNumbers={false}
          wrapLongLines
        />
      );
    }
    if (isLargePayload) {
      return <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-7">{output}</pre>;
    }
    return (
      <CodeHighlight code={output} language="json" searchQuery={searchQuery} />
    );
  };

  const errorDisplay = parseError
    ? parseError.line
      ? `${parseError.message} (line ${parseError.line}, column ${parseError.column})`
      : parseError.message
    : '';

  return (
    <div className="w-full">
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

      <div className="mb-7 flex items-start justify-between gap-5">
        <div>
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.035em] text-foreground">JSON input</h2>
          <p className="mt-1 text-[16px] text-foreground/78">Paste a payload, drop a file, or upload JSON to format and inspect it.</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="gum-button hidden h-12 items-center gap-2 px-5 text-[15px] font-semibold sm:inline-flex"
          title="Upload JSON file"
        >
          <Upload size={18} />
          Upload
        </button>
      </div>

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
              className={`surface-panel relative flex h-full min-h-80 flex-col overflow-hidden rounded-[4px] transition-colors duration-200 lg:min-h-[640px] ${
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

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onPaste={() => {
                  setTimeout(() => {
                    if (textareaRef.current) {
                      if (textareaRef.current.value.length > LARGE_PAYLOAD_CHARS) return;
                      skipDebounceRef.current = true;
                      const isValid = validateJSON(textareaRef.current.value);
                      if (isValid) setShowOutput(true);
                    }
                  }, 0);
                }}
                placeholder={`Paste JSON or drop a .json file...\n\n{\n  "name": "John",\n  "age": 30\n}`}
                className="flex-1 resize-none bg-card p-6 font-mono text-[14px] leading-8 placeholder:text-muted-foreground/55 focus:outline-none"
              />

              <div className="flex items-center justify-between gap-5 border-t border-border bg-card px-5 py-4">
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
                      ? `${repairFailed ? 'Could not repair · ' : ''}${errorDisplay}`
                      : requiresManualValidation
                        ? `Large payload ready · ${formatBytes(input.length)} · validate on demand`
                      : stats
                        ? stats.isLarge
                          ? `Valid large payload · ${formatBytes(stats.size)} source`
                          : `Valid · ${stats.lines} lines · ${formatBytes(stats.size)}`
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
                        setRepairFailed(false);
                        setParseError(null);
                        setShowOutput(false);
                        setParsedData(null);
                        setStats(null);
                        setSearchQuery('');
                        setRequiresManualValidation(false);
                        cancelScheduledValidation();
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
                      className="gum-button ml-2 flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
                    >
                      Format <ChevronRight size={14} className={`transition-transform ${showOutput ? 'rotate-90' : ''}`} />
                    </button>
                  )}
                  {input && parseError && !isLargePayload && (
                    <button
                      onClick={tryRepair}
                      className="gum-button ml-2 px-4 py-2.5 text-sm font-semibold"
                    >
                      Try fixing it
                    </button>
                  )}
                  {requiresManualValidation && (
                    <button
                      onClick={() => {
                        const isValid = validateJSON(input);
                        if (isValid) setShowOutput(true);
                      }}
                      className="gum-button ml-2 px-4 py-2.5 text-sm font-semibold"
                    >
                      Validate
                    </button>
                  )}
                </div>
              </div>
            </div>

            {stats && !parseError && !isLargePayload && (
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
            className="flex flex-col h-full min-h-80 lg:min-h-[560px] gap-6"
          >
            {!parseError && (
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex w-fit shrink-0 items-center gap-1 overflow-x-auto rounded-2xl border border-border/40 bg-card p-1.5 shadow-sm no-scrollbar">
                  {JSON_VIEWS.filter((view) => !isLargePayload || view.id === 'formatted').map((view) => {
                    const Icon = view.icon;
                    return (
                    <button
                      key={view.id}
                      onClick={() => setActiveTab(view.id)}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left whitespace-nowrap transition-all ${
                        activeTab === view.id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                      }`}
                    >
                      <Icon size={14} />
                      <span>
                        <span className="block text-xs font-semibold leading-none">{isLargePayload ? 'Source' : view.label}</span>
                        {!isLargePayload && <span className={`mt-1 block text-[9px] leading-none ${activeTab === view.id ? 'text-primary-foreground/65' : 'text-muted-foreground/65'}`}>{view.description}</span>}
                      </span>
                    </button>
                    );
                  })}
                </div>
                
                <div className="flex items-center gap-2 w-full xl:w-auto">
                  {!isLargePayload && (
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
                  )}

                  <div className="flex items-center gap-1 shrink-0 bg-secondary/40 p-1.5 rounded-2xl border border-border/30">
                    <button
                      onClick={() => setWorkspacePanel((panel) => panel === 'query' ? null : 'query')}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${workspacePanel === 'query' ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50' : 'text-muted-foreground hover:bg-background hover:text-foreground'}`}
                    >
                      Query
                    </button>
                    <button
                      onClick={() => setWorkspacePanel((panel) => panel === 'transform' ? null : 'transform')}
                      disabled={isLargePayload}
                      title={isLargePayload ? 'Transforms are paused for large payloads' : 'Transform JSON'}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${workspacePanel === 'transform' ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50' : 'text-muted-foreground hover:bg-background hover:text-foreground'} disabled:opacity-40`}
                    >
                      Transform
                    </button>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 bg-secondary/40 p-1.5 rounded-2xl border border-border/30">
                    {activeTab === 'tree' && canRenderTree && (
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
                        setRepairFailed(false);
                        setParseError(null);
                        setShowOutput(false);
                        setParsedData(null);
                        setStats(null);
                        setSearchInput('');
                        setSearchQuery('');
                        cancelScheduledValidation();
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

            {isLargePayload && !parseError && (
              <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Large payload mode.</span> Tree, search, and transforms are paused to keep the browser responsive. Use formatted output, download, or a focused JSONPath query.
              </div>
            )}

            <AnimatePresence initial={false}>
              {workspacePanel === 'query' && !parseError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="surface-panel rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">JSONPath query</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Supports properties, indices, quoted keys, and wildcards — for example <code>$.data.users[*].email</code>.</p>
                    </div>
                    <button onClick={() => setWorkspacePanel(null)} className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" title="Close query">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={queryInput}
                      onChange={(event) => setQueryInput(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') setQueryRequest(queryInput); }}
                      placeholder="$.data.users[*].email"
                      className="min-w-0 flex-1 rounded-xl border border-border/50 bg-secondary/40 px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button onClick={() => setQueryRequest(queryInput)} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
                      Run
                    </button>
                  </div>
                  {queryResult && (
                    <div className="rounded-xl border border-border/45 bg-secondary/20 p-3">
                      {queryResult.error ? (
                        <p className="text-xs text-destructive">{queryResult.error}</p>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <p className="text-xs font-semibold text-foreground">{queryResult.matches.length} match{queryResult.matches.length === 1 ? '' : 'es'}</p>
                            {queryResult.matches.length > 0 && !isLargePayload && (
                              <button onClick={() => handleCopy(JSON.stringify(queryResult.matches, null, 2))} className="text-xs font-medium text-primary hover:underline">Copy results</button>
                            )}
                          </div>
                          {queryResult.matches.slice(0, 20).map((match) => (
                            <div key={match.path} className="border-t border-border/35 py-2 first:border-t-0 first:pt-0">
                              <p className="font-mono text-[11px] text-primary">{match.path}</p>
                              <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">{formatQueryValue(match.value)}</pre>
                            </div>
                          ))}
                          {queryResult.matches.length > 20 && <p className="pt-2 text-xs text-muted-foreground">Showing the first 20 of at most 100 matches.</p>}
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {workspacePanel === 'transform' && !parseError && !isLargePayload && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="surface-panel rounded-2xl p-4 space-y-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">Transform JSON</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Each action replaces the working payload; copy or download first if you need the original.</p>
                    </div>
                    <button onClick={() => setWorkspacePanel(null)} className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" title="Close transforms">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TransformButton label="Sort keys" onClick={() => runTransform('sort')} />
                    <TransformButton label="Flatten" onClick={() => runTransform('flatten')} />
                    <TransformButton label="Unflatten" onClick={() => runTransform('unflatten')} />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <TransformField value={extractFields} onChange={setExtractFields} placeholder="id, email, status" action="Extract root-array fields" onAction={() => runTransform('extract')} />
                    <div className="flex gap-2">
                      <input value={renameFrom} onChange={(event) => setRenameFrom(event.target.value)} placeholder="Current key" className="min-w-0 flex-1 rounded-xl border border-border/45 bg-secondary/35 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      <input value={renameTo} onChange={(event) => setRenameTo(event.target.value)} placeholder="New key" className="min-w-0 flex-1 rounded-xl border border-border/45 bg-secondary/35 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      <TransformButton label="Rename" onClick={() => runTransform('rename')} />
                    </div>
                    <TransformField value={removeKey} onChange={setRemoveKey} placeholder="Key name" action="Remove matching keys" onAction={() => runTransform('remove')} />
                  </div>
                  {transformError && <p className="text-xs text-destructive">{transformError}</p>}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 surface-panel rounded-2xl overflow-hidden flex flex-col transition-colors duration-200">
              <div className="flex-1 overflow-auto p-5">
                {parseError ? (
                  <div className="space-y-4">
                    <div className="text-sm text-destructive font-mono">{errorDisplay}</div>
                    {parseError.line && (
                      <ErrorSnippet input={input} line={parseError.line} column={parseError.column} />
                    )}
                    {isLargePayload ? (
                      <p className="text-xs text-muted-foreground">Repair is paused for large payloads because it needs a full source pass.</p>
                    ) : (
                      <div className="space-y-2">
                        <button onClick={tryRepair} className="rounded-xl bg-secondary px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary/70">
                          Try fixing it
                        </button>
                        {repairFailed ? <p className="text-xs text-muted-foreground">No safe repair was found. The source is unchanged.</p> : null}
                      </div>
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
    <div className="surface-panel rounded-xl px-3 py-3 text-center">
      <p className="text-[10px] text-muted-foreground font-semibold mb-1 uppercase tracking-[0.12em]">{label}</p>
      <p className="text-sm font-semibold text-primary tabular-nums">{value}</p>
    </div>
  );
}

function TransformButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-xl border border-border/50 bg-secondary/45 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {label}
    </button>
  );
}

function TransformField({
  value,
  onChange,
  placeholder,
  action,
  onAction,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-xl border border-border/45 bg-secondary/35 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <TransformButton label={action} onClick={onAction} />
    </div>
  );
}

function formatQueryValue(value: unknown): string {
  const preview = (current: unknown, depth: number): unknown => {
    if (depth >= 3) return '…';
    if (Array.isArray(current)) {
      const items = current.slice(0, 8).map((item) => preview(item, depth + 1));
      return current.length > 8 ? [...items, `… ${current.length - 8} more`] : items;
    }
    if (current !== null && typeof current === 'object') {
      const result: Record<string, unknown> = {};
      let count = 0;
      for (const key in current) {
        if (!Object.hasOwn(current, key)) continue;
        if (count === 8) {
          result['…'] = 'more keys';
          break;
        }
        result[key] = preview((current as Record<string, unknown>)[key], depth + 1);
        count++;
      }
      return result;
    }
    if (typeof current === 'string' && current.length > 400) return `${current.slice(0, 400)}…`;
    return current;
  };

  return JSON.stringify(preview(value, 0), null, 2) ?? 'undefined';
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
