"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Bell, Bot, ChevronLeft, ChevronRight, LogOut, Moon, Search, Settings, Sun, Timer } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import styles from "./Topbar.module.css";

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

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
  userEmail?: string;
  orgLogoUrl?: string | null;
  orgName?: string | null;
  pollIntervalSeconds?: number;
  onPollIntervalChange?: (seconds: number) => void;
  onSignOut?: () => void;
  onSettings?: () => void;
  onToggleAI?: () => void;
  aiOpen?: boolean;
}

export default function Topbar({
  alertCount = 0,
  onCommandPaletteOpen,
  userInitials,
  userName,
  userEmail,
  orgLogoUrl,
  orgName,
  pollIntervalSeconds = 30,
  onPollIntervalChange,
  onSignOut,
  onSettings,
  onToggleAI,
  aiOpen,
}: TopbarProps) {
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [calOpen, setCalOpen] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [calYear, setCalYear] = useState(0);
  const [calMonth, setCalMonth] = useState(0);

  // Initialise on client only to avoid SSR hydration mismatch
  useEffect(() => {
    const d = new Date();
    setNow(d);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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

  useEffect(() => {
    if (!calOpen) return;
    const handler = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) {
        setCalOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [calOpen]);

  function openCal() {
    if (!calOpen && now) {
      setCalYear(now.getFullYear());
      setCalMonth(now.getMonth());
    }
    setCalOpen((v) => !v);
  }

  function prevMonth() {
    setCalMonth((m) => {
      if (m === 0) { setCalYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }

  function nextMonth() {
    setCalMonth((m) => {
      if (m === 11) { setCalYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }

  const todayY = now?.getFullYear();
  const todayM = now?.getMonth();
  const todayD = now?.getDate();
  const calDays = now ? buildCalendarDays(calYear, calMonth) : [];

  const timeStr = now
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  const dateStr = now
    ? now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
    : "";

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
            <span className={styles.wordmark}>{orgName} <span className={styles.wordmarkAccent}>OS</span></span>
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
        {now && (
          <div ref={calRef} className={styles.clockContainer}>
            <button
              className={styles.clockButton}
              aria-label="Date and time — click to open calendar"
              aria-expanded={calOpen}
              aria-haspopup="dialog"
              onClick={openCal}
            >
              <span className={styles.clockTime}>{timeStr}</span>
              <span className={styles.clockDate}>{dateStr}</span>
            </button>

            {calOpen && (
              <div className={styles.calDropdown} role="dialog" aria-label="Calendar">
                <div className={styles.calHeader}>
                  <button
                    className={styles.calNavBtn}
                    onClick={prevMonth}
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={14} aria-hidden="true" />
                  </button>
                  <span className={styles.calMonthLabel}>
                    {MONTH_NAMES[calMonth]} {calYear}
                  </span>
                  <button
                    className={styles.calNavBtn}
                    onClick={nextMonth}
                    aria-label="Next month"
                  >
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </div>

                <div className={styles.calGrid}>
                  {DAY_NAMES.map((d) => (
                    <span key={d} className={styles.calDayName}>{d}</span>
                  ))}
                  {calDays.map((day, i) => {
                    const isToday = day !== null && day === todayD && calMonth === todayM && calYear === todayY;
                    return (
                      <span
                        key={i}
                        className={`${styles.calDay} ${day === null ? styles.calDayEmpty : ""} ${isToday ? styles.calDayToday : ""}`}
                      >
                        {day ?? ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

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
          className={`${styles.iconButton}${aiOpen ? ` ${styles.iconButtonActive}` : ""}`}
          onClick={onToggleAI}
          aria-label="Toggle AI assistant"
          aria-expanded={aiOpen}
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
                  <div className={styles.menuUserInfo}>
                    {userName && <span className={styles.menuUserName}>{userName}</span>}
                    {userEmail && <span className={styles.menuUserEmail}>{userEmail}</span>}
                  </div>
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
                  onSettings?.();
                }}
              >
                <Settings size={14} aria-hidden="true" />
                Settings
              </button>

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
