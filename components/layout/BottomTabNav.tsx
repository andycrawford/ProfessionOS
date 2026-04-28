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
import styles from "./BottomTabNav.module.css";

const TAB_ITEMS = [
  { id: "mail",      label: "Mail",     Icon: Mail },
  { id: "calendar",  label: "Cal",      Icon: Calendar },
  { id: "messaging", label: "Msg",      Icon: MessageSquare },
  { id: "crm",       label: "CRM",      Icon: Users },
  { id: "code",      label: "Code",     Icon: Code2 },
];

interface BottomTabNavProps {
  activeItemId?: string;
  aiOpen?: boolean;
  onNavigate?: (id: string) => void;
  onToggleAI?: () => void;
}

export default function BottomTabNav({
  activeItemId,
  aiOpen,
  onNavigate,
  onToggleAI,
}: BottomTabNavProps) {
  return (
    <nav className={styles.tabBar} aria-label="Primary navigation">
      {TAB_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`${styles.tab}${id === activeItemId ? ` ${styles.active}` : ""}`}
          onClick={() => onNavigate?.(id)}
          aria-label={label}
          aria-current={id === activeItemId ? "page" : undefined}
        >
          <Icon size={20} aria-hidden="true" />
          <span className={styles.label}>{label}</span>
        </button>
      ))}

      <button
        className={`${styles.tab}${aiOpen ? ` ${styles.active}` : ""}`}
        onClick={onToggleAI}
        aria-label="AI Assistant"
        aria-expanded={aiOpen}
      >
        <Bot size={20} aria-hidden="true" />
        <span className={styles.label}>AI</span>
      </button>

      <button
        className={`${styles.tab}${"settings" === activeItemId ? ` ${styles.active}` : ""}`}
        onClick={() => onNavigate?.("settings")}
        aria-label="Settings"
      >
        <Settings size={20} aria-hidden="true" />
        <span className={styles.label}>More</span>
      </button>
    </nav>
  );
}
