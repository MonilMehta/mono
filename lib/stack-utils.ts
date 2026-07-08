export interface StackFrame {
  raw: string;
  functionName: string | null;
  file: string | null;
  line: number | null;
  column: number | null;
  isApp: boolean;
  isNodeModules: boolean;
  isNative: boolean;
}

export interface ParsedStack {
  errorMessage: string;
  frames: StackFrame[];
}

const FRAME_RE =
  /^\s*at\s+(?:(.+?)\s+\()?((?:https?:\/\/|file:\/\/|webpack:\/\/|\/|\w:)[^)\s]+?)(?::(\d+))?(?::(\d+))?\)?\s*$/;

const RN_FRAME_RE = /^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)\s*$/;

function classify(file: string | null): Pick<StackFrame, 'isApp' | 'isNodeModules' | 'isNative'> {
  if (!file) return { isApp: false, isNodeModules: false, isNative: true };
  const f = file.toLowerCase();
  if (f.includes('node_modules') || f.includes('node:internal') || f.includes('native')) {
    return { isApp: false, isNodeModules: f.includes('node_modules'), isNative: !f.includes('node_modules') };
  }
  if (f === '<anonymous>' || f.startsWith('native ')) {
    return { isApp: false, isNodeModules: false, isNative: true };
  }
  return { isApp: true, isNodeModules: false, isNative: false };
}

function parseFrame(line: string): StackFrame | null {
  const trimmed = line.trimEnd();
  if (!/^\s*at\s+/.test(trimmed) && !trimmed.includes(':')) return null;

  let m = trimmed.match(FRAME_RE) || trimmed.match(RN_FRAME_RE);
  if (!m) {
    // Chrome: "function@file:line:col" or bare "file:line:col"
    const alt = trimmed.match(/^(?:(.+)@)?(.+):(\d+):(\d+)$/);
    if (!alt) return null;
    const file = alt[2];
    const cls = classify(file);
    return {
      raw: trimmed,
      functionName: alt[1] || null,
      file,
      line: Number(alt[3]),
      column: Number(alt[4]),
      ...cls,
    };
  }

  const functionName = m[1] || null;
  const file = m[2] || null;
  const lineNum = m[3] ? Number(m[3]) : null;
  const column = m[4] ? Number(m[4]) : null;
  const cls = classify(file);

  return {
    raw: trimmed,
    functionName,
    file,
    line: lineNum,
    column,
    ...cls,
  };
}

export function parseStackTrace(text: string): ParsedStack {
  const lines = text.split(/\r?\n/);
  const frames: StackFrame[] = [];
  const messageLines: string[] = [];

  for (const line of lines) {
    const frame = parseFrame(line);
    if (frame) {
      frames.push(frame);
    } else if (frames.length === 0 && line.trim()) {
      messageLines.push(line.trim());
    }
  }

  return {
    errorMessage: messageLines.join('\n') || 'Error',
    frames,
  };
}

export function formatCleanStack(parsed: ParsedStack, appOnly: boolean): string {
  const frames = appOnly ? parsed.frames.filter((f) => f.isApp) : parsed.frames;
  const body = frames
    .map((f) => {
      const loc = f.file
        ? `${f.file}${f.line != null ? `:${f.line}` : ''}${f.column != null ? `:${f.column}` : ''}`
        : '<unknown>';
      return f.functionName ? `  at ${f.functionName} (${loc})` : `  at ${loc}`;
    })
    .join('\n');
  return `${parsed.errorMessage}\n${body}`;
}
