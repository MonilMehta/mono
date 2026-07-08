'use client';

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, AlertCircle, X, Check, Copy, Code2, MonitorPlay, FileJson, Smartphone, Link } from 'lucide-react';
import { CopyButton } from '@/components/copy-button';
import { formatBytes } from '@/lib/json-utils';

function minifySvg(svg: string): string {
  return svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\/>/g, '/>')
    .trim();
}

function toDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function toBase64Uri(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function svgToJsx(svg: string, componentName: string): string {
  let jsx = svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    .replace(/\bclass=/g, 'className=')
    .replace(/\bstroke-width=/g, 'strokeWidth=')
    .replace(/\bfill-rule=/g, 'fillRule=')
    .replace(/\bclip-rule=/g, 'clipRule=')
    .replace(/\bstroke-linecap=/g, 'strokeLinecap=')
    .replace(/\bstroke-linejoin=/g, 'strokeLinejoin=');

  return `function ${componentName}(props: React.SVGProps<SVGSVGElement>) {\n  return (\n    ${jsx.replace(/<svg/, '<svg {...props}')}\n  );\n}`;
}

function svgToReactNative(svg: string, componentName: string): string {
  const tagsUsed = new Set<string>();
  const tagRegex = /<(\w+)/g;
  let m;
  while ((m = tagRegex.exec(svg)) !== null) tagsUsed.add(m[1]);

  const tagMap: Record<string, string> = {
    svg: 'Svg', path: 'Path', circle: 'Circle', rect: 'Rect', g: 'G',
    line: 'Line', polygon: 'Polygon', polyline: 'Polyline', ellipse: 'Ellipse',
    defs: 'Defs', linearGradient: 'LinearGradient', stop: 'Stop', text: 'Text',
  };

  let body = svg.replace(/<!--[\s\S]*?-->/g, '');
  Object.entries(tagMap).forEach(([html, rn]) => {
    if (tagsUsed.has(html)) {
      body = body.replace(new RegExp(`<${html}(\\s|>|/)`, 'g'), `<${rn}$1`);
      body = body.replace(new RegExp(`</${html}>`, 'g'), `</${rn}>`);
    }
  });
  body = body
    .replace(/\bclass=/g, 'className=')
    .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

  const imports = Array.from(tagsUsed)
    .map((t) => tagMap[t])
    .filter(Boolean);
  const uniqueImports = Array.from(new Set(imports));

  return `import Svg, { ${uniqueImports.filter((i) => i !== 'Svg').join(', ')} } from 'react-native-svg';\n\nfunction ${componentName}(props: SvgProps) {\n  return (\n    ${body.replace(/<Svg/, '<Svg {...props}')}\n  );\n}`;
}

type TabMode = 'minify' | 'jsx' | 'rn' | 'uri';

export default function SvgTool() {
  const [input, setInput] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [tab, setTab] = useState<TabMode>('minify');
  const [copied, setCopied] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isValidSvg = useMemo(() => input.trim().startsWith('<svg') || input.includes('<svg'), [input]);

  const minified = useMemo(() => (isValidSvg ? minifySvg(input) : ''), [input, isValidSvg]);
  const jsxOutput = useMemo(() => (isValidSvg ? svgToJsx(input, 'MyIcon') : ''), [input, isValidSvg]);
  const rnOutput = useMemo(() => (isValidSvg ? svgToReactNative(input, 'MyIcon') : ''), [input, isValidSvg]);
  const dataUri = useMemo(() => (isValidSvg ? toDataUri(minified) : ''), [minified, isValidSvg]);
  const base64Uri = useMemo(() => (isValidSvg ? toBase64Uri(minified) : ''), [minified, isValidSvg]);

  const savings = input.trim() && minified
    ? Math.round(((input.length - minified.length) / input.length) * 100)
    : 0;

  const handleInputChange = (value: string) => {
    setInput(value);
    if (!value.trim()) {
      setShowOutput(false);
      return;
    }
    // We can auto-show output if they paste valid SVG
    if (value.trim().startsWith('<svg') || value.includes('<svg')) {
      setTimeout(() => setShowOutput(true), 100);
    }
  };

  const loadFileContent = (text: string) => {
    setInput(text);
    if (text.trim().startsWith('<svg') || text.includes('<svg')) {
      setShowOutput(true);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.includes('svg') && !file.name.endsWith('.svg')) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) loadFileContent(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const clear = () => {
    setInput('');
    setShowOutput(false);
  };

  const activeOutputText = useMemo(() => {
    if (tab === 'minify') return minified;
    if (tab === 'jsx') return jsxOutput;
    if (tab === 'rn') return rnOutput;
    return `URL Encoded:\n${dataUri}\n\nBase64:\n${base64Uri}`;
  }, [tab, minified, jsxOutput, rnOutput, dataUri, base64Uri]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeOutputText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
                        <span className="text-lg font-bold block mb-1 text-foreground">Drop SVG file</span>
                        <span className="text-sm text-muted-foreground font-medium">Release to view & convert</span>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />

              <div className="flex items-center justify-between gap-4 border-b border-border/50 bg-card px-8 py-5">
                <div>
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">SVG input</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Paste SVG code or drop a .svg file to preview and convert it.</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="hidden sm:inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-secondary/80 active:scale-95"
                >
                  <Upload size={16} />
                  Upload
                </button>
              </div>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={`Paste SVG code or drop a .svg file...\n\n<svg viewBox="0 0 24 24" fill="none">\n  <path d="M12 2L2 22h20L12 2z" />\n</svg>`}
                className="flex-1 bg-background/35 p-8 font-mono text-base resize-none focus:outline-none placeholder-muted-foreground/55 leading-8"
              />

              <div className="border-t border-border/50 bg-card px-8 py-5 flex items-center justify-between gap-5">
                <div className="flex items-center gap-2 min-w-0">
                  {input && !isValidSvg && <AlertCircle size={16} className="text-destructive shrink-0" />}
                  <span
                    className={`text-sm font-medium truncate ${
                      input && !isValidSvg ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    {input && !isValidSvg ? 'No <svg> tag detected' : 'Paste SVG code or upload a file...'}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {input && (
                    <button
                      onClick={clear}
                      className="p-2.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                      title="Clear"
                    >
                      <X size={16} />
                    </button>
                  )}
                  {isValidSvg && (
                    <button
                      onClick={() => setShowOutput(true)}
                      className="ml-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                      Preview & Convert
                    </button>
                  )}
                </div>
              </div>
            </div>
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
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex items-center gap-1 bg-secondary/40 p-1.5 rounded-2xl w-fit overflow-x-auto no-scrollbar shrink-0 border border-border/30">
                {(['minify', 'jsx', 'rn', 'uri'] as const).map((t) => {
                  const icons = {
                    minify: <MonitorPlay size={14} className="mr-2" />,
                    jsx: <FileJson size={14} className="mr-2" />,
                    rn: <Smartphone size={14} className="mr-2" />,
                    uri: <Link size={14} className="mr-2" />
                  };
                  const labels = {
                    minify: 'Minified',
                    jsx: 'React JSX',
                    rn: 'React Native',
                    uri: 'Data URIs'
                  };
                  return (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`flex items-center px-5 py-2.5 text-sm font-semibold rounded-xl capitalize whitespace-nowrap transition-all ${
                        tab === t
                          ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                          : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/60'
                      }`}
                    >
                      {icons[t]} {labels[t]}
                    </button>
                  );
                })}
              </div>
              
              <div className="flex items-center gap-1 shrink-0 bg-secondary/40 p-1.5 rounded-2xl border border-border/30">
                <button
                  onClick={handleCopy}
                  className="p-2.5 rounded-xl hover:bg-background transition-all active:scale-95 text-muted-foreground hover:text-foreground flex items-center gap-2"
                  title="Copy Output"
                >
                  {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
                  <span className="text-xs font-medium pr-1 hidden sm:inline">Copy</span>
                </button>
                <div className="w-px h-5 bg-border/50 mx-1"></div>
                <button
                  onClick={clear}
                  className="p-2.5 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all active:scale-95 flex items-center gap-2"
                  title="Clear & Edit"
                >
                  <X size={14} /> <span className="text-xs font-medium pr-1 hidden sm:inline">Clear</span>
                </button>
              </div>
            </div>

            <div className="flex-1 surface-panel rounded-3xl overflow-hidden flex flex-col xl:flex-row transition-colors duration-200">
              {/* Left Side: SVG Source Editor */}
              <div className="w-full xl:w-1/2 flex flex-col border-b xl:border-b-0 xl:border-r border-border/50">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Code2 size={14} /> Source Code
                  </span>
                  <span className="text-xs text-muted-foreground">{formatBytes(input.length)}</span>
                </div>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1 bg-background/35 p-6 font-mono text-xs leading-relaxed resize-none focus:outline-none text-foreground/80 whitespace-pre"
                  spellCheck={false}
                />
              </div>
              
              {/* Right Side: Preview and Output */}
              <div className="w-full xl:w-1/2 flex flex-col bg-card/50">
                {/* Preview Panel */}
                <div className="h-64 border-b border-border/50 relative bg-[repeating-conic-gradient(var(--secondary)_0%_25%,transparent_0%_50%)] bg-size-[16px_16px] flex items-center justify-center p-8 shrink-0">
                  <div className="absolute top-4 left-6">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-background/80 px-2 py-1 rounded-md">Live Preview</span>
                  </div>
                  {isValidSvg ? (
                    <div
                      className="w-full h-full flex items-center justify-center [&_svg]:max-w-full [&_svg]:max-h-full text-foreground"
                      dangerouslySetInnerHTML={{ __html: minified || input }}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">Invalid SVG</p>
                  )}
                </div>
                
                {/* Output Panel */}
                <div className="flex-1 flex flex-col min-h-[300px]">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {tab === 'minify' && 'Minified Output'}
                      {tab === 'jsx' && 'React Component'}
                      {tab === 'rn' && 'React Native Component'}
                      {tab === 'uri' && 'Data URIs'}
                    </span>
                    {tab === 'minify' && (
                      <span className="text-xs text-accent font-medium">Saved {savings}%</span>
                    )}
                  </div>
                  
                  <div className="flex-1 p-6 overflow-auto bg-background/35">
                    {tab === 'uri' ? (
                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-foreground">URL-encoded</span>
                            <CopyButton text={dataUri} size={14} />
                          </div>
                          <p className="text-xs font-mono break-all text-muted-foreground leading-relaxed bg-secondary/50 p-4 rounded-xl border border-border/30">
                            {dataUri}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-foreground">Base64</span>
                            <CopyButton text={base64Uri} size={14} />
                          </div>
                          <p className="text-xs font-mono break-all text-muted-foreground leading-relaxed bg-secondary/50 p-4 rounded-xl border border-border/30">
                            {base64Uri}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <pre className="text-xs font-mono text-foreground/80 leading-relaxed break-all whitespace-pre-wrap">
                        {activeOutputText}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
