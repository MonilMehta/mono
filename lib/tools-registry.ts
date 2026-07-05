import type { LucideIcon } from 'lucide-react';
import {
  Braces,
  KeyRound,
  Binary,
  Link,
  Clock,
  Fingerprint,
  Palette,
  GitCompare,
  Regex,
  Smartphone,
  ImageIcon,
  PenTool,
} from 'lucide-react';

export type ToolId =
  | 'json'
  | 'jwt'
  | 'base64'
  | 'url'
  | 'timestamp'
  | 'uuid'
  | 'color'
  | 'diff'
  | 'regex'
  | 'deeplink'
  | 'image'
  | 'svg';

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
  { id: 'diff', label: 'Diff', description: 'Compare two texts', category: 'data', icon: GitCompare, keywords: ['compare', 'changes'] },
  { id: 'image', label: 'Image', description: 'Inspect, compress & convert', category: 'media', icon: ImageIcon, keywords: ['png', 'jpg', 'webp', 'compress', 'resize'] },
  { id: 'svg', label: 'SVG', description: 'Preview, minify & export', category: 'media', icon: PenTool, keywords: ['vector', 'icon', 'jsx', 'react-native'] },
  { id: 'deeplink', label: 'Deep Link', description: 'Build Expo / app URLs', category: 'mobile', icon: Smartphone, keywords: ['expo', 'scheme', 'universal link'] },
  { id: 'base64', label: 'Base64', description: 'Encode & decode', category: 'encode', icon: Binary, keywords: ['b64'] },
  { id: 'url', label: 'URL', description: 'Encode & decode URLs', category: 'encode', icon: Link, keywords: ['uri', 'query', 'params'] },
  { id: 'uuid', label: 'UUID', description: 'Generate unique IDs', category: 'encode', icon: Fingerprint, keywords: ['guid', 'id'] },
  { id: 'jwt', label: 'JWT', description: 'Decode auth tokens', category: 'auth', icon: KeyRound, keywords: ['token', 'bearer', 'auth'] },
  { id: 'timestamp', label: 'Timestamp', description: 'Unix ↔ ISO dates', category: 'time', icon: Clock, keywords: ['unix', 'date', 'epoch'] },
  { id: 'color', label: 'Color', description: 'Hex, RGB & HSL', category: 'design', icon: Palette, keywords: ['hex', 'rgb', 'hsl', 'picker'] },
  { id: 'regex', label: 'Regex', description: 'Test patterns live', category: 'debug', icon: Regex, keywords: ['pattern', 'match'] },
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
