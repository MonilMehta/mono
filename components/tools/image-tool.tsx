'use client';

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, ImageIcon, X, Upload, Check, Copy, Palette, Scaling, Settings2, Lock, Unlock, Image as ImageIcon2 } from 'lucide-react';
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
  originalFile: File;
}

type TabMode = 'compress' | 'resize' | 'palette';

export default function ImageTool() {
  const [image, setImage] = useState<ImageMeta | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<TabMode>('compress');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress State
  const [quality, setQuality] = useState(80);
  const [format, setFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [compressed, setCompressed] = useState<{ dataUrl: string; size: number } | null>(null);

  // Resize State
  const [resizeW, setResizeW] = useState(0);
  const [resizeH, setResizeH] = useState(0);
  const [lockAspect, setLockAspect] = useState(true);
  const [resizedImage, setResizedImage] = useState<{ dataUrl: string; size: number; w: number; h: number } | null>(null);

  // Palette State
  const [palette, setPalette] = useState<string[]>([]);
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

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
          originalFile: file,
        });
        setResizeW(img.naturalWidth);
        setResizeH(img.naturalHeight);
        setCompressed(null);
        setResizedImage(null);
        extractColors(img);
        setShowOutput(true);
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

  const clear = () => {
    setImage(null);
    setCompressed(null);
    setResizedImage(null);
    setPalette([]);
    setShowOutput(false);
  };

  // --- Compress Logic ---
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

  const compressSavings = useMemo(() => {
    if (!image || !compressed) return null;
    return Math.round(((image.size - compressed.size) / image.size) * 100);
  }, [image, compressed]);

  // --- Resize Logic ---
  const handleWidthChange = (val: string) => {
    const w = parseInt(val) || 0;
    setResizeW(w);
    if (lockAspect && image) {
      setResizeH(Math.round(w * (image.height / image.width)));
    }
  };

  const handleHeightChange = (val: string) => {
    const h = parseInt(val) || 0;
    setResizeH(h);
    if (lockAspect && image) {
      setResizeW(Math.round(h * (image.width / image.height)));
    }
  };

  const applyPreset = (w: number, h: number) => {
    setResizeW(w);
    setResizeH(h);
    setLockAspect(false);
  };

  const runResize = useCallback(() => {
    if (!image || resizeW === 0 || resizeH === 0) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = resizeW;
      canvas.height = resizeH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, resizeW, resizeH);
      // Keep format as PNG for resized images to avoid compression artifacts, unless it's a jpeg and they want smaller size
      const outFormat = image.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      const dataUrl = canvas.toDataURL(outFormat, 0.9);
      const size = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
      setResizedImage({ dataUrl, size, w: resizeW, h: resizeH });
    };
    img.src = image.dataUrl;
  }, [image, resizeW, resizeH]);

  // --- Palette Logic ---
  const extractColors = (img: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Scale down for faster processing
    const sampleSize = 50;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    
    const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
    const colorCounts: Record<string, number> = {};
    
    for (let i = 0; i < data.length; i += 4) {
      const r = Math.floor(data[i] / 24) * 24;
      const g = Math.floor(data[i + 1] / 24) * 24;
      const b = Math.floor(data[i + 2] / 24) * 24;
      const hex = rgbToHex(r, g, b);
      colorCounts[hex] = (colorCounts[hex] || 0) + 1;
    }
    
    const sorted = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
    const result: string[] = [];
    
    for (const [hex] of sorted) {
      if (result.length >= 6) break;
      let tooClose = false;
      for (const rHex of result) {
        if (colorDistance(hex, rHex) < 40) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) result.push(hex);
    }
    
    // Pad if we need to
    let i = 0;
    while (result.length < 6 && i < sorted.length) {
      if (!result.includes(sorted[i][0])) result.push(sorted[i][0]);
      i++;
    }
    setPalette(result);
  };

  const copyColor = (color: string, format: 'hex' | 'rgb' | 'hsl') => {
    let text = color;
    if (format === 'rgb') {
      const rgb = hexToRgb(color);
      if (rgb) text = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    } else if (format === 'hsl') {
      text = hexToHsl(color);
    }
    
    navigator.clipboard.writeText(text).then(() => {
      setCopiedColor(text);
      setTimeout(() => setCopiedColor(null), 2000);
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
            className="flex flex-col h-full min-h-96 lg:min-h-[640px]"
          >
            <div
              className={`surface-panel relative rounded-3xl overflow-hidden flex flex-col h-full flex-1 transition-colors duration-200 ${
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
                        <span className="text-sm text-muted-foreground font-medium">Release to inspect, resize, and compress</span>
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

              <div className="flex items-center justify-between gap-4 border-b border-border/50 bg-card px-8 py-5">
                <div>
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">Image input</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Drop an image to compress, resize, or extract its color palette.</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="hidden sm:inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-secondary/80 active:scale-95"
                >
                  <Upload size={16} />
                  Upload Image
                </button>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center bg-background/35 p-8 text-center cursor-pointer hover:bg-background/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <div className="w-16 h-16 rounded-full bg-secondary/80 flex items-center justify-center mb-4 text-muted-foreground">
                  <ImageIcon2 size={28} />
                </div>
                <p className="font-medium text-foreground mb-1">Click or drag and drop to upload</p>
                <p className="text-sm text-muted-foreground">Supports PNG, JPG, WebP, GIF, SVG</p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="output"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}
            className="flex flex-col h-full min-h-96 lg:min-h-[640px] gap-6"
          >
            {image && (
              <>
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="flex items-center gap-1 bg-secondary/40 p-1.5 rounded-2xl w-fit overflow-x-auto no-scrollbar shrink-0 border border-border/30">
                    {(['compress', 'resize', 'palette'] as const).map((tab) => {
                      const icons = {
                        compress: <Settings2 size={14} className="mr-2" />,
                        resize: <Scaling size={14} className="mr-2" />,
                        palette: <Palette size={14} className="mr-2" />
                      };
                      return (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`flex items-center px-5 py-2.5 text-sm font-semibold rounded-xl capitalize whitespace-nowrap transition-all ${
                            activeTab === tab
                              ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                              : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/60'
                          }`}
                        >
                          {icons[tab]} {tab}
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0 bg-secondary/40 p-1.5 rounded-2xl border border-border/30">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 rounded-xl hover:bg-background transition-all active:scale-95 text-muted-foreground hover:text-foreground flex items-center gap-2"
                      title="Replace Image"
                    >
                      <Upload size={14} /> <span className="text-xs font-medium pr-1">Replace</span>
                    </button>
                    <div className="w-px h-5 bg-border/50 mx-1"></div>
                    <button
                      onClick={clear}
                      className="p-2.5 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all active:scale-95 flex items-center gap-2"
                      title="Clear"
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

                <div className="flex-1 surface-panel rounded-3xl overflow-hidden flex flex-col xl:flex-row transition-colors duration-200">
                  {/* Left side: Image Preview */}
                  <div className="flex-1 flex flex-col border-b xl:border-b-0 xl:border-r border-border/50 min-h-[300px]">
                     <div className="flex-1 relative bg-[repeating-conic-gradient(var(--secondary)_0%_25%,transparent_0%_50%)] bg-size-[20px_20px] flex items-center justify-center p-8">
                        <img 
                          src={
                            activeTab === 'compress' && compressed ? compressed.dataUrl : 
                            activeTab === 'resize' && resizedImage ? resizedImage.dataUrl : 
                            image.dataUrl
                          } 
                          alt={image.name} 
                          className="max-w-full max-h-full object-contain drop-shadow-md rounded-md" 
                        />
                     </div>
                     <div className="bg-card px-6 py-4 border-t border-border/50 flex justify-between items-center text-xs text-muted-foreground font-mono">
                        <span>{image.name}</span>
                        <div className="flex gap-4">
                          <span>{image.width} × {image.height}px</span>
                          <span>{formatBytes(image.size)}</span>
                          <span>{image.type.split('/')[1]?.toUpperCase()}</span>
                        </div>
                     </div>
                  </div>
                  
                  {/* Right side: Tools */}
                  <div className="w-full xl:w-[400px] flex flex-col bg-card/50 overflow-y-auto">
                    <div className="p-6 space-y-6">
                      
                      {activeTab === 'compress' && (
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-sm font-semibold mb-3">Format</h3>
                            <div className="flex gap-2">
                              {(['image/jpeg', 'image/webp', 'image/png'] as const).map((f) => (
                                <button
                                  key={f}
                                  onClick={() => setFormat(f)}
                                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                                    format === f ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  {f.replace('image/', '').toUpperCase()}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {format !== 'image/png' && (
                            <div>
                              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                                <span className="font-medium text-foreground">Quality</span>
                                <span>{quality}%</span>
                              </div>
                              <input
                                type="range" min={10} max={100} value={quality}
                                onChange={(e) => setQuality(Number(e.target.value))}
                                className="w-full accent-primary"
                              />
                            </div>
                          )}

                          <button
                            onClick={runCompress}
                            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity active:scale-[0.98]"
                          >
                            Compress Image
                          </button>

                          {compressed && (
                            <div className="pt-4 border-t border-border/50 space-y-4">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground font-medium">New size</span>
                                <span className="font-semibold text-foreground">{formatBytes(compressed.size)}</span>
                              </div>
                              {compressSavings !== null && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Saved</span>
                                  <span className={`font-semibold ${compressSavings > 0 ? 'text-accent' : 'text-destructive'}`}>
                                    {compressSavings > 0 ? `-${compressSavings}%` : `+${Math.abs(compressSavings)}%`}
                                  </span>
                                </div>
                              )}
                              
                              <a
                                href={compressed.dataUrl}
                                download={`compressed_${image.name.split('.')[0]}.${format.split('/')[1]}`}
                                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/70 transition-colors"
                              >
                                <Download size={16} /> Download {formatBytes(compressed.size)}
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'resize' && (
                        <div className="space-y-6">
                           <div>
                             <h3 className="text-sm font-semibold mb-3">Dimensions</h3>
                             <div className="flex items-center gap-3">
                               <div className="flex-1 relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">W</span>
                                  <input type="number" value={resizeW || ''} onChange={(e) => handleWidthChange(e.target.value)} className="w-full pl-8 pr-3 py-2.5 bg-secondary/50 border border-border/50 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
                               </div>
                               <button onClick={() => setLockAspect(!lockAspect)} className="p-2.5 rounded-xl hover:bg-secondary text-muted-foreground transition-colors" title={lockAspect ? "Unlock aspect ratio" : "Lock aspect ratio"}>
                                  {lockAspect ? <Lock size={16} /> : <Unlock size={16} />}
                               </button>
                               <div className="flex-1 relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">H</span>
                                  <input type="number" value={resizeH || ''} onChange={(e) => handleHeightChange(e.target.value)} className="w-full pl-8 pr-3 py-2.5 bg-secondary/50 border border-border/50 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
                               </div>
                             </div>
                           </div>

                           <div>
                             <h3 className="text-sm font-semibold mb-3">Presets</h3>
                             <div className="grid grid-cols-2 gap-2">
                               <PresetBtn label="OG Image" w={1200} h={630} onClick={() => applyPreset(1200, 630)} />
                               <PresetBtn label="Square (IG)" w={1080} h={1080} onClick={() => applyPreset(1080, 1080)} />
                               <PresetBtn label="Story" w={1080} h={1920} onClick={() => applyPreset(1080, 1920)} />
                               <PresetBtn label="Dribbble" w={1600} h={1200} onClick={() => applyPreset(1600, 1200)} />
                               <PresetBtn label="HD (1080p)" w={1920} h={1080} onClick={() => applyPreset(1920, 1080)} />
                               <PresetBtn label="4K UHD" w={3840} h={2160} onClick={() => applyPreset(3840, 2160)} />
                             </div>
                           </div>

                           <button
                            onClick={runResize}
                            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity active:scale-[0.98]"
                           >
                            Apply Resize
                           </button>

                           {resizedImage && (
                              <div className="pt-4 border-t border-border/50 space-y-4">
                                <a
                                  href={resizedImage.dataUrl}
                                  download={`resized_${resizedImage.w}x${resizedImage.h}_${image.name}`}
                                  className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/70 transition-colors"
                                >
                                  <Download size={16} /> Download ({resizedImage.w}×{resizedImage.h})
                                </a>
                              </div>
                           )}
                        </div>
                      )}

                      {activeTab === 'palette' && (
                        <div className="space-y-6">
                           <div>
                             <h3 className="text-sm font-semibold mb-1">Dominant Colors</h3>
                             <p className="text-xs text-muted-foreground mb-4">Click a swatch to copy its color code.</p>
                             
                             <div className="grid grid-cols-3 gap-3">
                                {palette.map((hex, i) => (
                                  <div key={i} className="space-y-2">
                                     <div 
                                       className="w-full aspect-square rounded-2xl border border-border/50 shadow-sm"
                                       style={{ backgroundColor: hex }}
                                     />
                                     <div className="flex flex-col gap-1">
                                       <ColorCopyBtn color={hex} format="hex" currentCopied={copiedColor} onClick={copyColor} />
                                       <ColorCopyBtn color={hex} format="rgb" currentCopied={copiedColor} onClick={copyColor} />
                                       <ColorCopyBtn color={hex} format="hsl" currentCopied={copiedColor} onClick={copyColor} />
                                     </div>
                                  </div>
                                ))}
                             </div>
                           </div>
                        </div>
                      )}

                      {/* Always show Base64 copy below tools if we have space or just keep it simple. Let's keep it in a small box at the bottom */}
                      <div className="mt-8 pt-6 border-t border-border/50">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Base64 Data URI</h3>
                          <CopyButton text={
                            activeTab === 'compress' && compressed ? compressed.dataUrl : 
                            activeTab === 'resize' && resizedImage ? resizedImage.dataUrl : 
                            image.dataUrl
                          } size={14} />
                        </div>
                        <div className="bg-secondary/40 border border-border/30 rounded-xl p-3 max-h-24 overflow-y-auto font-mono text-[10px] text-muted-foreground leading-relaxed break-all no-scrollbar">
                           {activeTab === 'compress' && compressed ? compressed.dataUrl : 
                            activeTab === 'resize' && resizedImage ? resizedImage.dataUrl : 
                            image.dataUrl}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PresetBtn({ label, w, h, onClick }: { label: string, w: number, h: number, onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-start p-3 rounded-xl bg-secondary/50 hover:bg-secondary border border-border/30 hover:border-border/60 transition-colors text-left group">
       <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{label}</span>
       <span className="text-[10px] text-muted-foreground font-mono mt-0.5">{w}×{h}</span>
    </button>
  );
}

function ColorCopyBtn({ color, format, currentCopied, onClick }: { color: string, format: 'hex'|'rgb'|'hsl', currentCopied: string|null, onClick: (c:string, f: 'hex'|'rgb'|'hsl')=>void }) {
  let display = color;
  if (format === 'rgb') {
    const rgb = hexToRgb(color);
    display = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '';
  } else if (format === 'hsl') {
    const hsl = hexToHsl(color);
    // remove 'hsl()' for display
    display = hsl.replace('hsl(', '').replace(')', '');
  }

  const isCopied = currentCopied && currentCopied.includes(display.split(',')[0] || display); // Rough check

  return (
    <button 
      onClick={() => onClick(color, format)}
      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-secondary text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors group"
    >
      <span className="uppercase opacity-50 font-sans font-bold text-[9px] w-5">{format}</span>
      <span className="truncate mx-1">{display}</span>
      <Copy size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// Color Utils
function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function hexToHsl(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '';
  let { r, g, b } = rgb;
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function colorDistance(hex1: string, hex2: string) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  if (!c1 || !c2) return 0;
  return Math.sqrt(Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2));
}
