"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, Calendar, MessageSquare, RefreshCw } from "lucide-react";
import styles from "./ServiceWidget.module.css";

interface FeedItem {
  id: string;
  title: string;
  subtitle?: string;
  timestamp: string;
  severity: string;
}

interface ServiceWidgetProps {
  config?: Record<string, unknown>;
  /** The plugin:* type string e.g. "plugin:ms365_email" */
  widgetType: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  "plugin:ms365_email": <Mail size={16} />,
  "plugin:ms365_calendar": <Calendar size={16} />,
  "plugin:ms_teams": <MessageSquare size={16} />,
};

const SERVICE_LABEL: Record<string, string> = {
  "plugin:ms365_email": "Email",
  "plugin:ms365_calendar": "Calendar",
  "plugin:ms_teams": "Teams",
};

const FEED_SERVICE_MAP: Record<string, string> = {
  "plugin:ms365_email": "mail",
  "plugin:ms365_calendar": "calendar",
  "plugin:ms_teams": "messaging",
};

export default function ServiceWidget({
  config,
  widgetType,
}: ServiceWidgetProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const feedService = FEED_SERVICE_MAP[widgetType];
  const label = SERVICE_LABEL[widgetType] ?? widgetType.replace("plugin:", "");
  const icon = ICON_MAP[widgetType] ?? <Mail size={16} />;

  const fetchItems = useCallback(async () => {
    if (!feedService) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/feed?service=${feedService}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setItems(data.slice(0, 5));
      }
    } catch {
      // Feed may not be available
    } finally {
      setLoading(false);
    }
  }, [feedService]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.label}>{label}</span>
        <button
          className={styles.refreshBtn}
          onClick={fetchItems}
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCw size={12} />
        </button>
      </div>
      <div className={styles.list}>
        {loading ? (
          <span className={styles.hint}>Loading…</span>
        ) : items.length === 0 ? (
          <span className={styles.hint}>No recent items</span>
        ) : (
          items.map((item) => (
            <div key={item.id} className={styles.row}>
              <span className={styles.rowTitle}>{item.title}</span>
              <span className={styles.rowTime}>{item.timestamp}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
