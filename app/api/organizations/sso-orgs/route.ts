// Returns all SSO-enabled organizations as label/value pairs for plugin config pickers.
// GET /api/organizations/sso-orgs

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { loadAllSsoOrgs } from "@/lib/sso";

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await loadAllSsoOrgs();

  return Response.json(
    orgs.map((o) => ({
      label: o.domain ? `${o.name} (${o.domain})` : o.name,
      value: o.orgId,
    }))
  );
}
