'use client';

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Language } from 'prism-react-renderer';
import {
  AlignLeft,
  Bold,
  Check,
  CheckSquare,
  Code2,
  Columns2,
  Download,
  Eye,
  FileText,
  Heading2,
  Italic,
  Link,
  List,
  ListTree,
  PenLine,
  Quote,
  Upload,
} from 'lucide-react';
import { CodeHighlight } from '@/components/code-highlight';
import { CopyButton } from '@/components/copy-button';
import { ToolCard, ToolChip } from '@/components/tool-card';
import { debounce } from '@/lib/debounce';
import styles from './markdown-tool.module.css';

type Draft = { name: string; text: string };
type Heading = { id: string; text: string; level: number };
type View = 'write' | 'split' | 'read';
const STORAGE_KEY = 'mono-markdown-draft';
const WELCOME: Draft = {
  name: 'untitled.md',
  text: '# A little space for big ideas.\n\nA note, a README, a first draft. Whatever you’re working on, make yourself at home.\n\n## Make it your own\n\nWrite in **Markdown** on the left. See it take shape on the right. Your preview and local draft update after a **3-second pause**.\n\n> Good writing starts with a little room to think.\n\n## The small things, covered\n\n- [x] A clean, comfortable reading view\n- [x] Tables, task lists, and highlighted code\n- [ ] Your next great idea\n\n## Something worth sharing\n\n```javascript\nconst idea = "Start small. Make it useful.";\nconsole.log(idea);\n```\n\n| Write it | Make it |\n| :--- | :--- |\n| **Bold** ideas | A little louder |\n| *Quiet* thoughts | A little softer |\n| [Useful links](https://commonmark.org/help/) | A little closer |\n\n---\n\nMade with a little mono.\n',
};
const VIEWS = [
  { id: 'write', label: 'Write', icon: PenLine },
  { id: 'split', label: 'Split', icon: Columns2 },
  { id: 'read', label: 'Read', icon: Eye },
] as const;
const FORMATS = [
  { label: 'Heading', icon: Heading2, before: '## ', after: '', placeholder: 'Heading' },
  { label: 'Bold', icon: Bold, before: '**', after: '**', placeholder: 'bold text' },
  { label: 'Italic', icon: Italic, before: '*', after: '*', placeholder: 'italic text' },
  { label: 'Quote', icon: Quote, before: '> ', after: '', placeholder: 'A thought worth keeping' },
  { label: 'List', icon: List, before: '- ', after: '', placeholder: 'List item' },
  { label: 'Task list', icon: CheckSquare, before: '- [ ] ', after: '', placeholder: 'To do' },
  {
    label: 'Link',
    icon: Link,
    before: '[',
    after: '](https://example.com)',
    placeholder: 'link text',
  },
  { label: 'Code block', icon: Code2, before: '```\n', after: '\n```', placeholder: 'code' },
] as const;

const markdownComponents: Components = {
  pre({ children }) {
    const child = Children.toArray(children)[0];
    if (!isValidElement<{ children?: ReactNode; className?: string }>(child))
      return <pre>{children}</pre>;
    const code = String(child.props.children ?? '').replace(/\n$/, '');
    const language = child.props.className?.replace(/^language-/, '') || 'text';
    return (
      <div className={styles.codeBlock}>
        <div className={styles.codeHeader}>
          <span>{language}</span>
          <CopyButton text={code} size={13} title="Copy code" />
        </div>
        <CodeHighlight
          code={code}
          language={language as Language}
          showLineNumbers={false}
          wrapLongLines
          className="px-4 py-3"
        />
      </div>
    );
  },
  table({ children }) {
    return (
      <div className={styles.tableWrap}>
        <table>{children}</table>
      </div>
    );
  },
};

export default function MarkdownTool() {
  const [draft, setDraft] = useState<Draft>(WELCOME);
  const [preview, setPreview] = useState(WELCOME.text);
  const [view, setView] = useState<View>('split');
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeading, setActiveHeading] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'waiting' | 'saved' | 'error'>('waiting');
  const [error, setError] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const latestRef = useRef(draft);
  const savedRef = useRef<Draft | null>(null);

  const saveDraft = useCallback((document: Draft) => {
    if (savedRef.current === document) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
      savedRef.current = document;
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, []);
  const updatePreview = useMemo(
    () =>
      debounce((document: Draft) => {
        setPreview(document.text);
        saveDraft(document);
      }, 3000),
    [saveDraft],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const document: unknown = JSON.parse(raw);
        if (
          !document ||
          typeof document !== 'object' ||
          !('name' in document) ||
          !('text' in document) ||
          typeof document.name !== 'string' ||
          typeof document.text !== 'string'
        )
          throw new Error('Invalid draft');
        const restored = { name: document.name, text: document.text };
        latestRef.current = restored;
        savedRef.current = restored;
        setDraft(restored);
        setPreview(restored.text);
        setSaveStatus('saved');
      }
    } catch {
      setError(
        'Your saved draft could not be opened. Local saving is paused to preserve it; you can still write and download.',
      );
      setSaveStatus('error');
      return;
    }
    setLoaded(true);
    const flush = () => saveDraft(latestRef.current);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [saveDraft]);

  useEffect(() => {
    if (loaded) {
      updatePreview(draft);
      return () => updatePreview.cancel();
    }
    const timer = setTimeout(() => setPreview(draft.text), 3000);
    return () => clearTimeout(timer);
  }, [draft, loaded, updatePreview]);

  const rendered = useMemo(
    () => (
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents} skipHtml>
        {preview}
      </Markdown>
    ),
    [preview],
  );
  useEffect(() => {
    const elements = preview.trim()
      ? previewRef.current?.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6')
      : undefined;
    setHeadings(
      Array.from(elements ?? [], (element, index) => {
        element.id = `md-heading-${index}`;
        return {
          id: element.id,
          text: element.textContent ?? '',
          level: Number(element.tagName[1]),
        };
      }),
    );
    setActiveHeading('');
  }, [rendered, preview]);

  function edit(document: Draft) {
    latestRef.current = document;
    setDraft(document);
    if (loaded) setSaveStatus('waiting');
  }
  function format(item: (typeof FORMATS)[number]) {
    const editor = editorRef.current;
    if (!editor) return;
    const { selectionStart: start, selectionEnd: end } = editor;
    const selection = draft.text.slice(start, end) || item.placeholder;
    const block = ['Heading', 'Quote', 'List', 'Task list', 'Code block'].includes(item.label);
    const lineBreak = block && start > 0 && draft.text[start - 1] !== '\n' ? '\n' : '';
    const insertion = `${lineBreak}${item.before}${selection}${item.after}`;
    editor.focus();
    // Native insertion keeps formatting in the textarea's undo history.
    if (!document.execCommand('insertText', false, insertion))
      edit({ ...draft, text: draft.text.slice(0, start) + insertion + draft.text.slice(end) });
    requestAnimationFrame(() =>
      editor.setSelectionRange(
        start + lineBreak.length + item.before.length,
        start + lineBreak.length + item.before.length + selection.length,
      ),
    );
  }
  async function openFile(file: File | undefined) {
    if (!file) return;
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      setError('Choose a .md, .markdown, or .txt file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Choose a Markdown file smaller than 2 MB.');
      return;
    }
    try {
      const text = await file.text();
      updatePreview.cancel();
      edit({ name: file.name, text });
      setPreview(text);
      if (loaded) setError('');
    } catch {
      setError('This file could not be opened. Your current draft is still here.');
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([draft.text], { type: 'text/markdown;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    const name = draft.name.trim().replace(/[/\\]/g, '-') || 'untitled.md';
    link.download = /\.(md|markdown)$/i.test(name) ? name : `${name}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const words = draft.text.trim().split(/\s+/).filter(Boolean).length;
  const pending = draft.text !== preview;

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <span className="h-1.5 w-1.5 bg-primary" /> A place for your words
          </div>
          <h2 className="text-[30px] font-bold leading-tight tracking-[-0.045em]">Markdown</h2>
          <p className="mt-1 text-sm text-muted-foreground">From rough notes to a good read.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={styles.openButton} onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Open file
          </button>
          <button
            className="gum-button flex h-10 items-center gap-2 px-4 text-sm font-semibold"
            onClick={download}
          >
            <Download size={15} /> Download
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            className="hidden"
            aria-label="Open Markdown file"
            onChange={(event) => {
              void openFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <ToolCard minHeight="min-h-0">
        <div className={styles.documentBar}>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <FileText size={17} className="shrink-0 text-muted-foreground" />
            <input
              aria-label="Document name"
              value={draft.name}
              onChange={(event) => edit({ ...draft, name: event.target.value })}
              className={styles.filename}
            />
          </div>
          <div className="flex items-center gap-1.5" aria-label="Document view">
            {VIEWS.map(({ id, label, icon: Icon }) => (
              <ToolChip
                key={id}
                active={view === id}
                onClick={() => setView(id)}
                className="flex items-center gap-1.5"
              >
                <Icon size={13} />
                <span>{label}</span>
              </ToolChip>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <CopyButton text={draft.text} title="Copy Markdown" size={15} />
            <button
              className={styles.iconButton}
              aria-label="Toggle document outline"
              aria-pressed={outlineOpen}
              disabled={view === 'write'}
              onClick={() => setOutlineOpen(!outlineOpen)}
              title="Document outline"
            >
              <ListTree size={16} />
            </button>
          </div>
        </div>
        <div className={styles.workspace} data-view={view}>
          <section
            className={styles.editorPane}
            aria-label="Markdown editor"
            hidden={view === 'read'}
          >
            <div className={styles.paneBar}>
              <span className={styles.paneLabel}>
                <Code2 size={13} /> Source
              </span>
              <div className="flex flex-wrap items-center gap-0.5" aria-label="Markdown formatting">
                {FORMATS.map((item) => (
                  <button
                    key={item.label}
                    title={item.label}
                    aria-label={item.label}
                    className={styles.iconButton}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => format(item)}
                  >
                    <item.icon size={14} />
                  </button>
                ))}
              </div>
            </div>
            <textarea
              ref={editorRef}
              aria-label="Markdown source"
              value={draft.text}
              onChange={(event) => edit({ ...draft, text: event.target.value })}
              onKeyDown={(event) => {
                if (
                  (event.metaKey || event.ctrlKey) &&
                  ['b', 'i', 'k'].includes(event.key.toLowerCase())
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  const label = { b: 'Bold', i: 'Italic', k: 'Link' }[
                    event.key.toLowerCase() as 'b' | 'i' | 'k'
                  ];
                  const item = FORMATS.find((entry) => entry.label === label);
                  if (item) format(item);
                }
              }}
              placeholder="# Start with a thought…"
              spellCheck={false}
              className={styles.editor}
            />
            <div className={styles.editorFoot}>
              <span>Markdown, plain and simple.</span>
              <span>⌘B bold · ⌘I italic</span>
            </div>
          </section>
          <section
            className={styles.previewPane}
            aria-label="Rendered Markdown"
            hidden={view === 'write'}
          >
            <div className={styles.paneBar}>
              <span className={styles.paneLabel}>
                <AlignLeft size={13} /> {view === 'read' ? 'Reading room' : 'Preview'}
              </span>
              <span
                role="status"
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${pending ? 'bg-primary' : 'bg-muted-foreground/45'}`}
                />
                {pending ? 'Updating after 3s pause' : 'Up to date'}
              </span>
            </div>
            <div className={styles.readingLayout}>
              {outlineOpen && (
                <nav className={styles.outline} aria-label="Document outline">
                  <p className={styles.paneLabel}>On this page</p>
                  {headings.length ? (
                    headings.map((heading) => (
                      <button
                        key={heading.id}
                        className={styles.outlineItem}
                        data-active={activeHeading === heading.id}
                        style={{ paddingLeft: `${Math.min(heading.level - 1, 3) * 10 + 8}px` }}
                        onClick={() => {
                          previewRef.current
                            ?.querySelector(`#${heading.id}`)
                            ?.scrollIntoView({ block: 'start' });
                          setActiveHeading(heading.id);
                        }}
                      >
                        {heading.text}
                      </button>
                    ))
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Add a heading to find your way.
                    </p>
                  )}
                </nav>
              )}
              <div className={styles.readingScroll}>
                <article ref={previewRef} className={styles.prose}>
                  {preview.trim() ? (
                    rendered
                  ) : (
                    <div className={styles.empty}>
                      <PenLine size={24} />
                      <h3>Your words go here.</h3>
                      <p>Start writing or open a Markdown file.</p>
                    </div>
                  )}
                </article>
              </div>
            </div>
          </section>
        </div>
        <div className={styles.statusBar}>
          <span className="flex items-center gap-1.5" role="status">
            {saveStatus === 'saved' ? (
              <Check size={12} />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
            {saveStatus === 'error'
              ? 'Local save unavailable — download to keep your work'
              : saveStatus === 'saved'
                ? 'Saved on this device'
                : 'Unsaved changes · saves after 3s pause'}
          </span>
          <span>
            {words.toLocaleString()} words <span className="mx-2 opacity-40">/</span>{' '}
            {Math.max(1, Math.ceil(words / 200))} min read
          </span>
        </div>
      </ToolCard>
      <p className="text-center text-[11px] text-muted-foreground">
        Your words stay in your browser. A little space, just for you.
      </p>
    </div>
  );
}
