"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Zap, Plus, Play, FlaskConical, Trash2,
  SendHorizonal, Loader2, ToggleLeft, ToggleRight, History, Pencil,
} from "lucide-react";
import styles from "./AutomationPanel.module.css";

export interface AutomationRow {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  enabled: boolean;
  writeMode: string;
  actionConfig: Record<string, unknown>;
  aiConversationId: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  createdAt: string;
}

interface Props {
  pluginServiceId: string;
  pluginDisplayName: string;
  aiServiceId: string | null;
  initialAutomations: AutomationRow[];
}

type ActiveTab = "automations" | "history";
type PanelMode = "list" | "create" | "edit";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RunHistoryEntry {
  id: string;
  isDryRun: boolean;
  status: string;
  output: unknown;
  error: string | null;
  startedAt: string | null;
  createdAt: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status: string | null) {
  if (!status) return "";
  if (status.includes("success")) return styles.statusSuccess;
  if (status.includes("error")) return styles.statusError;
  return "";
}

// ─── Unified chat panel — handles both create and edit ───────────────────────

function AutomationChatPanel({
  pluginServiceId,
  aiServiceId,
  editAutomation,
  onCreated,
  onUpdated,
  onCancel,
}: {
  pluginServiceId: string;
  aiServiceId: string | null;
  /** When set, the panel is in edit mode for this automation. */
  editAutomation?: AutomationRow;
  onCreated: (automation: AutomationRow) => void;
  onUpdated: (automation: AutomationRow) => void;
  onCancel: () => void;
}) {
  const isEditing = editAutomation !== undefined;

  const [name, setName] = useState(editAutomation?.name ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfig, setPendingConfig] = useState<Record<string, unknown> | null>(
    editAutomation?.actionConfig && Object.keys(editAutomation.actionConfig).length > 0
      ? editAutomation.actionConfig
      : null
  );
  const [saving, setSaving] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(
    editAutomation?.aiConversationId ?? undefined
  );
  const endRef = useRef<HTMLDivElement>(null);

  // Load existing conversation history when editing an automation that has one
  useEffect(() => {
    if (!isEditing || !editAutomation?.aiConversationId) return;
    setHistoryLoading(true);
    fetch(`/api/ai/conversations/${editAutomation.aiConversationId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { messages?: Array<{ role: string; content: string }> } | null) => {
        if (data?.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }))
          );
        }
      })
      .catch(() => {/* non-fatal */})
      .finally(() => setHistoryLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const userMsg = input.trim();
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setStreaming(true);

    try {
      const history = [...messages, { role: "user" as const, content: userMsg }];

      // Treat as automation prompt if it's the first message, or mentions key words
      const isAutomationPrompt =
        history.filter((m) => m.role === "user").length === 1 ||
        userMsg.toLowerCase().includes("automat") ||
        userMsg.toLowerCase().includes("when ") ||
        userMsg.toLowerCase().includes("trigger") ||
        userMsg.toLowerCase().includes("change") ||
        userMsg.toLowerCase().includes("update") ||
        userMsg.toLowerCase().includes("instead") ||
        userMsg.toLowerCase().includes("also") ||
        userMsg.toLowerCase().includes("add ") ||
        userMsg.toLowerCase().includes("remove ");

      if (isAutomationPrompt && aiServiceId) {
        const res = await fetch(`/api/automations/preview-config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: userMsg, aiServiceId }),
        });
        if (res.ok) {
          const data = await res.json() as { actionConfig: Record<string, unknown>; summary: string };
          setPendingConfig(data.actionConfig);
          const reply = data.summary
            ? `${data.summary} Review the updated steps below, then click ${isEditing ? "Update" : "Save"}.`
            : `I've ${isEditing ? "updated" : "generated"} the automation config. Review the steps below and click ${isEditing ? "Update" : "Save"}.`;
          setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
          setStreaming(false);
          return;
        }
      }

      // General AI chat (for follow-up questions, clarifications, etc.)
      const chatRes = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, conversationId }),
      });

      if (!chatRes.ok) throw new Error("Chat request failed");

      const newConvId = chatRes.headers.get("X-Conversation-Id");
      if (newConvId && !conversationId) setConversationId(newConvId);

      const reader = chatRes.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          assistantText += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: assistantText };
            return updated;
          });
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStreaming(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Please enter a name for this automation.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEditing && editAutomation) {
        // PATCH existing automation
        const res = await fetch(`/api/automations/${editAutomation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: messages.find((m) => m.role === "user")?.content?.slice(0, 200) ?? editAutomation.description,
            actionConfig: pendingConfig ?? editAutomation.actionConfig,
          }),
        });
        const data = await res.json() as AutomationRow & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to update");
        onUpdated({ ...data, aiConversationId: data.aiConversationId ?? editAutomation.aiConversationId });
      } else {
        // POST new automation
        const res = await fetch("/api/automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pluginServiceId,
            aiServiceId,
            name: name.trim(),
            description: messages.find((m) => m.role === "user")?.content?.slice(0, 200) ?? "",
            triggerType: "manual",
            triggerConfig: {},
            targetServiceIds: [],
            actionConfig: pendingConfig ?? {},
          }),
        });
        const data = await res.json() as AutomationRow & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to save");
        onCreated(data);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const title = isEditing ? `Edit: ${editAutomation!.name}` : "New Automation";
  const saveLabel = isEditing ? "Update Automation" : "Save Automation";
  const hasChanges = isEditing
    ? name.trim() !== editAutomation!.name || pendingConfig !== null
    : pendingConfig !== null;

  return (
    <div className={styles.createPanel}>
      <div className={styles.createHeader}>
        <button className={styles.backButton} onClick={onCancel}>
          <ChevronLeft size={14} /> Back
        </button>
        <h2 className={styles.createTitle}>{title}</h2>
      </div>

      <div className={styles.nameRow}>
        <input
          className={styles.nameInput}
          type="text"
          placeholder="Automation name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className={styles.chatArea}>
        {historyLoading ? (
          <div className={styles.chatLoadingHistory}>
            <Loader2 size={16} className={styles.spin} /> Loading conversation history…
          </div>
        ) : messages.length === 0 ? (
          <p className={styles.chatHint}>
            {isEditing
              ? "Describe what you'd like to change. For example: \"Also tag items as 'urgent-email'\" or \"Only trigger on emails from external senders\"."
              : "Describe what you want this automation to do. For example: \"When I get an email from my manager, mark it as urgent and tag it 'boss'.\""
            }
          </p>
        ) : null}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.chatMsg} ${msg.role === "user" ? styles.chatMsgUser : styles.chatMsgAssistant}`}
          >
            <span className={styles.chatRole}>{msg.role === "user" ? "You" : "AI"}</span>
            <p className={styles.chatContent}>{msg.content}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {pendingConfig && (
        <div className={styles.configPreview}>
          <p className={styles.configPreviewTitle}>
            {isEditing ? "Updated action steps:" : "Generated action steps:"}
          </p>
          <pre className={styles.configPreviewCode}>
            {JSON.stringify(pendingConfig, null, 2)}
          </pre>
        </div>
      )}

      {error && <p className={styles.chatError}>{error}</p>}

      <form className={styles.chatForm} onSubmit={sendMessage}>
        <input
          className={styles.chatInput}
          type="text"
          placeholder={
            aiServiceId
              ? isEditing
                ? "Describe what to change…"
                : "Describe your automation…"
              : "Connect an AI service to enable AI assistance"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming || historyLoading}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={streaming || !input.trim() || historyLoading}
          aria-label="Send"
        >
          {streaming ? <Loader2 size={16} className={styles.spin} /> : <SendHorizonal size={16} />}
        </button>
      </form>

      <div className={styles.createActions}>
        {(hasChanges || isEditing) && (
          <button
            className={`${styles.actionButton} ${styles.primary}`}
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? "Saving…" : saveLabel}
          </button>
        )}
        <button className={styles.actionButton} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main automation panel ────────────────────────────────────────────────────

export default function AutomationPanel({
  pluginServiceId,
  pluginDisplayName,
  aiServiceId,
  initialAutomations,
}: Props) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ActiveTab>("automations");
  const [mode, setMode] = useState<PanelMode>("list");
  const [rows, setRows] = useState<AutomationRow[]>(initialAutomations);
  const [editingAutomation, setEditingAutomation] = useState<AutomationRow | undefined>();
  const [running, setRunning] = useState<Record<string, "run" | "dry_run">>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<RunHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // If navigated here with ?editId=<id>, open edit panel for that automation
  useEffect(() => {
    const editId = searchParams.get("editId");
    if (editId) {
      const target = initialAutomations.find((r) => r.id === editId);
      if (target) {
        setEditingAutomation(target);
        setMode("edit");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory(automationId: string) {
    setHistoryLoading(true);
    setSelectedId(automationId);
    setTab("history");
    try {
      const res = await fetch(`/api/automations/${automationId}/runs`);
      if (res.ok) {
        const data = await res.json() as RunHistoryEntry[];
        setHistory(data);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleToggle(id: string, current: boolean) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !current } : r)));
    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !current }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: current } : r)));
    }
  }

  async function handleRun(id: string, dryRun: boolean) {
    const key: "run" | "dry_run" = dryRun ? "dry_run" : "run";
    setRunning((prev) => ({ ...prev, [id]: key }));
    setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try {
      const res = await fetch(`/api/automations/${id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json() as { error?: string; status?: string };
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      const newStatus = dryRun ? "dry_run_success" : "success";
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, lastRunAt: new Date().toISOString(), lastRunStatus: newStatus } : r
        )
      );
    } catch (err) {
      setErrors((prev) => ({ ...prev, [id]: (err as Error).message }));
    } finally {
      setRunning((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete automation "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/automations/${id}`, { method: "DELETE" });
      if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
      else setErrors((prev) => ({ ...prev, [id]: "Failed to delete" }));
    } catch {
      setErrors((prev) => ({ ...prev, [id]: "Network error" }));
    }
  }

  function openEdit(row: AutomationRow) {
    setEditingAutomation(row);
    setMode("edit");
  }

  if (mode === "create" || mode === "edit") {
    return (
      <AutomationChatPanel
        pluginServiceId={pluginServiceId}
        aiServiceId={aiServiceId}
        editAutomation={mode === "edit" ? editingAutomation : undefined}
        onCreated={(automation) => {
          setRows((prev) => [automation, ...prev]);
          setMode("list");
          setEditingAutomation(undefined);
        }}
        onUpdated={(updated) => {
          setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          setMode("list");
          setEditingAutomation(undefined);
        }}
        onCancel={() => {
          setMode("list");
          setEditingAutomation(undefined);
        }}
      />
    );
  }

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <Link href="/" className={styles.breadcrumb}>
        <ChevronLeft size={14} aria-hidden="true" />
        Dashboard
      </Link>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}><Zap size={20} /></span>
          <div>
            <h1 className={styles.heading}>{pluginDisplayName}</h1>
            <p className={styles.subheading}>AI-assisted automations for your connected services</p>
          </div>
        </div>
        <button
          className={`${styles.actionButton} ${styles.primary}`}
          onClick={() => { setEditingAutomation(undefined); setMode("create"); }}
        >
          <Plus size={14} aria-hidden="true" />
          New Automation
        </button>
      </div>

      <div className={styles.divider} />

      {/* Tabs */}
      <div className={styles.tabs} role="tablist">
        <button
          role="tab"
          aria-selected={tab === "automations"}
          className={`${styles.tab} ${tab === "automations" ? styles.tabActive : ""}`}
          onClick={() => setTab("automations")}
        >
          <Zap size={14} aria-hidden="true" />
          Automations
        </button>
        <button
          role="tab"
          aria-selected={tab === "history"}
          className={`${styles.tab} ${tab === "history" ? styles.tabActive : ""}`}
          onClick={() => { setTab("history"); if (selectedId) loadHistory(selectedId); }}
        >
          <History size={14} aria-hidden="true" />
          Run History
        </button>
      </div>

      {/* Automations tab */}
      {tab === "automations" && (
        <div className={styles.content}>
          {rows.length === 0 ? (
            <div className={styles.empty}>
              <Zap size={28} className={styles.emptyIcon} aria-hidden="true" />
              <p className={styles.emptyTitle}>No automations yet</p>
              <p className={styles.emptyBody}>
                Click &ldquo;New Automation&rdquo; and describe what you want to automate. The AI will generate the steps.
              </p>
            </div>
          ) : (
            <ul className={styles.list} role="list">
              {rows.map((row) => {
                const isRunning = running[row.id];
                const error = errors[row.id];
                return (
                  <li key={row.id} className={styles.card}>
                    {error && <p className={styles.rowError}>{error}</p>}
                    <div className={styles.cardRow}>
                      <div className={styles.info}>
                        <div className={styles.nameRow}>
                          <span className={styles.name}>{row.name}</span>
                          <span className={styles.badge}>{row.triggerType}</span>
                          <span
                            className={`${styles.badge} ${styles.badgeDisabled}`}
                            title="Read-write mode coming in a future update"
                          >
                            read-only
                          </span>
                        </div>
                        {row.description && (
                          <p className={styles.description}>{row.description}</p>
                        )}
                        <p className={styles.meta}>
                          Last run:{" "}
                          <span className={statusColor(row.lastRunStatus)}>
                            {row.lastRunStatus
                              ? `${formatDate(row.lastRunAt)} (${row.lastRunStatus})`
                              : "Never"}
                          </span>
                        </p>
                      </div>
                      <div className={styles.rowActions}>
                        <button
                          className={styles.iconButton}
                          onClick={() => handleToggle(row.id, row.enabled)}
                          title={row.enabled ? "Disable" : "Enable"}
                        >
                          {row.enabled
                            ? <ToggleRight size={18} className={styles.toggleOn} />
                            : <ToggleLeft size={18} className={styles.toggleOff} />}
                        </button>
                        {/* Edit/Continue button */}
                        <button
                          className={styles.actionButton}
                          onClick={() => openEdit(row)}
                          disabled={!!isRunning}
                          title="Edit automation with AI chat"
                        >
                          <Pencil size={13} aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          className={styles.actionButton}
                          onClick={() => handleRun(row.id, true)}
                          disabled={!!isRunning}
                          title="Dry run — simulates without making changes"
                        >
                          <FlaskConical size={13} />
                          {isRunning === "dry_run" ? "Running…" : "Dry Run"}
                        </button>
                        <button
                          className={`${styles.actionButton} ${styles.primary}`}
                          onClick={() => handleRun(row.id, false)}
                          disabled={!!isRunning}
                        >
                          <Play size={13} />
                          {isRunning === "run" ? "Running…" : "Run"}
                        </button>
                        <button
                          className={styles.iconButton}
                          onClick={() => loadHistory(row.id)}
                          title="View run history"
                        >
                          <History size={14} />
                        </button>
                        <button
                          className={`${styles.iconButton} ${styles.destructiveIcon}`}
                          onClick={() => handleDelete(row.id, row.name)}
                          disabled={!!isRunning}
                          aria-label={`Delete ${row.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!aiServiceId && (
            <div className={styles.noAiWarning}>
              No AI service configured for this plugin.{" "}
              <Link href={`/dashboard/settings/services/${pluginServiceId}`} className={styles.link}>
                Configure the AI service →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className={styles.content}>
          {!selectedId ? (
            <p className={styles.historyHint}>
              Click the history icon on an automation to see its run log.
            </p>
          ) : historyLoading ? (
            <div className={styles.loadingRow}>
              <Loader2 size={16} className={styles.spin} /> Loading…
            </div>
          ) : history.length === 0 ? (
            <p className={styles.historyHint}>No runs yet for this automation.</p>
          ) : (
            <ul className={styles.historyList} role="list">
              {history.map((run) => (
                <li key={run.id} className={styles.historyCard}>
                  <div className={styles.historyRow}>
                    <span className={`${styles.historyStatus} ${run.status.includes("error") ? styles.statusError : styles.statusSuccess}`}>
                      {run.isDryRun ? "Dry Run" : "Run"} — {run.status}
                    </span>
                    <span className={styles.historyDate}>{formatDate(run.createdAt)}</span>
                  </div>
                  {run.error && (
                    <p className={styles.historyError}>{run.error}</p>
                  )}
                  {run.output != null && (
                    <pre className={styles.historyOutput}>
                      {JSON.stringify(run.output, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
