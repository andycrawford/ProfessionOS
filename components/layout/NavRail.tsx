"use client";

import {
  Mail,
  Calendar,
  MessageSquare,
  Users,
  Code2,
  Bot,
  Settings,
} from "lucide-react";
import styles from "./NavRail.module.css";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}

const topItems: NavItem[] = [
  { id: "mail", label: "Mail", icon: <Mail size={20} aria-hidden="true" /> },
  { id: "calendar", label: "Calendar", icon: <Calendar size={20} aria-hidden="true" /> },
  { id: "messaging", label: "Messaging", icon: <MessageSquare size={20} aria-hidden="true" /> },
  { id: "crm", label: "CRM", icon: <Users size={20} aria-hidden="true" /> },
  { id: "code", label: "Code", icon: <Code2 size={20} aria-hidden="true" />, active: true },
];

const bottomItems: NavItem[] = [
  { id: "ai", label: "AI Assistant", icon: <Bot size={20} aria-hidden="true" /> },
  { id: "settings", label: "Settings", icon: <Settings size={20} aria-hidden="true" /> },
];

interface NavRailProps {
  activeItemId?: string;
  onNavigate?: (id: string) => void;
}

export default function NavRail({ activeItemId = "code", onNavigate }: NavRailProps) {
  return (
    <nav className={styles.navRail} aria-label="Primary navigation">
      <div className={styles.navSection}>
        {topItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem}${item.id === activeItemId ? ` ${styles.active}` : ""}`}
            onClick={() => onNavigate?.(item.id)}
            aria-label={item.label}
            aria-current={item.id === activeItemId ? "page" : undefined}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.navSection}>
        {bottomItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem}${item.id === activeItemId ? ` ${styles.active}` : ""}`}
            onClick={() => onNavigate?.(item.id)}
            aria-label={item.label}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
