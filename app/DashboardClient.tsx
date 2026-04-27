"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Calendar,
  MessageSquare,
  Code2,
  Users,
  Database,
  Bot,
  Settings,
  Filter,
  BellOff,
  SlidersHorizontal,
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
import WidgetSettingsDialog from "@/components/widgets/WidgetSettingsDialog";
import CommandPalette, { type Command } from "@/components/CommandPalette";
import KeyboardHelpDialog, { type PluginBinding } from "@/components/KeyboardHelpDialog";

import { useEventStream } from "@/lib/hooks/useEventStream";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import type { WidgetMetrics, WidgetPreference, WidgetServiceKey, KeybindingOverrides } from "@/lib/types";
import { DEFAULT_WIDGET_PREFS } from "@/lib/types";
import { netsuiteKeyLabel } from "@/lib/metrics";

import styles from "./dashboard.module.css";

// ─── Widget state ─────────────────────────────────────────────────────────────

type ServiceKey = WidgetServiceKey;

interface WidgetData {
  primaryMetric: number;
  secondaryLabel: string;
  deltaPercent: number;
  sparklineData: number[];
  state: WidgetState;
  alertCount?: number;
}

const EMPTY_WIDGET: WidgetData = {
  primaryMetric: 0,
  secondaryLabel: "items",
  deltaPercent: 0,
  sparklineData: [],
  state: "default",
};

// Static display config for the five core service tiles
const BASE_WIDGET_CONFIG: Record<
  string,
  { serviceLabel: string; icon: React.ReactNode; route: string }
> = {
  mail: {
    serviceLabel: "Email",
    icon: <Mail size={16} />,
    route: "/dashboard/mail",
  },
  calendar: {
    serviceLabel: "Calendar",
    icon: <Calendar size={16} />,
    route: "/dashboard/calendar",
  },
  messaging: {
    serviceLabel: "Messaging",
    icon: <MessageSquare size={16} />,
    route: "/dashboard/messaging",
  },
  code: {
    serviceLabel: "Code",
    icon: <Code2 size={16} />,
    route: "/dashboard/code",
  },
  crm: {
    serviceLabel: "CRM",
    icon: <Users size={16} />,
    route: "/dashboard/crm",
  },
};

/** Return display config for any widget key, including dynamic netsuite_* keys. */
function getWidgetConfig(
  key: string,
  label?: string,
): { serviceLabel: string; icon: React.ReactNode; route: string } {
  if (key in BASE_WIDGET_CONFIG) return BASE_WIDGET_CONFIG[key];
  // Dynamic netsuite_* tile — all link to the CRM detail page
  return {
    serviceLabel: label ?? netsuiteKeyLabel(key),
    icon: <Database size={16} />,
    route: "/dashboard/crm",
  };
}

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
  const [widgets, setWidgets] = useState<Record<string, WidgetData>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | undefined>(undefined);

  // ── Widget preferences ───────────────────────────────────────────────────────
  const [widgetPrefs, setWidgetPrefs] = useState<WidgetPreference[]>(DEFAULT_WIDGET_PREFS);
  const [metricsSettingsOpen, setMetricsSettingsOpen] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeNav, setActiveNav] = useState("code");
  const [feedFilter, setFeedFilter] = useState<FeedService | "all">("all");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aiStreaming, setAiStreaming] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  // ── Keybinding overrides & plugin bindings ───────────────────────────────────
  const [keybindingOverrides, setKeybindingOverrides] = useState<KeybindingOverrides>({});
  const [pluginBindings, setPluginBindings] = useState<PluginBinding[]>([]);

  // ── Load widget preferences + keybindings ────────────────────────────────────
  useEffect(() => {
    fetch("/api/settings/widgets")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setWidgetPrefs(data);
      })
      .catch(() => {});

    fetch("/api/settings/keybindings")
      .then((r) => r.json())
      .then((data) => {
        setKeybindingOverrides(data.overrides ?? {});
        setPluginBindings(data.pluginBindings ?? []);
      })
      .catch(() => {});
  }, []);

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

  // ── Widget preferences save ──────────────────────────────────────────────────
  const handleSaveWidgetPrefs = useCallback(async (prefs: WidgetPreference[]) => {
    const res = await fetch("/api/settings/widgets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    if (!res.ok) throw new Error("Failed to save");
    const saved: WidgetPreference[] = await res.json();
    setWidgetPrefs(saved);
    setMetricsSettingsOpen(false);
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
      id: "nav-messaging",
      label: "Go to Messaging",
      subtitle: "Navigate",
      icon: <MessageSquare size={16} />,
      group: "Navigate",
      action: () => router.push("/dashboard/messaging"),
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
      id: "filter-messaging",
      label: "Filter timeline: Messaging",
      subtitle: "Filter timeline",
      icon: <MessageSquare size={16} />,
      group: "Timeline",
      action: () => setFeedFilter("messaging"),
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
      id: "metrics-settings",
      label: "Configure Metrics Tiles",
      subtitle: "Choose which metrics to display",
      icon: <SlidersHorizontal size={16} />,
      group: "System",
      action: () => setMetricsSettingsOpen(true),
    },
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
  // Resolve effective key for an action: use user override or fall back to default.
  const k = (defaultKey: string, actionId: string) =>
    keybindingOverrides[actionId] ?? defaultKey;

  useKeyboardShortcuts({
    [k("cmd+k", "open-command-palette")]: () => setPaletteOpen(true),
    [k("/", "open-command-line")]: () => setPaletteOpen(true),
    [k("shift+?", "show-shortcuts")]: () => setHelpOpen(true),
    [k("cmd+/", "toggle-ai")]: () => setActiveNav((n) => (n === "ai" ? "code" : "ai")),
    [k("e", "nav-mail")]: () => router.push("/dashboard/mail"),
    [k("c", "nav-calendar")]: () => router.push("/dashboard/calendar"),
    [k("m", "nav-messaging")]: () => router.push("/dashboard/messaging"),
    escape: () => {
      if (helpOpen) { setHelpOpen(false); return; }
      setPaletteOpen(false);
    },
  });

  // ── Derived: visible widgets in preference order ─────────────────────────────
  const visibleWidgets = widgetPrefs.filter((p) => p.enabled);

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
              <div className={styles.widgetRowWrapper}>
                <WidgetRow>
                  {visibleWidgets.map((pref) => {
                    const cfg = getWidgetConfig(pref.key, pref.label);
                    const data = widgets[pref.key] ?? EMPTY_WIDGET;
                    return (
                      <WidgetCard
                        key={pref.key}
                        serviceLabel={cfg.serviceLabel}
                        serviceIcon={cfg.icon}
                        {...data}
                        onViewAll={() => router.push(cfg.route)}
                      />
                    );
                  })}
                </WidgetRow>
                <button
                  className={styles.widgetSettingsBtn}
                  onClick={() => setMetricsSettingsOpen(true)}
                  aria-label="Configure metric tiles"
                  title="Configure metric tiles"
                >
                  <SlidersHorizontal size={14} />
                </button>
              </div>

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

      <WidgetSettingsDialog
        open={metricsSettingsOpen}
        onClose={() => setMetricsSettingsOpen(false)}
        prefs={widgetPrefs}
        onSave={handleSaveWidgetPrefs}
      />

      <KeyboardHelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        overrides={keybindingOverrides}
        pluginBindings={pluginBindings}
      />
    </>
  );
}
