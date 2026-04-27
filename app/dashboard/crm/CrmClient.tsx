"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Users, Check, AlertTriangle, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import styles from "@/app/dashboard/_components/ServiceDetailShell.module.css";
import crmStyles from "./crm.module.css";

// ── Types mirrored from the API response ──────────────────────────────────────

interface ActivityItem {
  id: string;
  serviceId: string | null;
  externalId: string;
  itemType: string;
  title: string;
  urgency: number;
  status: string;
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string | null;
}

interface ConnectedService {
  id: string;
  type: string;
  displayName: string;
  status: string;
}

// ── Item type → display label ──────────────────────────────────────────────────

const ITEM_TYPE_LABELS: Record<string, string> = {
  netsuite_po: "Purchase Orders",
  netsuite_rma: "Return Authorizations",
  netsuite_vendor_bill: "Accounts Payable",
  netsuite_sales_order: "Sales Orders",
};

function labelForItemType(itemType: string): string {
  if (ITEM_TYPE_LABELS[itemType]) return ITEM_TYPE_LABELS[itemType];
  if (itemType.startsWith("netsuite_custom_")) {
    return itemType.replace("netsuite_custom_", "").replace(/_/g, " ");
  }
  return itemType;
}

// ── Approve row component ─────────────────────────────────────────────────────

function ApproveRow({
  item,
  serviceId,
  onApproved,
}: {
  item: ActivityItem;
  serviceId: string;
  onApproved: (itemId: string) => void;
}) {
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(item.status === "actioned");

  const handleApprove = useCallback(async () => {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/services/${serviceId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalId: item.externalId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Server error ${res.status}`);
      }
      setDone(true);
      onApproved(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  }, [serviceId, item.externalId, item.id, onApproved]);

  const meta = item.metadata;
  const amount = meta.amount != null
    ? `${meta.currency ?? ""} ${Number(meta.amount).toLocaleString()}`.trim()
    : null;
  const entityName = meta.entity as string | undefined;

  return (
    <li className={`${crmStyles.row} ${done ? crmStyles.rowDone : ""}`}>
      <div className={crmStyles.rowLeft}>
        <span className={`${crmStyles.urgencyDot} ${item.urgency === 2 ? crmStyles.urgencyHigh : item.urgency === 1 ? crmStyles.urgencyMed : crmStyles.urgencyLow}`} aria-hidden="true" />
        <div className={crmStyles.rowBody}>
          <span className={crmStyles.rowTitle}>{item.title}</span>
          {(amount || entityName) && (
            <span className={crmStyles.rowMeta}>
              {entityName && <span>{entityName}</span>}
              {entityName && amount && <span aria-hidden="true">·</span>}
              {amount && <span>{amount}</span>}
            </span>
          )}
        </div>
      </div>

      <div className={crmStyles.rowActions}>
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={crmStyles.viewLink}
            aria-label="Open in NetSuite"
          >
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}

        {done ? (
          <span className={crmStyles.approvedBadge} aria-label="Approved">
            <Check size={12} aria-hidden="true" />
            Approved
          </span>
        ) : (
          <button
            className={crmStyles.approveBtn}
            onClick={handleApprove}
            disabled={approving}
            aria-label={`Approve ${item.title}`}
          >
            {approving ? (
              <Loader2 size={12} className={crmStyles.spinner} aria-hidden="true" />
            ) : (
              <Check size={12} aria-hidden="true" />
            )}
            {approving ? "Approving…" : "Approve"}
          </button>
        )}
      </div>

      {error && (
        <p className={crmStyles.rowError} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

// ── Main CRM client ───────────────────────────────────────────────────────────

export default function CrmClient() {
  const [service, setService] = useState<ConnectedService | null>(null);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [pageState, setPageState] = useState<"loading" | "disconnected" | "empty" | "error" | "populated">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPageState("loading");
    setErrorMsg(null);
    try {
      // Find a connected NetSuite CRM service
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

      // Fetch activity items for this service (all non-dismissed netsuite items)
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

  useEffect(() => { load(); }, [load]);

  const handleApproved = useCallback((itemId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, status: "actioned" } : i))
    );
  }, []);

  // Group pending items by monitor type for display
  const grouped = items.reduce<Record<string, ActivityItem[]>>((acc, item) => {
    const label = labelForItemType(item.itemType);
    if (!acc[label]) acc[label] = [];
    acc[label].push(item);
    return acc;
  }, {});

  const pendingCount = items.filter((i) => i.status !== "actioned").length;

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <Link href="/" className={styles.breadcrumb}>
        <ChevronLeft size={14} aria-hidden="true" />
        Dashboard
      </Link>

      {/* Header */}
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

      {/* Content */}
      <div className={styles.content}>
        {/* Loading */}
        {pageState === "loading" && (
          <div className={styles.skeletonWrapper} aria-busy="true" aria-label="Loading…">
            <div className={`${styles.skeleton} ${styles.skeletonChart}`} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} />
            ))}
          </div>
        )}

        {/* Error */}
        {pageState === "error" && (
          <div className={styles.stateCenter}>
            <div className={`${styles.stateIconRing} ${styles.stateIconRingError}`}>
              <AlertTriangle size={24} className={`${styles.stateIcon} ${styles.stateIconError}`} aria-hidden="true" />
            </div>
            <p className={styles.stateMessage}>{errorMsg ?? "Failed to load CRM data"}</p>
            <button className={styles.actionBtn} onClick={load}>
              <RefreshCw size={14} aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {/* Not connected */}
        {pageState === "disconnected" && (
          <div className={styles.disconnectedState}>
            <p className={styles.stateMessage}>No NetSuite CRM service connected.</p>
            <Link href="/dashboard/settings/services/new" className={styles.actionBtn}>
              Connect NetSuite →
            </Link>
          </div>
        )}

        {/* Empty */}
        {pageState === "empty" && (
          <div className={styles.stateCenter}>
            <div className={styles.stateIconRing}>
              <Users size={20} aria-hidden="true" />
            </div>
            <p className={styles.stateMessage}>No pending approvals — all caught up.</p>
          </div>
        )}

        {/* Populated — grouped by record type */}
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
