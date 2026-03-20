"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  width?: number;
  delay?: number;
  className?: string;
}

interface Position {
  top: number;
  left: number;
  transformOrigin: string;
}

/** Returns the bottom edge of the lowest sticky/fixed element at the top of the page */
function getStickyBottom(): number {
  let maxBottom = 0;
  document.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const style = window.getComputedStyle(el);
    if (style.position === "sticky" || style.position === "fixed") {
      const rect = el.getBoundingClientRect();
      // Only count bars anchored to the top (top < 10px) with visible height
      if (rect.top < 10 && rect.height > 0 && rect.bottom > maxBottom) {
        maxBottom = rect.bottom;
      }
    }
  });
  return maxBottom;
}

function computePosition(
  rect: DOMRect,
  mouseX: number,
  tooltipWidth: number,
  tooltipHeight: number
): Position {
  const MARGIN = 8;
  const GAP = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Minimum top we can ever render — just below all sticky/fixed header bars
  const minTop = getStickyBottom() + MARGIN;

  // --- Vertical: prefer below trigger, flip above if not enough room ---
  const spaceBelow = vh - rect.bottom - GAP;
  const spaceAbove = rect.top - minTop - GAP;
  const placeBelow = spaceBelow >= tooltipHeight || spaceBelow >= spaceAbove;

  let top = placeBelow
    ? rect.bottom + GAP
    : rect.top - GAP - tooltipHeight;

  // Hard clamp — never overlap the sticky header
  if (top < minTop) top = minTop;

  // --- Horizontal: center on cursor X, clamp to viewport ---
  let left = mouseX - tooltipWidth / 2;
  if (left + tooltipWidth > vw - MARGIN) left = vw - MARGIN - tooltipWidth;
  if (left < MARGIN) left = MARGIN;

  const originXPct = Math.min(100, Math.max(0, ((mouseX - left) / tooltipWidth) * 100));
  const transformOriginY = placeBelow ? "top" : "bottom";
  const transformOrigin = `${originXPct.toFixed(0)}% ${transformOriginY}`;

  return { top, left, transformOrigin };
}

export function Tooltip({
  children,
  content,
  width = 256,
  delay = 100,
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<Position>({ top: 0, left: 0, transformOrigin: "50% top" });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseXRef = useRef<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const show = useCallback((e: MouseEvent) => {
    mouseXRef.current = e.clientX;
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const estimatedHeight = tooltipRef.current?.offsetHeight ?? 120;
      setPos(computePosition(rect, mouseXRef.current, width, estimatedHeight));
      setVisible(true);
    }, delay);
  }, [delay, width]);

  const move = useCallback((e: MouseEvent) => {
    mouseXRef.current = e.clientX;
    if (visible && triggerRef.current && tooltipRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const actualHeight = tooltipRef.current.offsetHeight;
      setPos(computePosition(rect, mouseXRef.current, width, actualHeight));
    }
  }, [visible, width]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  // Recompute after tooltip renders with actual height
  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const actualHeight = tooltipRef.current.offsetHeight;
    setPos(computePosition(rect, mouseXRef.current, width, actualHeight));
  }, [visible, width]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseMove={move}
        onMouseLeave={hide}
        onFocus={(e) => {
          if (!triggerRef.current) return;
          const rect = triggerRef.current.getBoundingClientRect();
          mouseXRef.current = rect.left + rect.width / 2;
          show(e as unknown as MouseEvent);
        }}
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
