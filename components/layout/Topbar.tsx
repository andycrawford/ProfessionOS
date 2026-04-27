"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Bell, Bot, LogOut, Moon, Search, Sun, Timer } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import styles from "./Topbar.module.css";

const REFRESH_OPTIONS = [
  { label: "15s", seconds: 15 },
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "15m", seconds: 900 },
];

interface TopbarProps {
  alertCount?: number;
  onCommandPaletteOpen?: () => void;
  userInitials?: string;
  userName?: string;
  orgLogoUrl?: string | null;
  orgName?: string | null;
  pollIntervalSeconds?: number;
  onPollIntervalChange?: (seconds: number) => void;
  onSignOut?: () => void;
}

export default function Topbar({
  alertCount = 0,
  onCommandPaletteOpen,
  userInitials,
  userName,
  orgLogoUrl,
  orgName,
  pollIntervalSeconds = 30,
  onPollIntervalChange,
  onSignOut,
}: TopbarProps) {
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

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

        <div ref={menuRef} className={styles.avatarContainer}>
          <button
            className={styles.avatar}
            aria-label="User menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {userInitials && (
              <span className={styles.avatarInitials} aria-hidden="true">
                {userInitials}
              </span>
            )}
            <span className={styles.statusDot} aria-hidden="true" />
          </button>

          {menuOpen && (
            <div className={styles.userMenu} role="menu">
              {(userInitials || userName) && (
                <div className={styles.menuHeader}>
                  {userInitials && (
                    <div className={styles.menuAvatar} aria-hidden="true">
                      {userInitials}
                    </div>
                  )}
                  {userName && <span className={styles.menuUserName}>{userName}</span>}
                </div>
              )}

              <div className={styles.menuDivider} />

              <div className={styles.menuSection}>
                <span className={styles.menuSectionLabel}>
                  <Timer size={11} aria-hidden="true" />
                  Refresh rate
                </span>
                <div className={styles.refreshOptions} role="group" aria-label="Refresh rate">
                  {REFRESH_OPTIONS.map((opt) => (
                    <button
                      key={opt.seconds}
                      className={`${styles.refreshOption} ${pollIntervalSeconds === opt.seconds ? styles.refreshOptionActive : ""}`}
                      onClick={() => {
                        onPollIntervalChange?.(opt.seconds);
                        setMenuOpen(false);
                      }}
                      aria-pressed={pollIntervalSeconds === opt.seconds}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.menuDivider} />

              <button
                className={styles.menuItem}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut?.();
                }}
              >
                <LogOut size={14} aria-hidden="true" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
