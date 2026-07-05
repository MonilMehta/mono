export interface JsonStats {
  lines: number;
  chars: number;
  size: number;
  minSize: number;
  compression: number;
  keys: number;
  arrays: number;
  depth: number;
}

export interface ParseError {
  message: string;
  line?: number;
  column?: number;
  position?: number;
}

export function getLineColumn(text: string, position: number): { line: number; column: number } {
  const before = text.slice(0, position);
  const lines = before.split('\n');
  return { line: lines.length, column: (lines[lines.length - 1]?.length ?? 0) + 1 };
}

export function parseJsonError(json: string, err: unknown): ParseError {
  const message = err instanceof Error ? err.message : String(err);
  const posMatch = message.match(/position\s+(\d+)/i);
  const lineColMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);

  if (lineColMatch) {
    return {
      message,
      line: parseInt(lineColMatch[1], 10),
      column: parseInt(lineColMatch[2], 10),
    };
  }

  if (posMatch) {
    const position = parseInt(posMatch[1], 10);
    const { line, column } = getLineColumn(json, position);
    return { message, position, line, column };
  }

  return { message };
}

export function parseJson(json: string): { ok: true; data: unknown } | { ok: false; error: ParseError } {
  try {
    return { ok: true, data: JSON.parse(json) };
  } catch (err) {
    return { ok: false, error: parseJsonError(json, err) };
  }
}

export function countKeys(obj: unknown): number {
  if (typeof obj !== 'object' || obj === null) return 0;
  let count = 0;
  for (const key of Object.keys(obj)) {
    count++;
    count += countKeys((obj as Record<string, unknown>)[key]);
  }
  return count;
}

export function countArrays(obj: unknown): number {
  if (typeof obj !== 'object' || obj === null) return 0;
  let count = Array.isArray(obj) ? 1 : 0;
  for (const key of Object.keys(obj)) {
    count += countArrays((obj as Record<string, unknown>)[key]);
  }
  return count;
}

export function getDepth(obj: unknown, depth = 0): number {
  if (typeof obj !== 'object' || obj === null) return depth;
  let maxDepth = depth;
  for (const key of Object.keys(obj)) {
    maxDepth = Math.max(maxDepth, getDepth((obj as Record<string, unknown>)[key], depth + 1));
  }
  return maxDepth;
}

export function computeStats(json: string, parsed: unknown): JsonStats {
  const formatted = JSON.stringify(parsed, null, 2);
  const minified = JSON.stringify(parsed);
  return {
    lines: formatted.split('\n').length,
    chars: json.length,
    size: new Blob([formatted]).size,
    minSize: new Blob([minified]).size,
    compression: json.length > 0 ? Math.round(((json.length - minified.length) / json.length) * 100) : 0,
    keys: countKeys(parsed),
    arrays: countArrays(parsed),
    depth: getDepth(parsed),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
