"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import NavRail from "@/components/layout/NavRail";
import KeyboardHelpDialog, { type PluginBinding } from "@/components/KeyboardHelpDialog";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import type { KeybindingOverrides } from "@/lib/types";
import styles from "./dashboard.module.css";

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

  useEffect(() => {
    fetch("/api/settings/keybindings")
      .then((r) => r.json())
      .then((data) => {
        setKeybindingOverrides(data.overrides ?? {});
        setPluginBindings(data.pluginBindings ?? []);
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

  function handleNavigate(id: string) {
    if (id === "settings") {
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
          <NavRail activeItemId={activeNav} onNavigate={handleNavigate} />
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
