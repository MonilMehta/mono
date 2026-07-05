'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: number;
  title?: string;
}

export function CopyButton({ text, className = '', size = 16, title = 'Copy' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground ${className}`}
      title={title}
    >
      {copied ? <Check size={size} className="text-accent" /> : <Copy size={size} />}
    </button>
  );
}
