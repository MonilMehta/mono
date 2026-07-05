'use client';

import { useMemo, useState } from 'react';
import { ToolCard } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';

interface Rgb { r: number; g: number; b: number }
interface Hsl { h: number; s: number; l: number }

function hexToRgb(hex: string): Rgb | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = s / 100, ln = l / 100;
  if (s === 0) { const v = Math.round(ln * 255); return { r: v, g: v, b: v }; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hn = h / 360;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1/3) * 255),
  };
}

function parseRgb(input: string): Rgb | null {
  const m = input.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

export default function ColorTool() {
  const [hex, setHex] = useState('#6366f1');
  const [rgbStr, setRgbStr] = useState('99, 102, 241');
  const [hslStr, setHslStr] = useState('239, 84%, 67%');

  const rgb = useMemo(() => hexToRgb(hex) ?? { r: 99, g: 102, b: 241 }, [hex]);
  const hsl = useMemo(() => rgbToHsl(rgb), [rgb]);

  const updateFromHex = (v: string) => {
    const h = v.startsWith('#') ? v : `#${v}`;
    setHex(h);
    const r = hexToRgb(h);
    if (r) {
      const h2 = rgbToHsl(r);
      setRgbStr(`${r.r}, ${r.g}, ${r.b}`);
      setHslStr(`${h2.h}, ${h2.s}%, ${h2.l}%`);
    }
  };

  const updateFromRgb = (v: string) => {
    setRgbStr(v);
    const r = parseRgb(`rgb(${v})`);
    if (r) {
      setHex(rgbToHex(r));
      const h = rgbToHsl(r);
      setHslStr(`${h.h}, ${h.s}%, ${h.l}%`);
    }
  };

  const updateFromHsl = (v: string) => {
    setHslStr(v);
    const m = v.match(/(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/);
    if (m) {
      const r = hslToRgb({ h: +m[1], s: +m[2], l: +m[3] });
      setHex(rgbToHex(r));
      setRgbStr(`${r.r}, ${r.g}, ${r.b}`);
    }
  };

  const formats = {
    hex: hex,
    rgb: `rgb(${rgbStr})`,
    hsl: `hsl(${hslStr})`,
    tailwind: `[${hex}]`,
    rn: `'${hex}'`,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ToolCard className="p-6 space-y-6">
        <div
          className="w-full h-40 rounded-2xl border border-border/30 transition-colors"
          style={{ backgroundColor: hex }}
        />
        <div className="space-y-4">
          <ColorField label="HEX" value={hex} onChange={updateFromHex} />
          <ColorField label="RGB" value={rgbStr} onChange={updateFromRgb} prefix="rgb(" suffix=")" />
          <ColorField label="HSL" value={hslStr} onChange={updateFromHsl} prefix="hsl(" suffix=")" />
        </div>
        <input
          type="color"
          value={hex.length === 7 ? hex : '#6366f1'}
          onChange={(e) => updateFromHex(e.target.value)}
          className="w-full h-10 rounded-lg cursor-pointer"
        />
      </ToolCard>

      <ToolCard className="p-6">
        <p className="text-sm font-medium mb-4">Copy formats</p>
        <div className="space-y-3">
          {Object.entries(formats).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2 border-b border-border/20">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
                <p className="text-sm font-mono">{value}</p>
              </div>
              <CopyButton text={value} size={14} />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-6">
          HSL: {hsl.h}° {hsl.s}% {hsl.l}%
        </p>
      </ToolCard>
    </div>
  );
}

function ColorField({
  label, value, onChange, prefix = '', suffix = '',
}: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string; suffix?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-1 mt-1">
        {prefix && <span className="text-sm font-mono text-muted-foreground">{prefix}</span>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-secondary font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {suffix && <span className="text-sm font-mono text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
