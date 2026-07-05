export function getCardShadow(isDark: boolean): string {
  return isDark
    ? '0 0 0 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
    : '0 0 0 1px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,1)';
}
