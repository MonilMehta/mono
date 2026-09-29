import type { LucideIcon } from 'lucide-react';
import {
  Braces,
  Binary,
  Link,
  Clock,
  Palette,
  GitCompare,
  Regex,
  Smartphone,
  ImageIcon,
  PenTool,
  Hash,
  Layers,
  Table2,
  FileCode2,
  Terminal,
  ScrollText,
  Server,
  ArrowLeftRight,
  FileText,
} from 'lucide-react';

export type ToolId =
  | 'json'
  | 'markdown'
  | 'base64'
  | 'url'
  | 'timestamp'
  | 'color'
  | 'diff'
  | 'regex'
  | 'deeplink'
  | 'image'
  | 'svg'
  | 'blurhash'
  | 'app-asset'
  | 'csv'
  | 'typegen'
  | 'curl'
  | 'log'
  | 'mock-api'
  | 'transfer';

export interface ToolDef {
  id: ToolId;
  label: string;
  description: string;
  category: 'data' | 'encode' | 'auth' | 'time' | 'design' | 'debug' | 'mobile' | 'media';
  icon: LucideIcon;
  keywords?: string[];
}

export const TOOLS: ToolDef[] = [
  { id: 'json', label: 'JSON', description: 'Format, validate & explore', category: 'data', icon: Braces, keywords: ['format', 'validate', 'tree', 'api'] },
  { id: 'markdown', label: 'Markdown', description: 'Write, preview & read beautifully', category: 'data', icon: FileText, keywords: ['md', 'editor', 'viewer', 'notes', 'readme', 'write', 'preview'] },
  { id: 'diff', label: 'Diff', description: 'Compare two texts', category: 'data', icon: GitCompare, keywords: ['compare', 'changes'] },
  { id: 'csv', label: 'CSV', description: 'CSV ↔ JSON ↔ Markdown', category: 'data', icon: Table2, keywords: ['tsv', 'table', 'spreadsheet', 'markdown'] },
  { id: 'typegen', label: 'Schema & Mocks', description: 'Types, schemas & API mocks', category: 'data', icon: FileCode2, keywords: ['typescript', 'interface', 'zod', 'mock', 'factory', 'msw', 'api'] },
  { id: 'mock-api', label: 'Mock API', description: 'Shareable GET, POST & PATCH endpoints', category: 'data', icon: Server, keywords: ['http', 'endpoint', 'response', 'server'] },
  { id: 'transfer', label: 'Transfer', description: 'Send text & files with a code', category: 'data', icon: ArrowLeftRight, keywords: ['share', 'file', 'text', 'code', 'send', 'receive'] },
  { id: 'curl', label: 'cURL', description: 'cURL → fetch, Axios, RN', category: 'data', icon: Terminal, keywords: ['http', 'axios', 'fetch', 'python', 'undici'] },
  { id: 'image', label: 'Image', description: 'Inspect, compress & convert', category: 'media', icon: ImageIcon, keywords: ['png', 'jpg', 'webp', 'compress', 'resize'] },
  { id: 'svg', label: 'SVG', description: 'Preview, minify & export', category: 'media', icon: PenTool, keywords: ['vector', 'icon', 'jsx', 'react-native'] },
  { id: 'blurhash', label: 'BlurHash', description: 'Generate image hashes', category: 'mobile', icon: Hash, keywords: ['thumbhash', 'placeholder', 'react-native', 'expo-image'] },
  { id: 'app-asset', label: 'App Assets', description: 'Generate icons & splash', category: 'mobile', icon: Layers, keywords: ['expo', 'react-native', 'icon', 'splash'] },
  { id: 'deeplink', label: 'Deep Link', description: 'Build Expo / app URLs', category: 'mobile', icon: Smartphone, keywords: ['expo', 'scheme', 'universal link'] },
  { id: 'base64', label: 'Encode & Auth', description: 'Base64, JWT & UUID utilities', category: 'encode', icon: Binary, keywords: ['base64', 'jwt', 'token', 'uuid', 'guid', 'auth'] },
  { id: 'url', label: 'URL', description: 'Encode & decode URLs', category: 'encode', icon: Link, keywords: ['uri', 'query', 'params'] },
  { id: 'timestamp', label: 'Timestamp', description: 'Unix ↔ ISO dates', category: 'time', icon: Clock, keywords: ['unix', 'date', 'epoch'] },
  { id: 'color', label: 'Color', description: 'Hex, RGB & HSL', category: 'design', icon: Palette, keywords: ['hex', 'rgb', 'hsl', 'picker'] },
  { id: 'regex', label: 'Regex', description: 'Test patterns live', category: 'debug', icon: Regex, keywords: ['pattern', 'match'] },
  { id: 'log', label: 'Logs & Traces', description: 'Inspect logs and stack traces', category: 'debug', icon: ScrollText, keywords: ['logger', 'error', 'stack', 'trace', 'sourcemap', 'node_modules', 'json'] },
];

export const TOOL_CATEGORIES: { id: ToolDef['category']; label: string }[] = [
  { id: 'data', label: 'Data' },
  { id: 'media', label: 'Media' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'encode', label: 'Encode' },
  { id: 'auth', label: 'Auth' },
  { id: 'time', label: 'Time' },
  { id: 'design', label: 'Design' },
  { id: 'debug', label: 'Debug' },
];

export function getTool(id: string): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}
