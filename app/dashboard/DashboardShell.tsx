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

  const activeNav = pathname.startsWith("/dashboard/settings") ? "settings" : "code";

  function handleNavigate(id: string) {
    if (id === "settings") {
      router.push("/dashboard/settings/services");
    } else {
      // Return to main dashboard for all other items
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
