"use client";

import { Mail, Calendar, MessageSquare, Code2, Users } from "lucide-react";
import styles from "./ActivityTimeline.module.css";

export type FeedItemSeverity = "critical" | "warning" | "info" | "neutral";

export type FeedService = "mail" | "calendar" | "slack" | "code" | "crm" | "ai";

export interface FeedItem {
  id: string;
  severity: FeedItemSeverity;
  service: FeedService;
  title: string;
  subtitle?: string;
  timestamp: string;
}

interface ActivityTimelineProps {
  items?: FeedItem[];
  activeFilter?: FeedService | "all";
  onFilterChange?: (filter: FeedService | "all") => void;
}

const SERVICE_FILTERS: { id: FeedService | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mail", label: "Mail" },
  { id: "calendar", label: "Calendar" },
  { id: "slack", label: "Slack" },
  { id: "crm", label: "CRM" },
  { id: "code", label: "Code" },
  { id: "ai", label: "AI" },
];

const serviceIcon: Partial<Record<FeedService, React.ReactNode>> = {
  mail: <Mail size={14} aria-hidden="true" />,
  calendar: <Calendar size={14} aria-hidden="true" />,
  slack: <MessageSquare size={14} aria-hidden="true" />,
  code: <Code2 size={14} aria-hidden="true" />,
  crm: <Users size={14} aria-hidden="true" />,
};

export default function ActivityTimeline({
  items = [],
  activeFilter = "all",
  onFilterChange,
}: ActivityTimelineProps) {
  const filtered =
    activeFilter === "all"
      ? items
      : items.filter((item) => item.service === activeFilter);

  return (
    <main className={styles.panel} aria-label="Activity timeline">
      {/* Header: section label + filter chips */}
      <div className={styles.header}>
        <span className={styles.sectionLabel}>Activity</span>
      </div>
      <div className={styles.filterBar} role="toolbar" aria-label="Filter by service">
        {SERVICE_FILTERS.map((f) => (
          <button
            key={f.id}
            className={`${styles.filterChip}${activeFilter === f.id ? ` ${styles.active}` : ""}`}
            onClick={() => onFilterChange?.(f.id)}
            aria-pressed={activeFilter === f.id}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No activity yet</p>
          <p className={styles.emptySubtitle}>Connect services to see activity here</p>
        </div>
      ) : (
        <div className={styles.feed} role="feed">
          <div className={styles.dateSeparator} aria-label="Today">Today</div>
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`${styles.feedItem}${item.severity === "critical" ? ` ${styles.critical}` : ""}`}
              role="article"
            >
              <span
                className={`${styles.dot} ${styles[item.severity]}`}
                aria-label={`${item.severity} severity`}
              />
              <div className={styles.feedItemContent}>
                <div className={styles.feedItemHeader}>
                  {serviceIcon[item.service] && (
                    <span className={styles.feedItemServiceIcon}>
                      {serviceIcon[item.service]}
                    </span>
                  )}
                  <span
                    className={`${styles.feedItemTitle}${
                      item.severity === "critical" || item.severity === "warning"
                        ? ` ${styles.bold}`
                        : ""
                    }`}
                  >
                    {item.title}
                  </span>
                  <time className={styles.feedItemTimestamp} dateTime={item.timestamp}>
                    {item.timestamp}
                  </time>
                </div>
                {item.subtitle && (
                  <p className={styles.feedItemSubtitle}>{item.subtitle}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
