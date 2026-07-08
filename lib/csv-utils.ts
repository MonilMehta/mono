export type Delimiter = ',' | '\t' | ';';

function parseRow(line: string, delimiter: Delimiter): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function escapeCell(value: string, delimiter: Delimiter): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function coerce(value: string): unknown {
  const t = value.trim();
  if (t === '') return '';
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return Number(t);
  return value;
}

export function detectDelimiter(text: string): Delimiter {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const counts = {
    ',': (first.match(/,/g) || []).length,
    '\t': (first.match(/\t/g) || []).length,
    ';': (first.match(/;/g) || []).length,
  } as const;
  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';']) return '\t';
  if (counts[';'] > counts[',']) return ';';
  return ',';
}

export function csvToJson(text: string, delimiter?: Delimiter): unknown[] {
  const delim = delimiter ?? detectDelimiter(text);
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseRow(lines[0], delim).map((h) => h.trim() || 'column');
  return lines.slice(1).map((line) => {
    const cells = parseRow(line, delim);
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      row[h] = coerce(cells[i] ?? '');
    });
    return row;
  });
}

export function jsonToCsv(data: unknown, delimiter: Delimiter = ','): string {
  let rows: Record<string, unknown>[];
  if (Array.isArray(data)) {
    rows = data.filter(isRecord);
  } else if (isRecord(data)) {
    rows = [data];
  } else {
    throw new Error('JSON must be an object or array of objects');
  }
  if (rows.length === 0) return '';

  const headers: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }

  const lines = [
    headers.map((h) => escapeCell(h, delimiter)).join(delimiter),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const v = row[h];
          if (v === null || v === undefined) return '';
          if (typeof v === 'object') return escapeCell(JSON.stringify(v), delimiter);
          return escapeCell(String(v), delimiter);
        })
        .join(delimiter)
    ),
  ];
  return lines.join('\n');
}

export function jsonToMarkdownTable(data: unknown): string {
  let rows: Record<string, unknown>[];
  if (Array.isArray(data)) {
    rows = data.filter(isRecord);
  } else if (isRecord(data)) {
    rows = [data];
  } else {
    throw new Error('JSON must be an object or array of objects');
  }
  if (rows.length === 0) return '';

  const headers: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }

  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  };

  const header = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${headers.map((h) => escape(row[h])).join(' | ')} |`).join('\n');
  return `${header}\n${sep}\n${body}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
