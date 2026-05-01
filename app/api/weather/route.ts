// Weather API — returns current weather for a location.
// Currently returns mock data; will be wired to a weather API (e.g. OpenWeatherMap) later.
//
// GET /api/weather?city=San+Francisco&state=CA&country=US

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";

export async function GET(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const city = url.searchParams.get("city")?.trim();

  if (!city) {
    return Response.json({ error: "City is required" }, { status: 400 });
  }

  // TODO: Wire to a real weather API (e.g. OpenWeatherMap) with API key from env.
  // For now, return plausible mock data so the widget renders.
  const mock = {
    temp: 68,
    condition: "Partly Cloudy",
    humidity: 55,
    windSpeed: 8,
  };

  return Response.json(mock, {
    headers: { "Cache-Control": "public, max-age=600" },
  });
}
