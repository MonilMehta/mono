'use client';

import { useMemo, useState } from 'react';
import { ToolCard, ToolBar } from '@/components/tool-card';
import { CopyButton } from '@/components/copy-button';

type LinkType = 'custom' | 'expo-go' | 'universal';

export default function DeeplinkTool() {
  const [linkType, setLinkType] = useState<LinkType>('custom');
  const [scheme, setScheme] = useState('myapp');
  const [host, setHost] = useState('127.0.0.1:8081');
  const [path, setPath] = useState('/profile');
  const [params, setParams] = useState('userId=123\nref=email');
  const [universalDomain, setUniversalDomain] = useState('myapp.com');

  const queryString = useMemo(() => {
    const pairs = params
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [k, ...rest] = l.split('=');
        return [k.trim(), rest.join('=').trim()] as [string, string];
      });
    const qs = new URLSearchParams();
    pairs.forEach(([k, v]) => { if (k) qs.set(k, v); });
    const s = qs.toString();
    return s ? `?${s}` : '';
  }, [params]);

  const urls = useMemo(() => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const result: { label: string; url: string }[] = [];

    if (linkType === 'custom' || linkType === 'expo-go') {
      result.push({
        label: 'Custom scheme',
        url: `${scheme}://${cleanPath.replace(/^\//, '')}${queryString}`,
      });
    }

    if (linkType === 'expo-go') {
      const expoPath = cleanPath.startsWith('/--') ? cleanPath : `/--${cleanPath}`;
      result.push({
        label: 'Expo Go (dev)',
        url: `exp://${host}${expoPath}${queryString}`,
      });
      result.push({
        label: 'Expo Go (LAN)',
        url: `exp://${host}${expoPath}${queryString}`,
      });
    }

    if (linkType === 'universal') {
      result.push({
        label: 'Universal link',
        url: `https://${universalDomain}${cleanPath}${queryString}`,
      });
      result.push({
        label: 'App scheme fallback',
        url: `${scheme}://${cleanPath.replace(/^\//, '')}${queryString}`,
      });
    }

    return result;
  }, [linkType, scheme, host, path, queryString, universalDomain]);

  const expoConfig = useMemo(() => {
    return JSON.stringify({
      expo: {
        scheme: scheme,
        ...(linkType === 'universal' && {
          ios: { associatedDomains: [`applinks:${universalDomain}`] },
          android: { intentFilters: [{ action: 'VIEW', data: [{ scheme: 'https', host: universalDomain }], category: ['BROWSABLE', 'DEFAULT'] }] },
        }),
      },
    }, null, 2);
  }, [scheme, linkType, universalDomain]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ToolCard className="p-6 space-y-5">
        <div className="flex gap-2 flex-wrap">
          {([
            { id: 'custom' as const, label: 'Custom scheme' },
            { id: 'expo-go' as const, label: 'Expo Go' },
            { id: 'universal' as const, label: 'Universal link' },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setLinkType(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                linkType === t.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Field label="Scheme" value={scheme} onChange={setScheme} placeholder="myapp" />
        {linkType === 'expo-go' && (
          <Field label="Dev server host" value={host} onChange={setHost} placeholder="127.0.0.1:8081" />
        )}
        {linkType === 'universal' && (
          <Field label="Domain" value={universalDomain} onChange={setUniversalDomain} placeholder="myapp.com" />
        )}
        <Field label="Path" value={path} onChange={setPath} placeholder="/profile" />
        <div>
          <label className="text-xs text-muted-foreground">Query params (key=value, one per line)</label>
          <textarea
            value={params}
            onChange={(e) => setParams(e.target.value)}
            rows={4}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary font-mono text-sm focus:outline-none resize-none"
            placeholder="userId=123&#10;ref=email"
          />
        </div>
      </ToolCard>

      <div className="space-y-4">
        {urls.map((item) => (
          <ToolCard key={item.label} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              <CopyButton text={item.url} size={14} />
            </div>
            <p className="text-sm font-mono break-all text-primary">{item.url}</p>
          </ToolCard>
        ))}

        <ToolCard className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">app.json snippet</span>
            <CopyButton text={expoConfig} size={14} />
          </div>
          <pre className="text-xs font-mono overflow-auto max-h-48 text-foreground/70">{expoConfig}</pre>
        </ToolCard>

        <ToolCard className="p-4">
          <ToolBar>
            <span className="text-xs text-muted-foreground">
              Test with: <code className="text-primary">npx uri-scheme open &quot;{urls[0]?.url}&quot; --ios</code>
            </span>
          </ToolBar>
        </ToolCard>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
