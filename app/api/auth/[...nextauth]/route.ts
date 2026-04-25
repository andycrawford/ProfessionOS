import { handlers } from "@/auth";

// Auth routes are always request-specific — never statically generated.
export const dynamic = "force-dynamic";

export const { GET, POST } = handlers;
