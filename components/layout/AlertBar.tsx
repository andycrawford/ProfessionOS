"use client";

import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import styles from "./AlertBar.module.css";

export type AlertSeverity = "critical" | "warning" | "info";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  summary: string;
  service?: string;
}

interface AlertBarProps {
  alerts?: Alert[];
  onDismissAll?: () => void;
  onViewAll?: () => void;
}

const severityIcon: Record<AlertSeverity, React.ReactNode> = {
  critical: <AlertCircle size={16} aria-hidden="true" />,
  warning: <AlertTriangle size={16} aria-hidden="true" />,
  info: <Info size={16} aria-hidden="true" />,
};

function topSeverity(alerts: Alert[]): AlertSeverity {
  if (alerts.some((a) => a.severity === "critical")) return "critical";
  if (alerts.some((a) => a.severity === "warning")) return "warning";
  return "info";
}

export default function AlertBar({ alerts = [], onDismissAll, onViewAll }: AlertBarProps) {
  if (alerts.length === 0) return null;

  const severity = topSeverity(alerts);
  const ariaLiveValue = severity === "critical" ? "assertive" : "polite";
  const scrolling = alerts.length > 2;

  return (
    <div
      className={styles.alertBar}
      data-severity={severity}
      role="region"
      aria-label="Alert Bar"
      aria-live={ariaLiveValue}
    >
      <span className={styles.severityIcon}>
        {severityIcon[severity]}
      </span>

      <span className={styles.countBadge} aria-hidden="true">
        {alerts.length}
      </span>

      <div className={styles.marqueeWrapper}>
        <div className={`${styles.marqueeContent}${scrolling ? ` ${styles.scrolling}` : ""}`}>
          {alerts.map((alert) => (
            <span key={alert.id} className={styles.alertSummary}>
              {alert.service ? `[${alert.service}] ` : ""}{alert.summary}
            </span>
          ))}
          {/* Duplicate for seamless marquee loop */}
          {scrolling && alerts.map((alert) => (
            <span key={`dup-${alert.id}`} className={styles.alertSummary} aria-hidden="true">
              {alert.service ? `[${alert.service}] ` : ""}{alert.summary}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.viewAllButton} onClick={onViewAll}>
          View all
        </button>
        <button
          className={styles.dismissButton}
          onClick={onDismissAll}
          aria-label="Dismiss low-priority alerts"
        >
          <X size={12} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
