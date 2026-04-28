import { notFound, redirect } from "next/navigation";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import "@/services/plugins"; // populate plugin registry
import { getPlugin } from "@/services/registry";
import type { ServiceType } from "@/services/types";

import ServiceDetailClient from "./ServiceDetailClient";

type Params = { id: string };

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const session = await safeAuth();
  if (!session?.user?.id) redirect("/sign-in");

  const { id } = await params;
  const db = getDb();

  const [service] = await db
    .select()
    .from(connectedServices)
    .where(
      and(
        eq(connectedServices.id, id),
        eq(connectedServices.userId, session.user.id)
      )
    );

  if (!service) notFound();

  const plugin = getPlugin(service.type as ServiceType);

  return (
    <ServiceDetailClient
      id={service.id}
      type={service.type as ServiceType}
      displayName={service.displayName}
      description={plugin?.description ?? ""}
      icon={plugin?.icon ?? "Plug"}
      color={plugin?.color ?? "var(--color-text-secondary)"}
      status={service.status as import("@/services/types").ServiceStatus}
      configFields={plugin?.configFields ?? []}
      config={
        (() => {
          const stored = (service.config ?? {}) as Record<string, string | number | boolean>;
          // Seed defaults for any fields not yet in stored config (e.g. new configSource field
          // on existing services — defaults to the first option so visibleWhen still works).
          const defaults: Record<string, string | number | boolean> = {};
          for (const f of plugin?.configFields ?? []) {
            if (f.type === "checkbox") defaults[f.key] = false;
            else if (f.type === "number") defaults[f.key] = 0;
            else if (f.type === "select" && f.options?.[0]) defaults[f.key] = f.options[0].value;
            else defaults[f.key] = "";
          }
          return { ...defaults, ...stored };
        })()
      }
    />
  );
}
