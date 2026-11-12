import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { Platform, View } from 'react-native';

/** One message menu for the chat and the diary, as in Telegram: long-press on touch,
 * right-click on desktop, a small menu beside the message over a softly dimmed screen. */
export type MenuRect = { x: number; y: number; width: number; height: number };
export type MenuItem = { key: string; label: string; icon: keyof typeof menuIcons; tone?: 'text' | 'error'; onPress(): void };
export type MenuSide = 'start' | 'end';

export const menuIcons = {
  edit: 'M4 20h4L19 9l-4-4L4 16ZM13 7l4 4',
  copy: 'M9 9h11v11H9ZM15 9V4H4v11h5',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5',
};

export const MENU_WIDTH = 208;
export const MENU_ROW = 46;
const MENU_PAD = 6;
const GAP = 8;

export const menuHeight = (count: number) => count * MENU_ROW + MENU_PAD * 2;

/** Under the message when it fits, otherwise above it, otherwise pinned to the screen edge.
 * It lines up with the message's own side and never leaves the screen. */
export function placeMenu(anchor: MenuRect, side: MenuSide, count: number, screen: { width: number; height: number }, margin = 16) {
  const height = menuHeight(count);
  const left = Math.min(Math.max(margin, side === 'end' ? anchor.x + anchor.width - MENU_WIDTH : anchor.x), Math.max(margin, screen.width - margin - MENU_WIDTH));
  const below = anchor.y + anchor.height + GAP;
  const above = anchor.y - GAP - height;
  const top = below + height <= screen.height - margin ? below : above >= margin ? above : Math.max(margin, screen.height - margin - height);
  return { left, top, width: MENU_WIDTH, height, from: top >= anchor.y + anchor.height ? 'top' as const : 'bottom' as const };
}

export const finePointer = () => Platform.OS === 'web' && typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;
export const canCopy = () => Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText;

/** Measures the message and opens its menu. On the web a right-click opens it too and
 * the browser's own menu stays closed; a touch screen uses long-press from the caller. */
export function useMenuAnchor(ref: RefObject<View | null>, onOpen: ((rect: MenuRect) => void) | undefined) {
  const latest = useRef(onOpen);
  useEffect(() => { latest.current = onOpen; });
  const open = useCallback(() => {
    const node = ref.current;
    if (!node || !latest.current) return;
    node.measureInWindow((x, y, width, height) => latest.current?.({ x, y, width, height }));
  }, [ref]);
  const enabled = !!onOpen;
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const element = ref.current as unknown as HTMLElement | null;
    if (!element?.addEventListener) return;
    const context = (event: MouseEvent) => { event.preventDefault(); open(); };
    element.addEventListener('contextmenu', context);
    return () => element.removeEventListener('contextmenu', context);
  }, [enabled, open, ref]);
  return open;
}
