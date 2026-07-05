'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { ToolCard, ToolTextarea, ToolBar } from '@/components/tool-card';
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

export default function SvgTool() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'minify' | 'jsx' | 'rn' | 'uri'>('minify');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValidSvg = useMemo(() => input.trim().startsWith('<svg') || input.includes('<svg'), [input]);

  const minified = useMemo(() => (isValidSvg ? minifySvg(input) : ''), [input, isValidSvg]);
  const jsxOutput = useMemo(() => (isValidSvg ? svgToJsx(input, 'MyIcon') : ''), [input, isValidSvg]);
  const rnOutput = useMemo(() => (isValidSvg ? svgToReactNative(input, 'MyIcon') : ''), [input, isValidSvg]);
  const dataUri = useMemo(() => (isValidSvg ? toDataUri(minified) : ''), [minified, isValidSvg]);
  const base64Uri = useMemo(() => (isValidSvg ? toBase64Uri(minified) : ''), [minified, isValidSvg]);

  const loadFile = useCallback((file: File) => {
    if (!file.type.includes('svg') && !file.name.endsWith('.svg')) {
      setError('Please upload an .svg file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setInput((e.target?.result as string) ?? '');
    reader.readAsText(file);
  }, []);

  const savings = input.trim() && minified
    ? Math.round(((input.length - minified.length) / input.length) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ToolCard minHeight="min-h-[500px]">
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="text-xs font-medium text-muted-foreground">SVG source</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Upload size={12} /> Upload .svg
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }}
          />
        </div>
        <ToolTextarea
          value={input}
          onChange={(v) => { setInput(v); setError(''); }}
          placeholder={`<svg viewBox="0 0 24 24" fill="none">\n  <path d="M12 2L2 22h20L12 2z" />\n</svg>`}
        />
        <ToolBar>
          <span className={`text-xs ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
            {error ? (
              <span className="flex items-center gap-1"><AlertCircle size={12} /> {error}</span>
            ) : input && !isValidSvg ? (
              'No <svg> tag detected'
            ) : (
              `${formatBytes(new Blob([input]).size)}`
            )}
          </span>
        </ToolBar>
      </ToolCard>

      <div className="space-y-4">
        <ToolCard minHeight="min-h-56" className="p-0">
          <div className="flex-1 flex items-center justify-center p-8 bg-[repeating-conic-gradient(var(--secondary)_0%_25%,transparent_0%_50%)] bg-size-[16px_16px]">
            {isValidSvg ? (
              <div
                className="w-32 h-32 [&_svg]:w-full [&_svg]:h-full text-foreground"
                dangerouslySetInnerHTML={{ __html: minified || input }}
              />
            ) : (
              <p className="text-xs text-muted-foreground">Preview appears here</p>
            )}
          </div>
        </ToolCard>

        <ToolCard>
          <div className="flex gap-0 px-4 pt-2 border-b border-border/20 overflow-x-auto">
            {([
              { id: 'minify' as const, label: 'Minified' },
              { id: 'jsx' as const, label: 'React JSX' },
              { id: 'rn' as const, label: 'React Native' },
              { id: 'uri' as const, label: 'Data URI' },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2.5 text-xs font-medium border-b-2 shrink-0 ${
                  tab === t.id ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-4 flex-1 overflow-auto max-h-72">
            {!isValidSvg ? (
              <p className="text-xs text-muted-foreground">Paste an SVG to see output</p>
            ) : tab === 'minify' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-accent">Saved {savings}% ({formatBytes(input.length)} → {formatBytes(minified.length)})</span>
                  <CopyButton text={minified} size={14} />
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground/80">{minified}</pre>
              </div>
            ) : tab === 'jsx' ? (
              <div className="space-y-2">
                <div className="flex justify-end"><CopyButton text={jsxOutput} size={14} /></div>
                <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground/80">{jsxOutput}</pre>
              </div>
            ) : tab === 'rn' ? (
              <div className="space-y-2">
                <div className="flex justify-end"><CopyButton text={rnOutput} size={14} /></div>
                <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground/80">{rnOutput}</pre>
                <p className="text-[10px] text-muted-foreground">Requires <code>react-native-svg</code></p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground uppercase">URL-encoded</span>
                    <CopyButton text={dataUri} size={12} />
                  </div>
                  <p className="text-xs font-mono break-all text-foreground/70">{dataUri}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground uppercase">Base64</span>
                    <CopyButton text={base64Uri} size={12} />
                  </div>
                  <p className="text-xs font-mono break-all text-foreground/70">{base64Uri}</p>
                </div>
              </div>
            )}
          </div>
        </ToolCard>
      </div>
    </div>
  );
}
