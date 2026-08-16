'use client';

import { useState, type ReactNode } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: number;
  title?: string;
  label?: string;
  icon?: ReactNode;
}

export function CopyButton({ text, className = '', size = 16, title = 'Copy', label, icon }: CopyButtonProps) {
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
      {copied ? <Check size={size} className={label ? '' : 'text-accent'} /> : icon ?? <Copy size={size} />}
      {label && <span>{copied ? 'Copied' : label}</span>}
    </button>
  );
}
