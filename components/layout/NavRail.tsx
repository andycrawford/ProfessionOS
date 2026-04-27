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
}

export interface CrmSubItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const topItems: NavItem[] = [
  { id: "mail", label: "Mail", icon: <Mail size={20} aria-hidden="true" /> },
  { id: "calendar", label: "Calendar", icon: <Calendar size={20} aria-hidden="true" /> },
  { id: "messaging", label: "Messaging", icon: <MessageSquare size={20} aria-hidden="true" /> },
  { id: "crm", label: "CRM", icon: <Users size={20} aria-hidden="true" /> },
  { id: "code", label: "Code", icon: <Code2 size={20} aria-hidden="true" /> },
];

const bottomItems: NavItem[] = [
  { id: "ai", label: "AI Assistant", icon: <Bot size={20} aria-hidden="true" /> },
  { id: "settings", label: "Settings", icon: <Settings size={20} aria-hidden="true" /> },
];

interface NavRailProps {
  activeItemId?: string;
  activeCrmSubItemId?: string;
  crmSubItems?: CrmSubItem[];
  onNavigate?: (id: string) => void;
}

export default function NavRail({
  activeItemId = "code",
  activeCrmSubItemId,
  crmSubItems,
  onNavigate,
}: NavRailProps) {
  return (
    <nav className={styles.navRail} aria-label="Primary navigation">
      <div className={styles.navSection}>
        {topItems.map((item) => (
          <div key={item.id}>
            <button
              className={`${styles.navItem}${item.id === activeItemId ? ` ${styles.active}` : ""}`}
              onClick={() => onNavigate?.(item.id)}
              aria-label={item.label}
              aria-current={item.id === activeItemId ? "page" : undefined}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </button>

            {item.id === "crm" && crmSubItems && crmSubItems.length > 0 && (
              <div className={styles.navSubList} role="group" aria-label="CRM record types">
                {crmSubItems.map((sub) => (
                  <button
                    key={sub.id}
                    className={`${styles.navSubItem}${sub.id === activeCrmSubItemId ? ` ${styles.active}` : ""}`}
                    onClick={() => onNavigate?.(`crm/${sub.id}`)}
                    aria-label={sub.label}
                    aria-current={sub.id === activeCrmSubItemId ? "page" : undefined}
                  >
                    <span className={styles.navSubIcon}>{sub.icon}</span>
                    <span className={styles.navLabel}>{sub.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
