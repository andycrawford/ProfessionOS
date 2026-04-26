import { signIn } from "@/auth";

// ─── Provider icons ───────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

interface SignUpPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export const metadata = {
  title: "Create account — Profession OS",
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { callbackUrl } = await searchParams;
  const redirectTo = callbackUrl ?? "/dashboard";

  return (
    <div style={styles.shell}>
      <div style={styles.card}>
        {/* Wordmark */}
        <div style={styles.header}>
          <span style={styles.wordmark}>PROFESSION OS</span>
          <h1 style={styles.heading}>Create your account</h1>
          <p style={styles.subheading}>Sign up free with your Microsoft account</p>
        </div>

        {/* Providers */}
        <div style={styles.providers}>
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
        </div>

        <p style={styles.legalNote}>
          By signing up you agree to our{" "}
          <a href="/legal/terms" style={styles.legalLink}>Terms of Service</a>
          {" "}and{" "}
          <a href="/legal/privacy" style={styles.legalLink}>Privacy Policy</a>.
        </p>

        <p style={styles.footerNote}>
          Already have an account?{" "}
          <a href="/sign-in" style={styles.footerLink}>Sign in →</a>
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

  heading: {
    fontSize: "var(--text-heading-sm-size)",
    fontWeight: "var(--text-heading-sm-weight)" as unknown as number,
    color: "var(--color-text-primary)",
    margin: 0,
  } satisfies React.CSSProperties,

  subheading: {
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

  footerNote: {
    fontSize: "var(--text-body-sm-size)",
    color: "var(--color-text-secondary)",
    textAlign: "center" as const,
  } satisfies React.CSSProperties,

  footerLink: {
    color: "var(--color-accent-brand)",
    textDecoration: "none",
  } satisfies React.CSSProperties,
} as const;
