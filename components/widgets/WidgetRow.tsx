"use client";

import styles from "./WidgetRow.module.css";

interface WidgetRowProps {
  children: React.ReactNode;
}

export default function WidgetRow({ children }: WidgetRowProps) {
  return (
    <section className={styles.widgetRow} aria-label="Service summary widgets">
      <div className={styles.inner}>{children}</div>
    </section>
  );
}
