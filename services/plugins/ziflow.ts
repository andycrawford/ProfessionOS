// Ziflow service plugin — API key authentication.
//
// Monitors proofs awaiting review/decision and surfaces them as activity items.
// Users retrieve an API token from their Ziflow account:
//   Account Settings → Integrations → API → Generate Token
//
// The approveItem() method posts an "approved" decision on a proof version.

import type { ServicePlugin, ActivityItemData, ServiceConfig } from "@/services/types";
import { ServiceType } from "@/services/types";
import { registerPlugin } from "@/services/registry";

const ZIFLOW_API = "https://api.ziflow.com/v2";

// ── API helpers ───────────────────────────────────────────────────────────────

function ziflowHeaders(apiToken: string): HeadersInit {
  return {
    "x-api-consumer-token": apiToken,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function ziflowGet<T>(apiToken: string, path: string): Promise<T> {
  const res = await fetch(`${ZIFLOW_API}${path}`, {
    headers: ziflowHeaders(apiToken),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ziflow API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as T;
}

async function ziflowPost(
  apiToken: string,
  path: string,
  body: Record<string, unknown>
): Promise<boolean> {
  const res = await fetch(`${ZIFLOW_API}${path}`, {
    method: "POST",
    headers: ziflowHeaders(apiToken),
    body: JSON.stringify(body),
  });
  return res.ok;
}

// ── Ziflow API types ──────────────────────────────────────────────────────────

interface ZiflowProof {
  id: string;
  name: string;
  status: string; // "active" | "archived" | "waiting_for_decision" | "approved" | "changes_required" | "draft"
  current_version_id?: string;
  current_version?: {
    id: string;
    version_number?: number;
    due_date?: string;
    decisions?: Array<{
      reviewer_id?: string;
      reviewer_name?: string;
      decision?: string; // "approve" | "changes_required" | "pending"
    }>;
  };
  owner?: { name?: string; email?: string };
  created_at?: string;
  updated_at?: string;
  url?: string;
}

interface ZiflowListResponse<T> {
  data?: T[];
  results?: T[];
  items?: T[];
}

// ── Plugin ────────────────────────────────────────────────────────────────────

const ziflowPlugin: ServicePlugin = {
  type: ServiceType.Ziflow,
  displayName: "Ziflow",
  description: "Monitor proofs awaiting review and approval decisions",
  icon: "FileCheck",
  color: "#FF5630",

  configFields: [
    {
      key: "apiToken",
      label: "API Token",
      type: "password",
      required: true,
      placeholder: "your-ziflow-api-token",
      description:
        "Generate at Account Settings → Integrations → API → Generate Token",
    },
    {
      key: "filterStatus",
      label: "Proof Status to Monitor",
      type: "select",
      required: false,
      options: [
        { label: "Waiting for decision", value: "waiting_for_decision" },
        { label: "Active (in review)", value: "active" },
        { label: "Both", value: "both" },
      ],
      description: "Which proof statuses to surface as activity items (default: both)",
    },
    {
      key: "urgentWithinHours",
      label: "Flag as Urgent Within (hours)",
      type: "number",
      required: false,
      placeholder: "24",
      description:
        "Proofs with a due date within this many hours are flagged as urgent (default: 24)",
    },
  ],

  async poll(config: ServiceConfig, credentials: ServiceConfig): Promise<ActivityItemData[]> {
    const apiToken =
      (credentials.apiToken as string | undefined) ||
      (config.apiToken as string | undefined);
    if (!apiToken) return [];

    const filterStatus = (config.filterStatus as string | undefined) ?? "both";
    const urgentWithinMs =
      ((config.urgentWithinHours as number | undefined) ?? 24) * 60 * 60 * 1000;

    // Fetch proofs — the Ziflow API returns a list under various wrapper keys
    let proofs: ZiflowProof[] = [];
    try {
      const resp = await ziflowGet<ZiflowListResponse<ZiflowProof>>(
        apiToken,
        "/proof?per_page=100"
      );
      proofs = resp.data ?? resp.results ?? resp.items ?? [];
    } catch (err) {
      console.error(
        "[ziflow] Failed to fetch proofs:",
        err instanceof Error ? err.message : err
      );
      return [];
    }

    const now = Date.now();
    const items: ActivityItemData[] = [];

    for (const proof of proofs) {
      const status = proof.status ?? "";

      // Apply status filter
      if (filterStatus === "waiting_for_decision" && status !== "waiting_for_decision") continue;
      if (filterStatus === "active" && status !== "active") continue;
      if (filterStatus === "both" && status !== "waiting_for_decision" && status !== "active") continue;

      const version = proof.current_version;
      const dueDate = version?.due_date ? new Date(version.due_date) : undefined;

      // Compute urgency
      let urgency: 0 | 1 | 2 = status === "waiting_for_decision" ? 1 : 0;
      if (dueDate) {
        const msUntilDue = dueDate.getTime() - now;
        if (msUntilDue < 0) {
          urgency = 2; // overdue
        } else if (msUntilDue <= urgentWithinMs) {
          urgency = 2; // due soon
        }
      }

      // Pending reviewers
      const pendingReviewers = (version?.decisions ?? [])
        .filter((d) => !d.decision || d.decision === "pending")
        .map((d) => d.reviewer_name)
        .filter(Boolean);

      const summaryParts: string[] = [];
      if (dueDate) summaryParts.push(`Due: ${dueDate.toLocaleDateString()}`);
      if (pendingReviewers.length > 0) {
        summaryParts.push(`Awaiting: ${pendingReviewers.join(", ")}`);
      }

      items.push({
        externalId: `proof:${proof.id}`,
        itemType: "ziflow_proof",
        title: proof.name || `Proof ${proof.id}`,
        summary: summaryParts.join(" · ") || undefined,
        urgency,
        sourceUrl: proof.url,
        metadata: {
          proofId: proof.id,
          versionId: version?.id,
          versionNumber: version?.version_number,
          status,
          dueDate: dueDate?.toISOString(),
          ownerName: proof.owner?.name,
          pendingReviewers,
        },
        occurredAt: proof.updated_at
          ? new Date(proof.updated_at)
          : proof.created_at
          ? new Date(proof.created_at)
          : new Date(),
      });
    }

    return items;
  },

  async testConnection(_config: ServiceConfig, credentials: ServiceConfig): Promise<boolean> {
    const apiToken =
      (credentials.apiToken as string | undefined) ||
      (_config.apiToken as string | undefined);
    if (!apiToken) return false;
    try {
      // Fetch the current user — lightweight validation call
      await ziflowGet(apiToken, "/user/me");
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
    // approveItem receives merged config+credentials, so apiToken may be on config
    const apiToken =
      (config.apiToken as string | undefined) ||
      (config.credentials as { apiToken?: string } | undefined)?.apiToken;
    if (!apiToken) return false;

    // externalId format: "proof:{proofId}"
    const colonIdx = externalId.indexOf(":");
    if (colonIdx === -1) return false;
    const proofId = externalId.slice(colonIdx + 1);
    if (!proofId) return false;

    // Fetch the proof to get the current version ID
    let proof: ZiflowProof;
    try {
      proof = await ziflowGet<ZiflowProof>(apiToken, `/proof/${proofId}`);
    } catch {
      return false;
    }

    const versionId = proof.current_version_id ?? proof.current_version?.id;
    if (!versionId) return false;

    return ziflowPost(apiToken, `/proof/${proofId}/version/${versionId}/decision`, {
      decision: "approve",
    });
  },
};

registerPlugin(ziflowPlugin);
export default ziflowPlugin;
