"use client";

import { useState } from "react";
import { Mail, Calendar, MessageSquare, Code2, Users } from "lucide-react";

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
import WidgetCard from "@/components/widgets/WidgetCard";
import WidgetRow from "@/components/widgets/WidgetRow";

import styles from "./dashboard.module.css";

// ─── Placeholder data (replaced by live data in task 2 of 2) ───

const PLACEHOLDER_ALERTS: Alert[] = [
  {
    id: "a1",
    severity: "warning",
    service: "Calendar",
    summary: "3 scheduling conflicts detected Thursday — review required",
  },
];

const PLACEHOLDER_FEED: FeedItem[] = [
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

const PLACEHOLDER_SUGGESTION: Suggestion = {
  id: "s1",
  body: "3 calendar conflicts detected on Thursday. Your Strategy sync overlaps with 1:1 Andy — want me to suggest reschedules?",
  actions: ["Resolve", "Snooze", "Ask AI"],
};

const PLACEHOLDER_MESSAGES: ChatMessage[] = [];

// ─── Sparkline sample data ───

const emailSparkline = [42, 58, 51, 73, 60, 88, 95, 112, 124];
const calSparkline = [8, 6, 9, 7, 10, 8, 11, 9, 12];
const slackSparkline = [210, 190, 225, 205, 230, 215, 240, 220, 248];
const codeSparkline = [3, 5, 4, 7, 6, 8, 5, 9, 11];
const crmSparkline = [2, 3, 2, 4, 3, 5, 4, 6, 5];

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<Alert[]>(PLACEHOLDER_ALERTS);
  const [activeNav, setActiveNav] = useState("code");
  const [feedFilter, setFeedFilter] = useState<FeedService | "all">("all");
  const [messages, setMessages] = useState<ChatMessage[]>(PLACEHOLDER_MESSAGES);

  const handleDismissAlerts = () => {
    // Only dismiss low-priority (non-critical) alerts
    setAlerts((prev) => prev.filter((a) => a.severity === "critical"));
  };

  const handleSendMessage = (content: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMsg]);
    // Placeholder AI response — data layer (task 2) will wire real streaming
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: "ai",
        content: "I'm here. The data layer integration is coming in task 2 of 2.",
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 600);
  };

  return (
    <div className={styles.shell}>
      <Topbar
        alertCount={alerts.length}
        onCommandPaletteOpen={() => {
          /* command palette — future feature */
        }}
      />

      <div className={styles.body}>
        <NavRail activeItemId={activeNav} onNavigate={setActiveNav} />

        <div className={styles.content}>
          <AlertBar
            alerts={alerts}
            onDismissAll={handleDismissAlerts}
            onViewAll={() => {
              /* drawer — future feature */
            }}
          />

          <div className={styles.mainPanel}>
            <WidgetRow>
              <WidgetCard
                serviceLabel="Email"
                serviceIcon={<Mail size={16} />}
                primaryMetric={124}
                secondaryLabel="new messages"
                deltaPercent={18}
                sparklineData={emailSparkline}
                state="default"
              />
              <WidgetCard
                serviceLabel="Calendar"
                serviceIcon={<Calendar size={16} />}
                primaryMetric={12}
                secondaryLabel="events today"
                deltaPercent={0}
                sparklineData={calSparkline}
                state="warning"
                alertCount={3}
              />
              <WidgetCard
                serviceLabel="Slack"
                serviceIcon={<MessageSquare size={16} />}
                primaryMetric={248}
                secondaryLabel="unread messages"
                deltaPercent={-5}
                sparklineData={slackSparkline}
                state="default"
              />
              <WidgetCard
                serviceLabel="Code"
                serviceIcon={<Code2 size={16} />}
                primaryMetric={11}
                secondaryLabel="open PRs"
                deltaPercent={22}
                sparklineData={codeSparkline}
                state="default"
              />
              <WidgetCard
                serviceLabel="CRM"
                serviceIcon={<Users size={16} />}
                primaryMetric={5}
                secondaryLabel="follow-ups due"
                deltaPercent={-2}
                sparklineData={crmSparkline}
                state="default"
              />
            </WidgetRow>

            <div className={styles.bottomRow}>
              <ActivityTimeline
                items={PLACEHOLDER_FEED}
                activeFilter={feedFilter}
                onFilterChange={setFeedFilter}
              />
              <AiPanel
                suggestion={PLACEHOLDER_SUGGESTION}
                messages={messages}
                onSendMessage={handleSendMessage}
                onSuggestionAction={(id, action) => {
                  if (action === "dismiss") {
                    // handled by panel internally via collapse
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
