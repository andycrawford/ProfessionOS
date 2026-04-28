// POST /api/organizations/[id]/logo — upload a logo image file (admin only)
// Saves the file to public/org-logos/{orgId}.{ext} and updates the org's logoUrl.

export const dynamic = "force-dynamic";

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { organizations, organizationMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

async function requireAdmin(userId: string, orgId: string) {
  const db = getDb();
  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, orgId)
      )
    )
    .limit(1);
  return membership?.role === "admin" ? membership : null;
}

export async function POST(req: Request, { params }: RouteContext) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const admin = await requireAdmin(session.user.id, id);
  if (!admin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return Response.json(
      { error: "Unsupported file type. Use PNG, JPEG, GIF, SVG, or WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: "File too large. Maximum size is 2 MB." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadsDir = path.join(process.cwd(), "public", "org-logos");
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${id}.${ext}`;
  await writeFile(path.join(uploadsDir, filename), buffer);

  const logoUrl = `/org-logos/${filename}`;

  const db = getDb();
  const [updated] = await db
    .update(organizations)
    .set({ logoUrl })
    .where(eq(organizations.id, id))
    .returning();

  if (!updated) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  return Response.json({ logoUrl });
}
