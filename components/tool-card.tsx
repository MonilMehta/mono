'use client';

interface ToolCardProps {
  children: React.ReactNode;
  className?: string;
  minHeight?: string;
}

export function ToolCard({ children, className = '', minHeight = 'min-h-64' }: ToolCardProps) {
  return (
    <div
      className={`surface-panel rounded-3xl overflow-hidden flex flex-col ${minHeight} transition-colors duration-200 hover:border-primary/20 ${className}`}
    >
      {children}
    </div>
  );
}

interface ToolTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  mono?: boolean;
}

export function ToolTextarea({ value, onChange, placeholder, className = '', mono = true }: ToolTextareaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`flex-1 bg-transparent p-7 text-base resize-none focus:outline-none placeholder-muted-foreground/45 leading-8 selection:bg-primary/20 ${mono ? 'font-mono' : 'font-sans'} ${className}`}
    />
  );
}

interface ToolBarProps {
  children: React.ReactNode;
}

export function ToolBar({ children }: ToolBarProps) {
  return (
    <div className="border-t border-border/40 bg-secondary/40 backdrop-blur-sm px-7 py-4 flex items-center justify-between gap-5">
      {children}
    </div>
  );
}
