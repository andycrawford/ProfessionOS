"use client";

import styles from "./embed.module.css";

interface EmbedClientProps {
  displayName: string;
  url: string;
}

export default function EmbedClient({ displayName, url }: EmbedClientProps) {
  return (
    <div className={styles.container}>
      <iframe
        src={url}
        title={displayName}
        className={styles.frame}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
