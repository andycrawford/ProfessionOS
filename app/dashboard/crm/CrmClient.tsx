"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Users, AlertTriangle, RefreshCw } from "lucide-react";
import styles from "@/app/dashboard/_components/ServiceDetailShell.module.css";
import crmStyles from "./crm.module.css";
import {
  ApproveRow,
  labelForItemType,
  type ActivityItem,
} from "./_components/ApproveRow";

interface ConnectedService {
  id: string;
  type: string;
  displayName: string;
  status: string;
  config: Record<string, unknown> | null;
}

export default function CrmClient() {
  const [service, setService] = useState<ConnectedService | null>(null);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [pageState, setPageState] = useState<
    "loading" | "disconnected" | "empty" | "error" | "populated"
  >("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

      const itemsRes = await fetch(`/api/items?serviceId=${ns.id}&limit=100`);
      if (!itemsRes.ok) throw new Error("Failed to load activity items");
      const { items: fetched }: { items: ActivityItem[] } = await itemsRes.json();
      const nsItems = fetched.filter(
        (i) => i.itemType.startsWith("netsuite_") && i.status !== "dismissed"
      );

      setItems(nsItems);
      setPageState(nsItems.length === 0 ? "empty" : "populated");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setPageState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApproved = useCallback((itemId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, status: "actioned" } : i))
    );
  }, []);

  const grouped = items.reduce<Record<string, ActivityItem[]>>((acc, item) => {
    const label = labelForItemType(item.itemType);
    if (!acc[label]) acc[label] = [];
    acc[label].push(item);
    return acc;
  }, {});

  const pendingCount = items.filter((i) => i.status !== "actioned").length;

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.breadcrumb}>
        <ChevronLeft size={14} aria-hidden="true" />
        Dashboard
      </Link>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>
            <Users size={20} aria-hidden="true" />
          </span>
          <div>
            <h1 className={styles.heading}>CRM</h1>
            <p className={styles.subheading}>
              {service
                ? `${service.displayName} — ${pendingCount} pending approval${pendingCount !== 1 ? "s" : ""}`
                : "Contacts, follow-ups, and pipeline metrics"}
            </p>
          </div>
        </div>

        {pageState !== "loading" && pageState !== "disconnected" && (
          <button className={styles.actionBtn} onClick={load} aria-label="Refresh">
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.content}>
        {pageState === "loading" && (
          <div className={styles.skeletonWrapper} aria-busy="true" aria-label="Loading…">
            <div className={`${styles.skeleton} ${styles.skeletonChart}`} />
            {Array.from({ length: 4 }).map((_, i) => (
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
            <p className={styles.stateMessage}>{errorMsg ?? "Failed to load CRM data"}</p>
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
              <Users size={20} aria-hidden="true" />
            </div>
            <p className={styles.stateMessage}>No pending approvals — all caught up.</p>
          </div>
        )}

        {pageState === "populated" && (
          <div className={styles.itemList}>
            {Object.entries(grouped).map(([label, groupItems]) => (
              <section key={label} className={crmStyles.group}>
                <h2 className={crmStyles.groupHeading}>{label}</h2>
                <ul className={crmStyles.list} aria-label={label}>
                  {groupItems.map((item) => (
                    <ApproveRow
                      key={item.id}
                      item={item}
                      serviceId={service!.id}
                      linkBehavior={
                        typeof service!.config?.linkBehavior === "string"
                          ? service!.config.linkBehavior
                          : undefined
                      }
                      onApproved={handleApproved}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
