'use client';

interface ToolCardProps {
  children: React.ReactNode;
  className?: string;
  minHeight?: string;
}

export function ToolCard({ children, className = '', minHeight = 'min-h-64' }: ToolCardProps) {
  return (
    <div
      className={`surface-panel rounded-2xl overflow-hidden flex flex-col ${minHeight} transition-colors duration-200 ${className}`}
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
      className={`flex-1 bg-transparent px-5 py-5 text-[13.5px] resize-none focus:outline-none placeholder-muted-foreground/45 leading-7 selection:bg-primary/20 ${mono ? 'font-mono' : 'font-sans'} ${className}`}
    />
  );
}

interface ToolBarProps {
  children: React.ReactNode;
}

export function ToolBar({ children }: ToolBarProps) {
  return (
    <div className="border-t border-border/50 bg-secondary/35 px-5 py-3 flex items-center justify-between gap-4">
      {children}
    </div>
  );
}

interface ToolSectionProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ToolSection({ title, description, actions, children, className = '' }: ToolSectionProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {(title || actions) && (
        <div className="flex items-end justify-between gap-4 px-0.5">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>}
            {description && <p className="text-xs text-muted-foreground mt-0.5 leading-5">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

interface ToolChipProps {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function ToolChip({ active, onClick, children, className = '' }: ToolChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary'
      } ${className}`}
    >
      {children}
    </button>
  );
}
