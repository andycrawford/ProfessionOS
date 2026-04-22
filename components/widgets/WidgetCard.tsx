"use client";

import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import styles from "./WidgetCard.module.css";

export type WidgetState =
  | "default"
  | "hover"
  | "warning"
  | "critical"
  | "loading"
  | "empty";

export interface WidgetCardProps {
  /** Short all-caps label for the service (e.g. "EMAIL") */
  serviceLabel: string;
  /** 16px Lucide icon node */
  serviceIcon?: React.ReactNode;
  /** Primary KPI — number or formatted string */
  primaryMetric?: string | number;
  /** Descriptor line below the metric (e.g. "new messages") */
  secondaryLabel?: string;
  /** Percent delta vs previous period. Positive = up, negative = down. */
  deltaPercent?: number;
  /** Array of data points for the sparkline (min 2 values) */
  sparklineData?: number[];
  /** Component display state */
  state?: WidgetState;
  /** Text for the "View all" link */
  viewAllLabel?: string;
  onViewAll?: () => void;
  /** Alert count badge (shown when warning/critical) */
  alertCount?: number;
}

/** Converts raw data-point array to an SVG polyline string scaled to the viewport. */
function buildSparklinePath(
  data: number[],
  width: number,
  height: number,
  declining = false
): { polyline: string; gradientId: string; areaPath: string } {
  if (data.length < 2) return { polyline: "", gradientId: "", areaPath: "" };

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const firstX = 0;
  const lastX = width;
  const bottomY = height;
  const areaPath = `M${points[0]} L${points.join(" L")} L${lastX},${bottomY} L${firstX},${bottomY} Z`;

  return {
    polyline: points.join(" "),
    gradientId: `spark-grad-${declining ? "red" : "blue"}`,
    areaPath,
  };
}

export default function WidgetCard({
  serviceLabel,
  serviceIcon,
  primaryMetric,
  secondaryLabel,
  deltaPercent,
  sparklineData,
  state = "default",
  viewAllLabel = "View all →",
  onViewAll,
  alertCount,
}: WidgetCardProps) {
  const cardClass = [
    styles.card,
    state !== "default" ? styles[state] : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (state === "loading") {
    return (
      <div className={cardClass} aria-busy="true" aria-label={`${serviceLabel} loading`}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {serviceIcon && <span className={styles.serviceIcon}>{serviceIcon}</span>}
            <span className={styles.serviceLabel}>{serviceLabel}</span>
          </div>
        </div>
        <div className={styles.divider} />
        <div className={styles.metric}>
          <div className={`${styles.skeleton} ${styles.skeletonMetric}`} />
          <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
        </div>
        <div className={styles.footer}>
          <div className={`${styles.skeleton} ${styles.skeletonFooter}`} />
        </div>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className={cardClass} aria-label={`${serviceLabel} — no data`}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {serviceIcon && <span className={styles.serviceIcon}>{serviceIcon}</span>}
            <span className={styles.serviceLabel}>{serviceLabel}</span>
          </div>
        </div>
        <div className={styles.divider} />
        <div className={styles.emptyState}>No data</div>
      </div>
    );
  }

  const deltaClass =
    deltaPercent === undefined || deltaPercent === 0
      ? styles.neutral
      : deltaPercent > 0
      ? styles.positive
      : styles.negative;

  const declining = (deltaPercent ?? 0) < 0 && state === "critical";

  // Sparkline dimensions — rendered at 200×40, CSS scales to full width
  const SVG_W = 200;
  const SVG_H = 40;
  const { polyline, areaPath } = sparklineData?.length
    ? buildSparklinePath(sparklineData, SVG_W, SVG_H, declining)
    : { polyline: "", areaPath: "" };

  const lineColor = declining
    ? "var(--color-alert-critical)"
    : "var(--color-accent-chart)";

  const alertSeverity =
    state === "critical" ? "critical" : state === "warning" ? "warning" : null;

  return (
    <div
      className={cardClass}
      onClick={onViewAll}
      role="button"
      tabIndex={0}
      aria-label={`${serviceLabel}: ${primaryMetric ?? "—"}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onViewAll?.();
      }}
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {serviceIcon && <span className={styles.serviceIcon}>{serviceIcon}</span>}
          <span className={styles.serviceLabel}>{serviceLabel}</span>
        </div>
        {alertSeverity && alertCount !== undefined && alertCount > 0 && (
          <span
            className={`${styles.alertBadge} ${styles[alertSeverity]}`}
            aria-label={`${alertCount} ${alertSeverity} alert${alertCount !== 1 ? "s" : ""}`}
          >
            {alertCount}
          </span>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.metric}>
        <span className={styles.primaryMetric}>
          {primaryMetric ?? "—"}
        </span>
        {secondaryLabel && (
          <span className={styles.secondaryLabel}>{secondaryLabel}</span>
        )}
      </div>

      <div className={styles.footer}>
        {deltaPercent !== undefined && (
          <span className={`${styles.delta} ${deltaClass}`} aria-label={`${deltaPercent === 0 ? "no change" : `${Math.abs(deltaPercent)}% ${deltaPercent > 0 ? "increase" : "decrease"}`} vs yesterday`}>
            {deltaPercent > 0 ? (
              <TrendingUp size={12} aria-hidden="true" />
            ) : deltaPercent < 0 ? (
              <TrendingDown size={12} aria-hidden="true" />
            ) : (
              <Minus size={12} aria-hidden="true" />
            )}
            {Math.abs(deltaPercent)}% vs yesterday
          </span>
        )}
        {onViewAll && (
          <button
            className={styles.viewAll}
            onClick={(e) => {
              e.stopPropagation();
              onViewAll();
            }}
            aria-label={`${viewAllLabel} for ${serviceLabel}`}
          >
            {viewAllLabel}
          </button>
        )}
      </div>

      {polyline && (
        <div className={styles.sparklineWrapper}>
          <svg
            className={styles.sparklineSvg}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="spark-grad-blue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(61,126,255,0.2)" />
                <stop offset="100%" stopColor="rgba(61,126,255,0)" />
              </linearGradient>
              <linearGradient id="spark-grad-red" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,71,87,0.2)" />
                <stop offset="100%" stopColor="rgba(255,71,87,0)" />
              </linearGradient>
            </defs>
            <path
              d={areaPath}
              fill={declining ? "url(#spark-grad-red)" : "url(#spark-grad-blue)"}
            />
            <polyline
              points={polyline}
              fill="none"
              stroke={lineColor}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
