"use client";

import { useState, useEffect } from "react";
import styles from "./ClockWidget.module.css";

interface ClockWidgetProps {
  config?: Record<string, unknown>;
}

export default function ClockWidget({ config }: ClockWidgetProps) {
  const format = (config?.format as string) ?? "12h";
  const timezone = (config?.timezone as string) ?? "local";

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const opts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: format === "12h",
    ...(timezone !== "local" ? { timeZone: timezone } : {}),
  };

  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(timezone !== "local" ? { timeZone: timezone } : {}),
  };

  const timeStr = now.toLocaleTimeString(undefined, opts);
  const dateStr = now.toLocaleDateString(undefined, dateOpts);

  const tzLabel =
    timezone === "local"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : timezone;

  return (
    <div className={styles.clock}>
      <span className={styles.time}>{timeStr}</span>
      <span className={styles.date}>{dateStr}</span>
      <span className={styles.tz}>{tzLabel}</span>
    </div>
  );
}
