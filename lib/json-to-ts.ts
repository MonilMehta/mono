function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toPascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(capitalize)
    .join('') || 'Root';
}

function inferPrimitive(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'number') return Number.isInteger(v) ? 'number' : 'number';
  if (typeof v === 'boolean') return 'boolean';
  return 'unknown';
}

function mergeTypes(a: string, b: string): string {
  if (a === b) return a;
  if (a === 'any' || b === 'any') return 'any';
  if (a === 'unknown') return b;
  if (b === 'unknown') return a;
  const parts = new Set([...a.split(' | '), ...b.split(' | ')]);
  return [...parts].sort().join(' | ');
}

interface TypeGenOptions {
  rootName?: string;
  useInterface?: boolean;
  optionalFields?: boolean;
  readonly?: boolean;
}

export function jsonToTypeScript(data: unknown, options: TypeGenOptions = {}): string {
  const {
    rootName = 'Root',
    useInterface = true,
    optionalFields = false,
    readonly = false,
  } = options;

  const defs: string[] = [];
  const seen = new Map<string, string>();

  function emitObject(obj: Record<string, unknown>, name: string): string {
    const key = JSON.stringify(Object.keys(obj).sort().map((k) => [k, typeof obj[k]]));
    const cached = seen.get(key + name);
    if (cached) return cached;

    const typeName = toPascalCase(name);
    seen.set(key + name, typeName);

    const lines: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const safeKey = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
      const fieldType = infer(v, capitalize(k));
      const opt = optionalFields || v === null || v === undefined ? '?' : '';
      const ro = readonly ? 'readonly ' : '';
      lines.push(`  ${ro}${safeKey}${opt}: ${fieldType};`);
    }

    const keyword = useInterface ? 'interface' : 'type';
    const body = useInterface
      ? `export ${keyword} ${typeName} {\n${lines.join('\n')}\n}`
      : `export ${keyword} ${typeName} = {\n${lines.join('\n')}\n};`;
    defs.push(body);
    return typeName;
  }

  function infer(value: unknown, name: string): string {
    if (Array.isArray(value)) {
      if (value.length === 0) return 'unknown[]';
      let itemType = infer(value[0], name.replace(/s$/, '') || 'Item');
      for (let i = 1; i < value.length; i++) {
        itemType = mergeTypes(itemType, infer(value[i], name.replace(/s$/, '') || 'Item'));
      }
      return `${itemType.includes('|') ? `(${itemType})` : itemType}[]`;
    }
    if (isPlainObject(value)) {
      return emitObject(value, name);
    }
    return inferPrimitive(value);
  }

  const rootType = infer(data, rootName);
  if (defs.length === 0) {
    return `export type ${toPascalCase(rootName)} = ${rootType};`;
  }
  // Ensure root alias if root was a primitive/array
  if (!defs.some((d) => d.includes(` ${toPascalCase(rootName)} `) || d.includes(` ${toPascalCase(rootName)} {`))) {
    defs.unshift(`export type ${toPascalCase(rootName)} = ${rootType};`);
  }
  return defs.reverse().join('\n\n');
}

export function jsonToZod(data: unknown, rootName = 'Root'): string {
  const defs: string[] = [];
  const emitted = new Set<string>();

  function zodFor(value: unknown, name: string): string {
    if (value === null) return 'z.null()';
    if (typeof value === 'string') return 'z.string()';
    if (typeof value === 'number') return 'z.number()';
    if (typeof value === 'boolean') return 'z.boolean()';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'z.array(z.unknown())';
      return `z.array(${zodFor(value[0], name.replace(/s$/, '') || 'Item')})`;
    }
    if (isPlainObject(value)) {
      const typeName = toPascalCase(name);
      if (!emitted.has(typeName)) {
        emitted.add(typeName);
        const fields = Object.entries(value)
          .map(([k, v]) => {
            const safe = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
            return `  ${safe}: ${zodFor(v, capitalize(k))},`;
          })
          .join('\n');
        defs.push(`export const ${typeName}Schema = z.object({\n${fields}\n});`);
      }
      return `${typeName}Schema`;
    }
    return 'z.unknown()';
  }

  const root = zodFor(data, rootName);
  if (defs.length === 0) {
    return `import { z } from 'zod';\n\nexport const ${toPascalCase(rootName)}Schema = ${root};`;
  }
  return `import { z } from 'zod';\n\n${defs.reverse().join('\n\n')}`;
}

export function sampleMock(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.length > 0 ? [sampleMock(data[0])] : [];
  }
  if (isPlainObject(data)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      out[k] = sampleMock(v);
    }
    return out;
  }
  if (typeof data === 'string') return 'string';
  if (typeof data === 'number') return 0;
  if (typeof data === 'boolean') return false;
  return null;
}
