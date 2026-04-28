"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, ChevronLeft, ChevronRight, Sparkles, X, Plus, MessageSquare, ChevronDown } from "lucide-react";
import styles from "./AiPanel.module.css";

export interface ChatMessage {
  id: string;
  role: "ai" | "user";
  content: string;
}

export interface Suggestion {
  id: string;
  body: string;
  actions?: string[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface AiPanelProps {
  suggestion?: Suggestion;
  messages?: ChatMessage[];
  conversations?: ConversationSummary[];
  activeConversationId?: string | null;
  forceVisible?: boolean;
  onSuggestionAction?: (suggestionId: string, action: string) => void;
  onSendMessage?: (content: string) => void;
  onNewChat?: () => void;
  onSelectConversation?: (conversationId: string) => void;
  onClose?: () => void;
}

export default function AiPanel({
  suggestion,
  messages = [],
  conversations = [],
  activeConversationId,
  forceVisible,
  onSuggestionAction,
  onSendMessage,
  onNewChat,
  onSelectConversation,
  onClose,
}: AiPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reset collapsed state whenever the panel is opened via forceVisible
  useEffect(() => {
    if (forceVisible) setCollapsed(false);
  }, [forceVisible]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draft.trim()) {
      onSendMessage?.(draft.trim());
      setDraft("");
    }
  };

  return (
    <aside
      className={`${styles.panel}${collapsed ? ` ${styles.collapsed}` : ""}${forceVisible ? ` ${styles.forceVisible}` : ""}`}
      aria-label="AI Assistant"
    >
      <div className={styles.header}>
        <Bot size={14} className={styles.botIcon} aria-hidden="true" />
        {!collapsed && <span className={styles.title}>AI Assistant</span>}
        {!collapsed && (
          <button
            className={styles.newChatButton}
            onClick={onNewChat}
            aria-label="New chat"
            title="New chat"
          >
            <Plus size={13} aria-hidden="true" />
          </button>
        )}
        {forceVisible ? (
          <button
            className={styles.collapseButton}
            onClick={onClose}
            aria-label="Close AI assistant"
          >
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        ) : (
          <button
            className={styles.collapseButton}
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand AI panel" : "Collapse AI panel"}
          >
            {collapsed ? (
              <ChevronLeft size={14} aria-hidden="true" />
            ) : (
              <ChevronRight size={14} aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          {conversations.length > 0 && (
            <div className={styles.historySection} aria-label="Conversation history">
              <div className={styles.historyLabel}>
                <MessageSquare size={10} aria-hidden="true" />
                History
              </div>
              <ul className={styles.historyList} role="list">
                {conversations.map((conv) => (
                  <li key={conv.id}>
                    <button
                      className={`${styles.historyItem}${conv.id === activeConversationId ? ` ${styles.historyItemActive}` : ""}`}
                      onClick={() => onSelectConversation?.(conv.id)}
                      title={conv.title}
                    >
                      <span className={styles.historyItemTitle}>{conv.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {suggestion && (
            <div className={styles.suggestionCard} role="complementary" aria-label="Proactive suggestion">
              <div className={styles.suggestionLabel}>
                <Sparkles size={10} className={styles.sparklesIcon} aria-hidden="true" />
                Suggestion
              </div>
              <p className={styles.suggestionBody}>{suggestion.body}</p>
              <div className={styles.suggestionActions}>
                {(suggestion.actions ?? ["Resolve", "Snooze"]).map((action) => (
                  <button
                    key={action}
                    className={`${styles.actionButton}${action === "Resolve" ? ` ${styles.primary}` : ""}`}
                    onClick={() => onSuggestionAction?.(suggestion.id, action)}
                  >
                    {action}
                  </button>
                ))}
                <button
                  className={styles.actionButton}
                  onClick={() => onSuggestionAction?.(suggestion.id, "dismiss")}
                  aria-label="Dismiss suggestion"
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          <div className={styles.conversation} role="log" aria-live="polite" aria-label="AI conversation">
            {messages.length === 0 && (
              <div className={styles.emptyState}>
                Ask AI anything about your workflow…
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`${styles.message} ${styles[msg.role]}`}>
                <span className={styles.messageSender}>
                  {msg.role === "ai" ? "AI:" : "You:"}
                </span>
                <div className={styles.messageBubble}>{msg.content}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className={styles.inputArea}>
            <div className={styles.inputRow}>
              <textarea
                className={styles.chatInput}
                placeholder="Ask AI…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
                rows={1}
                aria-label="Chat input"
              />
            </div>
            <p className={styles.sendHint}>⌘↵ to send</p>
          </div>
        </>
      )}
    </aside>
  );
}
