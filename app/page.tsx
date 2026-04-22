"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Mail,
  Calendar,
  MessageSquare,
  Code2,
  Users,
  Bot,
  Settings,
  Filter,
  BellOff,
} from "lucide-react";

import Topbar from "@/components/layout/Topbar";
import NavRail from "@/components/layout/NavRail";
import AlertBar, { type Alert } from "@/components/layout/AlertBar";
import ActivityTimeline, {
  type FeedItem,
  type FeedService,
} from "@/components/layout/ActivityTimeline";
import AiPanel, {
  type ChatMessage,
  type Suggestion,
} from "@/components/layout/AiPanel";
import WidgetCard, { type WidgetState } from "@/components/widgets/WidgetCard";
import WidgetRow from "@/components/widgets/WidgetRow";
import CommandPalette, { type Command } from "@/components/CommandPalette";

import { useEventStream } from "@/lib/hooks/useEventStream";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import type { WidgetMetrics } from "@/lib/types";

import styles from "./dashboard.module.css";

// ─── Initial widget state ─────────────────────────────────────────────────────

type ServiceKey = "mail" | "calendar" | "slack" | "code" | "crm";

interface WidgetData {
  primaryMetric: number;
  secondaryLabel: string;
  deltaPercent: number;
  sparklineData: number[];
  state: WidgetState;
  alertCount?: number;
}

const INITIAL_WIDGETS: Record<ServiceKey, WidgetData> = {
  mail: {
    primaryMetric: 124,
    secondaryLabel: "new messages",
    deltaPercent: 18,
    sparklineData: [42, 58, 51, 73, 60, 88, 95, 112, 124],
    state: "default",
  },
  calendar: {
    primaryMetric: 12,
    secondaryLabel: "events today",
    deltaPercent: 0,
    sparklineData: [8, 6, 9, 7, 10, 8, 11, 9, 12],
    state: "warning",
    alertCount: 3,
  },
  slack: {
    primaryMetric: 248,
    secondaryLabel: "unread messages",
    deltaPercent: -5,
    sparklineData: [210, 190, 225, 205, 230, 215, 240, 220, 248],
    state: "default",
  },
  code: {
    primaryMetric: 11,
    secondaryLabel: "open PRs",
    deltaPercent: 22,
    sparklineData: [3, 5, 4, 7, 6, 8, 5, 9, 11],
    state: "default",
  },
  crm: {
    primaryMetric: 5,
    secondaryLabel: "follow-ups due",
    deltaPercent: -2,
    sparklineData: [2, 3, 2, 4, 3, 5, 4, 6, 5],
    state: "default",
  },
};

// ─── Initial feed ─────────────────────────────────────────────────────────────

const INITIAL_FEED: FeedItem[] = [
  {
    id: "f1",
    severity: "warning",
    service: "calendar",
    title: "3 conflicts on Thursday — overlapping meetings",
    subtitle: "Google Calendar · affected: Strategy sync, 1:1 Andy, Team standup",
    timestamp: "09:41",
  },
  {
    id: "f2",
    severity: "info",
    service: "mail",
    title: "Q2 board report draft shared by finance team",
    subtitle: "Andy Crawford shared a Google Doc with you",
    timestamp: "09:22",
  },
  {
    id: "f3",
    severity: "neutral",
    service: "slack",
    title: "#eng-infra: deployment pipeline green after fix",
    subtitle: "CI/CD · main branch · build #1842",
    timestamp: "08:55",
  },
  {
    id: "f4",
    severity: "neutral",
    service: "code",
    title: "PR #204 merged: add dashboard scaffold and Vercel config",
    subtitle: "ProfessionOS · main ← feature/dashboard-scaffold",
    timestamp: "08:30",
  },
];

const INITIAL_ALERTS: Alert[] = [
  {
    id: "a1",
    severity: "warning",
    service: "Calendar",
    summary: "3 scheduling conflicts detected Thursday — review required",
  },
];

const INITIAL_SUGGESTION: Suggestion = {
  id: "s1",
  body: "3 calendar conflicts detected on Thursday. Your Strategy sync overlaps with 1:1 Andy — want me to suggest reschedules?",
  actions: ["Resolve", "Snooze", "Ask AI"],
};

// Max feed items retained in memory to avoid unbounded growth
const MAX_FEED_ITEMS = 100;

// ─── Page component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [feed, setFeed] = useState<FeedItem[]>(INITIAL_FEED);
  const [widgets, setWidgets] = useState<Record<ServiceKey, WidgetData>>(INITIAL_WIDGETS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestion, setSuggestion] = useState<Suggestion | undefined>(INITIAL_SUGGESTION);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeNav, setActiveNav] = useState("code");
  const [feedFilter, setFeedFilter] = useState<FeedService | "all">("all");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aiStreaming, setAiStreaming] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  // ── Real-time data layer ─────────────────────────────────────────────────────
  const { connected } = useEventStream({
    onFeedItem: useCallback((item: FeedItem) => {
      setFeed((prev) => [item, ...prev].slice(0, MAX_FEED_ITEMS));
    }, []),

    onAlert: useCallback((alert: Alert) => {
      setAlerts((prev) => {
        // Deduplicate by id
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev];
      });
    }, []),

    onWidgetUpdate: useCallback((update: WidgetMetrics) => {
      const key = update.service as ServiceKey;
      setWidgets((prev) => ({
        ...prev,
        [key]: {
          primaryMetric: update.metric,
          secondaryLabel: update.secondaryLabel,
          deltaPercent: update.deltaPercent,
          sparklineData: update.sparkline,
          state: update.state,
          alertCount: update.alertCount,
        },
      }));
    }, []),
  });

  // ── Alert handlers ──────────────────────────────────────────────────────────
  const handleDismissAlerts = useCallback(() => {
    setAlerts((prev) => prev.filter((a) => a.severity === "critical"));
  }, []);

  // ── AI chat ─────────────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async (content: string) => {
    // Cancel any in-flight stream
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMsg]);
    setAiStreaming(true);

    const aiMsgId = `msg-${Date.now()}-ai`;
    // Insert a placeholder so the bubble appears immediately
    setMessages((prev) => [...prev, { id: aiMsgId, role: "ai", content: "" }]);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content }],
        }),
        signal: controller.signal,
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        // Update the AI message in-place as chunks arrive
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: accumulated } : m))
        );
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: "Sorry, I couldn't reach the AI service. Please try again." }
              : m
          )
        );
      }
    } finally {
      setAiStreaming(false);
    }
  }, []);

  // Abort stream on unmount
  useEffect(() => {
    return () => streamAbortRef.current?.abort();
  }, []);

  // ── Command palette commands ─────────────────────────────────────────────────
  const commands: Command[] = [
    // Navigation
    {
      id: "nav-mail",
      label: "Go to Mail",
      subtitle: "Navigate",
      icon: <Mail size={16} />,
      group: "Navigate",
      action: () => setActiveNav("mail"),
    },
    {
      id: "nav-calendar",
      label: "Go to Calendar",
      subtitle: "Navigate",
      icon: <Calendar size={16} />,
      group: "Navigate",
      action: () => setActiveNav("calendar"),
    },
    {
      id: "nav-slack",
      label: "Go to Slack",
      subtitle: "Navigate",
      icon: <MessageSquare size={16} />,
      group: "Navigate",
      action: () => setActiveNav("slack"),
    },
    {
      id: "nav-code",
      label: "Go to Code",
      subtitle: "Navigate",
      icon: <Code2 size={16} />,
      group: "Navigate",
      action: () => setActiveNav("code"),
    },
    {
      id: "nav-crm",
      label: "Go to CRM",
      subtitle: "Navigate",
      icon: <Users size={16} />,
      group: "Navigate",
      action: () => setActiveNav("crm"),
    },
    {
      id: "nav-ai",
      label: "Go to AI Assistant",
      subtitle: "Navigate",
      icon: <Bot size={16} />,
      shortcut: "⌘/",
      group: "Navigate",
      action: () => setActiveNav("ai"),
    },
    // Timeline filters
    {
      id: "filter-all",
      label: "Show all activity",
      subtitle: "Filter timeline",
      icon: <Filter size={16} />,
      group: "Timeline",
      action: () => setFeedFilter("all"),
    },
    {
      id: "filter-mail",
      label: "Filter timeline: Mail",
      subtitle: "Filter timeline",
      icon: <Mail size={16} />,
      group: "Timeline",
      action: () => setFeedFilter("mail"),
    },
    {
      id: "filter-calendar",
      label: "Filter timeline: Calendar",
      subtitle: "Filter timeline",
      icon: <Calendar size={16} />,
      group: "Timeline",
      action: () => setFeedFilter("calendar"),
    },
    {
      id: "filter-slack",
      label: "Filter timeline: Slack",
      subtitle: "Filter timeline",
      icon: <MessageSquare size={16} />,
      group: "Timeline",
      action: () => setFeedFilter("slack"),
    },
    {
      id: "filter-code",
      label: "Filter timeline: Code",
      subtitle: "Filter timeline",
      icon: <Code2 size={16} />,
      group: "Timeline",
      action: () => setFeedFilter("code"),
    },
    // Alerts
    {
      id: "dismiss-alerts",
      label: "Dismiss non-critical alerts",
      subtitle: `${alerts.length} active alert${alerts.length !== 1 ? "s" : ""}`,
      icon: <BellOff size={16} />,
      group: "Alerts",
      action: handleDismissAlerts,
    },
    // Settings
    {
      id: "settings",
      label: "Open Settings",
      subtitle: "Preferences and configuration",
      icon: <Settings size={16} />,
      group: "System",
      action: () => {
        /* settings panel — future feature */
      },
    },
  ];

  // ── Global keyboard shortcuts ────────────────────────────────────────────────
  useKeyboardShortcuts({
    "cmd+k": () => setPaletteOpen(true),
    "cmd+/": () => setActiveNav((n) => (n === "ai" ? "code" : "ai")),
    escape: () => setPaletteOpen(false),
  });

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div className={styles.shell}>
        <Topbar
          alertCount={alerts.length}
          onCommandPaletteOpen={() => setPaletteOpen(true)}
          userInitials="AC"
        />

        <div className={styles.body}>
          <NavRail activeItemId={activeNav} onNavigate={setActiveNav} />

          <div className={styles.content}>
            <AlertBar
              alerts={alerts}
              onDismissAll={handleDismissAlerts}
              onViewAll={() => {
                /* alert drawer — future feature */
              }}
            />

            <div className={styles.mainPanel}>
              <WidgetRow>
                <WidgetCard
                  serviceLabel="Email"
                  serviceIcon={<Mail size={16} />}
                  {...widgets.mail}
                />
                <WidgetCard
                  serviceLabel="Calendar"
                  serviceIcon={<Calendar size={16} />}
                  {...widgets.calendar}
                />
                <WidgetCard
                  serviceLabel="Slack"
                  serviceIcon={<MessageSquare size={16} />}
                  {...widgets.slack}
                />
                <WidgetCard
                  serviceLabel="Code"
                  serviceIcon={<Code2 size={16} />}
                  {...widgets.code}
                />
                <WidgetCard
                  serviceLabel="CRM"
                  serviceIcon={<Users size={16} />}
                  {...widgets.crm}
                />
              </WidgetRow>

              <div className={styles.bottomRow}>
                <ActivityTimeline
                  items={feed}
                  activeFilter={feedFilter}
                  onFilterChange={setFeedFilter}
                />
                <AiPanel
                  suggestion={suggestion}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onSuggestionAction={(id, action) => {
                    if (action === "dismiss" || action === "Snooze") {
                      setSuggestion(undefined);
                    } else if (action === "Ask AI") {
                      // Pre-fill AI with the suggestion context
                      handleSendMessage(
                        "Can you help me resolve the calendar conflicts on Thursday?"
                      );
                      setSuggestion(undefined);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SSE connection status indicator — subtle dot in corner */}
        {!connected && (
          <div
            className={styles.connectionBanner}
            role="status"
            aria-live="polite"
          >
            Reconnecting to live feed…
          </div>
        )}
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />
    </>
  );
}
