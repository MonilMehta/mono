'use client';

/** Three equal columns — the mono mark */
export function MonoLogo({ className = '', title = 'mono' }: { className?: string; title?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <rect x="5.5" y="7" width="5.5" height="18" rx="1.75" fill="currentColor" />
      <rect x="13.25" y="7" width="5.5" height="18" rx="1.75" fill="currentColor" />
      <rect x="21" y="7" width="5.5" height="18" rx="1.75" fill="currentColor" />
    </svg>
  );
}
