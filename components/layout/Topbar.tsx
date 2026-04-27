"use client";

import Image from "next/image";
import { Bell, Bot, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import styles from "./Topbar.module.css";

interface TopbarProps {
  alertCount?: number;
  onCommandPaletteOpen?: () => void;
  userInitials?: string;
  orgLogoUrl?: string | null;
  orgName?: string | null;
}

export default function Topbar({
  alertCount = 0,
  onCommandPaletteOpen,
  userInitials,
  orgLogoUrl,
  orgName,
}: TopbarProps) {
  const { theme, toggle } = useTheme();

  return (
    <header className={styles.topbar} role="banner">
      <div className={styles.brand}>
        {orgLogoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={orgLogoUrl}
              alt={orgName ?? "Organization logo"}
              height={28}
              style={{ maxWidth: 120, objectFit: "contain" }}
            />
            <span className={styles.wordmark}>{orgName} OS</span>
          </>
        ) : (
          <Image
            src="/brand/logo.svg"
            alt="Profession OS"
            width={140}
            height={28}
            priority
          />
        )}
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

        <button
          className={styles.iconButton}
          onClick={toggle}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <Sun size={16} aria-hidden="true" />
          ) : (
            <Moon size={16} aria-hidden="true" />
          )}
        </button>

        <div className={styles.avatar} role="button" aria-label="User menu" tabIndex={0}>
          {userInitials && (
            <span className={styles.avatarInitials} aria-hidden="true">
              {userInitials}
            </span>
          )}
          <span className={styles.statusDot} aria-hidden="true" />
        </div>
      </div>
    </header>
  );
}
