export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'other';

export interface LogEntry {
  raw: string;
  line: number;
  timestamp: string | null;
  level: LogLevel;
  message: string;
  json: unknown | null;
  stack: string | null;
}

const TS_RE =
  /(?:^|\s)(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?|\d{2}:\d{2}:\d{2}(?:\.\d+)?|\d{10,13})/;

const LEVEL_RE = /\b(ERROR|WARN(?:ING)?|INFO|DEBUG|FATAL|TRACE)\b/i;

function detectLevel(line: string): LogLevel {
  const m = line.match(LEVEL_RE);
  if (!m) return 'other';
  const l = m[1].toUpperCase();
  if (l === 'ERROR' || l === 'FATAL') return 'error';
  if (l === 'WARN' || l === 'WARNING') return 'warn';
  if (l === 'INFO') return 'info';
  if (l === 'DEBUG' || l === 'TRACE') return 'debug';
  return 'other';
}

function extractJson(line: string): { json: unknown | null; rest: string } {
  const start = line.indexOf('{');
  const arrStart = line.indexOf('[');
  let idx = -1;
  if (start >= 0 && (arrStart < 0 || start < arrStart)) idx = start;
  else if (arrStart >= 0) idx = arrStart;
  if (idx < 0) return { json: null, rest: line };

  for (let end = line.length; end > idx; end--) {
    const slice = line.slice(idx, end);
    try {
      const json = JSON.parse(slice);
      return { json, rest: (line.slice(0, idx) + line.slice(end)).trim() };
    } catch {
      // keep shrinking
    }
  }
  return { json: null, rest: line };
}

function extractStack(lines: string[], start: number): { stack: string | null; consumed: number } {
  const stackLines: string[] = [];
  let i = start;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s+at\s+/.test(l) || /^\s*[-]{3}/.test(l) || /:\d+:\d+\)?$/.test(l.trim())) {
      stackLines.push(l);
      i++;
    } else if (stackLines.length > 0) {
      break;
    } else {
      break;
    }
  }
  return {
    stack: stackLines.length ? stackLines.join('\n') : null,
    consumed: stackLines.length,
  };
}

export function parseLogs(text: string): LogEntry[] {
  const lines = text.split(/\r?\n/);
  const entries: LogEntry[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    if (!raw.trim()) {
      i++;
      continue;
    }

    const tsMatch = raw.match(TS_RE);
    const timestamp = tsMatch ? tsMatch[1] : null;
    const level = detectLevel(raw);
    const { json, rest } = extractJson(raw);
    const { stack, consumed } = extractStack(lines, i + 1);

    let message = rest
      .replace(TS_RE, '')
      .replace(LEVEL_RE, '')
      .replace(/^[\s\[\]|:.-]+/, '')
      .trim();
    if (!message && json) message = '(json payload)';

    entries.push({
      raw: stack ? [raw, ...lines.slice(i + 1, i + 1 + consumed)].join('\n') : raw,
      line: i + 1,
      timestamp,
      level,
      message: message || raw.trim(),
      json,
      stack,
    });
    i += 1 + consumed;
  }

  return entries;
}

export function groupErrors(entries: LogEntry[]): { message: string; count: number; lines: number[] }[] {
  const map = new Map<string, { message: string; count: number; lines: number[] }>();
  for (const e of entries.filter((x) => x.level === 'error')) {
    const key = e.message.slice(0, 120);
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      existing.lines.push(e.line);
    } else {
      map.set(key, { message: e.message, count: 1, lines: [e.line] });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
