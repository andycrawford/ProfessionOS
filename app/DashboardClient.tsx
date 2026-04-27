"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  type ConversationSummary,
} from "@/components/layout/AiPanel";
import WidgetCard, { type WidgetState } from "@/components/widgets/WidgetCard";
import WidgetRow from "@/components/widgets/WidgetRow";
import CommandPalette, { type Command } from "@/components/CommandPalette";

import { useEventStream } from "@/lib/hooks/useEventStream";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import type { WidgetMetrics } from "@/lib/types";

import styles from "./dashboard.module.css";

// ─── Widget state ─────────────────────────────────────────────────────────────

type ServiceKey = "mail" | "calendar" | "slack" | "code" | "crm";

interface WidgetData {
  primaryMetric: number;
  secondaryLabel: string;
  deltaPercent: number;
  sparklineData: number[];
  state: WidgetState;
  alertCount?: number;
}

const EMPTY_WIDGETS: Record<ServiceKey, WidgetData> = {
  mail: {
    primaryMetric: 0,
    secondaryLabel: "new messages",
    deltaPercent: 0,
    sparklineData: [],
    state: "default",
  },
  calendar: {
    primaryMetric: 0,
    secondaryLabel: "events today",
    deltaPercent: 0,
    sparklineData: [],
    state: "default",
  },
  slack: {
    primaryMetric: 0,
    secondaryLabel: "unread messages",
    deltaPercent: 0,
    sparklineData: [],
    state: "default",
  },
  code: {
    primaryMetric: 0,
    secondaryLabel: "open PRs",
    deltaPercent: 0,
    sparklineData: [],
    state: "default",
  },
  crm: {
    primaryMetric: 0,
    secondaryLabel: "follow-ups due",
    deltaPercent: 0,
    sparklineData: [],
    state: "default",
  },
};

// Max feed items retained in memory to avoid unbounded growth
const MAX_FEED_ITEMS = 100;

// ─── Page component ───────────────────────────────────────────────────────────

export default function DashboardClient({
  userInitials,
}: {
  userInitials: string;
}) {
  const router = useRouter();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [widgets, setWidgets] = useState<Record<ServiceKey, WidgetData>>(EMPTY_WIDGETS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | undefined>(undefined);

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

  // ── Conversation history ─────────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/conversations");
      if (!res.ok) return;
      const data: ConversationSummary[] = await res.json();
      setConversations(data);
    } catch {
      // Silently ignore — conversation history is non-critical
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setActiveConversationId(null);
  }, []);

  const handleSelectConversation = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/ai/conversations/${conversationId}`);
      if (!res.ok) return;
      const data = await res.json();
      const loadedMessages: ChatMessage[] = (data.messages ?? []).map(
        (m: { id: string; role: string; content: string }) => ({
          id: m.id,
          role: m.role === "assistant" ? "ai" : "user",
          content: m.content,
        })
      );
      setMessages(loadedMessages);
      setActiveConversationId(conversationId);
    } catch {
      // Silently ignore
    }
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
          conversationId: activeConversationId ?? undefined,
        }),
        signal: controller.signal,
      });

      if (!res.body) throw new Error("No response body");

      // Capture the conversation ID from the response header so subsequent
      // messages are appended to the same session.
      const returnedConversationId = res.headers.get("X-Conversation-Id");
      if (returnedConversationId) {
        setActiveConversationId(returnedConversationId);
      }

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

      // Refresh conversation list so the new/updated entry appears in history.
      fetchConversations();
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
  }, [activeConversationId, fetchConversations]);

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
      action: () => router.push("/dashboard/mail"),
    },
    {
      id: "nav-calendar",
      label: "Go to Calendar",
      subtitle: "Navigate",
      icon: <Calendar size={16} />,
      group: "Navigate",
      action: () => router.push("/dashboard/calendar"),
    },
    {
      id: "nav-slack",
      label: "Go to Slack",
      subtitle: "Navigate",
      icon: <MessageSquare size={16} />,
      group: "Navigate",
      action: () => router.push("/dashboard/slack"),
    },
    {
      id: "nav-code",
      label: "Go to Code",
      subtitle: "Navigate",
      icon: <Code2 size={16} />,
      group: "Navigate",
      action: () => router.push("/dashboard/code"),
    },
    {
      id: "nav-crm",
      label: "Go to CRM",
      subtitle: "Navigate",
      icon: <Users size={16} />,
      group: "Navigate",
      action: () => router.push("/dashboard/crm"),
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
      action: () => router.push("/dashboard/settings/services"),
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
          userInitials={userInitials}
        />

        <div className={styles.body}>
          <NavRail
            activeItemId={activeNav}
            onNavigate={(id) => {
              if (id === "settings") {
                router.push("/dashboard/settings/services");
              } else if (id === "ai") {
                setActiveNav("ai");
              } else {
                router.push(`/dashboard/${id}`);
              }
            }}
          />

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
                  onViewAll={() => router.push("/dashboard/mail")}
                />
                <WidgetCard
                  serviceLabel="Calendar"
                  serviceIcon={<Calendar size={16} />}
                  {...widgets.calendar}
                  onViewAll={() => router.push("/dashboard/calendar")}
                />
                <WidgetCard
                  serviceLabel="Slack"
                  serviceIcon={<MessageSquare size={16} />}
                  {...widgets.slack}
                  onViewAll={() => router.push("/dashboard/slack")}
                />
                <WidgetCard
                  serviceLabel="Code"
                  serviceIcon={<Code2 size={16} />}
                  {...widgets.code}
                  onViewAll={() => router.push("/dashboard/code")}
                />
                <WidgetCard
                  serviceLabel="CRM"
                  serviceIcon={<Users size={16} />}
                  {...widgets.crm}
                  onViewAll={() => router.push("/dashboard/crm")}
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
                  conversations={conversations}
                  activeConversationId={activeConversationId}
                  onSendMessage={handleSendMessage}
                  onNewChat={handleNewChat}
                  onSelectConversation={handleSelectConversation}
                  onSuggestionAction={(_id, action) => {
                    if (action === "dismiss" || action === "Snooze") {
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
