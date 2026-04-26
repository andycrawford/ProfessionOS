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
  if (!session?.user?.id) redirect("/sign-in");

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

  return <DashboardClient userInitials={userInitials} />;
}
