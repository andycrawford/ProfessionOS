import { signIn } from "@/auth";

// ─── Provider icons ───────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="1" y="1" width="7.5" height="7.5" fill="#F25022" />
      <rect x="9.5" y="1" width="7.5" height="7.5" fill="#7FBA00" />
      <rect x="1" y="9.5" width="7.5" height="7.5" fill="#00A4EF" />
      <rect x="9.5" y="9.5" width="7.5" height="7.5" fill="#FFB900" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 814 1000" aria-hidden="true" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 376.7 0 209.5 0 148.7 0 111 14.2 74.1 40.1 48.4c26-25.7 60.8-40.7 95.5-40.7 48.7 0 87.4 31.6 117.3 31.6 28.6 0 72.8-33.8 129.1-33.8 20.4 0 93.9 1.9 144.3 73.9zm-167.4-235.5c-40.8 17.9-85.5 59.4-85.5 120.2 0 6.4.9 12.9 2.5 19.3.5 1.9 1.2 3.8 1.9 5.7 1.9.6 5.1 1.3 8.3 1.3 38.5 0 87.1-38.2 87.1-106 0-6.4-.6-13.5-2.6-21.5-1.3.1-7.8-.4-11.7.9z" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export const metadata = {
  title: "Sign in — Profession OS",
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { callbackUrl } = await searchParams;
  const redirectTo = callbackUrl ?? "/dashboard";

  return (
    <div style={styles.shell}>
      <div style={styles.card}>
        {/* Wordmark */}
        <div style={styles.header}>
          <span style={styles.wordmark}>PROFESSION OS</span>
          <p style={styles.tagline}>Command your work.</p>
        </div>

        {/* Providers */}
        <div style={styles.providers}>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <button type="submit" style={styles.providerBtn}>
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", { redirectTo });
            }}
          >
            <button type="submit" style={styles.providerBtn}>
              <MicrosoftIcon />
              <span>Continue with Microsoft</span>
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("apple", { redirectTo });
            }}
          >
            <button type="submit" style={styles.providerBtnApple}>
              <AppleIcon />
              <span>Continue with Apple</span>
            </button>
          </form>
        </div>

        <p style={styles.legalNote}>
          By signing in you agree to our{" "}
          <a href="/legal/terms" style={styles.legalLink}>Terms of Service</a>
          {" "}and{" "}
          <a href="/legal/privacy" style={styles.legalLink}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

// ─── Inline styles (avoids a separate CSS module for a single page) ────────────

const styles = {
  shell: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--color-bg-base)",
    fontFamily: "var(--font-ui)",
    padding: "var(--space-6)",
  } satisfies React.CSSProperties,

  card: {
    width: "100%",
    maxWidth: "360px",
    backgroundColor: "var(--color-bg-surface)",
    border: "1px solid var(--color-border-default)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-8)",
    display: "flex",
    flexDirection: "column" as const,
    gap: "var(--space-6)",
  } satisfies React.CSSProperties,

  header: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "var(--space-2)",
    textAlign: "center" as const,
  } satisfies React.CSSProperties,

  wordmark: {
    fontSize: "var(--text-wordmark-size)",
    fontWeight: "var(--text-wordmark-weight)" as unknown as number,
    letterSpacing: "var(--text-wordmark-spacing)",
    color: "var(--color-accent-brand)",
    textTransform: "uppercase" as const,
  } satisfies React.CSSProperties,

  tagline: {
    fontSize: "var(--text-body-sm-size)",
    color: "var(--color-text-secondary)",
  } satisfies React.CSSProperties,

  providers: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "var(--space-3)",
  } satisfies React.CSSProperties,

  providerBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-3)",
    padding: "10px var(--space-4)",
    backgroundColor: "var(--color-bg-raised)",
    border: "1px solid var(--color-border-default)",
    borderRadius: "var(--radius-default)",
    color: "var(--color-text-primary)",
    fontSize: "var(--text-body-base-size)",
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "background-color var(--duration-fast) var(--easing-default), border-color var(--duration-fast) var(--easing-default)",
  } satisfies React.CSSProperties,

  providerBtnApple: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-3)",
    padding: "10px var(--space-4)",
    backgroundColor: "var(--color-bg-raised)",
    border: "1px solid var(--color-border-default)",
    borderRadius: "var(--radius-default)",
    color: "var(--color-text-primary)",
    fontSize: "var(--text-body-base-size)",
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "background-color var(--duration-fast) var(--easing-default), border-color var(--duration-fast) var(--easing-default)",
  } satisfies React.CSSProperties,

  legalNote: {
    fontSize: "var(--text-body-sm-size)",
    color: "var(--color-text-disabled)",
    textAlign: "center" as const,
    lineHeight: "1.5",
  } satisfies React.CSSProperties,

  legalLink: {
    color: "var(--color-text-secondary)",
    textDecoration: "underline",
  } satisfies React.CSSProperties,
} as const;
