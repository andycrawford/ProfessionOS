import { NextRequest, NextResponse } from "next/server";
import { lookupOrgByEmailDomain } from "@/lib/sso";

// This route must remain public — it is called before the user signs in,
// so the auth proxy explicitly excludes /api/auth/* from its matcher.
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/sso-check?email=user@example.com
 *
 * Returns whether the given email address belongs to an SSO-enabled
 * organization, and if so, which Entra ID tenant they should be routed to.
 * The sign-in page uses this to hint the user and pre-select the correct
 * enterprise provider.
 *
 * Response shape:
 *   { ssoEnabled: false }
 *   { ssoEnabled: true, tenantId: string, orgName: string, providerId: string }
 *
 * providerId is the NextAuth provider id to pass to signIn() on the client:
 *   signIn(providerId, { redirectTo })
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Missing or invalid email query parameter" },
      { status: 400 }
    );
  }

  const org = await lookupOrgByEmailDomain(email);

  if (!org) {
    return NextResponse.json({ ssoEnabled: false });
  }

  return NextResponse.json({
    ssoEnabled: true,
    tenantId: org.tenantId,
    orgName: org.name,
    // The NextAuth provider id — use with signIn(providerId, { redirectTo })
    providerId: `microsoft-entra-id-${org.orgId}`,
  });
}
