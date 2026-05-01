"use client";

import { useRef, useCallback } from "react";
import { X, Minus, Plus } from "lucide-react";
import type { DashboardWidget } from "@/lib/types";
import ClockWidget from "./ClockWidget";
import WeatherWidget from "./WeatherWidget";
import styles from "./DashboardTile.module.css";

interface DashboardTileProps {
  widget: DashboardWidget;
  onClose: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onChange: (id: string, changes: Partial<DashboardWidget>) => void;
}

export default function DashboardTile({
  widget,
  onClose,
  onToggleCollapse,
  onChange,
}: DashboardTileProps) {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const resizeRef = useRef<{
    startX: number;
    startY: number;
    originW: number;
    originH: number;
  } | null>(null);

  // ── Drag by title bar ──────────────────────────────────────────────
  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      // Ignore clicks on buttons inside the title bar
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: widget.x,
        originY: widget.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      function onMove(ev: PointerEvent) {
        if (!dragRef.current) return;
        onChange(widget.id, {
          x: Math.max(
            0,
            dragRef.current.originX + ev.clientX - dragRef.current.startX,
          ),
          y: Math.max(
            0,
            dragRef.current.originY + ev.clientY - dragRef.current.startY,
          ),
        });
      }
      function onUp() {
        dragRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [widget.id, widget.x, widget.y, onChange],
  );

  // ── Resize by bottom-right corner ──────────────────────────────────
  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originW: widget.width,
        originH: widget.height,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      function onMove(ev: PointerEvent) {
        if (!resizeRef.current) return;
        onChange(widget.id, {
          width: Math.max(
            180,
            resizeRef.current.originW + ev.clientX - resizeRef.current.startX,
          ),
          height: Math.max(
            100,
            resizeRef.current.originH + ev.clientY - resizeRef.current.startY,
          ),
        });
      }
      function onUp() {
        resizeRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [widget.id, widget.width, widget.height, onChange],
  );

  return (
    <div
      className={styles.tile}
      style={{
        left: widget.x,
        top: widget.y,
        width: widget.width,
        height: widget.collapsed ? undefined : widget.height,
      }}
    >
      {/* Title bar — drag zone */}
      <div className={styles.titleBar} onPointerDown={handleDragStart}>
        <button
          className={styles.closeBtn}
          onClick={() => onClose(widget.id)}
          aria-label="Close widget"
        >
          <X size={10} />
        </button>
        <span className={styles.title}>{widget.title}</span>
        <button
          className={styles.collapseBtn}
          onClick={() => onToggleCollapse(widget.id)}
          aria-label={widget.collapsed ? "Expand widget" : "Collapse widget"}
        >
          {widget.collapsed ? <Plus size={10} /> : <Minus size={10} />}
        </button>
      </div>

      {/* Body */}
      {!widget.collapsed && (
        <>
          <div className={styles.body}>
            {widget.type === "clock" ? (
              <ClockWidget config={widget.config} />
            ) : widget.type === "weather" ? (
              <WeatherWidget config={widget.config} />
            ) : (
              <div className={styles.content}>
                {widget.content || "No content"}
              </div>
            )}
          </div>
          {/* Resize handle — bottom-right corner */}
          <div
            className={styles.resizeHandle}
            onPointerDown={handleResizeStart}
            aria-hidden="true"
          />
        </>
      )}
    </div>
  );
}
