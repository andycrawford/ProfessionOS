import { redirect } from "next/navigation";
import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import DashboardClient from "./DashboardClient";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

export default async function DashboardPage() {
  const session = await safeAuth();

  // Demo mode: no auth required. DEMO_MODE=true is set on demo.professionos.com
  // which has no DATABASE_URL, so session is always null there.
  if (!session?.user?.id) {
    if (process.env.DEMO_MODE === "true") {
      return <DashboardClient userInitials="OS" userName="Demo User" userEmail="demo@professionos.com" />;
    }
    redirect("/sign-in");
  }

  // Redirect first-time users (no connected services) to the setup page.
  // Skip silently if the DB is unavailable.
  try {
    const db = getDb();
    const [{ serviceCount }] = await db
      .select({ serviceCount: count() })
      .from(connectedServices)
      .where(eq(connectedServices.userId, session.user.id));

    if (serviceCount === 0) {
      redirect("/dashboard/settings/services");
    }
  } catch {
    // DB unavailable — render dashboard without redirect
  }

  const userInitials = getInitials(session.user.name);
  const userName = session.user.name ?? undefined;

  return <DashboardClient userInitials={userInitials} userName={userName} />;
}
