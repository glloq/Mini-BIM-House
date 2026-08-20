import { useCallback, useRef } from 'react';
import { MAXIMUM_PANEL_PX, MINIMUM_PANEL_PX } from './workspace-layout.js';

export interface PanelSeparatorProps {
  readonly label: string;
  readonly widthPx: number;
  /** Which way the pointer has to travel to widen the panel. */
  readonly grows: 'RIGHT' | 'LEFT';
  readonly onResize: (widthPx: number) => void;
}

/** How much one arrow key moves a separator, in pixels. */
const KEYBOARD_STEP_PX = 16;

/**
 * The edge between a panel and the drawing.
 *
 * It is a separator rather than a button: dragging it is the obvious gesture,
 * and the arrow keys do the same thing for anyone not using a pointer, which is
 * what the pattern exists for.
 */
export function PanelSeparator({
  label,
  widthPx,
  grows,
  onResize,
}: PanelSeparatorProps) {
  const origin = useRef<
    { readonly x: number; readonly widthPx: number } | undefined
  >(undefined);

  const move = useCallback(
    (clientX: number) => {
      const start = origin.current;
      if (start === undefined) return;
      const travelled = clientX - start.x;
      onResize(start.widthPx + (grows === 'RIGHT' ? travelled : -travelled));
    },
    [grows, onResize],
  );

  return (
    <div
      className="panel-separator"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={widthPx}
      aria-valuemin={MINIMUM_PANEL_PX}
      aria-valuemax={MAXIMUM_PANEL_PX}
      tabIndex={0}
      onPointerDown={(event) => {
        origin.current = { x: event.clientX, widthPx };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (origin.current !== undefined) move(event.clientX);
      }}
      onPointerUp={(event) => {
        origin.current = undefined;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onKeyDown={(event) => {
        const towards =
          event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
        if (towards === 0) return;
        event.preventDefault();
        onResize(
          widthPx + towards * KEYBOARD_STEP_PX * (grows === 'RIGHT' ? 1 : -1),
        );
      }}
    />
  );
}
