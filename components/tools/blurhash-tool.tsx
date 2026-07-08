'use client';

import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Image as ImageIcon2 } from 'lucide-react';
import { encode } from 'blurhash';
import { rgbaToThumbHash } from 'thumbhash';
import { CopyButton } from '@/components/copy-button';

interface ImageMeta {
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

export default function BlurhashTool() {
  const [image, setImage] = useState<ImageMeta | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [blurhash, setBlurhash] = useState<string>('');
  const [thumbhash, setThumbhash] = useState<string>('');

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setImage({
          name: file.name,
          dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        generateHashes(img);
        setShowOutput(true);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  const generateHashes = (img: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use a small size for processing
    const maxDim = 100;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round(h * (maxDim / w));
        w = maxDim;
      } else {
        w = Math.round(w * (maxDim / h));
        h = maxDim;
      }
    }

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    
    const imageData = ctx.getImageData(0, 0, w, h);
    
    // Generate BlurHash
    const bh = encode(imageData.data, w, h, 4, 3);
    setBlurhash(bh);

    // Generate ThumbHash
    const th = rgbaToThumbHash(w, h, imageData.data);
    
    // Convert Uint8Array to base64
    let binary = '';
    for (let i = 0; i < th.length; i++) {
      binary += String.fromCharCode(th[i]);
    }
    setThumbhash(btoa(binary));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const clear = () => {
    setImage(null);
    setBlurhash('');
    setThumbhash('');
    setShowOutput(false);
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
                        <span className="text-sm text-muted-foreground font-medium">Release to generate hashes</span>
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
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">Image to Hash</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Drop an image to generate BlurHash and ThumbHash</p>
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

                <div className="flex-1 surface-panel rounded-3xl overflow-hidden flex flex-col xl:flex-row transition-colors duration-200">
                  <div className="flex-1 flex flex-col border-b xl:border-b-0 xl:border-r border-border/50 min-h-[300px]">
                     <div className="flex-1 relative bg-[repeating-conic-gradient(var(--secondary)_0%_25%,transparent_0%_50%)] bg-size-[20px_20px] flex items-center justify-center p-8">
                        <img 
                          src={image.dataUrl} 
                          alt={image.name} 
                          className="max-w-full max-h-full object-contain drop-shadow-md rounded-md" 
                        />
                     </div>
                     <div className="bg-card px-6 py-4 border-t border-border/50 flex justify-between items-center text-xs text-muted-foreground font-mono">
                        <span>{image.name}</span>
                        <span>{image.width} × {image.height}px</span>
                     </div>
                  </div>
                  
                  <div className="w-full xl:w-[500px] flex flex-col bg-card/50 overflow-y-auto">
                    <div className="p-6 space-y-6">
                      
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-sm font-semibold">BlurHash</h3>
                          <CopyButton text={blurhash} size={14} />
                        </div>
                        <div className="bg-secondary/40 border border-border/30 rounded-xl p-3 font-mono text-sm text-foreground break-all">
                          {blurhash}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-sm font-semibold">ThumbHash (Base64)</h3>
                          <CopyButton text={thumbhash} size={14} />
                        </div>
                        <div className="bg-secondary/40 border border-border/30 rounded-xl p-3 font-mono text-sm text-foreground break-all">
                          {thumbhash}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-sm font-semibold">React Native / Expo Snippet</h3>
                          <CopyButton text={`import { Image } from 'expo-image';

<Image
  style={{ width: '100%', height: '100%' }}
  source="https://example.com/image.jpg"
  placeholder={{ blurhash: '${blurhash}' }}
  contentFit="cover"
  transition={1000}
/>`} size={14} />
                        </div>
                        <pre className="bg-secondary/40 border border-border/30 rounded-xl p-4 font-mono text-xs text-muted-foreground overflow-x-auto">
{`import { Image } from 'expo-image';

<Image
  style={{ width: '100%', height: '100%' }}
  source="https://example.com/image.jpg"
  placeholder={{ blurhash: '${blurhash}' }}
  contentFit="cover"
  transition={1000}
/>`}
                        </pre>
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
