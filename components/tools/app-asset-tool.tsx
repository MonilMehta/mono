'use client';

import { useCallback, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Image as ImageIcon2, Download } from 'lucide-react';
import { CopyButton } from '@/components/copy-button';

interface Asset {
  name: string;
  w: number;
  h: number;
  dataUrl: string;
  type: string;
}

export default function AppAssetTool() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setOriginalImage(dataUrl);
        generateAssets(img, backgroundColor);
        setShowOutput(true);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [backgroundColor]);

  const generateAssets = (img: HTMLImageElement, bgHex: string) => {
    const generated: Asset[] = [];
    
    const render = (w: number, h: number, name: string, type: 'contain' | 'cover' | 'fill' = 'contain') => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill background
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, w, h);

      // Draw image
      let drawW = w;
      let drawH = h;
      let dx = 0;
      let dy = 0;

      if (type === 'contain') {
        const ratio = Math.min(w / img.naturalWidth, h / img.naturalHeight);
        drawW = img.naturalWidth * ratio * 0.8; // 80% to give some padding for splash
        drawH = img.naturalHeight * ratio * 0.8;
        dx = (w - drawW) / 2;
        dy = (h - drawH) / 2;
      } else if (type === 'cover') {
        const ratio = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        drawW = img.naturalWidth * ratio;
        drawH = img.naturalHeight * ratio;
        dx = (w - drawW) / 2;
        dy = (h - drawH) / 2;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, dx, dy, drawW, drawH);

      generated.push({
        name,
        w,
        h,
        dataUrl: canvas.toDataURL('image/png'),
        type: name.includes('splash') ? 'Splash Screen' : 'Icon',
      });
    };

    // Expo Standard Sizes
    render(1024, 1024, 'icon.png', 'cover');
    render(1080, 1080, 'adaptive-icon.png', 'contain');
    render(1242, 2436, 'splash.png', 'contain');
    render(256, 256, 'favicon.png', 'cover');

    setAssets(generated);
  };

  const regenerate = () => {
    if (!originalImage) return;
    const img = new Image();
    img.onload = () => generateAssets(img, backgroundColor);
    img.src = originalImage;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const clear = () => {
    setOriginalImage(null);
    setAssets([]);
    setShowOutput(false);
  };

  const appJsonSnippet = useMemo(() => {
    return JSON.stringify({
      expo: {
        icon: "./assets/icon.png",
        splash: {
          image: "./assets/splash.png",
          resizeMode: "contain",
          backgroundColor: backgroundColor
        },
        android: {
          adaptiveIcon: {
            foregroundImage: "./assets/adaptive-icon.png",
            backgroundColor: backgroundColor
          }
        },
        web: {
          favicon: "./assets/favicon.png"
        }
      }
    }, null, 2);
  }, [backgroundColor]);

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!showOutput ? (
          <motion.div 
            key="input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col h-full min-h-80 lg:min-h-[560px]"
          >
            <div
              className={`surface-panel relative rounded-2xl overflow-hidden flex flex-col h-full flex-1 transition-colors duration-200 ${
                isDragging ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <AnimatePresence>
                {isDragging && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 bg-background/90 flex items-center justify-center pointer-events-none"
                  >
                    <div className="absolute inset-6 border-2 border-dashed border-primary/50 rounded-2xl animate-pulse"></div>
                    <motion.div 
                      animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      className="flex flex-col items-center gap-4 text-primary"
                    >
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <Upload size={36} />
                      </div>
                      <div className="text-center">
                        <span className="text-lg font-bold block mb-1 text-foreground">Drop Image</span>
                        <span className="text-sm text-muted-foreground font-medium">Release to generate app assets</span>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadFile(f);
                  e.target.value = '';
                }}
              />

              <div className="flex items-center justify-between gap-4 border-b border-border/50 bg-card px-5 py-3.5">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">App Asset Generator</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Upload a logo to generate Expo/React Native icons & splash screens</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-secondary/80 active:scale-95"
                >
                  <Upload size={16} />
                  Upload Logo
                </button>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center bg-background/35 p-5 text-center cursor-pointer hover:bg-background/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <div className="w-16 h-16 rounded-full bg-secondary/80 flex items-center justify-center mb-4 text-muted-foreground">
                  <ImageIcon2 size={28} />
                </div>
                <p className="font-medium text-foreground mb-1">Click or drag and drop your app logo</p>
                <p className="text-sm text-muted-foreground">Preferably a high-resolution PNG with transparency</p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="output"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}
            className="flex flex-col h-full min-h-80 lg:min-h-[560px] gap-6"
          >
            <div className="flex flex-col xl:flex-row xl:items-center justify-end gap-4">
              <div className="flex items-center gap-1 shrink-0 bg-secondary/40 p-1.5 rounded-2xl border border-border/30">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl hover:bg-background transition-all active:scale-95 text-muted-foreground hover:text-foreground flex items-center gap-2"
                >
                  <Upload size={14} /> <span className="text-xs font-medium pr-1">Replace</span>
                </button>
                <div className="w-px h-5 bg-border/50 mx-1"></div>
                <button
                  onClick={clear}
                  className="p-2.5 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all active:scale-95 flex items-center gap-2"
                >
                  <X size={14} /> <span className="text-xs font-medium pr-1 hidden sm:inline">Clear</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Configuration Panel */}
              <div className="surface-panel rounded-2xl p-6 h-fit">
                <h3 className="text-sm font-semibold mb-4">Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Background Color</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={backgroundColor} 
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                      />
                      <input 
                        type="text" 
                        value={backgroundColor} 
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="flex-1 bg-secondary border border-border/50 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    onClick={regenerate}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity active:scale-[0.98]"
                  >
                    Regenerate Assets
                  </button>
                </div>

                <div className="mt-8">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-semibold">app.json snippet</h3>
                    <CopyButton text={appJsonSnippet} size={14} />
                  </div>
                  <pre className="bg-secondary/40 border border-border/30 rounded-xl p-4 font-mono text-xs text-muted-foreground overflow-x-auto max-h-64">
                    {appJsonSnippet}
                  </pre>
                </div>
              </div>

              {/* Assets Grid */}
              <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                {assets.map((asset) => (
                  <div key={asset.name} className="surface-panel rounded-2xl p-4 flex flex-col">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{asset.name}</h4>
                        <span className="text-xs text-muted-foreground">{asset.w} × {asset.h}</span>
                      </div>
                      <a
                        href={asset.dataUrl}
                        download={asset.name}
                        className="p-1.5 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                        title="Download"
                      >
                        <Download size={14} />
                      </a>
                    </div>
                    <div className="flex-1 bg-[repeating-conic-gradient(var(--secondary)_0%_25%,transparent_0%_50%)] bg-size-[16px_16px] rounded-xl flex items-center justify-center p-4 overflow-hidden border border-border/30 min-h-[160px]">
                      <img src={asset.dataUrl} alt={asset.name} className="max-w-full max-h-full object-contain rounded-md shadow-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
