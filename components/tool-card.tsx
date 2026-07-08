'use client';

import type { LucideIcon } from 'lucide-react';

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
      className={`flex-1 bg-transparent px-5 py-5 text-[13.5px] resize-none focus:outline-none placeholder-muted-foreground/40 leading-7 selection:bg-primary/20 ${mono ? 'font-mono' : 'font-sans'} ${className}`}
    />
  );
}

interface ToolBarProps {
  children: React.ReactNode;
}

export function ToolBar({ children }: ToolBarProps) {
  return (
    <div className="border-t border-border/45 bg-secondary/30 px-5 py-3 flex items-center justify-between gap-4">
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

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className = '' }: EmptyStateProps) {
  return (
    <div className={`empty-canvas flex-1 flex flex-col items-center justify-center text-center px-8 py-12 ${className}`}>
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-card/80 text-primary shadow-sm">
          <Icon size={20} strokeWidth={1.75} />
        </div>
      )}
      <p className="text-sm font-semibold text-foreground/90 tracking-tight">{title}</p>
      {description && (
        <p className="mt-1.5 text-xs text-muted-foreground max-w-[240px] leading-5">{description}</p>
      )}
    </div>
  );
}
