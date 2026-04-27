"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Calendar, MessageSquare, Code2, Users, ChevronLeft, AlertTriangle, RefreshCw } from "lucide-react";
import styles from "./ServiceDetailShell.module.css";

type ServiceKey = "mail" | "calendar" | "messaging" | "code" | "crm";
type TimeRange = "24h" | "7d" | "30d";

// "disconnected" = service not connected yet (default shell state)
// "loading"      = data fetch in flight
// "empty"        = connected, no items in range
// "error"        = fetch failed
// "populated"    = data ready (web developer fills in children)
export type DetailState = "disconnected" | "loading" | "empty" | "error" | "populated";

const SERVICE_CONFIG: Record<
  ServiceKey,
  { label: string; icon: React.ReactNode; description: string; emptyMessage: string }
> = {
  mail: {
    label: "Email",
    icon: <Mail size={20} aria-hidden="true" />,
    description: "Email activity and message metrics",
    emptyMessage: "No unread messages in this period",
  },
  calendar: {
    label: "Calendar",
    icon: <Calendar size={20} aria-hidden="true" />,
    description: "Calendar events and scheduling overview",
    emptyMessage: "No events scheduled in this period",
  },
  messaging: {
    label: "Messaging",
    icon: <MessageSquare size={20} aria-hidden="true" />,
    description: "Messages and channel activity",
    emptyMessage: "All caught up — no unread messages",
  },
  code: {
    label: "Code",
    icon: <Code2 size={20} aria-hidden="true" />,
    description: "Pull requests, commits, and code activity",
    emptyMessage: "No open pull requests",
  },
  crm: {
    label: "CRM",
    icon: <Users size={20} aria-hidden="true" />,
    description: "Contacts, follow-ups, and pipeline metrics",
    emptyMessage: "No follow-ups due in this period",
  },
};

const TIME_RANGES: TimeRange[] = ["24h", "7d", "30d"];

interface Props {
  service: ServiceKey;
  /** Override the derived page state (web developer wires this to real data) */
  pageState?: DetailState;
  /** Called when user clicks Retry on the error state */
  onRetry?: () => void;
  /** Populated-state content */
  children?: React.ReactNode;
}

export default function ServiceDetailShell({
  service,
  pageState = "disconnected",
  onRetry,
  children,
}: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const config = SERVICE_CONFIG[service];

  return (
    <div className={styles.page}>
      {/* ── Breadcrumb ───────────────────────────────────────────────── */}
      <Link href="/" className={styles.breadcrumb}>
        <ChevronLeft size={14} aria-hidden="true" />
        Dashboard
      </Link>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>{config.icon}</span>
          <div>
            <h1 className={styles.heading}>{config.label}</h1>
            <p className={styles.subheading}>{config.description}</p>
          </div>
        </div>

        {/* Time range selector */}
        <div className={styles.timeRangeSelector} role="group" aria-label="Time range">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              className={`${styles.timeRangeBtn} ${timeRange === range ? styles.timeRangeBtnActive : ""}`}
              onClick={() => setTimeRange(range)}
              aria-pressed={timeRange === range}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── Content area ─────────────────────────────────────────────── */}
      <div className={styles.content}>
        {pageState === "loading" && <LoadingSkeleton />}

        {pageState === "error" && (
          <div className={styles.stateCenter}>
            <div className={`${styles.stateIconRing} ${styles.stateIconRingError}`}>
              <AlertTriangle size={24} className={`${styles.stateIcon} ${styles.stateIconError}`} aria-hidden="true" />
            </div>
            <p className={styles.stateMessage}>Failed to load {config.label} data</p>
            {onRetry && (
              <button className={styles.actionBtn} onClick={onRetry}>
                <RefreshCw size={14} aria-hidden="true" />
                Retry
              </button>
            )}
          </div>
        )}

        {pageState === "empty" && (
          <div className={styles.stateCenter}>
            <div className={styles.stateIconRing}>
              {config.icon}
            </div>
            <p className={styles.stateMessage}>{config.emptyMessage}</p>
          </div>
        )}

        {pageState === "disconnected" && (
          <>
            {/* Chart area — placeholder until data layer is wired */}
            <div className={styles.chartArea} aria-label="Metrics chart — service not connected">
              <span className={styles.chartPlaceholderText}>
                Detailed metrics · Connect {config.label} to see activity
              </span>
            </div>

            <div className={styles.disconnectedState}>
              <p className={styles.stateMessage}>No {config.label} service connected.</p>
              <Link href="/dashboard/settings/services/new" className={styles.actionBtn}>
                Connect {config.label} →
              </Link>
            </div>
          </>
        )}

        {pageState === "populated" && (
          <>
            {/* Chart area — web developer replaces with real chart component */}
            <div className={styles.chartArea} aria-label={`${config.label} metrics chart`}>
              <span className={styles.chartPlaceholderText}>Chart · {timeRange}</span>
            </div>

            {/* Item list — web developer fills in per-service rows */}
            <div className={styles.itemList}>
              {children}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className={styles.skeletonWrapper} aria-busy="true" aria-label="Loading…">
      <div className={`${styles.skeleton} ${styles.skeletonChart}`} />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} />
      ))}
    </div>
  );
}
