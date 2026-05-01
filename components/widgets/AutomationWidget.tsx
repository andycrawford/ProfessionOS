"use client";

import { useState, useCallback } from "react";
import { Zap, Play, Loader2, CheckCircle2, XCircle } from "lucide-react";
import styles from "./AutomationWidget.module.css";

interface AutomationWidgetProps {
  config?: Record<string, unknown>;
  title: string;
}

export default function AutomationWidget({
  config,
  title,
}: AutomationWidgetProps) {
  const automationId = config?.automationId as string | undefined;
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);

  const runAutomation = useCallback(async () => {
    if (!automationId || running) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(`/api/automations/${automationId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      setResult(res.ok ? "success" : "error");
    } catch {
      setResult("error");
    } finally {
      setRunning(false);
    }
  }, [automationId, running]);

  if (!automationId) {
    return (
      <div className={styles.widget}>
        <Zap size={20} className={styles.iconMuted} />
        <span className={styles.hint}>No automation linked.</span>
      </div>
    );
  }

  return (
    <div className={styles.widget}>
      <Zap size={20} className={styles.icon} />
      <span className={styles.name}>{title}</span>
      <button
        className={styles.runBtn}
        onClick={runAutomation}
        disabled={running}
        title="Run automation"
      >
        {running ? (
          <Loader2 size={14} className={styles.spinner} />
        ) : (
          <Play size={14} />
        )}
        {running ? "Running…" : "Run"}
      </button>
      {result === "success" && (
        <span className={styles.success}>
          <CheckCircle2 size={12} /> Done
        </span>
      )}
      {result === "error" && (
        <span className={styles.error}>
          <XCircle size={12} /> Failed
        </span>
      )}
    </div>
  );
}
