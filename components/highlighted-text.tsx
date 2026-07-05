'use client';

import type { ReactNode } from 'react';

interface HighlightedTextProps {
  text: string;
  query: string;
  className?: string;
}

export function HighlightedText({ text, query, className }: HighlightedTextProps) {
  if (!query.trim()) {
    return <span className={className}>{text}</span>;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: ReactNode[] = [];
  let start = 0;
  let idx = lowerText.indexOf(lowerQuery);
  let key = 0;

  while (idx !== -1) {
    if (idx > start) {
      parts.push(<span key={key++}>{text.slice(start, idx)}</span>);
    }
    parts.push(
      <mark 
        key={key++} 
        className="highlight-mark bg-accent text-accent-foreground font-semibold rounded-sm px-0.5 shadow-sm transition-all data-[active=true]:ring-2 data-[active=true]:ring-ring data-[active=true]:ring-offset-1 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
      >
        {text.slice(idx, idx + query.length)}
      </mark>
    );
    start = idx + query.length;
    idx = lowerText.indexOf(lowerQuery, start);
  }

  if (start < text.length) {
    parts.push(<span key={key++}>{text.slice(start)}</span>);
  }

  return <span className={className}>{parts}</span>;
}
