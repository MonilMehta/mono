'use client';

import { animate, AnimatePresence, LayoutGroup, motion, type PanInfo, useMotionValue } from 'framer-motion';
import { Archive, ArrowUp, Braces, CheckCircle2, ExternalLink, FileText, GitPullRequest, ImagePlus, Link2, Paperclip, PenTool, RotateCcw, Search, Terminal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { changedRecords, mergeRecords } from '@/lib/artifact-sync';

type ArtifactKind = 'note' | 'image' | 'json' | 'request' | 'svg' | 'github';
type Priority = 'p0' | 'p1' | 'p2';

type ArtifactRecord = {
  id: string;
  text: string;
  createdAt: number;
  image?: Blob;
  kind?: ArtifactKind;
  priority?: Priority;
  archived?: boolean;
  completed?: boolean;
  stackId?: string;
  sourceUrl?: string;
  sourceRepo?: string;
  sourceNumber?: number;
  sourceType?: 'issue' | 'pull request';
};

type Artifact = ArtifactRecord & { imageUrl?: string };

type DragPreview = {
  id: string;
  kind: ArtifactKind;
  label: string;
  meta: string;
  text?: string;
  image?: string;
  imageAlt?: string;
  angle: number;
  priority: Priority;
  memberIds: string[];
};

type GitHubResult = {
  id: number;
  title: string;
  html_url: string;
  repository_url: string;
  number: number;
  pull_request?: unknown;
  section: 'review' | 'assigned' | 'authored';
};

const GITHUB_SECTIONS = [
  { id: 'review', label: 'Review requested' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'authored', label: 'Authored PRs & issues' },
] as const;

const DB_NAME = 'mono-home';
const STORE_NAME = 'todos';
const SYNC_CHANNEL_NAME = `${DB_NAME}-sync`;
const SETTLE_ANGLES = [-1.2, 0.8, -0.45, 1.05, -0.7, 0.4];
const HANG_OFFSETS = [2, 8, 4, 10, 6, 0];
const PRIORITIES: Priority[] = ['p0', 'p1', 'p2'];
const FOCUS_LIMIT = 3;
const PRIORITY_COLORS: Record<Priority, string> = {
  p0: '#a78bfa',
  p1: '#bd9235',
  p2: '#555b5c',
};
const TEST_ARTIFACT_IDS = ['sample-json', 'sample-image', 'sample-request', 'sample-study', 'sample-material'];

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = (event) => {
      const store = request.result.objectStoreNames.contains(STORE_NAME)
        ? request.transaction?.objectStore(STORE_NAME)
        : request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      if (event.oldVersion < 3) {
        TEST_ARTIFACT_IDS.forEach((id) => store?.delete(id));
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

async function saveArtifactChanges(artifacts: ArtifactRecord[]) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
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
    priority: record.priority ?? 'p2',
    archived: record.archived ?? false,
    completed: record.completed ?? false,
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

function makeRoomForFocus(artifacts: Artifact[], incomingStackKey: string): Artifact[] {
  const focusedStackKeys = Array.from(new Set(artifacts
    .filter((artifact) => !artifact.archived && !artifact.completed && (artifact.priority ?? 'p2') === 'p0')
    .map((artifact) => artifact.stackId ?? artifact.id)))
    .filter((key) => key !== incomingStackKey);
  if (focusedStackKeys.length < FOCUS_LIMIT) return artifacts;
  const displacedStackKey = focusedStackKeys.at(-1);
  return artifacts.map((artifact): Artifact => (artifact.stackId ?? artifact.id) === displacedStackKey
    ? { ...artifact, priority: 'p1' }
    : artifact);
}

async function githubRequestError(response: Response, action: string) {
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  if (response.status === 401) {
    return new Error('GitHub rejected this token (401). It may be expired, revoked, or issued for a different GitHub host.');
  }
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
    return new Error('GitHub’s API rate limit has been reached. Wait for it to reset, then try again.');
  }
  if (response.status === 403) {
    const permissions = response.headers.get('x-accepted-github-permissions');
    return new Error(permissions
      ? `The token is valid, but it cannot ${action}. GitHub requires: ${permissions}.`
      : `The token is valid, but GitHub denied access to ${action}. Check its repository selection and organization approval.`);
  }
  return new Error(payload?.message ? `GitHub: ${payload.message}` : `GitHub could not ${action} (${response.status}).`);
}

function KindMark({ kind }: { kind: ArtifactKind }) {
  if (kind === 'json') return <Braces size={12} />;
  if (kind === 'request') return <Terminal size={12} />;
  if (kind === 'svg') return <PenTool size={12} />;
  if (kind === 'image') return <ImagePlus size={12} />;
  if (kind === 'github') return <GitPullRequest size={12} />;
  return <FileText size={12} />;
}

function StudioCard({
  kind,
  label,
  meta,
  priority,
  text,
  image,
  imageAlt,
}: {
  kind: ArtifactKind;
  label: string;
  meta: string;
  priority: Priority;
  text?: string;
  image?: string;
  imageAlt?: string;
}) {
  return (
    <article className={`studio-card studio-card-${kind} group relative flex h-[306px] flex-col`}>
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-foreground/80">
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-foreground/12 bg-black/[0.03] px-2.5 font-mono text-[8px] tracking-[0.08em] text-foreground/70">
            <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_COLORS[priority] }} />
            {priority}
          </span>
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
  const [draftPriority, setDraftPriority] = useState<Priority>('p1');
  const [cardQuery, setCardQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [discardingId, setDiscardingId] = useState<string>();
  const [draggingId, setDraggingId] = useState<string>();
  const [dragAtShredder, setDragAtShredder] = useState(false);
  const [dragAtArchive, setDragAtArchive] = useState(false);
  const [dragPreview, setDragPreview] = useState<DragPreview>();
  const [returningFocusId, setReturningFocusId] = useState<string>();
  const [drawerView, setDrawerView] = useState<'archive' | 'completed' | null>(null);
  const [githubOpen, setGithubOpen] = useState(false);
  const [githubUsername, setGithubUsername] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubConnectedUsername, setGithubConnectedUsername] = useState('');
  const [githubResults, setGithubResults] = useState<GitHubResult[]>([]);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shredderRef = useRef<HTMLDivElement>(null);
  const archiveRef = useRef<HTMLButtonElement>(null);
  const dragProxyRefs = useRef(new Map<string, HTMLDivElement>());
  const dragOriginRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 125, y: 153 });
  const previewX = useMotionValue(0);
  const previewY = useMotionValue(0);
  const artifactsRef = useRef<Artifact[]>([]);
  const imageUrlsRef = useRef<string[]>([]);
  const saveQueueRef = useRef(Promise.resolve());
  const syncChannelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    const pendingRemoteRecords: ArtifactRecord[] = [];
    let isLoaded = false;
    syncChannelRef.current = channel;

    const applyRecords = (records: ArtifactRecord[]) => {
      const incoming = records.map(artifactFromRecord);
      setArtifacts((current) => {
        const merged = mergeRecords(current, incoming).sort((a, b) => b.createdAt - a.createdAt);
        const nextImageUrls = merged.flatMap((artifact) => artifact.imageUrl?.startsWith('blob:') ? [artifact.imageUrl] : []);
        imageUrlsRef.current.filter((url) => !nextImageUrls.includes(url)).forEach((url) => URL.revokeObjectURL(url));
        imageUrlsRef.current = nextImageUrls;
        artifactsRef.current = merged;
        return merged;
      });
    };

    channel.onmessage = (event: MessageEvent<ArtifactRecord[]>) => {
      if (!Array.isArray(event.data)) return;
      if (!isLoaded) {
        pendingRemoteRecords.push(...event.data);
        return;
      }
      applyRecords(event.data);
    };

    readArtifacts()
      .then((records) => {
        isLoaded = true;
        applyRecords(mergeRecords(records, pendingRemoteRecords));
        setIsReady(true);
      })
      .catch(() => undefined);

    return () => {
      channel.close();
      imageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function commitArtifacts(update: (current: Artifact[]) => Artifact[]) {
    if (!isReady) return;
    const current = artifactsRef.current;
    const next = update(current);
    const changed = changedRecords(current, next);
    if (changed.length === 0) return;

    artifactsRef.current = next;
    setArtifacts(next);
    const records = changed.map(({ imageUrl: _imageUrl, ...artifact }) => artifact);
    saveQueueRef.current = saveQueueRef.current
      .then(() => saveArtifactChanges(records))
      .then(() => syncChannelRef.current?.postMessage(records))
      .catch(() => undefined);
  }

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
    if (!isReady || (!text && !pendingImage)) return;

    const imageUrl = pendingImage ? URL.createObjectURL(pendingImage) : undefined;
    if (imageUrl) imageUrlsRef.current.push(imageUrl);
    const id = crypto.randomUUID();
    commitArtifacts((current) => {
      const prepared = draftPriority === 'p0' ? makeRoomForFocus(current, id) : current;
      return [{
        id,
        text: text || 'Untitled reference',
        createdAt: Date.now(),
        image: pendingImage ?? undefined,
        imageUrl,
        kind: detectKind(text, Boolean(pendingImage)),
        priority: draftPriority,
        archived: false,
        completed: false,
      }, ...prepared];
    });
    setDraft('');
    setPendingImage(null);
    setPendingImageUrl(undefined);
    setDraftPriority('p1');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function cyclePriority(priority: Priority) {
    return PRIORITIES[(PRIORITIES.indexOf(priority) + 1) % PRIORITIES.length];
  }

  function cycleArtifactPriority(id: string) {
    commitArtifacts((current) => {
      const artifact = current.find((item) => item.id === id);
      if (!artifact) return current;
      const stackKey = artifact.stackId ?? artifact.id;
      const memberIds = artifact.stackId
        ? current.filter((item) => item.stackId === artifact.stackId).map((item) => item.id)
        : [id];
      const next = cyclePriority(artifact.priority ?? 'p2');
      const prepared = next === 'p0' ? makeRoomForFocus(current, stackKey) : current;
      return prepared.map((item) => {
        if (memberIds.includes(item.id)) return { ...item, priority: next };
        return item;
      });
    });
  }

  function returnToWall(id: string) {
    setReturningFocusId(id);
    commitArtifacts((current) => {
      const artifact = current.find((item) => item.id === id);
      if (!artifact) return current;
      const stackKey = artifact.stackId ?? artifact.id;
      return current.map((item) => (item.stackId ?? item.id) === stackKey ? { ...item, priority: 'p1' } : item);
    });
  }

  function archiveArtifacts(ids: string[]) {
    commitArtifacts((current) => current.map((artifact) => ids.includes(artifact.id) ? { ...artifact, archived: true, completed: false } : artifact));
    setDraggingId(undefined);
    setDragAtArchive(false);
    setDragPreview(undefined);
  }

  function completeArtifacts(ids: string[]) {
    commitArtifacts((current) => current.map((artifact) => ids.includes(artifact.id) ? { ...artifact, archived: false, completed: true } : artifact));
    setDiscardingId(undefined);
    setDraggingId(undefined);
    setDragAtShredder(false);
    setDragPreview(undefined);
  }

  function restoreArtifacts(ids: string[]) {
    commitArtifacts((current) => {
      const restored = current.find((artifact) => ids.includes(artifact.id));
      const prepared = restored && (restored.priority ?? 'p2') === 'p0'
        ? makeRoomForFocus(current, restored.stackId ?? restored.id)
        : current;
      return prepared.map((artifact) => ids.includes(artifact.id) ? { ...artifact, archived: false, completed: false } : artifact);
    });
  }

  function linkArtifacts(sourceIds: string[], targetId: string) {
    commitArtifacts((current) => {
      const target = current.find((artifact) => artifact.id === targetId);
      if (!target) return current;
      const targetIds = target.stackId
        ? current.filter((artifact) => artifact.stackId === target.stackId).map((artifact) => artifact.id)
        : [target.id];
      const stackId = target.stackId ?? target.id;
      const linkedIds = new Set([...sourceIds, ...targetIds]);
      return current.map((artifact) => linkedIds.has(artifact.id) ? { ...artifact, stackId } : artifact);
    });
    setDraggingId(undefined);
    setDragPreview(undefined);
  }

  async function connectGithub() {
    let username = githubUsername.trim().replace(/^@/, '');
    const token = githubToken.replace(/\s+/g, '');
    if (!username && !token) return;
    setGithubLoading(true);
    setGithubError('');
    try {
      const headers: HeadersInit = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      if (token) {
        const viewerResponse = await fetch('https://api.github.com/user', { headers });
        if (!viewerResponse.ok) throw await githubRequestError(viewerResponse, 'authenticate');
        const viewer = await viewerResponse.json() as { login: string };
        if (!username) {
          username = viewer.login;
          setGithubUsername(viewer.login);
        }
      }
      const queries = [
        { section: 'review' as const, query: `is:open is:pr review-requested:${username}` },
        { section: 'assigned' as const, query: `is:open assignee:${username}` },
        { section: 'authored' as const, query: `is:open author:${username}` },
      ];
      const responses = await Promise.all(queries.map(({ query }) => fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=8`, {
        headers,
      })));
      const failedResponse = responses.find((response) => !response.ok);
      if (failedResponse) throw await githubRequestError(failedResponse, 'search issues and pull requests');
      const payloads = await Promise.all(responses.map((response) => response.json() as Promise<{ items: GitHubResult[] }>));
      setGithubResults(payloads.flatMap((payload, index) => payload.items.map((item) => ({
        ...item,
        section: queries[index].section,
      }))));
      setGithubConnectedUsername(username);
    } catch (error) {
      setGithubError(error instanceof Error ? error.message : 'Unable to reach GitHub.');
    } finally {
      setGithubLoading(false);
    }
  }

  function disconnectGithub() {
    setGithubConnectedUsername('');
    setGithubToken('');
    setGithubResults([]);
    setGithubError('');
  }

  function pinGithubItem(item: GitHubResult) {
    if (!isReady) return;
    const repo = item.repository_url.split('/').slice(-2).join('/');
    commitArtifacts((current) => [{
      id: crypto.randomUUID(),
      text: item.title,
      createdAt: Date.now(),
      kind: 'github',
      priority: 'p1',
      archived: false,
      completed: false,
      sourceUrl: item.html_url,
      sourceRepo: repo,
      sourceNumber: item.number,
      sourceType: item.pull_request ? 'pull request' : 'issue',
    }, ...current]);
    setGithubResults((current) => current.filter((result) => result.id !== item.id));
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

  function isNearArchive(point: PanInfo['point']) {
    const bounds = archiveRef.current?.getBoundingClientRect();
    return Boolean(
      bounds &&
      point.x >= bounds.left - 54 &&
      point.x <= bounds.right + 84 &&
      point.y >= bounds.top - 110 &&
      point.y <= bounds.bottom + 30
    );
  }

  function updateDrag(id: string, info: PanInfo) {
    const position = getPreviewPosition(info.point);
    previewX.set(position.x);
    previewY.set(position.y);
    const near = isNearShredder(info.point);
    setDragAtShredder((current) => current === near ? current : near);
    const nearArchive = !near && isNearArchive(info.point);
    setDragAtArchive((current) => current === nearArchive ? current : nearArchive);
  }

  function finishDrag(id: string, info: PanInfo) {
    const shouldDiscard = isNearShredder(info.point);
    if (shouldDiscard) {
      setDragAtShredder(true);
      setDiscardingId(id);
      return;
    }

    if (dragPreview && isNearArchive(info.point) && artifacts.some((artifact) => artifact.id === id)) {
      const bounds = archiveRef.current?.getBoundingClientRect();
      if (bounds) {
        setDragAtArchive(true);
        void Promise.all([
          animate(previewX, bounds.left + 18, { duration: 0.32, ease: [0.22, 1, 0.36, 1] }),
          animate(previewY, bounds.top - 20, { duration: 0.32, ease: [0.22, 1, 0.36, 1] }),
        ]).then(() => archiveArtifacts(dragPreview.memberIds));
        return;
      }
    }

    if (dragPreview && artifacts.some((artifact) => artifact.id === id)) {
      const target = artifacts.find((artifact) => {
        if (artifact.archived || artifact.completed || dragPreview.memberIds.includes(artifact.id)) return false;
        const bounds = dragProxyRefs.current.get(artifact.id)?.getBoundingClientRect();
        return Boolean(bounds && info.point.x >= bounds.left && info.point.x <= bounds.right && info.point.y >= bounds.top && info.point.y <= bounds.bottom);
      });
      if (target) {
        const bounds = dragProxyRefs.current.get(target.id)?.getBoundingClientRect();
        if (bounds) {
          void Promise.all([
            animate(previewX, bounds.left + 10, { duration: 0.28, ease: [0.22, 1, 0.36, 1] }),
            animate(previewY, bounds.top + 10, { duration: 0.28, ease: [0.22, 1, 0.36, 1] }),
          ]).then(() => linkArtifacts(dragPreview.memberIds, target.id));
          return;
        }
      }
    }

    setDragAtShredder(false);
    setDragAtArchive(false);
    void Promise.all([
      animate(previewX, dragOriginRef.current.x, { duration: 0.36, ease: [0.22, 1, 0.36, 1] }),
      animate(previewY, dragOriginRef.current.y, { duration: 0.36, ease: [0.22, 1, 0.36, 1] }),
    ]).then(() => {
      setDraggingId(undefined);
      setDragPreview(undefined);
    });
  }

  const activeArtifacts = artifacts.filter((artifact) => !artifact.archived && !artifact.completed);
  const archivedArtifacts = artifacts.filter((artifact) => artifact.archived);
  const completedArtifacts = artifacts.filter((artifact) => artifact.completed);
  const drawerArtifacts = drawerView === 'completed' ? completedArtifacts : archivedArtifacts;
  const artifactGroups = new Map<string, Artifact[]>();
  activeArtifacts.forEach((artifact) => {
    const key = artifact.stackId ?? artifact.id;
    artifactGroups.set(key, [...(artifactGroups.get(key) ?? []), artifact]);
  });
  const activeGroups = Array.from(artifactGroups.entries()).map(([stackId, group]) => [
    ...group.filter((artifact) => artifact.id === stackId),
    ...group.filter((artifact) => artifact.id !== stackId),
  ]);
  const focusGroups = activeGroups.filter((group) => (group[0].priority ?? 'p2') === 'p0').slice(0, FOCUS_LIMIT);
  const focusedIds = new Set(focusGroups.flatMap((group) => group.map((artifact) => artifact.id)));
  const wallArtifacts = activeGroups.filter((group) => !focusedIds.has(group[0].id)).map((group) => group[0]);
  const wallItems = wallArtifacts;
  const wallWidth = Math.max(1220, activeGroups.length * 276 + 96);
  return (
    <section className="studio-room relative min-h-dvh overflow-hidden pb-16">
      <img aria-hidden="true" src="/studio-assets/landscape.jpg" className="studio-landscape" style={{ height: 'calc(100% - 185px)' }} />

      <div className="absolute right-6 top-5 z-50 flex items-center gap-2 sm:right-10">
        <div>
          <button
            onClick={() => setGithubOpen((open) => !open)}
            className={`flex h-9 items-center gap-2 border-b px-2.5 font-mono text-[9px] transition-colors ${githubOpen ? 'border-primary/55 text-primary' : 'border-foreground/14 text-foreground/48 hover:text-foreground'}`}
            aria-label="Open GitHub inbox"
          >
            <GitPullRequest size={13} />
            <span className="hidden sm:inline">{githubConnectedUsername ? `@${githubConnectedUsername}` : 'GitHub'}</span>
          </button>
        </div>
        <div className="flex h-9 items-center border-b border-foreground/14 text-foreground/48">
          <button onClick={() => setSearchOpen((open) => {
            if (open) setCardQuery('');
            return !open;
          })} className={`flex h-8 w-8 items-center justify-center transition-colors hover:text-foreground ${searchOpen ? 'text-primary' : ''}`} aria-label="Search cards" title="Search cards">
            <Search size={13} />
          </button>
          <AnimatePresence initial={false}>
            {searchOpen && (
              <motion.label initial={{ width: 0, opacity: 0 }} animate={{ width: 190, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="flex min-w-0 items-center overflow-hidden">
                <input autoFocus aria-label="Search the wall" value={cardQuery} onChange={(event) => setCardQuery(event.target.value)} placeholder="Search the wall…" className="w-[170px] bg-transparent font-mono text-[10px] outline-none placeholder:text-foreground/36" />
                {cardQuery && <button onClick={() => setCardQuery('')} aria-label="Clear search"><X size={11} /></button>}
              </motion.label>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="relative z-[2] mx-auto w-full max-w-[1320px] px-6 pb-3 pt-14 sm:px-10 lg:pt-20">
          <div className="capture-desk relative w-full">
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
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault();
                if (event.metaKey || event.ctrlKey) {
                  setDraftPriority((current) => cyclePriority(current));
                  return;
                }
                addArtifact();
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
                <button
                  onClick={() => setDraftPriority((current) => cyclePriority(current))}
                  className="hidden h-7 items-center gap-2 rounded-full border border-foreground/10 bg-black/[0.025] px-2.5 font-mono text-[8px] uppercase tracking-[0.08em] text-foreground/58 sm:flex"
                  title="⌘/Ctrl + Enter cycles priority"
                  aria-label={`Draft priority ${draftPriority}. Command Enter cycles priority.`}
                >
                  <span className="h-2.5 w-2.5 rounded-full shadow-[0_1px_2px_rgba(20,24,30,0.24)]" style={{ background: PRIORITY_COLORS[draftPriority] }} />
                  Priority · {draftPriority}
                </button>
              </div>
              <button
                onClick={addArtifact}
                disabled={!isReady || (!draft.trim() && !pendingImage)}
                className="pin-button flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[transform,opacity] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                aria-label="Pin to wall"
              >
                <ArrowUp size={18} />
              </button>
            </div>
        </div>
      </div>

      <LayoutGroup id="studio-focus">
      <div className="relative z-[3] mx-auto mt-5 h-[88px] w-full max-w-[1320px] px-6 sm:px-10">
        <AnimatePresence initial={false}>
          {focusGroups.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="absolute inset-x-6 top-0 sm:inset-x-10"
            >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="h-px w-7 bg-primary/70" />
                <span className="font-serif text-[18px] italic text-foreground/82">Today</span>
                <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-foreground/42">{focusGroups.length} of {FOCUS_LIMIT} in focus</span>
              </div>
              <span className="hidden font-mono text-[7px] uppercase tracking-[0.1em] text-foreground/32 sm:block">Click a reference to return it to the wall</span>
            </div>
            <div className="mt-2 flex max-w-[930px] gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {focusGroups.map((group) => {
                  const item = group[0];
                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      onClick={() => returnToWall(item.id)}
                      className="group/focus relative flex h-[56px] min-w-[220px] max-w-[300px] flex-1 items-center gap-3 overflow-hidden border border-foreground/10 bg-[#f5f0e7]/88 px-3 text-left shadow-[0_8px_18px_-17px_rgba(20,24,30,0.65)] transition-transform hover:-translate-y-0.5"
                      title="Return to the wall as P1"
                      aria-label={`Return ${item.text} to the wall as P1`}
                    >
                      <span className="absolute inset-y-0 left-0 w-[2px] bg-primary" />
                      <span className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2 font-mono text-[7px] uppercase tracking-[0.1em] text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" /> P0
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-serif text-[14px] leading-tight text-foreground/88">{item.text}</span>
                        <span className="mt-1 flex items-center gap-1.5 font-mono text-[7px] uppercase tracking-[0.08em] text-foreground/38">
                          <KindMark kind={item.kind ?? 'note'} />
                          {group.length > 1 ? `${group.length} linked` : 'Active reference'}
                        </span>
                      </span>
                      <RotateCcw size={11} className="shrink-0 text-foreground/28 transition-colors group-hover/focus:text-primary" />
                    </motion.button>
                );
              })}
            </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        className="relative z-[3] mt-5 overflow-x-auto overflow-y-hidden pb-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="clothesline-track relative min-h-[440px]" style={{ width: `max(100%, ${wallWidth}px)` }}>
          <div className="clothesline-cord absolute left-0 right-0 top-[34px]" />

          <AnimatePresence mode="popLayout">
            <div className="relative z-10 flex gap-[26px] px-12">
              {wallItems.map((item, index) => {
                const offset = HANG_OFFSETS[index % HANG_OFFSETS.length];
                const angle = SETTLE_ANGLES[index % SETTLE_ANGLES.length];
                const kind = item.kind ?? 'note';
                const members = artifactGroups.get(item.stackId ?? item.id) ?? [item];
                const memberIds = members.map((member) => member.id);
                const priority = item.priority ?? 'p2';
                const label = item.kind === 'github' ? item.sourceType ?? 'GitHub' : kind;
                const meta = item.kind === 'github' ? `${item.sourceRepo?.split('/').pop() ?? 'repo'} #${item.sourceNumber}` : 'Just now';
                const text = formatArtifactText(item);
                const image = item.imageUrl;
                const imageAlt = item.text;
                const searchText = `${label} ${meta} ${text ?? ''}`.toLowerCase();
                const mutedBySearch = Boolean(cardQuery.trim()) && !searchText.includes(cardQuery.trim().toLowerCase());

                return (
                  <motion.div
                    key={item.id}
                    layout="position"
                    transition={{ layout: { duration: 0.52, ease: [0.22, 1, 0.36, 1] } }}
                    className="relative w-[250px] shrink-0"
                    style={{ paddingTop: 40 + offset }}
                  >
                    {members.length > 1 && (
                      <>
                        <div className="studio-card absolute left-2 z-[4] h-[306px] w-[250px] rotate-[2.4deg] bg-[#e9e1d4]" style={{ top: 44 + offset }} />
                        <div className="studio-card absolute -left-1 z-[5] h-[306px] w-[250px] -rotate-[1.7deg] bg-[#efe8dc]" style={{ top: 40 + offset }} />
                      </>
                    )}
                    <div aria-hidden="true" className="binder-clip absolute left-1/2 z-20 -translate-x-1/2" style={{ top: 20 + offset }}>
                      <span className="binder-handle binder-handle-back" />
                      <span className="binder-handle binder-handle-front" />
                    </div>
                    <motion.div
                      layout
                      initial={returningFocusId === item.id
                        ? { opacity: 0, y: -72, scale: 0.94, rotate: 0 }
                        : { opacity: 0, y: -10, scale: 1, rotate: angle * 2 }}
                      animate={discardingId === item.id
                        ? { opacity: 0 }
                        : { opacity: draggingId === item.id ? 0 : mutedBySearch ? 0.22 : 1, y: mutedBySearch ? 2 : cardQuery ? -6 : 0, scale: 1, rotate: angle, filter: mutedBySearch ? 'saturate(0.35) blur(0.45px)' : 'saturate(1) blur(0px)' }}
                      exit={{ opacity: 0, y: 12, rotate: angle * 1.4 }}
                      transition={discardingId === item.id
                        ? { duration: 0.12, ease: 'easeOut' }
                        : returningFocusId === item.id
                          ? { duration: 0.46, delay: 0.18, ease: [0.22, 1, 0.36, 1], layout: { duration: 0.46, ease: [0.22, 1, 0.36, 1] } }
                          : { duration: 0, layout: { duration: 0.52, ease: [0.22, 1, 0.36, 1] } }}
                      onAnimationComplete={() => {
                        if (returningFocusId === item.id) setReturningFocusId(undefined);
                      }}
                      className="pointer-events-none relative z-20 w-[250px]"
                      style={{ transformOrigin: '50% 0' }}
                    >
                      <StudioCard
                        kind={kind}
                        label={label}
                        meta={meta}
                        priority={priority}
                        text={text}
                        image={image}
                        imageAlt={imageAlt}
                      />
                    </motion.div>
                    <button
                      onClick={() => cycleArtifactPriority(item.id)}
                      className="absolute left-4 z-30 h-6 w-[48px] rounded-full bg-transparent"
                      style={{ top: 52 + offset }}
                      title={`${priority.toUpperCase()} priority · click to cycle`}
                      aria-label={`${priority.toUpperCase()} priority. Click to cycle.`}
                    />
                    {members.length > 1 && (
                      <span className="absolute right-3 z-30 flex h-6 items-center gap-1 rounded-full border border-foreground/10 bg-[#f5f0e7] px-2 font-mono text-[8px] uppercase shadow-sm" style={{ top: 48 + offset }}>
                        <Link2 size={9} /> {members.length}
                      </span>
                    )}
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute right-3 z-30 flex h-8 items-center gap-1.5 border border-foreground/15 bg-[#f5f0e7] px-2.5 font-mono text-[8px] uppercase tracking-[0.06em] text-foreground/70 shadow-sm hover:border-primary/40 hover:text-primary"
                        style={{ top: 304 + offset }}
                        aria-label={`Open ${item.text} on GitHub`}
                      >
                        Open <ExternalLink size={10} />
                      </a>
                    )}
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
                        setDragAtArchive(false);
                        dragOriginRef.current = position;
                        previewX.set(position.x);
                        previewY.set(position.y);
                        setDragPreview({ id: item.id, kind, label, meta, text, image, imageAlt, angle, priority, memberIds });
                      }}
                      onDrag={(_event, info) => updateDrag(item.id, info)}
                      onDragEnd={(_event, info) => finishDrag(item.id, info)}
                      className="absolute left-0 z-10 h-[306px] w-[250px] cursor-grab touch-none active:cursor-grabbing"
                      style={{ top: 40 + offset }}
                    />
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        </div>
      </motion.div>
      </LayoutGroup>

      {dragPreview && !discardingId && createPortal(
        <motion.div
          key={dragPreview.id}
          initial={false}
          animate={dragAtShredder || dragAtArchive ? {
            scaleX: dragAtArchive ? 0.64 : 0.72,
            scaleY: dragAtArchive ? 0.64 : 0.72,
            rotate: dragAtArchive ? -3 : 0,
            opacity: 1,
          } : {
            scaleX: 1,
            scaleY: 1,
            rotate: dragPreview.angle,
            opacity: 1,
          }}
          transition={{ duration: dragAtShredder || dragAtArchive ? 0.16 : 0.08, ease: [0.22, 1, 0.36, 1] }}
          className={dragAtShredder ? 'shredding-sheet' : ''}
          style={{ position: 'fixed', left: 0, top: 0, x: previewX, y: previewY, zIndex: 1000, width: 250, pointerEvents: 'none', transformOrigin: '50% 50%' }}
        >
          <StudioCard
            kind={dragPreview.kind}
            label={dragPreview.label}
            meta={dragPreview.meta}
            priority={dragPreview.priority}
            text={dragPreview.text}
            image={dragPreview.image}
            imageAlt={dragPreview.imageAlt}
          />
        </motion.div>,
        document.body
      )}

      {isReady && createPortal(
        <AnimatePresence>
          {githubOpen && (
            <>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setGithubOpen(false)}
                className="fixed inset-0 z-[66] bg-black/35"
                aria-label="Close GitHub inbox"
              />
              <motion.section
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-x-0 bottom-0 z-[70] max-h-[78dvh] overflow-hidden rounded-t-[12px] border border-b-0 border-border bg-card text-card-foreground shadow-[0_-8px_0_#111] lg:left-[280px]"
                role="dialog"
                aria-modal="true"
                aria-label="GitHub inbox"
              >
                <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-muted-foreground/35" />
                <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-8">
                  <div>
                    <h2 className="flex items-center gap-2 text-[20px] font-bold tracking-tight"><GitPullRequest size={18} /> GitHub inbox</h2>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">Reviews and open work that need your attention.</p>
                  </div>
                  <button onClick={() => setGithubOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-border hover:bg-secondary" aria-label="Close GitHub inbox"><X size={16} /></button>
                </div>

                {!githubConnectedUsername ? (
                  <div className="px-5 py-5 sm:px-8">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">
                        Username <span className="normal-case tracking-normal opacity-70">optional with token</span>
                        <input
                          value={githubUsername}
                          onChange={(event) => setGithubUsername(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !githubLoading) void connectGithub();
                          }}
                          placeholder="monil"
                          className="h-10 min-w-0 rounded-[4px] border border-border bg-background px-3 font-mono text-[12px] normal-case tracking-normal text-foreground outline-none focus:border-primary"
                        />
                      </label>
                      <label className="grid gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">
                        Private token <span className="normal-case tracking-normal opacity-70">optional</span>
                        <input
                          type="password"
                          autoComplete="off"
                          value={githubToken}
                          onChange={(event) => setGithubToken(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !githubLoading) void connectGithub();
                          }}
                          placeholder="github_pat_…"
                          className="h-10 min-w-0 rounded-[4px] border border-border bg-background px-3 font-mono text-[12px] normal-case tracking-normal text-foreground outline-none focus:border-primary"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                      <p className="max-w-xl text-[11px] leading-5 text-muted-foreground">The token stays in this browser session and is sent directly to api.github.com.</p>
                      <button onClick={() => void connectGithub()} disabled={githubLoading || (!githubUsername.trim() && !githubToken.trim())} className="h-10 rounded-[4px] bg-primary px-5 font-mono text-[9px] uppercase tracking-[0.1em] text-primary-foreground disabled:opacity-35">
                        {githubLoading ? 'Connecting…' : 'Connect GitHub'}
                      </button>
                    </div>
                    {githubError && <p className="mt-3 whitespace-pre-line font-mono text-[10px] leading-5 text-destructive">{githubError}</p>}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 sm:px-8">
                      <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" /> @{githubConnectedUsername}</div>
                      <div className="flex items-center gap-4">
                        <button onClick={() => void connectGithub()} disabled={githubLoading} className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground disabled:opacity-35">{githubLoading ? 'Refreshing…' : 'Refresh'}</button>
                        <button onClick={disconnectGithub} className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">Disconnect</button>
                      </div>
                    </div>
                    {githubError && <p className="border-b border-border px-5 py-3 font-mono text-[10px] leading-5 text-destructive sm:px-8">{githubError}</p>}
                    <div className="max-h-[56dvh] overflow-y-auto px-5 py-4 sm:px-8">
                      {githubResults.length === 0 && !githubLoading ? (
                        <p className="py-12 text-center text-[13px] text-muted-foreground">All caught up. No open GitHub items found.</p>
                      ) : (
                        <div className="space-y-6">
                          {GITHUB_SECTIONS.map((section) => {
                            const items = githubResults.filter((item) => item.section === section.id);
                            return (
                              <section key={section.id}>
                                <div className="mb-2 flex items-center gap-2">
                                  <h3 className="text-[13px] font-semibold">{section.label}</h3>
                                  <span className="font-mono text-[9px] text-muted-foreground">{items.length}</span>
                                </div>
                                {items.length === 0 ? (
                                  <p className="border-t border-border py-3 text-[11px] text-muted-foreground">Nothing here.</p>
                                ) : (
                                  <div className="grid gap-2 lg:grid-cols-2">
                                    {items.map((item) => {
                                      const repo = item.repository_url.split('/').slice(-2).join('/');
                                      return (
                                        <div key={`${section.id}-${item.id}`} className="flex items-center gap-3 rounded-[4px] border border-border bg-background/40 p-3">
                                          <GitPullRequest size={13} className="shrink-0 text-muted-foreground" />
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate text-[13px] font-medium">{item.title}</p>
                                            <p className="mt-0.5 font-mono text-[9px] uppercase text-muted-foreground">{repo} #{item.number} · {item.pull_request ? 'PR' : 'issue'}</p>
                                          </div>
                                          <a href={item.html_url} target="_blank" rel="noreferrer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-border text-muted-foreground hover:bg-secondary hover:text-foreground" title="Open on GitHub" aria-label={`Open ${item.title} on GitHub`}><ExternalLink size={12} /></a>
                                          <button onClick={() => pinGithubItem(item)} className="h-8 shrink-0 rounded-[4px] border border-border px-3 font-mono text-[8px] uppercase hover:bg-secondary">Pin</button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </section>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </motion.section>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {isReady && createPortal(
        <>
          <div className="fixed bottom-0 left-5 z-[55] flex items-end gap-1 lg:left-[284px]">
            <button
              ref={archiveRef}
              onClick={() => setDrawerView((view) => view === 'archive' ? null : 'archive')}
              className={`flex h-9 w-[92px] items-center justify-center gap-2 border border-b-0 border-border bg-card text-foreground transition-transform ${dragAtArchive ? 'h-12 -translate-y-1 bg-primary' : ''}`}
              aria-label="Open archived items"
            >
              <Archive size={12} />
              <span className="font-mono text-[7px] uppercase tracking-[0.12em]">archive {archivedArtifacts.length}</span>
            </button>
            <button
              onClick={() => setDrawerView((view) => view === 'completed' ? null : 'completed')}
              className="flex h-9 w-[104px] items-center justify-center gap-2 border border-b-0 border-border bg-card text-foreground"
              aria-label="Open completed items"
            >
              <CheckCircle2 size={12} />
              <span className="font-mono text-[7px] uppercase tracking-[0.12em]">completed {completedArtifacts.length}</span>
            </button>
          </div>
          <AnimatePresence>
            {drawerView && (
              <>
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setDrawerView(null)}
                  className="fixed inset-0 z-[56] bg-black/35"
                  aria-label="Close bottom sheet"
                />
                <motion.section
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-x-0 bottom-0 z-[60] max-h-[62dvh] overflow-hidden rounded-t-[12px] border border-b-0 border-border bg-card text-card-foreground shadow-[0_-8px_0_#111] lg:left-[280px]"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Saved items"
                >
                  <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-muted-foreground/35" />
                  <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-8">
                    <div>
                      <h2 className="text-[20px] font-bold tracking-tight">Saved items</h2>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">Archive references for later, or restore completed work.</p>
                    </div>
                    <button onClick={() => setDrawerView(null)} className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-border hover:bg-secondary" aria-label="Close saved items"><X size={16} /></button>
                  </div>
                  <div className="flex border-b border-border px-5 sm:px-8">
                    <button onClick={() => setDrawerView('archive')} className={`border-b-[3px] px-1 py-3 text-[13px] font-semibold ${drawerView === 'archive' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}>Archived <span className="ml-1 font-mono text-[11px]">{archivedArtifacts.length}</span></button>
                    <button onClick={() => setDrawerView('completed')} className={`ml-7 border-b-[3px] px-1 py-3 text-[13px] font-semibold ${drawerView === 'completed' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}>Completed <span className="ml-1 font-mono text-[11px]">{completedArtifacts.length}</span></button>
                  </div>
                  <div className="max-h-[42dvh] overflow-y-auto px-5 py-4 sm:px-8">
                    {drawerArtifacts.length === 0 ? (
                      <p className="py-12 text-center text-[13px] text-muted-foreground">No {drawerView} items yet.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {drawerArtifacts.map((artifact) => (
                          <div key={artifact.id} className="flex items-center gap-3 rounded-[4px] border border-border bg-background/40 p-3">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PRIORITY_COLORS[artifact.priority ?? 'p2'] }} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium">{artifact.text}</p>
                              <p className="mt-0.5 font-mono text-[9px] uppercase text-muted-foreground">{artifact.kind ?? 'note'} · {artifact.priority ?? 'p2'}</p>
                            </div>
                            {artifact.sourceUrl && (
                              <a href={artifact.sourceUrl} target="_blank" rel="noreferrer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-border text-muted-foreground hover:bg-secondary hover:text-foreground" title="Open on GitHub" aria-label={`Open ${artifact.text} on GitHub`}><ExternalLink size={12} /></a>
                            )}
                            <button onClick={() => restoreArtifacts(artifact.stackId ? drawerArtifacts.filter((item) => item.stackId === artifact.stackId).map((item) => item.id) : [artifact.id])} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-border text-muted-foreground hover:bg-secondary hover:text-foreground" title="Restore"><RotateCcw size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.section>
              </>
            )}
          </AnimatePresence>
        </>,
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
              onAnimationComplete={() => completeArtifacts(dragPreview.memberIds)}
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
                <div className="absolute inset-x-0 bottom-5 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-[#183047]/70">shredding {dragPreview.memberIds.length > 1 ? `${dragPreview.memberIds.length} linked references` : 'reference'}</div>
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
