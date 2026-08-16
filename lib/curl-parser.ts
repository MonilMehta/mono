export interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  query: Record<string, string>;
}

const BROWSER_RESTRICTED_HEADERS = new Set([
  'accept-encoding', 'connection', 'content-length', 'cookie',
  'host', 'origin', 'referer', 'user-agent',
]);

export function curlToBrowserRequest(parsed: ParsedCurl): {
  url: string;
  init: RequestInit;
  omittedHeaders: string[];
} {
  const method = parsed.method.toUpperCase();
  if ((method === 'GET' || method === 'HEAD') && parsed.body !== null) {
    throw new Error(`Browsers cannot send a body with ${method} requests.`);
  }

  const omittedHeaders: string[] = [];
  const headers = Object.fromEntries(Object.entries(parsed.headers).filter(([name]) => {
    if (!BROWSER_RESTRICTED_HEADERS.has(name.toLowerCase())) return true;
    omittedHeaders.push(name);
    return false;
  }));

  return {
    url: parsed.url,
    init: { method, headers, body: parsed.body ?? undefined, credentials: 'omit' },
    omittedHeaders,
  };
}

function unquote(s: string): string {
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;
  let escaped = false;

  const push = () => {
    if (current.length > 0) {
      tokens.push(current);
      current = '';
    }
  };

  const cleaned = input.replace(/\\\r?\n/g, ' ').trim();

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      push();
      continue;
    }
    current += ch;
  }
  push();
  return tokens;
}

export function parseCurl(input: string): ParsedCurl {
  const tokens = tokenize(input);
  if (tokens.length === 0 || tokens[0].toLowerCase() !== 'curl') {
    throw new Error('Paste a curl command starting with curl');
  }

  let method = 'GET';
  let url = '';
  const headers: Record<string, string> = {};
  let body: string | null = null;
  let methodSet = false;

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    const next = () => tokens[++i] ?? '';

    if (t === '-X' || t === '--request') {
      method = next().toUpperCase();
      methodSet = true;
    } else if (t === '-H' || t === '--header') {
      const raw = next();
      const idx = raw.indexOf(':');
      if (idx > 0) {
        headers[raw.slice(0, idx).trim()] = raw.slice(idx + 1).trim();
      }
    } else if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary' || t === '--data-ascii') {
      body = next();
      if (!methodSet) method = 'POST';
    } else if (t === '--json') {
      body = next();
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      if (!methodSet) method = 'POST';
    } else if (t === '-u' || t === '--user') {
      headers['Authorization'] = `Basic ${btoa(next())}`;
    } else if (t === '-A' || t === '--user-agent') {
      headers['User-Agent'] = next();
    } else if (t === '-e' || t === '--referer') {
      headers['Referer'] = next();
    } else if (t.startsWith('-') && !t.startsWith('http')) {
      // skip unknown flags; consume value if it doesn't look like another flag/url
      const peek = tokens[i + 1];
      if (peek && !peek.startsWith('-') && !/^https?:\/\//i.test(peek)) i++;
    } else if (!url && (t.startsWith('http') || t.startsWith('/') || t.includes('.'))) {
      url = unquote(t);
    }
  }

  if (!url) throw new Error('Could not find a URL in the curl command');

  const query: Record<string, string> = {};
  try {
    const u = new URL(url);
    u.searchParams.forEach((v, k) => {
      query[k] = v;
    });
  } catch {
    // relative or malformed — leave query empty
  }

  return { method, url, headers, body, query };
}

function headersObjectLiteral(headers: Record<string, string>, indent = 2): string {
  const pad = ' '.repeat(indent);
  const entries = Object.entries(headers);
  if (entries.length === 0) return '{}';
  return `{\n${entries.map(([k, v]) => `${pad}'${k}': '${v.replace(/'/g, "\\'")}',`).join('\n')}\n${' '.repeat(indent - 2)}}`;
}

export function curlToFetch(parsed: ParsedCurl): string {
  const opts: string[] = [`  method: '${parsed.method}',`];
  if (Object.keys(parsed.headers).length) {
    opts.push(`  headers: ${headersObjectLiteral(parsed.headers, 4)},`);
  }
  if (parsed.body !== null) {
    const isJson = (parsed.headers['Content-Type'] || parsed.headers['content-type'] || '').includes('json');
    opts.push(isJson ? `  body: JSON.stringify(${tryPrettyJson(parsed.body)}),` : `  body: ${JSON.stringify(parsed.body)},`);
  }
  return `const res = await fetch('${parsed.url}', {\n${opts.join('\n')}\n});\nconst data = await res.json();`;
}

export function curlToAxios(parsed: ParsedCurl): string {
  const lines = [`method: '${parsed.method.toLowerCase()}',`, `url: '${parsed.url}',`];
  if (Object.keys(parsed.headers).length) {
    lines.push(`headers: ${headersObjectLiteral(parsed.headers, 4)},`);
  }
  if (parsed.body !== null) {
    const isJson = (parsed.headers['Content-Type'] || parsed.headers['content-type'] || '').includes('json');
    lines.push(isJson ? `data: ${tryPrettyJson(parsed.body)},` : `data: ${JSON.stringify(parsed.body)},`);
  }
  return `import axios from 'axios';\n\nconst { data } = await axios({\n  ${lines.join('\n  ')}\n});`;
}

export function curlToPython(parsed: ParsedCurl): string {
  const headers = Object.entries(parsed.headers)
    .map(([k, v]) => `    "${k}": "${v.replace(/"/g, '\\"')}",`)
    .join('\n');
  const lines = [
    'import requests',
    '',
    `url = "${parsed.url}"`,
    Object.keys(parsed.headers).length ? `headers = {\n${headers}\n}` : 'headers = {}',
  ];
  if (parsed.body !== null) {
    const isJson = (parsed.headers['Content-Type'] || parsed.headers['content-type'] || '').includes('json');
    if (isJson) {
      lines.push(`payload = ${tryPrettyJson(parsed.body)}`);
      lines.push(`res = requests.request("${parsed.method}", url, headers=headers, json=payload)`);
    } else {
      lines.push(`payload = ${JSON.stringify(parsed.body)}`);
      lines.push(`res = requests.request("${parsed.method}", url, headers=headers, data=payload)`);
    }
  } else {
    lines.push(`res = requests.request("${parsed.method}", url, headers=headers)`);
  }
  lines.push('print(res.json())');
  return lines.join('\n');
}

export function curlToUndici(parsed: ParsedCurl): string {
  const opts: string[] = [`  method: '${parsed.method}',`];
  if (Object.keys(parsed.headers).length) {
    opts.push(`  headers: ${headersObjectLiteral(parsed.headers, 4)},`);
  }
  if (parsed.body !== null) {
    opts.push(`  body: ${JSON.stringify(parsed.body)},`);
  }
  return `import { request } from 'undici';\n\nconst { statusCode, body } = await request('${parsed.url}', {\n${opts.join('\n')}\n});\nconst data = await body.json();\nconsole.log(statusCode, data);`;
}

export function curlToReactQuery(parsed: ParsedCurl, kind: 'query' | 'mutation'): string {
  const fetchBody = curlToFetch(parsed);
  if (kind === 'query') {
    return `import { useQuery } from '@tanstack/react-query';\n\nexport function useApi() {\n  return useQuery({\n    queryKey: ['api'],\n    queryFn: async () => {\n${fetchBody.split('\n').map((l) => `      ${l}`).join('\n')}\n      return data;\n    },\n  });\n}`;
  }
  return `import { useMutation } from '@tanstack/react-query';\n\nexport function useApiMutation() {\n  return useMutation({\n    mutationFn: async () => {\n${fetchBody.split('\n').map((l) => `      ${l}`).join('\n')}\n      return data;\n    },\n  });\n}`;
}

export function curlToRnFetch(parsed: ParsedCurl): string {
  // React Native-safe: no undici, explicit JSON headers when body present
  const headers = { ...parsed.headers };
  if (parsed.body !== null && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  const opts: string[] = [`  method: '${parsed.method}',`];
  if (Object.keys(headers).length) {
    opts.push(`  headers: ${headersObjectLiteral(headers, 4)},`);
  }
  if (parsed.body !== null) {
    opts.push(`  body: ${JSON.stringify(parsed.body)},`);
  }
  return `// React Native / Expo\nconst res = await fetch('${parsed.url}', {\n${opts.join('\n')}\n});\nif (!res.ok) throw new Error(\`HTTP \${res.status}\`);\nconst data = await res.json();\nreturn data;`;
}

function tryPrettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return JSON.stringify(s);
  }
}
