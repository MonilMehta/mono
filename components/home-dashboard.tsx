'use client';

import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { ArrowUp, Command, ImagePlus, Paperclip, Shredder, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type TodoRecord = {
  id: string;
  text: string;
  createdAt: number;
  image?: Blob;
};

type Todo = TodoRecord & { imageUrl?: string };

const DB_NAME = 'mono-home';
const STORE_NAME = 'todos';

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

async function readTodos(): Promise<TodoRecord[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as TodoRecord[]);
    request.onerror = () => reject(request.error);
  });
}

async function saveTodos(todos: TodoRecord[]) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    todos.forEach((todo) => store.put(todo));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function todoFromRecord(record: TodoRecord): Todo {
  return {
    ...record,
    imageUrl: record.image ? URL.createObjectURL(record.image) : undefined,
  };
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp);
}

export function HomeDashboard() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string>();
  const [isReady, setIsReady] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [shreddingId, setShreddingId] = useState<string | null>(null);
  const [isOverShredder, setIsOverShredder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shredderRef = useRef<HTMLDivElement>(null);
  const imageUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    readTodos()
      .then((records) => {
        const restored = records.sort((a, b) => b.createdAt - a.createdAt).map(todoFromRecord);
        imageUrlsRef.current = restored.flatMap((todo) => (todo.imageUrl ? [todo.imageUrl] : []));
        setTodos(restored);
      })
      .catch(() => {
        // The screen remains usable if private browsing blocks IndexedDB.
      })
      .finally(() => setIsReady(true));

    return () => imageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (!isReady) return;
    void saveTodos(todos.map(({ imageUrl: _imageUrl, ...todo }) => todo)).catch(() => {
      // Keep the current session available even if the browser storage quota is full.
    });
  }, [todos, isReady]);

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

  function addTodo() {
    const text = draft.trim();
    if (!text && !pendingImage) return;

    const imageUrl = pendingImage ? URL.createObjectURL(pendingImage) : undefined;
    if (imageUrl) imageUrlsRef.current.push(imageUrl);
    setTodos((current) => [
      {
        id: crypto.randomUUID(),
        text: text || 'Untitled bug',
        createdAt: Date.now(),
        image: pendingImage ?? undefined,
        imageUrl,
      },
      ...current,
    ]);
    setDraft('');
    setPendingImage(null);
    setPendingImageUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function isPointOverShredder(point: PanInfo['point']) {
    const bounds = shredderRef.current?.getBoundingClientRect();
    return Boolean(
      bounds &&
      point.x >= bounds.left - 28 &&
      point.x <= bounds.right + 28 &&
      point.y >= bounds.top - 44 &&
      point.y <= bounds.bottom + 28
    );
  }

  function finishDrag(id: string, info: PanInfo) {
    setDraggingId(null);
    setIsOverShredder(false);
    if (isPointOverShredder(info.point)) setShreddingId(id);
  }

  function removeTodo(id: string) {
    setTodos((current) => {
      const removed = current.find((todo) => todo.id === id);
      if (removed?.imageUrl) {
        URL.revokeObjectURL(removed.imageUrl);
        imageUrlsRef.current = imageUrlsRef.current.filter((url) => url !== removed.imageUrl);
      }
      return current.filter((todo) => todo.id !== id);
    });
    setShreddingId(null);
  }

  const shredderActive = draggingId !== null && isOverShredder;
  const shreddingTodo = todos.find((todo) => todo.id === shreddingId);
  const clotheslineWidth = Math.max(320, todos.length * 240);
  const shredStripCount = 10;

  return (
    <section className="relative min-h-[calc(100dvh-60px)] overflow-visible px-5 pb-44 pt-7 sm:px-10 sm:pt-10 lg:px-14">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Todo clothesline</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Hold on to the loose ends.</h1>
        </div>
        <p className="rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">{todos.length} {todos.length === 1 ? 'thing' : 'things'} hanging</p>
      </div>

      <div className="mx-auto mt-7 w-full max-w-[680px]">
        <div className="rounded-[26px] border border-border/70 bg-card/92 p-2 shadow-[0_18px_55px_-28px_color-mix(in_oklch,var(--foreground)_55%,transparent)] backdrop-blur-xl">
          {pendingImageUrl && (
            <div className="relative ml-2 mt-2 w-fit">
              <img src={pendingImageUrl} alt="New bug attachment preview" className="max-h-28 max-w-40 rounded-xl object-contain" />
              <button onClick={clearAttachment} className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background shadow-sm" aria-label="Remove attachment">
                <X size={12} />
              </button>
            </div>
          )}
          <label htmlFor="todo-draft" className="sr-only">New to-do</label>
          <textarea
            id="todo-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') addTodo();
            }}
            placeholder="Add a thought or attach a bug screenshot…"
            rows={2}
            className="min-h-[64px] w-full resize-none bg-transparent px-3 pt-3 text-[15px] leading-6 outline-none placeholder:text-muted-foreground/65"
          />
          <div className="flex items-center justify-between gap-3 px-1 pb-1">
            <div className="flex items-center gap-1">
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
              <button onClick={() => fileInputRef.current?.click()} className="inline-flex h-9 items-center gap-2 rounded-xl px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                {pendingImage ? <Paperclip size={14} /> : <ImagePlus size={14} />}
                <span className="hidden sm:inline">Attach image</span>
              </button>
              <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"><Command size={11} />↵ to pin</span>
            </div>
            <button onClick={addTodo} disabled={!draft.trim() && !pendingImage} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Pin to clothesline">
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-11 overflow-visible pb-8">
        <div className="relative z-0 min-h-[370px] min-w-full" style={{ width: clotheslineWidth }}>
          <svg aria-hidden="true" viewBox="0 0 1000 120" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 h-[120px] w-full overflow-visible">
            <path d="M 0 22 Q 500 128 1000 22" fill="none" stroke="var(--foreground)" strokeOpacity="0.16" strokeWidth="7" strokeLinecap="round" />
            <path d="M 0 22 Q 500 128 1000 22" fill="none" stroke="var(--foreground)" strokeOpacity="0.78" strokeWidth="3" strokeLinecap="round" />
            <path d="M 0 22 Q 500 128 1000 22" fill="none" stroke="var(--background)" strokeOpacity="0.7" strokeWidth="0.85" strokeDasharray="2 6" strokeLinecap="round" />
            <path d="M 0 19 Q 500 121 1000 19" fill="none" stroke="var(--accent)" strokeOpacity="0.48" strokeWidth="1.1" strokeLinecap="round" />
            <circle cx="2" cy="21" r="7" fill="var(--foreground)" fillOpacity="0.82" />
            <circle cx="2" cy="21" r="2" fill="var(--accent)" />
            <circle cx="998" cy="21" r="7" fill="var(--foreground)" fillOpacity="0.82" />
            <circle cx="998" cy="21" r="2" fill="var(--accent)" />
          </svg>

          {todos.length > 0 ? (
            <div className="relative z-10 flex min-w-full justify-around gap-10 px-10 sm:px-16">
              {todos.map((todo, index) => {
                const position = (index + 0.5) / todos.length;
                const ropeY = 34 + 54 * 4 * position * (1 - position);
                const isShredding = shreddingId === todo.id;
                return (
                  <div key={todo.id} className="shrink-0" style={{ paddingTop: ropeY + 28 }}>
                    <motion.article
                      layout
                      drag={isShredding ? false : true}
                      dragSnapToOrigin
                      dragElastic={0.08}
                      dragMomentum={false}
                      whileDrag={{ scale: 1.025, rotate: 0, cursor: 'grabbing' }}
                      onDragStart={() => setDraggingId(todo.id)}
                      onDrag={(_, info) => setIsOverShredder(isPointOverShredder(info.point))}
                      onDragEnd={(_, info) => finishDrag(todo.id, info)}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={isShredding ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1, rotate: index % 2 ? 0.8 : -0.8 }}
                      transition={isShredding ? { duration: 0.12, ease: 'easeOut' } : { type: 'spring', stiffness: 320, damping: 26 }}
                      className="relative cursor-grab touch-none transition-[filter] hover:drop-shadow-[0_16px_16px_color-mix(in_oklch,var(--foreground)_16%,transparent)]"
                      style={{ zIndex: draggingId === todo.id ? 60 : 20, touchAction: 'none' }}
                    >
                      <span className="absolute -top-[28px] left-1/2 h-[28px] w-[2px] -translate-x-1/2 bg-foreground/35 shadow-[0_0_0_1px_color-mix(in_oklch,var(--background)_35%,transparent)]" />
                      <span className="absolute -top-[22px] left-1/2 z-10 h-9 w-[18px] -translate-x-1/2 rounded-[5px] border border-foreground/20 bg-[linear-gradient(90deg,color-mix(in_oklch,var(--accent)_76%,white),var(--accent)_62%,color-mix(in_oklch,var(--accent)_70%,black))] shadow-[0_5px_9px_-5px_color-mix(in_oklch,var(--foreground)_80%,transparent)]">
                        <span className="absolute inset-y-1 left-[3px] w-[5px] rounded-sm border border-foreground/10 bg-white/20" />
                        <span className="absolute inset-y-1 right-[3px] w-[5px] rounded-sm border border-foreground/10 bg-black/10" />
                        <span className="absolute left-1/2 top-[13px] h-[5px] w-[5px] -translate-x-1/2 rounded-full border border-foreground/35 bg-foreground/45 shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
                      </span>
                      {todo.imageUrl ? (
                        <figure className="max-w-[70vw] rounded-[10px] border border-foreground/10 bg-card p-1.5 shadow-[0_18px_32px_-22px_color-mix(in_oklch,var(--foreground)_55%,transparent)] sm:max-w-[360px]">
                          <img draggable={false} src={todo.imageUrl} alt={`Attachment for ${todo.text}`} className="max-h-[260px] w-auto rounded-[6px] object-contain" />
                          {todo.text !== 'Untitled bug' && <figcaption className="mt-2 max-w-[300px] text-sm font-medium leading-5 text-foreground">{todo.text}</figcaption>}
                          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.13em] text-muted-foreground">{formatDate(todo.createdAt)} · pull to shred</p>
                        </figure>
                      ) : (
                        <div className="relative w-[230px] overflow-hidden rounded-[4px] border border-foreground/10 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--accent)_25%,var(--card)),var(--card))] px-5 py-5 shadow-[0_18px_35px_-22px_color-mix(in_oklch,var(--foreground)_55%,transparent)] ring-1 ring-foreground/5">
                          <span aria-hidden="true" className="absolute right-0 top-0 h-6 w-6 border-b border-l border-foreground/10 bg-background/35 [clip-path:polygon(0_0,100%_100%,100%_0)]" />
                          <p className="text-[15px] font-medium leading-6">{todo.text}</p>
                          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">{formatDate(todo.createdAt)}</p>
                        </div>
                      )}
                    </motion.article>
                  </div>
                );
              })}
            </div>
          ) : isReady ? (
            <div className="absolute left-1/2 top-[145px] -translate-x-1/2 whitespace-nowrap text-center">
              <p className="text-sm font-medium text-muted-foreground">Pin a thought, a bug, or a screenshot to the line.</p>
            </div>
          ) : null}
        </div>
      </div>

      <div ref={shredderRef} className={`absolute inset-x-5 bottom-5 z-30 flex h-[124px] items-center justify-center rounded-[32px] border-2 border-dashed transition-all duration-200 sm:inset-x-10 lg:inset-x-14 ${shredderActive ? 'scale-[1.01] border-destructive/60 bg-destructive/10 text-destructive' : 'border-border/80 bg-card/35 text-muted-foreground'}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/[0.06]"><Shredder size={23} /></div>
          <div>
            <p className="text-sm font-semibold">{shredderActive ? 'Let go to shred it' : 'Finished with something?'}</p>
            <p className="mt-0.5 text-xs opacity-75">Drag it into the shredder</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {shreddingTodo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-background/40 px-5 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.86, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 25 }} className="relative h-[380px] w-[min(92vw,560px)]">
              <motion.div
                initial={{ y: -32, opacity: 0, scale: 0.9 }}
                animate={{ y: [-32, -26, 44, 198], opacity: [0, 1, 1, 0], scale: [0.9, 0.95, 0.95, 0.9] }}
                transition={{ duration: 1.48, times: [0, 0.11, 0.33, 0.53], ease: [0.4, 0, 0.8, 1] }}
                onAnimationComplete={() => removeTodo(shreddingTodo.id)}
                className="absolute bottom-[126px] left-1/2 z-0 h-[166px] w-[250px] -translate-x-1/2 overflow-hidden rounded-t-xl border border-border/80 bg-card shadow-2xl"
              >
                {shreddingTodo.imageUrl && <img src={shreddingTodo.imageUrl} alt="" className="h-20 w-full border-b border-border/60 object-cover" />}
                <div className="p-4">
                  <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">{shreddingTodo.text}</p>
                  <div className="mt-4 h-2 w-3/4 rounded-full bg-muted" />
                  <div className="mt-2 h-2 w-1/2 rounded-full bg-muted" />
                </div>
              </motion.div>

              <motion.div animate={{ x: [0, -2, 2, -1, 1, 0] }} transition={{ delay: 0.38, duration: 0.46 }} className="absolute bottom-[58px] z-10 h-[136px] w-full overflow-visible">
                <div className="absolute inset-x-0 top-0 h-12 rounded-t-[28px] border border-primary/35 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--primary)_26%,var(--card)),var(--card))] shadow-[0_18px_30px_-24px_color-mix(in_oklch,var(--foreground)_65%,transparent)]" />
                <div className="absolute left-1/2 top-[22px] h-3 w-[290px] -translate-x-1/2 rounded-full bg-foreground shadow-[inset_0_2px_2px_rgba(0,0,0,0.6)]" />
                <div className="absolute left-1/2 top-[33px] flex w-[280px] -translate-x-1/2 justify-center gap-1">
                  {Array.from({ length: 18 }, (_, tooth) => <span key={tooth} className="h-2 w-2 rotate-45 bg-foreground/75" />)}
                </div>
                <div className="absolute inset-x-0 bottom-0 h-[102px] rounded-b-[28px] border border-primary/25 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--primary)_12%,var(--card)),var(--card))] shadow-2xl">
                  <div className="absolute left-1/2 top-5 h-2 w-[230px] -translate-x-1/2 rounded-full bg-foreground/65" />
                  <div className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-3">
                    <div className="flex h-11 w-12 items-center justify-center rounded-2xl bg-foreground/[0.08]"><Shredder size={22} /></div>
                    <div><p className="text-base font-semibold">Shredding</p><p className="text-xs text-muted-foreground">Cutting it into strips</p></div>
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
                  </div>
                </div>
              </motion.div>

              <div className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-[120px] w-[250px] -translate-x-1/2 overflow-visible">
                {Array.from({ length: shredStripCount }, (_, strip) => (
                  <motion.div
                    key={strip}
                    initial={{ y: -116, opacity: 0, rotate: 0 }}
                    animate={{ y: [-116, -42, 54, 142], opacity: [0, 1, 1, 0], rotate: [0, strip % 2 ? -1.5 : 1.5, strip % 2 ? -4 : 4, strip % 2 ? -8 : 8] }}
                    transition={{ duration: 0.9, delay: 0.43 + strip * 0.018, times: [0, 0.18, 0.7, 1], ease: 'easeIn' }}
                    className="absolute top-0 h-[154px] overflow-hidden border-x border-border/30 bg-card shadow-sm"
                    style={{ left: `${(strip / shredStripCount) * 100}%`, width: `${100 / shredStripCount}%` }}
                  >
                    <div className="absolute top-0 h-[166px] w-[250px] bg-card" style={{ left: `-${strip * (250 / shredStripCount)}px` }}>
                      {shreddingTodo.imageUrl && <img src={shreddingTodo.imageUrl} alt="" className="h-20 w-full border-b border-border/60 object-cover" />}
                      <div className="p-4">
                        <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">{shreddingTodo.text}</p>
                        <div className="mt-4 h-2 w-3/4 rounded-full bg-muted" />
                        <div className="mt-2 h-2 w-1/2 rounded-full bg-muted" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
