import { Suspense } from "react";
import NewServiceClient from "./NewServiceClient";
import { getAllPlugins } from "@/services/registry";

// Server component: reads the plugin registry and passes serialisable plugin
// metadata to the client. Actual poll/testConnection functions are stripped.
// hasOAuth: true when the plugin defines getAuthUrl, signalling that the user
// should be redirected through the OAuth consent screen instead of filling in
// credentials manually.
export default function NewServicePage() {
  const plugins = getAllPlugins().map((p) => ({
    type: p.type,
    displayName: p.displayName,
    description: p.description,
    icon: p.icon,
    color: p.color,
    configFields: p.configFields,
    hasOAuth: typeof p.getAuthUrl === "function",
  }));

  // Suspense required: NewServiceClient uses useSearchParams(), which causes
  // Next.js to bail out of static prerendering without a boundary.
  return (
    <Suspense>
      <NewServiceClient plugins={plugins} />
    </Suspense>
  );
}
