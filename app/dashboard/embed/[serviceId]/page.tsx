import { notFound, redirect } from "next/navigation";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import "@/services/plugins"; // populate plugin registry
import { ServiceType } from "@/services/types";

import EmbedClient from "./EmbedClient";

type Params = { serviceId: string };

export default async function EmbedPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const session = await safeAuth();
  if (!session?.user?.id) redirect("/sign-in");

  const { serviceId } = await params;
  const db = getDb();

  const [service] = await db
    .select()
    .from(connectedServices)
    .where(
      and(
        eq(connectedServices.id, serviceId),
        eq(connectedServices.userId, session.user.id)
      )
    );

  if (!service || service.type !== ServiceType.EmbedWebsite) notFound();

  const config = (service.config ?? {}) as Record<string, unknown>;
  const url = typeof config.url === "string" ? config.url : null;

  if (!url) notFound();

  return <EmbedClient displayName={service.displayName} url={url} />;
}
