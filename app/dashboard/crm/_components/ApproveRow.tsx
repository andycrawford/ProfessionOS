"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import crmStyles from "../crm.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActivityItem {
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

// ── Item type → display label ─────────────────────────────────────────────────

export const ITEM_TYPE_LABELS: Record<string, string> = {
  netsuite_po: "Purchase Orders",
  netsuite_rma: "Return Authorizations",
  netsuite_vendor_bill: "Accounts Payable",
  netsuite_sales_order: "Sales Orders",
};

export function labelForItemType(itemType: string): string {
  if (ITEM_TYPE_LABELS[itemType]) return ITEM_TYPE_LABELS[itemType];
  if (itemType.startsWith("netsuite_custom_")) {
    return itemType.replace("netsuite_custom_", "").replace(/_/g, " ");
  }
  return itemType;
}

// ── Approve row component ─────────────────────────────────────────────────────

export function ApproveRow({
  item,
  serviceId,
  linkBehavior,
  onApproved,
}: {
  item: ActivityItem;
  serviceId: string;
  linkBehavior?: string;
  onApproved: (itemId: string) => void;
}) {
  const router = useRouter();
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
  const amount =
    meta.amount != null
      ? `${meta.currency ?? ""} ${Number(meta.amount).toLocaleString()}`.trim()
      : null;
  const entityName = meta.entity as string | undefined;

  return (
    <li className={`${crmStyles.row} ${done ? crmStyles.rowDone : ""}`}>
      <div className={crmStyles.rowLeft}>
        <span
          className={`${crmStyles.urgencyDot} ${
            item.urgency === 2
              ? crmStyles.urgencyHigh
              : item.urgency === 1
                ? crmStyles.urgencyMed
                : crmStyles.urgencyLow
          }`}
          aria-hidden="true"
        />
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
          linkBehavior === "embed" ? (
            <button
              className={crmStyles.viewLink}
              aria-label="View source"
              onClick={() =>
                router.push(
                  `/dashboard/embed?url=${encodeURIComponent(item.sourceUrl!)}`
                )
              }
            >
              <ExternalLink size={12} aria-hidden="true" />
            </button>
          ) : (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={crmStyles.viewLink}
              aria-label="Open in NetSuite"
            >
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          )
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
