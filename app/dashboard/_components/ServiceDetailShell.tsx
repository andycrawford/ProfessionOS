"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Calendar, MessageSquare, Code2, Users } from "lucide-react";
import styles from "./ServiceDetailShell.module.css";

type ServiceKey = "mail" | "calendar" | "slack" | "code" | "crm";
type TimeRange = "24h" | "7d" | "30d";

const SERVICE_CONFIG: Record<
  ServiceKey,
  { label: string; icon: React.ReactNode; description: string }
> = {
  mail: {
    label: "Email",
    icon: <Mail size={20} aria-hidden="true" />,
    description: "Email activity and message metrics",
  },
  calendar: {
    label: "Calendar",
    icon: <Calendar size={20} aria-hidden="true" />,
    description: "Calendar events and scheduling overview",
  },
  slack: {
    label: "Slack",
    icon: <MessageSquare size={20} aria-hidden="true" />,
    description: "Slack messages and channel activity",
  },
  code: {
    label: "Code",
    icon: <Code2 size={20} aria-hidden="true" />,
    description: "Pull requests, commits, and code activity",
  },
  crm: {
    label: "CRM",
    icon: <Users size={20} aria-hidden="true" />,
    description: "Contacts, follow-ups, and pipeline metrics",
  },
};

const TIME_RANGES: TimeRange[] = ["24h", "7d", "30d"];

export default function ServiceDetailShell({ service }: { service: ServiceKey }) {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const config = SERVICE_CONFIG[service];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>{config.icon}</span>
        <div>
          <h1 className={styles.heading}>{config.label}</h1>
          <p className={styles.subheading}>{config.description}</p>
        </div>
      </div>

      <div className={styles.controls}>
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

      {/* Expanded chart area — wired to /api/metrics/[service] once Systems Developer delivers it */}
      <div className={styles.chartArea}>
        <div className={styles.chartPlaceholder} aria-label="Metrics chart coming soon">
          <span className={styles.chartPlaceholderText}>
            Detailed metrics · Available once {config.label} service is connected
          </span>
        </div>
      </div>

      <div className={styles.emptyState}>
        <p className={styles.emptyStateText}>No {config.label} service connected.</p>
        <Link href="/dashboard/settings/services/new" className={styles.connectLink}>
          Connect {config.label} →
        </Link>
      </div>
    </div>
  );
}
