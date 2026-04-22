"use client";

import Image from "next/image";
import { Bell, Bot, Search } from "lucide-react";
import styles from "./Topbar.module.css";

interface TopbarProps {
  alertCount?: number;
  onCommandPaletteOpen?: () => void;
}

export default function Topbar({
  alertCount = 0,
  onCommandPaletteOpen,
}: TopbarProps) {
  return (
    <header className={styles.topbar} role="banner">
      <div className={styles.brand}>
        <Image
          src="/brand/logo-icon.svg"
          alt=""
          width={24}
          height={24}
          aria-hidden="true"
          priority
        />
        <span className={styles.wordmark}>Profession OS</span>
      </div>

      <div className={styles.searchTrigger}>
        <button
          className={styles.searchButton}
          onClick={onCommandPaletteOpen}
          aria-label="Open command palette (Cmd+K)"
        >
          <Search size={12} aria-hidden="true" />
          <span>Search or run a command…</span>
          <kbd className={styles.searchHint}>⌘K</kbd>
        </button>
      </div>

      <div className={styles.actions}>
        {alertCount > 0 && (
          <button
            className={styles.alertBadge}
            aria-label={`${alertCount} active alert${alertCount !== 1 ? "s" : ""}`}
          >
            <Bell size={10} aria-hidden="true" />
            <span className={styles.alertBadgeCount}>{alertCount}</span>
          </button>
        )}

        <button
          className={styles.iconButton}
          aria-label="Toggle AI assistant"
        >
          <Bot size={16} aria-hidden="true" />
        </button>

        <div className={styles.avatar} role="button" aria-label="User menu" tabIndex={0}>
          <span className={styles.statusDot} aria-hidden="true" />
        </div>
      </div>
    </header>
  );
}
