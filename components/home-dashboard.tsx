'use client';

import { animate, AnimatePresence, motion, type PanInfo, useMotionTemplate, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { Archive, ArrowUp, Braces, CheckCircle2, Circle, ExternalLink, FileText, GitPullRequest, ImagePlus, Link2, Paperclip, PenTool, RotateCcw, Search, Terminal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { changedRecords, mergeRecords } from '@/lib/artifact-sync';
import { boardPlacement, boardPosition, nextBoardLayer, BOARD_CARD_WIDTH, type BoardPosition } from '@/lib/task-board';

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
  boardPosition?: BoardPosition;
  boardLayer?: number;
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
  height: number;
  width: number;
  focused: boolean;
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
const PRIORITIES: Priority[] = ['p0', 'p1', 'p2'];
const FOCUS_LIMIT = 3;
const BOARD_CONTENT_TOP = 132;
const FOCUS_CARD_HEIGHT = 76;
const FOCUS_DIVIDER_TOP = 168;
const CARD_SPRING = { type: 'spring', stiffness: 450, damping: 38 } as const;
const PRIORITY_COLORS: Record<Priority, string> = {
  p0: '#475e50',
  p1: '#70736b',
  p2: '#8a8d85',
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

function taskCardHeight(kind: ArtifactKind) {
  return kind === 'image' ? 286 : kind === 'note' || kind === 'github' ? 220 : 250;
}

function StudioCard({ kind, label, meta, priority, text, image, imageAlt, focused = false }: {
  kind: ArtifactKind;
  label: string;
  meta: string;
  priority: Priority;
  text?: string;
  image?: string;
  imageAlt?: string;
  focused?: boolean;
}) {
  return (
    <article className={`task-paper ${focused ? 'is-focused' : ''}`} style={{ height: focused ? FOCUS_CARD_HEIGHT : taskCardHeight(kind) }}>
      <div className="task-paper-heading">
        <span className="task-priority">{priority.toUpperCase()}</span>
        <KindMark kind={kind} />
        <span className="sr-only">{label}</span>
      </div>
      {focused ? <p className="task-focus-title">{text?.split('\n')[0]}</p> : image ? (
        <div className="task-paper-image">
          <img draggable={false} src={image} alt={imageAlt ?? label} />
          <p>{text}</p>
        </div>
      ) : kind === 'note' || kind === 'github' ? (
        <div className="task-paper-note"><strong>{text?.split("\n")[0]}</strong>{text?.includes("\n") && <p>{text.split("\n").slice(1).join("\n")}</p>}</div>
      ) : (
        <pre className="task-paper-code">{text}</pre>
      )}
      {!focused && <div className="task-paper-meta"><KindMark kind={kind} /><span>{meta === 'Just now' ? label : meta}</span></div>}
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
  const [isReady, setIsReady] = useState(false);
  const [discardingId, setDiscardingId] = useState<string>();
  const [draggingId, setDraggingId] = useState<string>();
  const [dragAtBin, setDragAtBin] = useState(false);
  const [dragAtArchive, setDragAtArchive] = useState(false);
  const [stackTargetId, setStackTargetId] = useState<string>();
  const [dragPreview, setDragPreview] = useState<DragPreview>();
  const [drawerView, setDrawerView] = useState<'archive' | 'completed' | null>(null);
  const [githubOpen, setGithubOpen] = useState(false);
  const [githubUsername, setGithubUsername] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubConnectedUsername, setGithubConnectedUsername] = useState('');
  const [githubResults, setGithubResults] = useState<GitHubResult[]>([]);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const binRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(0);
  const reducedMotion = useReducedMotion();
  const archiveRef = useRef<HTMLButtonElement>(null);
  const dragProxyRefs = useRef(new Map<string, HTMLDivElement>());
  const dragOriginRef = useRef({ x: 0, y: 0 });
  const dragSessionRef = useRef(0);
  const instantMoveRef = useRef(false);
  const arrivingIdRef = useRef<string | undefined>(undefined);
  const linkOnDropRef = useRef(false);
  const dragOffsetRef = useRef({ x: 125, y: 153 });
  const previewX = useMotionValue(0);
  const previewY = useMotionValue(0);
  const previewTilt = useMotionValue(0);
  const previewScale = useMotionValue(1);
  const previewLiftTransform = useMotionTemplate`scale(${previewScale}) rotate(${previewTilt}deg)`;
  const previewShadow = useTransform(previewScale, [1, 1.03], [0, 1]);
  const previewTransform = useMotionTemplate`translate3d(${previewX}px, ${previewY}px, 0)`;
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

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const observer = new ResizeObserver(() => setBoardWidth(board.clientWidth));
    observer.observe(board);
    setBoardWidth(board.clientWidth);
    return () => observer.disconnect();
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

  function addArtifact(withMotion = false) {
    const text = draft.trim();
    if (!isReady || (!text && !pendingImage)) return;

    const imageUrl = pendingImage ? URL.createObjectURL(pendingImage) : undefined;
    if (imageUrl) imageUrlsRef.current.push(imageUrl);
    const id = crypto.randomUUID();
    arrivingIdRef.current = withMotion ? id : undefined;
    commitArtifacts((current) => {
      const prepared = draftPriority === 'p0' ? makeRoomForFocus(current, id) : current;
      return [{
        id,
        text: text || 'Untitled task',
        createdAt: Date.now(),
        boardLayer: nextBoardLayer(current),
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
      const boardLayer = nextBoardLayer(current);
      return prepared.map((item) => {
        if (memberIds.includes(item.id)) return { ...item, priority: next, boardLayer };
        return item;
      });
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
    setDragAtBin(false);
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
      const boardLayer = Math.max(...current.filter((artifact) => linkedIds.has(artifact.id)).map((artifact) => artifact.boardLayer ?? 0));
      return current.map((artifact) => linkedIds.has(artifact.id) ? { ...artifact, stackId, boardLayer } : artifact);
    });
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
      boardLayer: nextBoardLayer(current),
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
    return { x: point.x - dragOffsetRef.current.x, y: point.y - dragOffsetRef.current.y };
  }

  function isNearBin(point: PanInfo['point']) {
    const bounds = binRef.current?.getBoundingClientRect();
    return Boolean(bounds && point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom);
  }

  function isNearArchive(point: PanInfo['point']) {
    const bounds = archiveRef.current?.getBoundingClientRect();
    return Boolean(bounds && point.x >= bounds.left - 8 && point.x <= bounds.right + 8 && point.y >= bounds.top - 8 && point.y <= bounds.bottom + 8);
  }

  function stackTargetAt(point: PanInfo['point'], memberIds: string[]) {
    let target: Artifact | undefined;
    let highestLayer = -1;
    for (const artifact of artifactsRef.current) {
      if (artifact.archived || artifact.completed || memberIds.includes(artifact.id)) continue;
      const card = dragProxyRefs.current.get(artifact.id)?.parentElement;
      const bounds = card?.getBoundingClientRect();
      const layer = Number(card?.style.zIndex ?? -1);
      if (bounds && layer > highestLayer && point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom) {
        target = artifact;
        highestLayer = layer;
      }
    }
    return target;
  }

  function pickUpCard(preview: DragPreview, info?: PanInfo, link = false) {
    const bounds = dragProxyRefs.current.get(preview.id)?.parentElement?.getBoundingClientRect();
    if (!bounds) return false;
    dragSessionRef.current += 1;
    instantMoveRef.current = false;
    previewX.stop(); previewY.stop(); previewTilt.stop(); previewScale.stop();
    previewTilt.set(0); previewScale.set(1);
    if (!reducedMotion) void animate(previewScale, 1.03, CARD_SPRING);
    dragOffsetRef.current = info ? { x: info.point.x - info.offset.x - bounds.left, y: info.point.y - info.offset.y - bounds.top } : { x: bounds.width / 2, y: bounds.height / 2 };
    dragOriginRef.current = { x: bounds.left, y: bounds.top };
    linkOnDropRef.current = link;
    previewX.set(bounds.left + (info?.offset.x ?? 0)); previewY.set(bounds.top + (info?.offset.y ?? 0));
    setDraggingId(preview.id); setDiscardingId(undefined);
    setDragAtBin(false); setDragAtArchive(false); setStackTargetId(undefined);
    setDragPreview(preview);
    const boardLayer = nextBoardLayer(artifactsRef.current);
    commitArtifacts((current) => current.map((item) => preview.memberIds.includes(item.id) ? { ...item, boardLayer } : item));
    return true;
  }

  function settleCard(position: { x: number; y: number }, velocity: PanInfo['velocity'], session: number) {
    void Promise.all([
      animate(previewX, position.x, reducedMotion ? { duration: 0 } : { ...CARD_SPRING, velocity: velocity.x }),
      animate(previewY, position.y, reducedMotion ? { duration: 0 } : { ...CARD_SPRING, velocity: velocity.y }),
      animate(previewTilt, 0, reducedMotion ? { duration: 0 } : CARD_SPRING),
      animate(previewScale, 1, reducedMotion ? { duration: 0 } : CARD_SPRING),
    ]).then(() => {
      if (session !== dragSessionRef.current) return;
      setDraggingId(undefined); setDragPreview(undefined);
    });
  }

  function putAwayCard(preview: DragPreview, destination: 'archive' | 'completed') {
    const bounds = (destination === 'archive' ? archiveRef.current : binRef.current)?.getBoundingClientRect();
    if (!bounds) return;
    const session = dragSessionRef.current;
    setDragAtBin(destination === 'completed'); setDragAtArchive(destination === 'archive');
    setStackTargetId(undefined); setDiscardingId(preview.id);
    void animate(previewTilt, 0, reducedMotion ? { duration: 0 } : CARD_SPRING);
    commitArtifacts((current) => current.map((item) => preview.memberIds.includes(item.id)
      ? { ...item, archived: destination === 'archive', completed: destination === 'completed' } : item));
    const transition = { duration: reducedMotion ? 0.1 : 0.32, ease: [0.77, 0, 0.175, 1] as const };
    void Promise.all([
      animate(previewX, reducedMotion ? previewX.get() : bounds.left + bounds.width / 2 - preview.width / 2, transition),
      animate(previewY, reducedMotion ? previewY.get() : bounds.top + (destination === 'archive' ? bounds.height / 2 : 34) - preview.height / 2, transition),
    ]).then(() => {
      if (session !== dragSessionRef.current) return;
      setDiscardingId(undefined); setDraggingId(undefined); setDragAtBin(false); setDragAtArchive(false); setDragPreview(undefined);
    });
  }

  function updateDrag(info: PanInfo) {
    const position = getPreviewPosition(info.point);
    previewX.set(position.x);
    previewY.set(position.y);
    if (!reducedMotion) void animate(previewTilt, Math.max(-4, Math.min(4, info.velocity.x / 250)), CARD_SPRING);
    const nearBin = isNearBin(info.point);
    setDragAtBin(nearBin);
    const nearArchive = !nearBin && isNearArchive(info.point);
    setDragAtArchive(nearArchive);
    if (!reducedMotion && (nearBin !== dragAtBin || nearArchive !== dragAtArchive)) {
      void animate(previewScale, nearBin || nearArchive ? 0.94 : 1.03, CARD_SPRING);
    }
    setStackTargetId(linkOnDropRef.current && !nearBin && !nearArchive && dragPreview
      ? stackTargetAt(info.point, dragPreview.memberIds)?.id : undefined);
  }

  function finishDrag(info: PanInfo) {
    if (!dragPreview) return;
    const session = dragSessionRef.current;
    setStackTargetId(undefined);
    if (isNearBin(info.point)) {
      putAwayCard(dragPreview, 'completed');
      return;
    }
    if (isNearArchive(info.point)) {
      putAwayCard(dragPreview, 'archive');
      return;
    }
    // Free placement is the default; linking remains an explicit Shift-drag.
    if (linkOnDropRef.current) {
      const target = stackTargetAt(info.point, dragPreview.memberIds);
      const bounds = target && dragProxyRefs.current.get(target.id)?.parentElement?.getBoundingClientRect();
      if (target && bounds) {
        linkArtifacts(dragPreview.memberIds, target.id);
        settleCard({ x: bounds.left, y: bounds.top }, info.velocity, session);
        return;
      }
    }
    const board = boardRef.current;
    const bounds = board?.getBoundingClientRect();
    if (board && bounds && info.point.x >= bounds.left && info.point.x <= bounds.right && info.point.y >= bounds.top && info.point.y <= bounds.bottom) {
      const position = getPreviewPosition(info.point);
      const savedPosition = boardPosition(position.x - bounds.left - board.clientLeft, position.y - bounds.top - board.clientTop - BOARD_CONTENT_TOP, board.clientWidth, board.clientHeight - BOARD_CONTENT_TOP, taskCardHeight(dragPreview.kind));
      if (!dragPreview.focused) commitArtifacts((current) => current.map((item) => dragPreview.memberIds.includes(item.id)
        ? { ...item, boardPosition: savedPosition } : item));
      const placed = boardPlacement(0, board.clientWidth, savedPosition);
      // Use the saved destination, never an intermediate layout-animation frame.
      settleCard(dragPreview.focused ? dragOriginRef.current : {
        x: bounds.left + board.clientLeft + placed.left,
        y: bounds.top + board.clientTop + BOARD_CONTENT_TOP + placed.top,
      }, info.velocity, session);
    } else {
      settleCard(dragOriginRef.current, info.velocity, session);
    }
    setDragAtBin(false);
    setDragAtArchive(false);
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
  const boardItems = [...focusGroups.map((group) => group[0]), ...wallItems];
  const focusCardWidth = Math.max(1, (boardWidth - 88) / FOCUS_LIMIT);
  const wallIds = wallItems.map((item) => item.id).join(',');
  const boardHeight = Math.max(400, ...wallItems.map((item, index) => BOARD_CONTENT_TOP + boardPlacement(index, boardWidth, item.boardPosition).top + taskCardHeight(item.kind ?? 'note') + 80));

  useEffect(() => {
    if (!isReady || !boardWidth) return;
    const positions = new Map<string, BoardPosition>();
    const occupied = wallItems.filter((item) => item.boardPosition).map((item, index) => boardPlacement(index, boardWidth, item.boardPosition));
    wallItems.filter((item) => !item.boardPosition).forEach((item) => {
      let slot = 0;
      let point = boardPlacement(slot, boardWidth);
      while (occupied.some((other) => Math.abs(other.left - point.left) < 240 && Math.abs(other.top - point.top) < 240)) {
        point = boardPlacement(++slot, boardWidth);
      }
      occupied.push(point);
      positions.set(item.stackId ?? item.id, boardPosition(point.left, point.top, boardWidth, Infinity, taskCardHeight(item.kind ?? 'note')));
    });
    if (positions.size) commitArtifacts((current) => current.map((item) => {
      const position = positions.get(item.stackId ?? item.id);
      return position ? { ...item, boardPosition: position } : item;
    }));
  // New and restored tasks get an unused starting spot; saved positions never shift.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, boardWidth, wallIds]);

  return (
    <section className="task-workspace">
      <header className="task-header">
        <div><h1>My tasks</h1><p>{activeArtifacts.length} open · a place to put things in order</p></div>
        <div className="task-header-actions">
          <button onClick={() => setGithubOpen((open) => !open)} className="task-control" aria-label="Open GitHub inbox"><GitPullRequest size={15} /><span>{githubConnectedUsername ? `@${githubConnectedUsername}` : 'GitHub inbox'}</span></button>
          <label className="task-search"><Search size={15} /><input aria-label="Search tasks" placeholder="Search tasks…" value={cardQuery} onChange={(event) => setCardQuery(event.target.value)} /></label>
        </div>
      </header>

      <div className="task-capture">
        {pendingImageUrl && <div className="task-attachment-preview"><img src={pendingImageUrl} alt="New task attachment" /><button onClick={clearAttachment} aria-label="Remove attachment"><X size={14} /></button></div>}
        <textarea id="capture-draft" aria-label="Add a task" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a thought or attach a screenshot…" rows={2} onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey) return;
          event.preventDefault();
          if (event.metaKey || event.ctrlKey) setDraftPriority((current) => cyclePriority(current));
          else addArtifact();
        }} />
        <div className="task-capture-actions">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) setAttachment(file); }} />
          <button onClick={() => fileInputRef.current?.click()} className="task-quiet-button"><ImagePlus size={15} />Attach image</button>
          <button onClick={() => setDraftPriority((current) => cyclePriority(current))} className="task-quiet-button" aria-label={`Draft priority ${draftPriority}`} title="Command Enter cycles priority">Priority · {draftPriority.toUpperCase()}</button>
          <button onClick={(event) => addArtifact(event.detail !== 0)} disabled={!isReady || (!draft.trim() && !pendingImage)} className="task-pin-button" aria-label="Pin task"><ArrowUp size={19} /></button>
        </div>
      </div>

      <div className="task-board-frame">
      <div className="task-board-scroll">
        <div ref={boardRef} className="cutting-mat" style={{ height: boardHeight }} aria-label="Task board">
          <div className="mat-heading"><span>Task board</span><span>{boardItems.length} pinned</span></div>
          <div className="mat-ruler" aria-hidden="true">{Array.from({ length: Math.max(1, Math.floor(boardWidth / 120)) }, (_, index) => <span key={index}>{index * 5}</span>)}</div>
          <div className="mat-focus-heading"><h2>Today <span>P0</span></h2><span>{focusGroups.length} / {FOCUS_LIMIT}</span></div>
          <div className="mat-focus-divider" style={{ top: FOCUS_DIVIDER_TOP }} aria-hidden="true" />
          {!boardItems.length && <div className="task-board-empty"><FileText size={28} strokeWidth={1.3} /><h2>{isReady ? 'Pin your first task' : 'Opening your board…'}</h2><p>Capture a thought above, then arrange it here.</p></div>}
          <AnimatePresence>
            {boardItems.map((item, index) => {
              const kind = item.kind ?? 'note';
              const members = artifactGroups.get(item.stackId ?? item.id) ?? [item];
              const memberIds = members.map((member) => member.id);
              const priority = item.priority ?? 'p2';
              const label = kind === 'github' ? item.sourceType ?? 'GitHub' : kind;
              const meta = kind === 'github' ? `${item.sourceRepo?.split('/').pop() ?? 'repo'} #${item.sourceNumber}` : 'Just now';
              const text = formatArtifactText(item);
              const angle = SETTLE_ANGLES[index % SETTLE_ANGLES.length];
              const focusIndex = focusGroups.findIndex((group) => group[0].id === item.id);
              const focused = focusIndex >= 0;
              const width = focused ? focusCardWidth : BOARD_CARD_WIDTH;
              const height = focused ? FOCUS_CARD_HEIGHT : taskCardHeight(kind);
              const wallPosition = boardPlacement(Math.max(0, index - focusGroups.length), boardWidth, item.boardPosition);
              const position = focused ? { left: 28 + focusIndex * (focusCardWidth + 16), top: 82 } : { left: wallPosition.left, top: wallPosition.top + BOARD_CONTENT_TOP };
              const muted = Boolean(cardQuery.trim()) && !`${label} ${meta} ${text}`.toLowerCase().includes(cardQuery.trim().toLowerCase());
              const stackTarget = stackTargetId === item.id;
              const preview: DragPreview = { id: item.id, kind, label, meta, text, image: item.imageUrl, imageAlt: item.text, angle, priority, memberIds, height, width, focused };
              return <motion.div key={item.id} layout="position" transition={reducedMotion || instantMoveRef.current || draggingId === item.id ? { duration: 0 } : CARD_SPRING} className={`board-task ${focused ? 'is-focused' : ''} ${stackTarget ? 'is-stack-target' : ''}`} data-task-id={item.id} style={{ left: position.left, top: position.top, width, height, zIndex: item.boardLayer ?? index + 2, opacity: draggingId === item.id ? 0 : 1 }}>
                <motion.div initial={arrivingIdRef.current === item.id ? { opacity: 0, transform: reducedMotion ? 'none' : `translateY(-18px) scale(0.97) rotate(${angle - 3}deg)` } : false}
                  animate={{ opacity: muted ? 0.22 : 1, transform: `translateY(${!reducedMotion && stackTarget ? -4 : 0}px) scale(${!reducedMotion && stackTarget ? 1.02 : 1}) rotate(${angle}deg)` }}
                  transition={reducedMotion ? { duration: 0.1, transform: { duration: 0 } } : { ...CARD_SPRING, opacity: { duration: 0.12 } }} className="board-task-paper">
                  {members.length > 1 && <motion.div initial={false} animate={{ transform: `rotate(${!reducedMotion && stackTarget ? 5 : 2}deg)` }} transition={reducedMotion ? { duration: 0 } : CARD_SPRING} className="task-paper-stack" />}
                  <StudioCard kind={kind} label={label} meta={meta} priority={priority} text={text} image={item.imageUrl} imageAlt={item.text} focused={focused} />
                  <span className="task-pushpin" aria-hidden="true" />
                </motion.div>
                <button onClick={(event) => { instantMoveRef.current = event.detail === 0; cycleArtifactPriority(item.id); }} className="board-priority-control" aria-label={`Change priority of ${item.text}, currently ${priority.toUpperCase()}`} title="Cycle P0 / P1 / P2" />
                {members.length > 1 && <span className="board-stack-count"><Link2 size={11} />{members.length}</span>}
                <div className="board-task-actions">
                  <button onClick={(event) => { if (event.detail === 0 || !pickUpCard(preview)) archiveArtifacts(memberIds); else putAwayCard(preview, 'archive'); }} aria-label={`Archive ${item.text}`} title="Archive"><Archive size={15} /></button>
                  <button onClick={(event) => { if (event.detail === 0 || !pickUpCard(preview)) completeArtifacts(memberIds); else putAwayCard(preview, 'completed'); }} aria-label={`Complete ${item.text}`} title="Complete"><Circle size={19} /></button>
                </div>
                {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="board-source-link" aria-label={`Open ${item.text} on GitHub`}><ExternalLink size={13} /></a>}
                <motion.div ref={(element) => { if (element) dragProxyRefs.current.set(item.id, element); else dragProxyRefs.current.delete(item.id); }}
                  className="board-task-drag" role="button" tabIndex={0} aria-label={`Move task: ${item.text}`} title={focused ? 'Change priority to return to the board. Drag to Archive or the bin.' : 'Drag to arrange. Shift-drag to stack. Arrow keys move the task.'}
                  drag dragSnapToOrigin dragMomentum={false} dragElastic={0}
                  onKeyDown={(event) => {
                    instantMoveRef.current = true;
                    if (focused) {
                      if (event.key.startsWith('Arrow')) event.preventDefault();
                      return;
                    }
                    const directions: Record<string, [number, number]> = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] };
                    const delta = directions[event.key];
                    if (!delta) return;
                    event.preventDefault();
                    const next = boardPosition(position.left + delta[0], position.top + delta[1] - BOARD_CONTENT_TOP, boardWidth, boardHeight - BOARD_CONTENT_TOP, height);
                    const boardLayer = nextBoardLayer(artifactsRef.current);
                    commitArtifacts((current) => current.map((member) => memberIds.includes(member.id) ? { ...member, boardPosition: next, boardLayer } : member));
                  }}
                  onDragStart={(event, info) => {
                    pickUpCard(preview, info, 'shiftKey' in event && event.shiftKey);
                  }}
                  onDrag={(_event, info) => updateDrag(info)} onDragEnd={(_event, info) => finishDrag(info)} />
              </motion.div>;
            })}
          </AnimatePresence>
        </div>
      </div>
          <motion.div ref={binRef} initial={false} animate={{ transform: reducedMotion ? 'none' : discardingId && dragAtBin ? 'translateY(2px) scale(0.96)' : dragAtBin ? 'translateY(-3px) scale(1.04)' : 'translateY(0px) scale(1)' }} transition={reducedMotion ? { duration: 0 } : CARD_SPRING} className={`task-waste-bin ${dragAtBin ? 'is-active' : ''}`} aria-label="Paper waste bin">
            <svg width="72" height="88" viewBox="0 0 72 88" fill="none" aria-hidden="true">
              <defs><pattern id="bin-mesh" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H9V9" stroke="currentColor" strokeWidth="0.65" opacity="0.65" /></pattern></defs>
              <path d="M10 17L18 76Q36 86 54 76L62 17Z" fill="#20372e" fillOpacity="0.42" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 17L18 76Q36 86 54 76L62 17Z" fill="url(#bin-mesh)" />
              <path d="M25 59L32 51L43 54L48 64L43 74L29 75L23 66Z" fill="#e9e8df" stroke="#b9bbae" />
              <path d="M32 51L34 64L25 59M34 64L43 74M34 64L48 64" stroke="#b2b5a8" />
              <motion.ellipse initial={false} animate={{ transform: !reducedMotion && dragAtBin ? 'translateY(-2px) scaleY(1.25)' : 'translateY(0px) scaleY(1)' }} style={{ transformOrigin: '36px 17px' }} transition={reducedMotion ? { duration: 0 } : CARD_SPRING} cx="36" cy="17" rx="26" ry="8" fill="#183c2e" stroke="currentColor" strokeWidth="2" />
              <path d="M18 76Q36 85 54 76" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span>{dragAtBin ? 'Release to discard' : 'Drop to discard'}</span>
          </motion.div>
      <footer className="task-board-footer">
        <motion.button ref={archiveRef} initial={false} animate={{ transform: !reducedMotion && dragAtArchive ? 'translateY(-3px) scale(1.04)' : 'translateY(0px) scale(1)' }} transition={reducedMotion ? { duration: 0 } : CARD_SPRING} onClick={() => setDrawerView((view) => view === 'archive' ? null : 'archive')} className={`task-quiet-button ${dragAtArchive ? 'is-drop-target' : ''}`} aria-label="Open archived items"><Archive size={15} />Archive<span className="task-count">{archivedArtifacts.length}</span></motion.button>
        <button onClick={() => setDrawerView((view) => view === 'completed' ? null : 'completed')} className="task-quiet-button" aria-label="Open completed items"><CheckCircle2 size={16} />Completed<span className="task-count">{completedArtifacts.length}</span></button>
      </footer>
      </div>

      {dragPreview && createPortal(<motion.div key={dragPreview.id}
        style={{ position: 'fixed', left: 0, top: 0, transform: previewTransform, zIndex: 1000, width: dragPreview.width, pointerEvents: 'none' }}>
        <motion.div className="task-drag-preview" initial={{ transform: `rotate(${dragPreview.angle}deg)` }}
          animate={discardingId ? { transform: reducedMotion ? `rotate(${dragPreview.angle}deg)` : `scale(0.08) rotate(${dragAtArchive ? -6 : 16}deg)`, opacity: 0 } : { transform: `rotate(${dragPreview.angle}deg)`, opacity: 1 }}
          transition={reducedMotion ? { duration: 0.1 } : discardingId ? { duration: 0.32, ease: [0.77, 0, 0.175, 1], opacity: { duration: 0.12, delay: 0.2 } } : CARD_SPRING}>
          <motion.div className="task-drag-lift" style={{ transform: previewLiftTransform }}>
            <motion.span className="task-lift-shadow" style={{ opacity: previewShadow }} aria-hidden="true" />
            {dragPreview.memberIds.length > 1 && <div className="task-paper-stack" />}
            <StudioCard {...dragPreview} />
            <span className="task-pushpin" aria-hidden="true" />
          </motion.div>
        </motion.div>
      </motion.div>, document.body)}

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
                initial={{ transform: reducedMotion ? 'none' : 'translateY(100%)', opacity: 0 }}
                animate={{ transform: 'translateY(0%)', opacity: 1 }}
                exit={{ transform: reducedMotion ? 'none' : 'translateY(100%)', opacity: 0 }}
                transition={{ duration: reducedMotion ? 0.12 : 0.28, ease: [0.32, 0.72, 0, 1] }}
                className="fixed inset-x-0 bottom-0 z-[70] max-h-[78dvh] overflow-hidden rounded-t-[12px] border border-b-0 border-border bg-card text-card-foreground task-sheet"
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
                  initial={{ transform: reducedMotion ? 'none' : 'translateY(100%)', opacity: 0 }}
                  animate={{ transform: 'translateY(0%)', opacity: 1 }}
                  exit={{ transform: reducedMotion ? 'none' : 'translateY(100%)', opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0.12 : 0.28, ease: [0.32, 0.72, 0, 1] }}
                  className="fixed inset-x-0 bottom-0 z-[60] max-h-[62dvh] overflow-hidden rounded-t-[12px] border border-b-0 border-border bg-card text-card-foreground task-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Saved items"
                >
                  <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-muted-foreground/35" />
                  <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-8">
                    <div>
                      <h2 className="text-[20px] font-bold tracking-tight">Saved items</h2>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">Keep tasks for later, or restore completed work.</p>
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

    </section>
  );
}
