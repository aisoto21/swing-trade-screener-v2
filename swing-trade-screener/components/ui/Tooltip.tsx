"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  children: ReactNode;       // the trigger element
  content: ReactNode;        // tooltip content
  width?: number;            // tooltip width in px (default 256)
  delay?: number;            // show delay in ms (default 120)
  className?: string;
}

interface Position {
  top: number;
  left: number;
  transformOrigin: string;
}

function computePosition(
  rect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number
): Position {
  const MARGIN = 8; // px gap between trigger and tooltip
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // --- Vertical: prefer below, flip above if not enough room ---
  const spaceBelow = vh - rect.bottom - MARGIN;
  const spaceAbove = rect.top - MARGIN;
  const placeBelow = spaceBelow >= tooltipHeight || spaceBelow >= spaceAbove;

  const top = placeBelow
    ? rect.bottom + MARGIN
    : rect.top - MARGIN - tooltipHeight;

  // --- Horizontal: align left of trigger, shift left if clips right edge ---
  let left = rect.left;
  if (left + tooltipWidth > vw - MARGIN) {
    left = vw - MARGIN - tooltipWidth;
  }
  if (left < MARGIN) left = MARGIN;

  const transformOriginY = placeBelow ? "top" : "bottom";
  const originXPct = Math.min(
    100,
    Math.max(0, ((rect.left + rect.width / 2 - left) / tooltipWidth) * 100)
  );
  const transformOrigin = `${originXPct.toFixed(0)}% ${transformOriginY}`;

  return { top, left, transformOrigin };
}

export function Tooltip({
  children,
  content,
  width = 256,
  delay = 120,
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<Position>({ top: 0, left: 0, transformOrigin: "top left" });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      // Measure tooltip height — estimate 120px, recalc after render
      const estimatedHeight = tooltipRef.current?.offsetHeight ?? 120;
      setPos(computePosition(rect, width, estimatedHeight));
      setVisible(true);
    }, delay);
  }, [delay, width]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  // Recompute position after tooltip renders (actual height known)
  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const actualHeight = tooltipRef.current.offsetHeight;
    setPos(computePosition(rect, width, actualHeight));
  }, [visible, width]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={className}
        style={{ display: "contents" }}
      >
        {children}
      </div>

      {mounted && visible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            onMouseLeave={hide}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width,
              zIndex: 9999,
              transformOrigin: pos.transformOrigin,
              pointerEvents: "none",
            }}
            className="rounded border border-[var(--border-default)] bg-[var(--background-elevated)] p-3 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
