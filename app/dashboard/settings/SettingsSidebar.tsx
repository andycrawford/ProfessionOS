"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plug, Building2, Puzzle } from "lucide-react";
import styles from "./settings.module.css";

const navItems = [
  { href: "/dashboard/settings/services", label: "Services", icon: Plug },
  { href: "/dashboard/settings/plugins", label: "Plugins", icon: Puzzle },
  { href: "/dashboard/settings/organization", label: "Organization", icon: Building2 },
];

export default function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <nav className={styles.sidebar}>
      <p className={styles.sidebarLabel}>Settings</p>
      <ul className={styles.sidebarList}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`${styles.sidebarItem} ${active ? styles.active : ""}`}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
