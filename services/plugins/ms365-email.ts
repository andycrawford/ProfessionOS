import type { ServicePlugin, ActivityItemData, ServiceConfig } from "@/services/types";
import { ServiceType } from "@/services/types";
import { graphGet, testMailboxAccess } from "@/lib/microsoft-graph";
import { registerPlugin } from "@/services/registry";

interface GraphMessage {
  id: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
  importance?: string;
  isRead?: boolean;
  bodyPreview?: string;
  webLink?: string;
  hasAttachments?: boolean;
  flag?: { flagStatus?: string };
}

interface GraphMessageResponse {
  value: GraphMessage[];
  "@odata.nextLink"?: string;
}

const ms365EmailPlugin: ServicePlugin = {
  type: ServiceType.Ms365Email,
  displayName: "Microsoft 365 Email",
  description: "Monitor Microsoft 365 / Outlook mailboxes for important emails",
  icon: "Mail",
  color: "#0078D4",
  configFields: [
    {
      key: "mailbox",
      label: "Mailbox Address",
      type: "email",
      required: true,
      placeholder: "user@company.com",
      description: "The email address to monitor",
    },
    {
      key: "folders",
      label: "Folders to Monitor",
      type: "text",
      required: false,
      placeholder: "Inbox",
      description: "Comma-separated folder names (default: Inbox)",
    },
    {
      key: "lookbackHours",
      label: "Lookback Window (hours)",
      type: "number",
      required: false,
      placeholder: "24",
      description: "How far back to look for emails on each poll",
    },
    {
      key: "unreadOnly",
      label: "Unread Only",
      type: "select",
      required: false,
      placeholder: "false",
      description: "Only fetch unread messages",
      options: [
        { label: "All messages", value: "false" },
        { label: "Unread only", value: "true" },
      ],
    },
  ],

  async poll(
    config: ServiceConfig,
    _credentials: ServiceConfig
  ): Promise<ActivityItemData[]> {
    const mailbox = config.mailbox as string;
    if (!mailbox) throw new Error("Mailbox address is required");

    const lookbackHours = (config.lookbackHours as number) || 24;
    const since = new Date(
      Date.now() - lookbackHours * 60 * 60 * 1000
    ).toISOString();
    const unreadOnly = config.unreadOnly === "true";

    let filter = `receivedDateTime ge ${since}`;
    if (unreadOnly) filter += " and isRead eq false";

    const endpoint = `/users/${mailbox}/messages?$filter=${encodeURIComponent(filter)}&$top=50&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,importance,isRead,bodyPreview,webLink,hasAttachments,flag`;

    const data = await graphGet<GraphMessageResponse>(endpoint);
    const messages = data.value || [];

    return messages.map((msg): ActivityItemData => {
      const importance = msg.importance || "normal";
      const isFlagged = msg.flag?.flagStatus === "flagged";

      let urgency: 0 | 1 | 2 = 0;
      if (importance === "high" || isFlagged) urgency = 2;
      else if (importance === "low") urgency = 0;

      return {
        externalId: msg.id,
        itemType: "email",
        title: msg.subject || "(No Subject)",
        summary: msg.bodyPreview || undefined,
        urgency,
        sourceUrl: msg.webLink || undefined,
        metadata: {
          from: msg.from?.emailAddress?.address,
          fromName: msg.from?.emailAddress?.name,
          isRead: msg.isRead,
          importance,
          hasAttachments: msg.hasAttachments,
          isFlagged,
        },
        occurredAt: msg.receivedDateTime
          ? new Date(msg.receivedDateTime)
          : undefined,
      };
    });
  },

  async testConnection(config: ServiceConfig): Promise<boolean> {
    const mailbox = config.mailbox as string;
    if (!mailbox) return false;
    return testMailboxAccess(mailbox);
  },
};

registerPlugin(ms365EmailPlugin);
export default ms365EmailPlugin;
