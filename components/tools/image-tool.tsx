'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Download, ImageIcon, X } from 'lucide-react';
import { ToolCard, ToolBar } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';
import { formatBytes } from '@/lib/json-utils';

interface ImageMeta {
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  dataUrl: string;
}

export default function ImageTool() {
  const [image, setImage] = useState<ImageMeta | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [quality, setQuality] = useState(80);
  const [format, setFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [compressed, setCompressed] = useState<{ dataUrl: string; size: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setImage({
          name: file.name,
          type: file.type,
          size: file.size,
          width: img.naturalWidth,
          height: img.naturalHeight,
          dataUrl,
        });
        setCompressed(null);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const runCompress = useCallback(() => {
    if (!image) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL(format, quality / 100);
      const size = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
      setCompressed({ dataUrl, size });
    };
    img.src = image.dataUrl;
  }, [image, format, quality]);

  const savings = useMemo(() => {
    if (!image || !compressed) return null;
    return Math.round(((image.size - compressed.size) / image.size) * 100);
  }, [image, compressed]);

  const clear = () => {
    setImage(null);
    setCompressed(null);
  };

  if (!image) {
    return (
      <ToolCard minHeight="min-h-[420px]" className="p-0">
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
            isDragging ? 'bg-primary/5' : ''
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }}
          />
          <div className="p-4 rounded-2xl bg-secondary">
            <ImageIcon size={28} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Drop an image or click to upload</p>
          <p className="text-xs text-muted-foreground">PNG, JPG, WebP, GIF, SVG</p>
        </div>
      </ToolCard>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ToolCard minHeight="min-h-[420px]" className="p-0">
        <div className="relative flex-1 flex items-center justify-center p-6 bg-[repeating-conic-gradient(var(--secondary)_0%_25%,transparent_0%_50%)] bg-size-[16px_16px]">
          <button
            onClick={clear}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-background/80 hover:bg-secondary text-muted-foreground"
          >
            <X size={14} />
          </button>
          <img src={image.dataUrl} alt={image.name} className="max-w-full max-h-80 rounded-lg object-contain" />
        </div>
        <ToolBar>
          <div className="text-xs text-muted-foreground truncate">
            {image.name} · {image.width}×{image.height} · {formatBytes(image.size)}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-primary hover:underline shrink-0"
          >
            Replace
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }}
          />
        </ToolBar>
      </ToolCard>

      <div className="space-y-4">
        <ToolCard className="p-5 space-y-3">
          <h3 className="text-sm font-semibold">Metadata</h3>
          <MetaRow label="Dimensions" value={`${image.width} × ${image.height}px`} />
          <MetaRow label="Aspect ratio" value={simplifyRatio(image.width, image.height)} />
          <MetaRow label="File size" value={formatBytes(image.size)} />
          <MetaRow label="MIME type" value={image.type} />
        </ToolCard>

        <ToolCard className="p-5 space-y-4">
          <h3 className="text-sm font-semibold">Compress & convert</h3>
          <div className="flex gap-2">
            {(['image/jpeg', 'image/webp', 'image/png'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  format === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}
              >
                {f.replace('image/', '').toUpperCase()}
              </button>
            ))}
          </div>
          {format !== 'image/png' && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Quality</span>
                <span>{quality}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full"
              />
            </div>
          )}
          <button
            onClick={runCompress}
            className="w-full px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
          >
            Convert
          </button>

          {compressed && (
            <div className="pt-2 border-t border-border/20 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  New size: <span className="text-foreground font-medium">{formatBytes(compressed.size)}</span>
                </span>
                {savings !== null && (
                  <span className={savings > 0 ? 'text-accent' : 'text-destructive'}>
                    {savings > 0 ? `-${savings}%` : `+${Math.abs(savings)}%`}
                  </span>
                )}
              </div>
              <a
                href={compressed.dataUrl}
                download={`converted.${format.replace('image/', '')}`}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-medium hover:bg-secondary/70"
              >
                <Download size={14} /> Download
              </a>
            </div>
          )}
        </ToolCard>

        <ToolCard className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Base64 data URI</h3>
            <CopyButton text={image.dataUrl} size={14} />
          </div>
          <p className="text-xs font-mono text-muted-foreground break-all line-clamp-3 max-h-16 overflow-hidden">
            {image.dataUrl}
          </p>
        </ToolCard>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function simplifyRatio(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}
