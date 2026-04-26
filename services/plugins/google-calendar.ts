import type { ServicePlugin, ActivityItemData, ServiceConfig } from "@/services/types";
import { ServiceType } from "@/services/types";
import { registerPlugin } from "@/services/registry";

const googleCalendarPlugin: ServicePlugin = {
  type: ServiceType.GoogleCalendar,
  displayName: "Google Calendar",
  description: "Monitor Google Calendar events and meetings",
  icon: "CalendarDays",
  color: "#4285F4",
  configFields: [
    {
      key: "calendarId",
      label: "Calendar ID",
      type: "text",
      required: false,
      placeholder: "primary",
      description: "Calendar ID or 'primary' for default calendar",
    },
    {
      key: "lookaheadHours",
      label: "Lookahead Window (hours)",
      type: "number",
      required: false,
      placeholder: "48",
      description: "How far ahead to look for upcoming events",
    },
  ],

  async poll(
    config: ServiceConfig,
    credentials: ServiceConfig
  ): Promise<ActivityItemData[]> {
    const accessToken = credentials.access_token as string;
    if (!accessToken) return [];

    const calendarId = (config.calendarId as string) || "primary";
    const lookaheadHours = (config.lookaheadHours as number) || 48;
    const now = new Date();
    const end = new Date(now.getTime() + lookaheadHours * 60 * 60 * 1000);

    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      maxResults: "50",
      singleEvents: "true",
      orderBy: "startTime",
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status}`);
    }

    const data = await response.json();
    const events = data.items || [];

    return events.map((evt: Record<string, unknown>): ActivityItemData => {
      const start = evt.start as { dateTime?: string; date?: string };
      const end_ = evt.end as { dateTime?: string; date?: string };
      const startStr = start?.dateTime || start?.date;
      const startDate = startStr ? new Date(startStr) : new Date();
      const minutesUntil = (startDate.getTime() - Date.now()) / (1000 * 60);

      // Urgency: starting within 30 min → urgent (2), within 2 hours → important (1)
      let urgency: 0 | 1 | 2 = 0;
      if (minutesUntil <= 30) urgency = 2;
      else if (minutesUntil <= 120) urgency = 1;

      return {
        externalId: evt.id as string,
        itemType: "calendar_event",
        title: (evt.summary as string) || "(No Title)",
        summary:
          (evt.description as string)?.substring(0, 200) ||
          (evt.location as string) ||
          undefined,
        urgency,
        sourceUrl: (evt.htmlLink as string) || undefined,
        metadata: {
          startTime: startStr,
          endTime: end_?.dateTime || end_?.date,
          location: evt.location,
          organizer: (evt.organizer as { email?: string })?.email,
          status: evt.status,
          attendeeCount: Array.isArray(evt.attendees)
            ? (evt.attendees as unknown[]).length
            : 0,
        },
        occurredAt: startDate,
      };
    });
  },

  async testConnection(
    _config: ServiceConfig,
    credentials: ServiceConfig
  ): Promise<boolean> {
    const accessToken = credentials.access_token as string;
    if (!accessToken) return false;
    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.ok;
  },
};

registerPlugin(googleCalendarPlugin);
export default googleCalendarPlugin;
