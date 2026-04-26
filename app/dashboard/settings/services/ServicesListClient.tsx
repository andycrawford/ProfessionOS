"use client";

import Link from "next/link";
import { Plus, CheckCircle2, AlertCircle, Clock, Loader2, Plug } from "lucide-react";
import styles from "./services.module.css";
import type { ServiceStatus } from "@/services/types";

export interface ServiceRow {
  id: string;
  type: string;
  displayName: string;
  icon: string;
  color: string;
  status: ServiceStatus;
  lastPollAt: string | null;
  itemCount: number;
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  const icons: Record<ServiceStatus, React.ReactNode> = {
    ok: <CheckCircle2 size={12} aria-hidden="true" />,
    error: <AlertCircle size={12} aria-hidden="true" />,
    pending: <Clock size={12} aria-hidden="true" />,
    polling: (
      <Loader2
        size={12}
        className={styles.spinner}
        aria-hidden="true"
      />
    ),
  };
  const labels: Record<ServiceStatus, string> = {
    ok: "Connected",
    error: "Error",
    pending: "Pending",
    polling: "Syncing…",
  };
  return (
    <span
      className={`${styles.statusBadge} ${styles[status]}`}
      aria-label={`Status: ${labels[status]}`}
    >
      {icons[status]}
      {labels[status]}
    </span>
  );
}

function formatLastSync(lastPollAt: string | null): string {
  if (!lastPollAt) return "Never synced";
  const date = new Date(lastPollAt);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default function ServicesListClient({
  services,
}: {
  services: ServiceRow[];
}) {
  return (
    <>
      {services.length === 0 ? (
        <div className={styles.empty}>
          <Plug
            size={32}
            className={styles.emptyIcon}
            aria-hidden="true"
          />
          <p className={styles.emptyTitle}>No services connected yet</p>
          <p className={styles.emptyBody}>
            Connect a service to start monitoring emails, calendar events,
            tasks, and more.
          </p>
          <Link
            href="/dashboard/settings/services/new"
            className={styles.addButton}
          >
            <Plus size={14} aria-hidden="true" />
            Add your first service
          </Link>
        </div>
      ) : (
        <ul className={styles.list} role="list">
          {services.map((svc) => (
            <li key={svc.id} className={styles.card}>
              <div
                className={styles.iconWrap}
                style={{ color: svc.color }}
                aria-hidden="true"
              >
                {svc.icon}
              </div>

              <div className={styles.info}>
                <div className={styles.name}>{svc.displayName}</div>
                <div className={styles.meta}>
                  {svc.itemCount} items · Last sync:{" "}
                  {formatLastSync(svc.lastPollAt)}
                </div>
              </div>

              <div className={styles.statusRow}>
                <StatusBadge status={svc.status} />
              </div>

              <div className={styles.actions}>
                <Link
                  href={`/dashboard/settings/services/${svc.id}`}
                  className={styles.actionButton}
                >
                  Configure
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
