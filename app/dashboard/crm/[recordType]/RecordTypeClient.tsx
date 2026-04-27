"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  FileText,
  AlertTriangle,
  RefreshCw,
  CheckCheck,
  Loader2,
} from "lucide-react";
import styles from "@/app/dashboard/_components/ServiceDetailShell.module.css";
import crmStyles from "../crm.module.css";
import {
  ApproveRow,
  labelForItemType,
  type ActivityItem,
} from "../_components/ApproveRow";

interface ConnectedService {
  id: string;
  type: string;
  displayName: string;
  status: string;
}

export default function RecordTypeClient({ recordType }: { recordType: string }) {
  const [service, setService] = useState<ConnectedService | null>(null);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [pageState, setPageState] = useState<
    "loading" | "disconnected" | "empty" | "error" | "populated"
  >("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);

  const load = useCallback(async () => {
    setPageState("loading");
    setErrorMsg(null);
    try {
      const servicesRes = await fetch("/api/services");
      if (!servicesRes.ok) throw new Error("Failed to load services");
      const services: ConnectedService[] = await servicesRes.json();
      const ns = services.find((s) => s.type === "netsuite_crm");

      if (!ns) {
        setService(null);
        setPageState("disconnected");
        return;
      }

      setService(ns);

      const itemsRes = await fetch(
        `/api/items?serviceId=${ns.id}&itemType=${encodeURIComponent(recordType)}&limit=100`
      );
      if (!itemsRes.ok) throw new Error("Failed to load activity items");
      const { items: fetched }: { items: ActivityItem[] } = await itemsRes.json();
      const visible = fetched.filter((i) => i.status !== "dismissed");

      setItems(visible);
      setPageState(visible.length === 0 ? "empty" : "populated");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setPageState("error");
    }
  }, [recordType]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApproved = useCallback((itemId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, status: "actioned" } : i))
    );
  }, []);

  const handleApproveAll = useCallback(async () => {
    if (!service) return;
    const pending = items.filter((i) => i.status !== "actioned");
    if (pending.length === 0) return;

    setBulkApproving(true);
    for (const item of pending) {
      try {
        const res = await fetch(`/api/services/${service.id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ externalId: item.externalId }),
        });
        if (res.ok) {
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, status: "actioned" } : i))
          );
        }
      } catch {
        // continue with remaining items on individual failure
      }
    }
    setBulkApproving(false);
  }, [service, items]);

  const label = labelForItemType(recordType);
  const pendingCount = items.filter((i) => i.status !== "actioned").length;

  return (
    <div className={styles.page}>
      <Link href="/dashboard/crm" className={styles.breadcrumb}>
        <ChevronLeft size={14} aria-hidden="true" />
        CRM
      </Link>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>
            <FileText size={20} aria-hidden="true" />
          </span>
          <div>
            <h1 className={styles.heading}>{label}</h1>
            <p className={styles.subheading}>
              {service
                ? `${service.displayName} — ${pendingCount} pending approval${pendingCount !== 1 ? "s" : ""}`
                : "NetSuite records pending approval"}
            </p>
          </div>
        </div>

        {pageState === "populated" && (
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {pendingCount > 0 && (
              <button
                className={styles.actionBtn}
                onClick={handleApproveAll}
                disabled={bulkApproving}
                aria-label={`Approve all ${pendingCount} pending ${label}`}
              >
                {bulkApproving ? (
                  <Loader2 size={14} aria-hidden="true" style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <CheckCheck size={14} aria-hidden="true" />
                )}
                {bulkApproving ? "Approving…" : `Approve All (${pendingCount})`}
              </button>
            )}
            <button className={styles.actionBtn} onClick={load} aria-label="Refresh">
              <RefreshCw size={14} aria-hidden="true" />
              Refresh
            </button>
          </div>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.content}>
        {pageState === "loading" && (
          <div className={styles.skeletonWrapper} aria-busy="true" aria-label="Loading…">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} />
            ))}
          </div>
        )}

        {pageState === "error" && (
          <div className={styles.stateCenter}>
            <div className={`${styles.stateIconRing} ${styles.stateIconRingError}`}>
              <AlertTriangle
                size={24}
                className={`${styles.stateIcon} ${styles.stateIconError}`}
                aria-hidden="true"
              />
            </div>
            <p className={styles.stateMessage}>{errorMsg ?? "Failed to load records"}</p>
            <button className={styles.actionBtn} onClick={load}>
              <RefreshCw size={14} aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {pageState === "disconnected" && (
          <div className={styles.disconnectedState}>
            <p className={styles.stateMessage}>No NetSuite CRM service connected.</p>
            <Link href="/dashboard/settings/services/new" className={styles.actionBtn}>
              Connect NetSuite →
            </Link>
          </div>
        )}

        {pageState === "empty" && (
          <div className={styles.stateCenter}>
            <div className={styles.stateIconRing}>
              <FileText size={20} aria-hidden="true" />
            </div>
            <p className={styles.stateMessage}>
              No pending {label.toLowerCase()} — all caught up.
            </p>
          </div>
        )}

        {pageState === "populated" && (
          <div className={styles.itemList}>
            <ul className={crmStyles.list} aria-label={label}>
              {items.map((item) => (
                <ApproveRow
                  key={item.id}
                  item={item}
                  serviceId={service!.id}
                  onApproved={handleApproved}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
