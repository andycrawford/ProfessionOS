"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ShoppingCart,
  RotateCcw,
  Receipt,
  TrendingUp,
  Box,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import NavRail, { type CrmSubItem } from "@/components/layout/NavRail";
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

export default function DashboardShell({
  children,
  orgLogoUrl,
  orgName,
}: {
  children: React.ReactNode;
  orgLogoUrl?: string | null;
  orgName?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const [keybindingOverrides, setKeybindingOverrides] = useState<KeybindingOverrides>({});
  const [pluginBindings, setPluginBindings] = useState<PluginBinding[]>([]);
  const [crmSubItems, setCrmSubItems] = useState<CrmSubItem[]>([]);

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
    fetch("/api/services")
      .then((r) => r.json())
      .then((services: Array<{ type: string; config: Record<string, unknown> }>) => {
        const ns = services.find((s) => s.type === "netsuite_crm");
        if (!ns?.config) return;

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
      })
      .catch(() => {});
  }, []);

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
    return "code";
  })();

  // Derive the active CRM sub-item from the pathname (e.g. /dashboard/crm/netsuite_po)
  const activeCrmSubItemId = pathname.startsWith("/dashboard/crm/")
    ? pathname.slice("/dashboard/crm/".length).split("/")[0] || undefined
    : undefined;

  function handleNavigate(id: string) {
    if (id.startsWith("crm/")) {
      router.push(`/dashboard/${id}`);
    } else if (id === "settings") {
      router.push("/dashboard/settings/services");
    } else if (["mail", "calendar", "messaging", "code", "crm"].includes(id)) {
      router.push(`/dashboard/${id}`);
    } else {
      router.push("/");
    }
  }

  return (
    <>
      <div className={styles.shell}>
        <Topbar userInitials="AC" orgLogoUrl={orgLogoUrl} orgName={orgName} />
        <div className={styles.body}>
          <NavRail
            activeItemId={activeNav}
            activeCrmSubItemId={activeCrmSubItemId}
            crmSubItems={crmSubItems}
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
