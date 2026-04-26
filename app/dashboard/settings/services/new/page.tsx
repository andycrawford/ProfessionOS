import NewServiceClient from "./NewServiceClient";
import { getAllPlugins } from "@/services/registry";

// Server component: reads the plugin registry and passes serialisable plugin
// metadata to the client. Actual poll/testConnection functions are stripped.
export default function NewServicePage() {
  const plugins = getAllPlugins().map((p) => ({
    type: p.type,
    displayName: p.displayName,
    description: p.description,
    icon: p.icon,
    color: p.color,
    configFields: p.configFields,
  }));

  return <NewServiceClient plugins={plugins} />;
}
