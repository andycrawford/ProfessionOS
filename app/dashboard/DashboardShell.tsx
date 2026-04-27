"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ShoppingCart,
  RotateCcw,
  Receipt,
  TrendingUp,
  Box,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import NavRail, { type CrmSubItem, type EmbedItem } from "@/components/layout/NavRail";
import KeyboardHelpDialog, { type PluginBinding } from "@/components/KeyboardHelpDialog";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import type { KeybindingOverrides } from "@/lib/types";
import styles from "./dashboard.module.css";

// ── NetSuite CRM monitor → nav sub-item mapping ───────────────────────────────

const NETSUITE_MONITORS = [
  { configKey: "monitorPO",         itemType: "netsuite_po",          label: "Purchase Orders",       Icon: ShoppingCart },
  { configKey: "monitorRMA",        itemType: "netsuite_rma",         label: "Return Authorizations", Icon: RotateCcw },
  { configKey: "monitorVendorBill", itemType: "netsuite_vendor_bill", label: "Accounts Payable",      Icon: Receipt },
  { configKey: "monitorSalesOrder", itemType: "netsuite_sales_order", label: "Sales Orders",          Icon: TrendingUp },
] as const;

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "";
}

export default function DashboardShell({
  children,
  orgLogoUrl,
  orgName,
  userName,
  userEmail,
}: {
  children: React.ReactNode;
  orgLogoUrl?: string | null;
  orgName?: string | null;
  userName?: string | null;
  userEmail?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const [keybindingOverrides, setKeybindingOverrides] = useState<KeybindingOverrides>({});
  const [pluginBindings, setPluginBindings] = useState<PluginBinding[]>([]);
  const [crmSubItems, setCrmSubItems] = useState<CrmSubItem[]>([]);
  const [embedItems, setEmbedItems] = useState<EmbedItem[]>([]);
  const [pollIntervalSeconds, setPollIntervalSeconds] = useState(30);

  useEffect(() => {
    fetch("/api/settings/keybindings")
      .then((r) => r.json())
      .then((data) => {
        setKeybindingOverrides(data.overrides ?? {});
        setPluginBindings(data.pluginBindings ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/settings/poll-interval")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.pollIntervalSeconds === "number") {
          setPollIntervalSeconds(data.pollIntervalSeconds);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((services: Array<{ id: string; type: string; displayName: string; config: Record<string, unknown> }>) => {
        // ── NetSuite CRM sub-items ──────────────────────────────────────────
        const ns = services.find((s) => s.type === "netsuite_crm");
        if (ns?.config) {
          const subItems: CrmSubItem[] = [];

          for (const m of NETSUITE_MONITORS) {
            if (ns.config[m.configKey]) {
              subItems.push({
                id: m.itemType,
                label: m.label,
                icon: <m.Icon size={16} aria-hidden="true" />,
              });
            }
          }

          // Custom monitors (up to 3)
          for (let i = 1; i <= 3; i++) {
            const label = ns.config[`custom${i}Label`] as string | undefined;
            const recordType = ns.config[`custom${i}RecordType`] as string | undefined;
            if (label && recordType) {
              subItems.push({
                id: `netsuite_custom_${recordType}`,
                label,
                icon: <Box size={16} aria-hidden="true" />,
              });
            }
          }

          setCrmSubItems(subItems);
        }

        // ── Embed website items ─────────────────────────────────────────────
        const embeds = services
          .filter((s) => s.type === "embed_website")
          .map((s) => ({ id: s.id, label: s.displayName }));
        setEmbedItems(embeds);
      })
      .catch(() => {});
  }, []);

  async function handlePollIntervalChange(seconds: number) {
    setPollIntervalSeconds(seconds);
    await fetch("/api/settings/poll-interval", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollIntervalSeconds: seconds }),
    }).catch(() => {});
  }

  const k = (defaultKey: string, actionId: string) =>
    keybindingOverrides[actionId] ?? defaultKey;

  useKeyboardShortcuts({
    [k("shift+?", "show-shortcuts")]: () => setHelpOpen(true),
    [k("e", "nav-mail")]: () => router.push("/dashboard/mail"),
    [k("c", "nav-calendar")]: () => router.push("/dashboard/calendar"),
    [k("m", "nav-messaging")]: () => router.push("/dashboard/messaging"),
    escape: () => setHelpOpen(false),
  });

  const activeNav = (() => {
    if (pathname.startsWith("/dashboard/settings")) return "settings";
    if (pathname.startsWith("/dashboard/mail")) return "mail";
    if (pathname.startsWith("/dashboard/calendar")) return "calendar";
    if (pathname.startsWith("/dashboard/messaging")) return "messaging";
    if (pathname.startsWith("/dashboard/code")) return "code";
    if (pathname.startsWith("/dashboard/crm")) return "crm";
    // Embed routes don't map to a top-level nav item
    return "code";
  })();

  // Derive the active CRM sub-item from the pathname (e.g. /dashboard/crm/netsuite_po)
  const activeCrmSubItemId = pathname.startsWith("/dashboard/crm/")
    ? pathname.slice("/dashboard/crm/".length).split("/")[0] || undefined
    : undefined;

  // Derive the active embed service ID from the pathname (e.g. /dashboard/embed/{serviceId})
  const activeEmbedItemId = pathname.startsWith("/dashboard/embed/")
    ? pathname.slice("/dashboard/embed/".length).split("/")[0] || undefined
    : undefined;

  function handleNavigate(id: string) {
    if (id.startsWith("crm/")) {
      router.push(`/dashboard/${id}`);
    } else if (id.startsWith("embed/")) {
      router.push(`/dashboard/${id}`);
    } else if (id === "settings") {
      router.push("/dashboard/settings/services");
    } else if (["mail", "calendar", "messaging", "code", "crm"].includes(id)) {
      router.push(`/dashboard/${id}`);
    } else {
      router.push("/");
    }
  }

  const userInitials = getInitials(userName, userEmail);

  return (
    <>
      <div className={styles.shell}>
        <Topbar
          userInitials={userInitials || undefined}
          userName={userName ?? undefined}
          orgLogoUrl={orgLogoUrl}
          orgName={orgName}
          pollIntervalSeconds={pollIntervalSeconds}
          onPollIntervalChange={handlePollIntervalChange}
          onSignOut={() => signOut({ callbackUrl: "/" })}
        />
        <div className={styles.body}>
          <NavRail
            activeItemId={activeNav}
            activeCrmSubItemId={activeCrmSubItemId}
            crmSubItems={crmSubItems}
            embedItems={embedItems}
            activeEmbedItemId={activeEmbedItemId}
            onNavigate={handleNavigate}
          />
          <div className={styles.content}>{children}</div>
        </div>
      </div>

      <KeyboardHelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        overrides={keybindingOverrides}
        pluginBindings={pluginBindings}
      />
    </>
  );
}
