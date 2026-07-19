'use client';

import { animate, AnimatePresence, motion, type PanInfo, useMotionValue } from 'framer-motion';
import { ArrowUp, Braces, Command, FileText, ImagePlus, Paperclip, PenTool, Terminal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ArtifactKind = 'note' | 'image' | 'json' | 'request' | 'svg';

type ArtifactRecord = {
  id: string;
  text: string;
  createdAt: number;
  image?: Blob;
  kind?: ArtifactKind;
};

type Artifact = ArtifactRecord & { imageUrl?: string };

type StudioSample = {
  id: string;
  kind: ArtifactKind;
  label: string;
  meta: string;
  text?: string;
  image?: string;
  imageAlt?: string;
};

type DragPreview = {
  id: string;
  kind: ArtifactKind;
  label: string;
  meta: string;
  text?: string;
  image?: string;
  imageAlt?: string;
  angle: number;
};

const DB_NAME = 'mono-home';
const STORE_NAME = 'todos';
const SETTLE_ANGLES = [-1.2, 0.8, -0.45, 1.05, -0.7, 0.4];
const HANG_OFFSETS = [2, 8, 4, 10, 6, 0];

const STUDIO_SAMPLES: StudioSample[] = [
  {
    id: 'sample-json',
    kind: 'json',
    label: 'JSON',
    meta: '3.2 KB',
    text: '{\n  "id": "usr_01H7X",\n  "name": "Monil Mehta",\n  "role": "Developer",\n  "status": "active"\n}',
  },
  {
    id: 'sample-image',
    kind: 'image',
    label: 'Image',
    meta: 'JPG',
    image: '/studio-assets/landscape.jpg',
    imageAlt: 'A grainy landscape of clouds and colorful rolling hills',
  },
  {
    id: 'sample-request',
    kind: 'request',
    label: 'cURL',
    meta: '1.1 KB',
    text: "curl -X POST \\\nhttps://api.example.com/v1/auth \\\n-H 'Content-Type: application/json' \\\n-d '{\n  \"email\": \"hello@mono.dev\",\n  \"password\": \"••••••••\"\n}'",
  },
  {
    id: 'sample-study',
    kind: 'svg',
    label: 'Interface study',
    meta: 'Draft 04',
    image: '/studio-assets/interface-study.jpg',
    imageAlt: 'Architectural drawing of a responsive browser interface',
  },
  {
    id: 'sample-material',
    kind: 'image',
    label: 'Material study',
    meta: 'Ink proof',
    image: '/studio-assets/material-study.jpg',
    imageAlt: 'Risograph color-token print proof',
  },
];

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readArtifacts(): Promise<ArtifactRecord[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as ArtifactRecord[]);
    request.onerror = () => reject(request.error);
  });
}

async function saveArtifacts(artifacts: ArtifactRecord[]) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    artifacts.forEach((artifact) => store.put(artifact));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function detectKind(text: string, hasImage: boolean): ArtifactKind {
  if (hasImage) return 'image';
  const value = text.trim();
  if (/^curl\s/i.test(value)) return 'request';
  if (/^<svg[\s>]/i.test(value)) return 'svg';
  if (/^[{[]/.test(value)) {
    try {
      JSON.parse(value);
      return 'json';
    } catch {
      return 'note';
    }
  }
  return 'note';
}

function artifactFromRecord(record: ArtifactRecord): Artifact {
  return {
    ...record,
    kind: record.kind ?? detectKind(record.text, Boolean(record.image)),
    imageUrl: record.image ? URL.createObjectURL(record.image) : undefined,
  };
}

function formatArtifactText(artifact: Artifact) {
  if (artifact.kind !== 'json') return artifact.text;
  try {
    return JSON.stringify(JSON.parse(artifact.text), null, 2);
  } catch {
    return artifact.text;
  }
}

function KindMark({ kind }: { kind: ArtifactKind }) {
  if (kind === 'json') return <Braces size={12} />;
  if (kind === 'request') return <Terminal size={12} />;
  if (kind === 'svg') return <PenTool size={12} />;
  if (kind === 'image') return <ImagePlus size={12} />;
  return <FileText size={12} />;
}

function StudioCard({
  kind,
  label,
  meta,
  text,
  image,
  imageAlt,
}: {
  kind: ArtifactKind;
  label: string;
  meta: string;
  text?: string;
  image?: string;
  imageAlt?: string;
}) {
  return (
    <article className={`studio-card studio-card-${kind} group relative flex h-[306px] flex-col`}>
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-foreground/80">
          <span className="studio-card-dot" />
          <KindMark kind={kind} />
          <span className="sr-only">{label}</span>
        </div>
        <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.08em] text-foreground/65">{meta}</span>
      </div>

      {image ? (
        <figure className="flex min-h-0 flex-1 flex-col p-3">
          <img draggable={false} src={image} alt={imageAlt ?? label} className="min-h-0 flex-1 border border-foreground/10 bg-[#e9e2d6] object-cover" />
          <figcaption className="sr-only">{imageAlt ?? label}</figcaption>
        </figure>
      ) : kind === 'note' ? (
        <p className="px-5 py-6 font-serif text-[21px] leading-[1.38] tracking-[-0.018em] text-foreground">{text}</p>
      ) : (
        <pre className="min-h-0 flex-1 overflow-hidden whitespace-pre-wrap break-words px-4 py-5 font-mono text-[9px] leading-[1.75] text-foreground/85">{text}</pre>
      )}
    </article>
  );
}

export function HomeDashboard() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string>();
  const [isReady, setIsReady] = useState(false);
  const [discardingId, setDiscardingId] = useState<string>();
  const [draggingId, setDraggingId] = useState<string>();
  const [dragAtShredder, setDragAtShredder] = useState(false);
  const [dragPreview, setDragPreview] = useState<DragPreview>();
  const [hiddenSampleIds, setHiddenSampleIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shredderRef = useRef<HTMLDivElement>(null);
  const dragProxyRefs = useRef(new Map<string, HTMLDivElement>());
  const dragOriginRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 125, y: 153 });
  const previewX = useMotionValue(0);
  const previewY = useMotionValue(0);
  const imageUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    readArtifacts()
      .then((records) => {
        const restored = records.sort((a, b) => b.createdAt - a.createdAt).map(artifactFromRecord);
        imageUrlsRef.current = restored.flatMap((artifact) => (artifact.imageUrl ? [artifact.imageUrl] : []));
        setArtifacts(restored);
      })
      .catch(() => undefined)
      .finally(() => setIsReady(true));

    return () => imageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (!isReady) return;
    void saveArtifacts(artifacts.map(({ imageUrl: _imageUrl, ...artifact }) => artifact)).catch(() => undefined);
  }, [artifacts, isReady]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const image = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith('image/'));
      if (!image) return;
      event.preventDefault();
      setAttachment(image);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  function setAttachment(file: File) {
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
    setPendingImage(file);
    setPendingImageUrl(URL.createObjectURL(file));
  }

  function clearAttachment() {
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
    setPendingImage(null);
    setPendingImageUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function addArtifact() {
    const text = draft.trim();
    if (!text && !pendingImage) return;

    const imageUrl = pendingImage ? URL.createObjectURL(pendingImage) : undefined;
    if (imageUrl) imageUrlsRef.current.push(imageUrl);
    setArtifacts((current) => [
      {
        id: crypto.randomUUID(),
        text: text || 'Untitled reference',
        createdAt: Date.now(),
        image: pendingImage ?? undefined,
        imageUrl,
        kind: detectKind(text, Boolean(pendingImage)),
      },
      ...current,
    ]);
    setDraft('');
    setPendingImage(null);
    setPendingImageUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeArtifact(id: string, isUserArtifact = true) {
    if (!isUserArtifact) {
      setHiddenSampleIds((current) => current.includes(id) ? current : [...current, id]);
      setDiscardingId(undefined);
      setDraggingId(undefined);
      setDragAtShredder(false);
      setDragPreview(undefined);
      return;
    }

    setArtifacts((current) => {
      const removed = current.find((artifact) => artifact.id === id);
      if (removed?.imageUrl) {
        URL.revokeObjectURL(removed.imageUrl);
        imageUrlsRef.current = imageUrlsRef.current.filter((url) => url !== removed.imageUrl);
      }
      return current.filter((artifact) => artifact.id !== id);
    });
    setDiscardingId(undefined);
    setDraggingId(undefined);
    setDragAtShredder(false);
    setDragPreview(undefined);
  }

  function getPreviewPosition(point: PanInfo['point']) {
    return {
      x: Math.min(Math.max(point.x - dragOffsetRef.current.x, 8), window.innerWidth - 258),
      y: Math.min(Math.max(point.y - dragOffsetRef.current.y, 8), window.innerHeight - 314),
    };
  }

  function isNearShredder(point: PanInfo['point']) {
    const bounds = shredderRef.current?.getBoundingClientRect();
    return Boolean(
      bounds &&
      point.x >= bounds.left - 92 &&
      point.x <= bounds.right + 64 &&
      point.y >= bounds.top - 132 &&
      point.y <= bounds.bottom + 32
    );
  }

  function updateDrag(id: string, info: PanInfo) {
    const position = getPreviewPosition(info.point);
    previewX.set(position.x);
    previewY.set(position.y);
    const near = isNearShredder(info.point);
    setDragAtShredder((current) => current === near ? current : near);
  }

  function finishDrag(id: string, info: PanInfo) {
    const shouldDiscard = isNearShredder(info.point);
    if (shouldDiscard) {
      setDragAtShredder(true);
      setDiscardingId(id);
      return;
    }

    setDragAtShredder(false);
    void Promise.all([
      animate(previewX, dragOriginRef.current.x, { duration: 0.36, ease: [0.22, 1, 0.36, 1] }),
      animate(previewY, dragOriginRef.current.y, { duration: 0.36, ease: [0.22, 1, 0.36, 1] }),
    ]).then(() => {
      setDraggingId(undefined);
      setDragPreview(undefined);
    });
  }

  const wallItems = [...artifacts, ...STUDIO_SAMPLES.filter((sample) => !hiddenSampleIds.includes(sample.id))];
  const wallWidth = Math.max(1220, wallItems.length * 276 + 96);
  return (
    <section className="studio-room relative min-h-dvh overflow-hidden pb-16">
      <img aria-hidden="true" src="/studio-assets/landscape.jpg" className="studio-landscape" style={{ height: 'calc(100% - 185px)' }} />

      <div className="relative z-[2] mx-auto w-full max-w-[1320px] px-6 pb-3 pt-14 sm:px-10 lg:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14">
          <header className="max-w-[470px] pt-8 lg:pt-12">
            <h1 className="font-serif text-[49px] font-medium leading-[0.98] tracking-[-0.052em] text-foreground sm:text-[66px] lg:text-[72px]">
              Hold on to<br />
              the <em className="font-normal text-[#174c9c]">loose</em> ends.
            </h1>
          </header>

          <div className="capture-desk lg:mt-16">
            {pendingImageUrl && (
              <div className="relative mb-4 w-fit">
                <img src={pendingImageUrl} alt="New artifact preview" className="max-h-24 max-w-44 border border-border bg-card object-contain p-1" />
                <button onClick={clearAttachment} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground" aria-label="Remove attachment">
                  <X size={11} />
                </button>
              </div>
            )}

            <label htmlFor="capture-draft" className="sr-only">Pin a reference</label>
            <textarea
              id="capture-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') addArtifact();
              }}
              placeholder={'Add a thought\nor attach a screenshot…'}
              rows={3}
              className="min-h-[92px] w-full resize-none bg-transparent font-mono text-[14px] leading-8 outline-none placeholder:text-foreground/58"
            />

            <div className="flex items-center justify-between gap-4 border-t border-foreground/10 pt-4">
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) setAttachment(file);
                  }}
                />
                <button onClick={() => fileInputRef.current?.click()} className="inline-flex h-8 items-center gap-2 font-mono text-[9px] text-foreground/72 transition-colors hover:text-foreground">
                  {pendingImage ? <Paperclip size={13} /> : <ImagePlus size={13} />}
                  Attach image
                </button>
                <span className="hidden h-5 w-px bg-foreground/10 sm:block" />
                <span className="hidden items-center gap-1.5 font-mono text-[8px] text-foreground/55 sm:flex"><Command size={10} /> + Enter to pin</span>
              </div>
              <button
                onClick={addArtifact}
                disabled={!draft.trim() && !pendingImage}
                className="pin-button flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[transform,opacity] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                aria-label="Pin to wall"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-[3] mt-14 overflow-x-auto overflow-y-hidden pb-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mt-12">
        <div className="clothesline-track relative min-h-[440px]" style={{ width: wallWidth }}>
          <div className="clothesline-cord absolute left-0 right-0 top-[34px]" />

          <AnimatePresence mode="popLayout">
            <div className="relative z-10 flex gap-[26px] px-12">
              {wallItems.map((item, index) => {
                const offset = HANG_OFFSETS[index % HANG_OFFSETS.length];
                const angle = SETTLE_ANGLES[index % SETTLE_ANGLES.length];
                const isUserArtifact = 'createdAt' in item;
                const kind = item.kind ?? 'note';
                const label = isUserArtifact ? kind : item.label;
                const meta = isUserArtifact ? 'Just now' : item.meta;
                const text = isUserArtifact ? formatArtifactText(item) : item.text;
                const image = isUserArtifact ? item.imageUrl : item.image;
                const imageAlt = isUserArtifact ? item.text : item.imageAlt;

                return (
                  <div key={item.id} className="relative w-[250px] shrink-0" style={{ paddingTop: 40 + offset }}>
                    <div aria-hidden="true" className="binder-clip absolute left-1/2 z-20 -translate-x-1/2" style={{ top: 20 + offset }}>
                      <span className="binder-handle binder-handle-back" />
                      <span className="binder-handle binder-handle-front" />
                    </div>
                    <motion.div
                      layout
                      initial={isUserArtifact ? { opacity: 0, y: -10, rotate: angle * 2 } : false}
                      animate={discardingId === item.id
                        ? { opacity: 0 }
                        : { opacity: draggingId === item.id ? 0 : 1, y: 0, rotate: angle }}
                      exit={{ opacity: 0, y: 12, rotate: angle * 1.4 }}
                      transition={discardingId === item.id
                        ? { duration: 0.12, ease: 'easeOut' }
                        : { duration: 0 }}
                      className="pointer-events-none relative z-20 w-[250px]"
                      style={{ transformOrigin: '50% 0' }}
                    >
                      <StudioCard
                        kind={kind}
                        label={label}
                        meta={meta}
                        text={text}
                        image={image}
                        imageAlt={imageAlt}
                      />
                    </motion.div>
                    <motion.div
                      ref={(element) => {
                        if (element) dragProxyRefs.current.set(item.id, element);
                        else dragProxyRefs.current.delete(item.id);
                      }}
                      aria-hidden="true"
                      drag
                      dragSnapToOrigin
                      dragMomentum={false}
                      dragElastic={0.04}
                      onDragStart={(_event, info) => {
                        const bounds = dragProxyRefs.current.get(item.id)?.getBoundingClientRect();
                        if (!bounds) return;
                        dragOffsetRef.current = { x: info.point.x - bounds.left, y: info.point.y - bounds.top };
                        const position = { x: bounds.left, y: bounds.top };
                        setDraggingId(item.id);
                        setDragAtShredder(false);
                        dragOriginRef.current = position;
                        previewX.set(position.x);
                        previewY.set(position.y);
                        setDragPreview({ id: item.id, kind, label, meta, text, image, imageAlt, angle });
                      }}
                      onDrag={(_event, info) => updateDrag(item.id, info)}
                      onDragEnd={(_event, info) => finishDrag(item.id, info)}
                      className="absolute left-0 z-10 h-[306px] w-[250px] cursor-grab touch-none active:cursor-grabbing"
                      style={{ top: 40 + offset }}
                    />
                  </div>
                );
              })}
            </div>
          </AnimatePresence>
        </div>
      </div>

      {dragPreview && !discardingId && createPortal(
        <motion.div
          key={dragPreview.id}
          initial={false}
          animate={dragAtShredder ? {
            scaleX: 0.72,
            scaleY: 0.72,
            rotate: 0,
            opacity: 1,
          } : {
            scaleX: 1,
            scaleY: 1,
            rotate: dragPreview.angle,
            opacity: 1,
          }}
          transition={{ duration: dragAtShredder ? 0.16 : 0.08, ease: [0.22, 1, 0.36, 1] }}
          className={dragAtShredder ? 'shredding-sheet' : ''}
          style={{ position: 'fixed', left: 0, top: 0, x: previewX, y: previewY, zIndex: 1000, width: 250, pointerEvents: 'none', transformOrigin: '50% 50%' }}
        >
          <StudioCard
            kind={dragPreview.kind}
            label={dragPreview.label}
            meta={dragPreview.meta}
            text={dragPreview.text}
            image={dragPreview.image}
            imageAlt={dragPreview.imageAlt}
          />
        </motion.div>,
        document.body
      )}

      {dragPreview && discardingId === dragPreview.id && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-[#e9e2d7]/75 px-5 backdrop-blur-[5px]"
        >
          <motion.div
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-[470px] w-[min(92vw,590px)]"
          >
            <motion.div
              initial={{ y: -62, opacity: 0, scale: 0.78, rotate: dragPreview.angle }}
              animate={{ y: [-62, -28, 92, 224], opacity: [0, 1, 1, 0], scale: [0.78, 0.78, 0.76, 0.7], rotate: [dragPreview.angle, 0, 0, 0] }}
              transition={{ duration: 1.62, times: [0, 0.1, 0.5, 0.7], ease: [0.4, 0, 0.75, 1] }}
              onAnimationComplete={() => removeArtifact(dragPreview.id, artifacts.some((artifact) => artifact.id === dragPreview.id))}
              className="absolute left-1/2 top-0 z-0 w-[250px] -translate-x-1/2 origin-top"
            >
              <StudioCard {...dragPreview} />
            </motion.div>

            <motion.div
              animate={{ x: [0, -2, 2, -1, 1, 0] }}
              transition={{ delay: 0.72, duration: 0.48 }}
              className="absolute inset-x-0 top-[238px] z-20 h-[142px]"
            >
              <div className="absolute inset-x-0 top-0 h-14 rounded-t-[26px] border border-[#183047]/25 bg-[#233c54] shadow-[0_18px_32px_-22px_rgba(20,31,42,0.65)]" />
              <div className="absolute left-1/2 top-[22px] h-3 w-[300px] -translate-x-1/2 rounded-full bg-[#07131e] shadow-[inset_0_2px_3px_rgba(0,0,0,0.7)]" />
              <div className="absolute left-1/2 top-[34px] flex w-[286px] -translate-x-1/2 justify-center gap-[5px]">
                {Array.from({ length: 20 }, (_, tooth) => <span key={tooth} className="h-[9px] w-[9px] rotate-45 bg-[#102536]" />)}
              </div>
              <div className="absolute inset-x-0 bottom-0 h-[96px] rounded-b-[26px] border border-[#183047]/20 bg-[#eee7dc] shadow-[0_22px_38px_-24px_rgba(20,31,42,0.65)]">
                <div className="absolute left-1/2 top-5 h-2 w-[242px] -translate-x-1/2 rounded-full bg-[#183047]/70" />
                <div className="absolute inset-x-0 bottom-5 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-[#183047]/70">shredding reference</div>
              </div>
            </motion.div>

            <div className="pointer-events-none absolute left-1/2 top-[276px] z-10 h-[190px] w-[250px] -translate-x-1/2 overflow-visible">
              {Array.from({ length: 12 }, (_, strip) => (
                <motion.div
                  key={strip}
                  initial={{ y: -90, opacity: 0, rotate: 0 }}
                  animate={{ y: [-90, -28, 72, 184], opacity: [0, 1, 1, 0], rotate: [0, strip % 2 ? -2 : 2, strip % 2 ? -5 : 5, strip % 2 ? -10 : 10] }}
                  transition={{ duration: 1.02, delay: 0.76 + strip * 0.018, times: [0, 0.2, 0.72, 1], ease: 'easeIn' }}
                  className="absolute top-0 h-[184px] overflow-hidden border-x border-[#463923]/15 bg-[#f5f0e7] shadow-sm"
                  style={{ left: `${(strip / 12) * 100}%`, width: `${100 / 12}%` }}
                >
                  <div className="absolute top-0 h-[306px] w-[250px]" style={{ left: `-${strip * (250 / 12)}px` }}>
                    <StudioCard {...dragPreview} />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>,
        document.body
      )}

      {isReady && createPortal(
        <div
          ref={shredderRef}
          aria-hidden="true"
          className={`studio-shredder ${discardingId || (draggingId && dragAtShredder) ? 'is-active' : ''}`}
          style={{ position: 'fixed', right: 78, bottom: 24, zIndex: 50, width: 84, height: 88, pointerEvents: 'none' }}
        >
          <span
            className="studio-shredder-label"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', color: '#183047', fontFamily: 'var(--font-geist-mono), monospace', fontSize: 7, letterSpacing: '0.12em', textAlign: 'center', textTransform: 'uppercase' }}
          >
            shred
          </span>
          <AnimatePresence>
            {discardingId && (
              <motion.span
                key={discardingId}
                initial={{ y: -34, scaleX: 0.82, scaleY: 1, opacity: 0 }}
                animate={{ y: [-34, -11, 10], scaleX: [0.82, 0.64, 0.5], scaleY: [1, 0.58, 0.08], opacity: [0, 1, 0] }}
                transition={{ duration: 0.54, times: [0, 0.44, 1], ease: [0.4, 0, 0.2, 1] }}
                style={{ position: 'absolute', top: 24, left: 25, zIndex: 2, width: 34, height: 34, border: '1px solid rgba(24, 48, 71, 0.22)', background: '#f7f0e5', boxShadow: 'inset 3px -3px 5px rgba(61, 48, 34, 0.16)' }}
              />
            )}
          </AnimatePresence>
          <span className="studio-shredder-head" style={{ position: 'absolute', top: 16, left: 0, zIndex: 4, width: 84, height: 24, borderRadius: 3, background: '#183047' }}>
            <span className="studio-shredder-slot" />
            <span className="studio-shredder-light" />
          </span>
          <span className="studio-shredder-body">
            {discardingId && Array.from({ length: 11 }, (_, index) => (
              <motion.span
                key={index}
                initial={{ y: -8, height: 0, opacity: 0 }}
                animate={{
                  y: [-8, 2, 34],
                  x: [0, index % 2 === 0 ? -1 : 1, index % 3 === 0 ? -5 : 4],
                  height: [0, 24 + (index % 4) * 3, 30],
                  rotate: [0, index % 2 === 0 ? -2 : 2, index % 2 === 0 ? -8 : 7],
                  opacity: [0, 1, 0],
                }}
                transition={{ duration: 0.68, delay: 0.5 + index * 0.018, times: [0, 0.28, 1], ease: [0.4, 0, 0.2, 1] }}
                style={{ left: 5 + index * 5.4 }}
              />
            ))}
          </span>
        </div>,
        document.body
      )}
    </section>
  );
}
