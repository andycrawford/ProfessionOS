"use client";

import { useRouter, usePathname } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import NavRail from "@/components/layout/NavRail";
import styles from "./dashboard.module.css";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const activeNav = (() => {
    if (pathname.startsWith("/dashboard/settings")) return "settings";
    if (pathname.startsWith("/dashboard/mail")) return "mail";
    if (pathname.startsWith("/dashboard/calendar")) return "calendar";
    if (pathname.startsWith("/dashboard/slack")) return "slack";
    if (pathname.startsWith("/dashboard/code")) return "code";
    if (pathname.startsWith("/dashboard/crm")) return "crm";
    return "code";
  })();

  function handleNavigate(id: string) {
    if (id === "settings") {
      router.push("/dashboard/settings/services");
    } else if (["mail", "calendar", "slack", "code", "crm"].includes(id)) {
      router.push(`/dashboard/${id}`);
    } else {
      router.push("/");
    }
  }

  return (
    <div className={styles.shell}>
      <Topbar userInitials="AC" />
      <div className={styles.body}>
        <NavRail activeItemId={activeNav} onNavigate={handleNavigate} />
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
