"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./CommandPalette.module.css";

export interface Command {
  id: string;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  group?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

export default function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Reset and focus when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Defer focus so the element is visible before we focus it
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered =
    query.trim() === ""
      ? commands
      : commands.filter(
          (cmd) =>
            cmd.label.toLowerCase().includes(query.toLowerCase()) ||
            cmd.subtitle?.toLowerCase().includes(query.toLowerCase()) ||
            cmd.group?.toLowerCase().includes(query.toLowerCase())
        );

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const item = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[activeIndex]) {
          filtered[activeIndex].action();
          onClose();
        }
        break;
      case "Escape":
        onClose();
        break;
    }
  }

  if (!open) return null;

  return (
    // Backdrop — click outside to close
    <div className={styles.overlay} onMouseDown={onClose} role="presentation">
      <div
        className={styles.palette}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
      >
        {/* Search row */}
        <div className={styles.searchRow}>
          <svg
            className={styles.searchIcon}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className={styles.searchInput}
            type="text"
            placeholder="Type a command or search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="cmd-list"
            aria-activedescendant={
              filtered[activeIndex] ? `cmd-${filtered[activeIndex].id}` : undefined
            }
            role="combobox"
            aria-expanded={filtered.length > 0}
          />
          <kbd className={styles.escHint}>esc</kbd>
        </div>

        <div className={styles.divider} />

        {/* Results */}
        {filtered.length > 0 ? (
          <ul
            id="cmd-list"
            ref={listRef}
            className={styles.list}
            role="listbox"
            aria-label="Commands"
          >
            {filtered.map((cmd, i) => (
              <li
                id={`cmd-${cmd.id}`}
                key={cmd.id}
                className={`${styles.item}${i === activeIndex ? ` ${styles.active}` : ""}`}
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur on input
                  cmd.action();
                  onClose();
                }}
              >
                {cmd.icon && <span className={styles.itemIcon}>{cmd.icon}</span>}
                <div className={styles.itemText}>
                  <span className={styles.itemLabel}>{cmd.label}</span>
                  {cmd.subtitle && (
                    <span className={styles.itemSubtitle}>{cmd.subtitle}</span>
                  )}
                </div>
                {cmd.shortcut && <kbd className={styles.shortcutBadge}>{cmd.shortcut}</kbd>}
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.empty}>
            No results for <strong>&ldquo;{query}&rdquo;</strong>
          </div>
        )}
      </div>
    </div>
  );
}
