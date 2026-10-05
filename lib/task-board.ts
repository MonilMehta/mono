export type BoardPosition = { x: number; y: number };

export const BOARD_CARD_WIDTH = 250;
const BOARD_MARGIN = 28;

export function nextBoardLayer(items: readonly { boardLayer?: number }[]) {
  return Math.max(items.length + 1, ...items.map((item) => item.boardLayer ?? 0)) + 1;
}

export function boardPlacement(index: number, width: number, saved?: BoardPosition) {
  const available = Math.max(0, width - BOARD_CARD_WIDTH - BOARD_MARGIN * 2);
  const columns = Math.max(1, Math.floor((width - BOARD_MARGIN * 2 + 28) / (BOARD_CARD_WIDTH + 28)));
  const x = saved?.x ?? Math.min(available, (index % columns) * 278) / Math.max(1, available);
  const y = saved?.y ?? 64 + Math.floor(index / columns) * 310 + [0, 48, 12][index % 3];
  return { left: BOARD_MARGIN + Math.max(0, Math.min(1, x)) * available, top: Math.max(52, y) };
}

export function boardPosition(x: number, y: number, width: number, height: number, cardHeight: number): BoardPosition {
  return {
    x: Math.max(0, Math.min(1, (x - BOARD_MARGIN) / Math.max(1, width - BOARD_CARD_WIDTH - BOARD_MARGIN * 2))),
    y: Math.max(52, Math.min(height - cardHeight - BOARD_MARGIN, y)),
  };
}
