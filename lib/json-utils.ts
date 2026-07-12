export interface JsonStats {
  lines: number;
  chars: number;
  size: number;
  minSize: number;
  compression: number;
  keys: number;
  arrays: number;
  depth: number;
  isLarge?: boolean;
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

export function computeLightweightStats(json: string): JsonStats {
  return {
    lines: 0,
    chars: json.length,
    size: json.length,
    minSize: 0,
    compression: 0,
    keys: 0,
    arrays: 0,
    depth: 0,
    isLarge: true,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function parseJsonPath(path: string): (string | number)[] {
  if (path === '$') return [];
  const rest = path.startsWith('$.') ? path.slice(2) : path.startsWith('$') ? path.slice(1) : path;
  const segments: (string | number)[] = [];

  let remaining = rest;
  while (remaining.length > 0) {
    if (remaining.startsWith('.')) remaining = remaining.slice(1);
    if (remaining.startsWith('[')) {
      const match = remaining.match(/^\[(\d+)\]/);
      if (!match) break;
      segments.push(parseInt(match[1], 10));
      remaining = remaining.slice(match[0].length);
    } else {
      const match = remaining.match(/^([^.\[]+)/);
      if (!match) break;
      segments.push(match[1]);
      remaining = remaining.slice(match[0].length);
    }
  }

  return segments;
}

export function deleteAtPath(data: unknown, path: string): unknown {
  if (path === '$') return data;

  const segments = parseJsonPath(path);
  if (segments.length === 0) return data;

  const clone = structuredClone(data);
  let parent: unknown = clone;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (typeof seg === 'number') {
      parent = (parent as unknown[])[seg];
    } else {
      parent = (parent as Record<string, unknown>)[seg];
    }
    if (parent === undefined) return data;
  }

  const last = segments[segments.length - 1];
  if (typeof last === 'number' && Array.isArray(parent)) {
    parent.splice(last, 1);
  } else if (typeof last === 'string' && parent !== null && typeof parent === 'object' && !Array.isArray(parent)) {
    delete (parent as Record<string, unknown>)[last];
  }

  return clone;
}

export interface JsonPathMatch {
  path: string;
  value: unknown;
}

type JsonPathSegment = string | number | '*';

function formatJsonPathSegment(parent: string, segment: string | number): string {
  if (typeof segment === 'number') return `${parent}[${segment}]`;
  return /^[A-Za-z_$][\w$]*$/.test(segment)
    ? `${parent}.${segment}`
    : `${parent}[${JSON.stringify(segment)}]`;
}

function parseJsonPathQuery(query: string): JsonPathSegment[] {
  const source = query.trim();
  if (!source.startsWith('$')) throw new Error('Query must start with $');

  const segments: JsonPathSegment[] = [];
  let index = 1;

  while (index < source.length) {
    if (source[index] === '.') {
      index++;
      if (source[index] === '*') {
        segments.push('*');
        index++;
        continue;
      }
      const match = source.slice(index).match(/^[A-Za-z_$][\w$]*/);
      if (!match) throw new Error(`Expected a property at character ${index + 1}`);
      segments.push(match[0]);
      index += match[0].length;
      continue;
    }

    if (source[index] === '[') {
      const end = source.indexOf(']', index + 1);
      if (end === -1) throw new Error('Missing closing ]');
      const content = source.slice(index + 1, end).trim();
      if (content === '*') {
        segments.push('*');
      } else if (/^\d+$/.test(content)) {
        segments.push(Number(content));
      } else if (content.startsWith('"') && content.endsWith('"')) {
        try {
          segments.push(JSON.parse(content));
        } catch {
          throw new Error('Invalid quoted property name');
        }
      } else if (content.startsWith("'") && content.endsWith("'")) {
        segments.push(content.slice(1, -1).replace(/\\'/g, "'"));
      } else {
        throw new Error('Use an index, *, or a quoted property name inside []');
      }
      index = end + 1;
      continue;
    }

    throw new Error(`Unexpected character ${source[index]}`);
  }

  return segments;
}

export function queryJsonPath(data: unknown, query: string, maxMatches = 100): JsonPathMatch[] {
  const segments = parseJsonPathQuery(query);
  let matches: JsonPathMatch[] = [{ path: '$', value: data }];

  for (const segment of segments) {
    const next: JsonPathMatch[] = [];
    for (const match of matches) {
      if (next.length >= maxMatches) break;
      if (segment === '*') {
        if (Array.isArray(match.value)) {
          for (let index = 0; index < match.value.length && next.length < maxMatches; index++) {
            next.push({ path: formatJsonPathSegment(match.path, index), value: match.value[index] });
          }
        } else if (match.value !== null && typeof match.value === 'object') {
          for (const key in match.value) {
            if (!Object.hasOwn(match.value, key)) continue;
            next.push({
              path: formatJsonPathSegment(match.path, key),
              value: (match.value as Record<string, unknown>)[key],
            });
            if (next.length >= maxMatches) break;
          }
        }
        continue;
      }

      if (typeof segment === 'number') {
        if (Array.isArray(match.value) && segment < match.value.length) {
          next.push({ path: formatJsonPathSegment(match.path, segment), value: match.value[segment] });
        }
      } else if (match.value !== null && typeof match.value === 'object' && Object.hasOwn(match.value, segment)) {
        next.push({
          path: formatJsonPathSegment(match.path, segment),
          value: (match.value as Record<string, unknown>)[segment],
        });
      }
    }
    matches = next;
  }

  return matches;
}

export interface JsonRepairResult {
  text: string;
  changes: string[];
}

function stripJsonComments(source: string): string {
  let output = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      output += character;
    } else if (character === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index++;
      output += source[index] ?? '';
    } else if (character === '/' && source[index + 1] === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++;
      index++;
    } else {
      output += character;
    }
  }
  return output;
}

function replaceSingleQuotedStrings(source: string): string {
  let output = '';
  let doubleQuoted = false;
  let escaped = false;

  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (doubleQuoted) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') doubleQuoted = false;
      continue;
    }
    if (character === '"') {
      doubleQuoted = true;
      output += character;
      continue;
    }
    if (character !== "'") {
      output += character;
      continue;
    }

    let value = '';
    let closed = false;
    for (index++; index < source.length; index++) {
      const next = source[index];
      if (next === '\\' && index + 1 < source.length) {
        const escapedCharacter = source[++index];
        value += escapedCharacter === "'" ? "'" : `\\${escapedCharacter}`;
      } else if (next === "'") {
        closed = true;
        break;
      } else {
        value += next;
      }
    }
    output += closed ? JSON.stringify(value) : `'${value}`;
  }
  return output;
}

function quoteBareKeys(source: string): string {
  let output = '';
  let quote: '"' | null = null;
  let escaped = false;

  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"') {
      quote = character;
      output += character;
      continue;
    }
    if (character !== '{' && character !== ',') {
      output += character;
      continue;
    }

    output += character;
    const whitespaceStart = index + 1;
    let cursor = whitespaceStart;
    while (/\s/.test(source[cursor] ?? '')) cursor++;
    const keyMatch = source.slice(cursor).match(/^[A-Za-z_$][\w$-]*/);
    if (!keyMatch) continue;
    const key = keyMatch[0];
    const afterKey = cursor + key.length;
    let afterWhitespace = afterKey;
    while (/\s/.test(source[afterWhitespace] ?? '')) afterWhitespace++;
    if (source[afterWhitespace] !== ':') continue;

    output += source.slice(whitespaceStart, cursor);
    output += JSON.stringify(key);
    output += source.slice(afterKey, afterWhitespace);
    index = afterWhitespace - 1;
  }
  return output;
}

function normalizePythonLiterals(source: string): string {
  let output = '';
  let quote: '"' | null = null;
  let escaped = false;

  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"') {
      quote = character;
      output += character;
      continue;
    }
    const literal = source.slice(index).match(/^(True|False|None)\b/);
    if (literal) {
      output += literal[1] === 'True' ? 'true' : literal[1] === 'False' ? 'false' : 'null';
      index += literal[1].length - 1;
    } else {
      output += character;
    }
  }
  return output;
}

function removeTrailingCommas(source: string): string {
  let output = '';
  let quote: '"' | null = null;
  let escaped = false;

  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"') {
      quote = character;
      output += character;
      continue;
    }
    if (character === ',') {
      let cursor = index + 1;
      while (/\s/.test(source[cursor] ?? '')) cursor++;
      if (source[cursor] === '}' || source[cursor] === ']') continue;
    }
    output += character;
  }
  return output;
}

export function repairJson(source: string): JsonRepairResult {
  const stages: { label: string; apply: (value: string) => string }[] = [
    { label: 'removed a byte-order mark', apply: (value) => value.replace(/^\uFEFF/, '') },
    { label: 'removed comments', apply: stripJsonComments },
    { label: 'converted single-quoted strings', apply: replaceSingleQuotedStrings },
    { label: 'quoted bare property names', apply: quoteBareKeys },
    { label: 'normalized Python literals', apply: normalizePythonLiterals },
    { label: 'removed trailing commas', apply: removeTrailingCommas },
  ];

  const changes: string[] = [];
  let text = source;
  for (const stage of stages) {
    const next = stage.apply(text);
    if (next !== text) changes.push(stage.label);
    text = next;
  }
  return { text, changes };
}

function mapJson(value: unknown, mapper: (key: string, value: unknown) => [string, unknown] | null): unknown {
  if (Array.isArray(value)) return value.map((item) => mapJson(item, mapper));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, unknown>>((result, [key, child]) => {
      const mapped = mapper(key, child);
      if (mapped) result[mapped[0]] = mapJson(mapped[1], mapper);
      return result;
    }, {});
  }
  return value;
}

export function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value)
      .sort((a, b) => a.localeCompare(b))
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortJsonKeys((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

export function flattenJson(value: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const visit = (current: unknown, path: string) => {
    if (Array.isArray(current)) {
      if (current.length === 0) result[path] = [];
      current.forEach((item, index) => visit(item, formatJsonPathSegment(path, index)));
    } else if (current !== null && typeof current === 'object') {
      const entries = Object.entries(current);
      if (entries.length === 0) result[path] = {};
      entries.forEach(([key, item]) => visit(item, formatJsonPathSegment(path, key)));
    } else {
      result[path] = current;
    }
  };
  visit(value, '$');
  return result;
}

export function unflattenJson(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Unflatten expects an object whose keys are JSONPath values');
  }

  let root: unknown = {};
  for (const [path, item] of Object.entries(value)) {
    const segments = parseJsonPathQuery(path);
    if (segments.includes('*')) throw new Error('Unflatten does not support wildcard paths');
    if (segments.length === 0) {
      root = item;
      continue;
    }

    if (typeof root !== 'object' || root === null) root = typeof segments[0] === 'number' ? [] : {};
    let current = root as Record<string, unknown> | unknown[];
    segments.forEach((segment, index) => {
      const isLast = index === segments.length - 1;
      if (isLast) {
        (current as Record<string | number, unknown>)[segment] = item;
        return;
      }
      const nextSegment = segments[index + 1];
      const existing = (current as Record<string | number, unknown>)[segment];
      if (existing === null || typeof existing !== 'object') {
        (current as Record<string | number, unknown>)[segment] = typeof nextSegment === 'number' ? [] : {};
      }
      current = (current as Record<string | number, unknown>)[segment] as Record<string, unknown> | unknown[];
    });
  }
  return root;
}

export function extractRootArrayFields(value: unknown, fields: string[]): unknown {
  if (!Array.isArray(value)) throw new Error('Extract fields works on a root array');
  const selected = fields.map((field) => field.trim()).filter(Boolean);
  if (selected.length === 0) throw new Error('Enter at least one field name');
  return value.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return item;
    return selected.reduce<Record<string, unknown>>((result, field) => {
      if (Object.hasOwn(item, field)) result[field] = (item as Record<string, unknown>)[field];
      return result;
    }, {});
  });
}

export function renameJsonKey(value: unknown, from: string, to: string): unknown {
  if (!from.trim() || !to.trim()) throw new Error('Enter both the current and new key names');
  return mapJson(value, (key, child) => [key === from.trim() ? to.trim() : key, child]);
}

export function removeJsonKey(value: unknown, keyToRemove: string): unknown {
  if (!keyToRemove.trim()) throw new Error('Enter a key name to remove');
  return mapJson(value, (key, child) => (key === keyToRemove.trim() ? null : [key, child]));
}
