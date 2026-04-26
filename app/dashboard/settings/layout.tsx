import type { ReactNode } from "react";
import SettingsSidebar from "./SettingsSidebar";
import styles from "./settings.module.css";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.layout}>
      <SettingsSidebar />
      <div className={styles.main}>{children}</div>
    </div>
  );
}
