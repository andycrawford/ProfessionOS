// NetSuite CRM service plugin — OAuth 2.0 Authorization Code flow.
//
// Monitors configurable transaction types (POs, RMAs, Vendor Bills, Sales Orders,
// and up to 3 custom record types) and surfaces pending-approval records as
// activity items. The approveItem() method patches the approval status on the
// record via the NetSuite REST Record API.
//
// Auth setup in NetSuite:
//   Setup > Integration > Manage Integrations > New
//   Enable "Authorization Code Grant" under OAuth 2.0.
//   Set redirect URI to: {AUTH_URL}/api/auth/netsuite/callback
//   Add NETSUITE_CLIENT_ID + NETSUITE_CLIENT_SECRET to your environment.
//   Users connect via "Authorize with NetSuite" — no manual token pasting required.

import type { ServicePlugin, ActivityItemData, ServiceConfig } from "@/services/types";
import { ServiceType } from "@/services/types";
import { registerPlugin } from "@/services/registry";
import { refreshAccessToken } from "@/lib/netsuite-oauth";

// ── NetSuite REST API helpers ─────────────────────────────────────────────────

interface NsRecord {
  id: string;
  tranId?: string;
  memo?: string;
  entity?: { id?: string; refName?: string };
  total?: number;
  currency?: { refName?: string };
  tranDate?: string;
  approvalStatus?: { id?: string; refName?: string };
  status?: { id?: string; refName?: string };
  links?: Array<{ rel?: string; href?: string }>;
}

interface NsListResponse {
  items?: NsRecord[];
  totalResults?: number;
}

function nsBaseUrl(accountId: string): string {
  // NetSuite requires the account ID in the URL with hyphens, not underscores.
  // Sandbox accounts look like "12345678-SB1"; prod like "12345678".
  const urlAccount = accountId.replace(/_/g, "-").toLowerCase();
  return `https://${urlAccount}.suitetalk.api.netsuite.com/services/rest/record/v1`;
}

async function nsGet<T>(accountId: string, accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${nsBaseUrl(accountId)}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "transient",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NetSuite API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as T;
}

async function nsPatch(
  accountId: string,
  accessToken: string,
  path: string,
  body: Record<string, unknown>
): Promise<boolean> {
  const res = await fetch(`${nsBaseUrl(accountId)}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

// ── Monitor type definitions ──────────────────────────────────────────────────

// Each entry maps a config checkbox key to a NetSuite record type and query.
// The approval filter uses the SuiteQL-style q parameter supported by the REST API.
const STANDARD_MONITORS = [
  {
    configKey: "monitorPO",
    label: "Purchase Orders",
    recordType: "purchaseOrder",
    // approvalStatus 1=Pending, 2=Approved — filter to pending
    queryParam: '?q=approvalStatus IS "1"&limit=50',
    itemType: "netsuite_po",
    urgency: 1 as const,
  },
  {
    configKey: "monitorRMA",
    label: "Return Authorizations",
    recordType: "returnAuthorization",
    queryParam: "?limit=50",
    itemType: "netsuite_rma",
    urgency: 1 as const,
  },
  {
    configKey: "monitorVendorBill",
    label: "Monitor Accounts Payable (Vendor Bills)",
    recordType: "vendorBill",
    queryParam: '?q=approvalStatus IS "1"&limit=50',
    itemType: "netsuite_vendor_bill",
    urgency: 1 as const,
  },
  {
    configKey: "monitorSalesOrder",
    label: "Sales Orders",
    recordType: "salesOrder",
    queryParam: "?limit=50",
    itemType: "netsuite_sales_order",
    urgency: 0 as const,
  },
];

// ── Plugin definition ─────────────────────────────────────────────────────────

const netSuiteCRMPlugin: ServicePlugin = {
  type: ServiceType.NetSuiteCRM,
  displayName: "NetSuite CRM",
  description: "Monitor and approve NetSuite transactions: POs, RMAs, Accounts Payable, and more",
  icon: "Database",
  color: "#E31E24",

  configFields: [
    // ── Connection ─────────────────────────────────────────────────────────────
    {
      key: "accountId",
      label: "NetSuite Account ID",
      type: "text",
      required: true,
      placeholder: "1234567 or TSTDRV1234567",
      description:
        'Found in Setup > Company > Company Information. Click "Authorize with NetSuite" after entering this.',
    },
    // ── Standard monitors ──────────────────────────────────────────────────────
    {
      key: "monitorPO",
      label: "Monitor Purchase Orders",
      type: "checkbox",
      required: false,
      description: "Surface POs pending approval",
    },
    {
      key: "monitorRMA",
      label: "Monitor Return Authorizations (RMA)",
      type: "checkbox",
      required: false,
      description: "Surface RMAs pending approval",
    },
    {
      key: "monitorVendorBill",
      label: "Monitor Accounts Payable (Vendor Bills)",
      type: "checkbox",
      required: false,
      description: "Surface vendor bills pending approval",
    },
    {
      key: "monitorSalesOrder",
      label: "Monitor Sales Orders",
      type: "checkbox",
      required: false,
      description: "Surface sales orders awaiting action",
    },
    // ── Custom monitors ────────────────────────────────────────────────────────
    {
      key: "custom1Label",
      label: "Custom Monitor 1 — Name",
      type: "text",
      required: false,
      placeholder: "e.g. Expense Reports",
      description: "Display name for a custom record type to monitor",
    },
    {
      key: "custom1RecordType",
      label: "Custom Monitor 1 — Record Type",
      type: "text",
      required: false,
      placeholder: "e.g. expenseReport",
      description: "NetSuite REST record type identifier (camelCase)",
    },
    {
      key: "custom2Label",
      label: "Custom Monitor 2 — Name",
      type: "text",
      required: false,
      placeholder: "e.g. Journal Entries",
    },
    {
      key: "custom2RecordType",
      label: "Custom Monitor 2 — Record Type",
      type: "text",
      required: false,
      placeholder: "e.g. journalEntry",
    },
    {
      key: "custom3Label",
      label: "Custom Monitor 3 — Name",
      type: "text",
      required: false,
      placeholder: "e.g. Custom Record",
    },
    {
      key: "custom3RecordType",
      label: "Custom Monitor 3 — Record Type",
      type: "text",
      required: false,
      placeholder: "e.g. customrecord_mytype",
    },
  ],

  // getAuthUrl signals to the UI that this plugin uses OAuth instead of
  // manual credential entry. The redirect URI is built by the authorize route;
  // this method is used by the UI to determine flow type (not called server-side).
  getAuthUrl(_redirectUri: string): string {
    // Actual auth URL construction happens in /api/auth/netsuite/authorize
    // because it requires the accountId from the form. Return a sentinel value
    // so callers can detect OAuth capability via `typeof plugin.getAuthUrl`.
    return "/api/auth/netsuite/authorize";
  },

  // Refresh the OAuth access token if it is expired or close to expiry.
  // Returns updated credentials when a refresh occurs, null otherwise.
  async refreshCredentials(
    config: ServiceConfig,
    credentials: ServiceConfig
  ): Promise<ServiceConfig | null> {
    const accountId = config.accountId as string;
    const refreshToken = credentials.refreshToken as string | undefined;
    const expiresAt = credentials.expiresAt as number | undefined;

    if (!accountId || !refreshToken) return null;

    // Refresh if token is expired or missing an expiry timestamp
    const needsRefresh = !expiresAt || Date.now() >= expiresAt;
    if (!needsRefresh) return null;

    const tokens = await refreshAccessToken(accountId, refreshToken);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    };
  },

  async poll(config: ServiceConfig, credentials: ServiceConfig): Promise<ActivityItemData[]> {
    const accountId = config.accountId as string;
    const accessToken = credentials.accessToken as string;
    if (!accountId || !accessToken) return [];

    const items: ActivityItemData[] = [];

    // Standard monitored record types
    for (const monitor of STANDARD_MONITORS) {
      if (!config[monitor.configKey]) continue;
      try {
        const resp = await nsGet<NsListResponse>(
          accountId,
          accessToken,
          `/${monitor.recordType}${monitor.queryParam}`
        );
        for (const record of resp.items ?? []) {
          const entityName = record.entity?.refName ?? "Unknown";
          const amount =
            record.total != null
              ? `${record.currency?.refName ?? ""} ${record.total.toLocaleString()}`.trim()
              : undefined;
          // Prefer the self-link href for deep-linking into NetSuite UI
          const selfLink = record.links?.find((l) => l.rel === "self")?.href;

          items.push({
            externalId: `${monitor.recordType}:${record.id}`,
            itemType: monitor.itemType,
            title: `${monitor.label}: ${record.tranId ?? record.id} — ${entityName}`,
            summary: amount,
            urgency: monitor.urgency,
            sourceUrl: selfLink,
            metadata: {
              recordType: monitor.recordType,
              recordId: record.id,
              tranId: record.tranId,
              entity: entityName,
              amount: record.total,
              currency: record.currency?.refName,
              approvalStatus:
                record.approvalStatus?.refName ?? record.status?.refName,
              monitorLabel: monitor.label,
              monitorConfigKey: monitor.configKey,
            },
            occurredAt: record.tranDate ? new Date(record.tranDate) : new Date(),
          });
        }
      } catch (err) {
        console.error(
          `[netsuite-crm] Failed to poll ${monitor.recordType}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    // Custom record type monitors (up to 3)
    for (let i = 1; i <= 3; i++) {
      const label = config[`custom${i}Label`] as string | undefined;
      const recordType = config[`custom${i}RecordType`] as string | undefined;
      if (!label || !recordType) continue;
      try {
        const resp = await nsGet<NsListResponse>(
          accountId,
          accessToken,
          `/${recordType}?limit=50`
        );
        for (const record of resp.items ?? []) {
          items.push({
            externalId: `${recordType}:${record.id}`,
            itemType: `netsuite_custom_${recordType}`,
            title: `${label}: ${record.tranId ?? record.id}`,
            summary: record.memo ?? undefined,
            urgency: 0,
            metadata: {
              recordType,
              recordId: record.id,
              tranId: record.tranId,
              monitorLabel: label,
              monitorIndex: i,
            },
            occurredAt: record.tranDate ? new Date(record.tranDate) : new Date(),
          });
        }
      } catch (err) {
        console.error(
          `[netsuite-crm] Failed to poll custom record type "${recordType}":`,
          err instanceof Error ? err.message : err
        );
      }
    }

    return items;
  },

  async testConnection(config: ServiceConfig, credentials: ServiceConfig): Promise<boolean> {
    const accountId = config.accountId as string;
    const accessToken = credentials.accessToken as string;
    if (!accountId || !accessToken) return false;
    try {
      // Minimal read — fetch 1 PO to validate credentials and REST access
      await nsGet(accountId, accessToken, "/purchaseOrder?limit=1");
      return true;
    } catch {
      return false;
    }
  },

  async approveItem(
    config: ServiceConfig,
    externalId: string,
    _action: string
  ): Promise<boolean> {
    const accountId = config.accountId as string;
    // The approve route merges config + credentials before calling this, so
    // accessToken (from credentials) is available directly on the config param.
    const accessToken = config.accessToken as string;
    if (!accountId || !accessToken) return false;

    // externalId format: "{recordType}:{recordId}"
    const colonIdx = externalId.indexOf(":");
    if (colonIdx === -1) return false;
    const recordType = externalId.slice(0, colonIdx);
    const recordId = externalId.slice(colonIdx + 1);
    if (!recordType || !recordId) return false;

    // approvalStatus id "2" = Approved across PO, vendor bill, and most approval-workflow records.
    return nsPatch(accountId, accessToken, `/${recordType}/${recordId}`, {
      approvalStatus: { id: "2" },
    });
  },
};

registerPlugin(netSuiteCRMPlugin);
export default netSuiteCRMPlugin;
