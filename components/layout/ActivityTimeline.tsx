"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Mail, Calendar, MessageSquare, Code2, Users, Video, X, Monitor } from "lucide-react";
import styles from "./ActivityTimeline.module.css";

export type FeedItemSeverity = "critical" | "warning" | "info" | "neutral";

export type FeedService = "mail" | "calendar" | "messaging" | "code" | "crm" | "ai";

export interface FeedItem {
  id: string;
  severity: FeedItemSeverity;
  service: FeedService;
  title: string;
  subtitle?: string;
  timestamp: string;
  /** OWA or service URL — makes the item row clickable (opens in new tab) */
  sourceUrl?: string;
  /** Teams meeting join URL — shown as a "Join" button; only set for online meetings */
  joinUrl?: string;
  /** How to open sourceUrl: new browser tab (default) or embedded dashboard iframe */
  linkBehavior?: "new_tab" | "embed";
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
  { id: "messaging", label: "Messaging" },
  { id: "crm", label: "CRM" },
  { id: "code", label: "Code" },
  { id: "ai", label: "AI" },
];

const serviceIcon: Partial<Record<FeedService, React.ReactNode>> = {
  mail: <Mail size={14} aria-hidden="true" />,
  calendar: <Calendar size={14} aria-hidden="true" />,
  messaging: <MessageSquare size={14} aria-hidden="true" />,
  code: <Code2 size={14} aria-hidden="true" />,
  crm: <Users size={14} aria-hidden="true" />,
};

interface CalendarEventPopupProps {
  item: FeedItem;
  onClose: () => void;
  onOpen: (url: string, behavior: "new_tab" | "embed" | undefined) => void;
}

function CalendarEventPopup({ item, onClose, onOpen }: CalendarEventPopupProps) {
  return (
    <div
      className={styles.popupBackdrop}
      onClick={onClose}
      role="presentation"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div
        className={styles.popupDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-event-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.popupHeader}>
          <span className={styles.popupHeaderIcon}>
            <Calendar size={15} aria-hidden="true" />
          </span>
          <h2 id="cal-event-title" className={styles.popupTitle}>{item.title}</h2>
          <button className={styles.popupCloseBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Body — clicking opens the calendar entry following linkBehavior */}
        <div
          className={`${styles.popupBody}${item.sourceUrl ? ` ${styles.popupBodyClickable}` : ""}`}
          onClick={
            item.sourceUrl
              ? () => { onOpen(item.sourceUrl!, item.linkBehavior); onClose(); }
              : undefined
          }
          role={item.sourceUrl ? "button" : undefined}
          tabIndex={item.sourceUrl ? 0 : undefined}
          onKeyDown={
            item.sourceUrl
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(item.sourceUrl!, item.linkBehavior);
                    onClose();
                  }
                }
              : undefined
          }
          aria-label={item.sourceUrl ? "Open calendar event" : undefined}
        >
          <time className={styles.popupTimestamp} dateTime={item.timestamp}>
            {item.timestamp}
          </time>
          {item.subtitle && (
            <p className={styles.popupSubtitle}>{item.subtitle}</p>
          )}
        </div>

        <div className={styles.popupFooter}>
          <button
            className={styles.popupJoinBtn}
            onClick={() => {
              if (item.joinUrl) {
                window.open(item.joinUrl, "_blank", "noopener,noreferrer");
              }
            }}
            disabled={!item.joinUrl}
            aria-label={item.joinUrl ? "Join meeting" : "No meeting link available"}
          >
            <Video size={14} aria-hidden="true" />
            Join Meeting
          </button>
          <button
            className={styles.popupMonitorBtn}
            disabled
            aria-label="Monitor meeting (not available)"
          >
            <Monitor size={14} aria-hidden="true" />
            Monitor Meeting
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ActivityTimeline({
  items = [],
  activeFilter = "all",
  onFilterChange,
}: ActivityTimelineProps) {
  const router = useRouter();
  const [popupItem, setPopupItem] = useState<FeedItem | null>(null);

  const filtered =
    activeFilter === "all"
      ? items
      : items.filter((item) => item.service === activeFilter);

  function openItem(url: string, behavior: "new_tab" | "embed" | undefined) {
    if (behavior === "embed") {
      router.push(`/dashboard/embed?url=${encodeURIComponent(url)}`);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function handleItemClick(item: FeedItem) {
    if (item.service === "calendar") {
      setPopupItem(item);
    } else if (item.sourceUrl) {
      openItem(item.sourceUrl, item.linkBehavior);
    }
  }

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
          {filtered.map((item) => {
            const isClickable = item.service === "calendar" || !!item.sourceUrl;
            return (
              <div
                key={item.id}
                className={`${styles.feedItem}${item.severity === "critical" ? ` ${styles.critical}` : ""}${isClickable ? ` ${styles.clickable}` : ""}`}
                role="article"
                onClick={isClickable ? () => handleItemClick(item) : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={
                  isClickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleItemClick(item);
                        }
                      }
                    : undefined
                }
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
                    {item.joinUrl && (
                      <button
                        className={styles.joinButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(item.joinUrl, "_blank", "noopener,noreferrer");
                        }}
                        aria-label="Join Teams meeting"
                      >
                        <Video size={11} aria-hidden="true" />
                        Join
                      </button>
                    )}
                    <time className={styles.feedItemTimestamp} dateTime={item.timestamp}>
                      {item.timestamp}
                    </time>
                  </div>
                  {item.subtitle && (
                    <p className={styles.feedItemSubtitle}>{item.subtitle}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar event popup — rendered via portal to escape panel stacking context */}
      {popupItem && typeof document !== "undefined" &&
        createPortal(
          <CalendarEventPopup
            item={popupItem}
            onClose={() => setPopupItem(null)}
            onOpen={openItem}
          />,
          document.body
        )
      }
    </main>
  );
}
