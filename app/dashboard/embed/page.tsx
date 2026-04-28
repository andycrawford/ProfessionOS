// Generic embed page — renders any URL in an iframe.
// Navigated to via /dashboard/embed?url={encodedUrl} when a service has
// linkBehavior set to "embed".

import { redirect } from "next/navigation";

import { safeAuth } from "@/auth";
import EmbedClient from "./EmbedClient";

export default async function GenericEmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const session = await safeAuth();
  if (!session?.user?.id) redirect("/sign-in");

  const { url } = await searchParams;
  if (!url) redirect("/dashboard");

  return <EmbedClient displayName="Source" url={url} />;
}
