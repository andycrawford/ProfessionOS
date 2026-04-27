// NOTE: This plugin requires the Azure AD app registration to have the
// ChannelMessage.Read.All application permission (admin-consented) in addition
// to the existing Mail/Calendar permissions.

import type { ServicePlugin, ActivityItemData, ServiceConfig } from "@/services/types";
import { ServiceType } from "@/services/types";
import { graphGet } from "@/lib/microsoft-graph";
import { registerPlugin } from "@/services/registry";

interface GraphTeam {
  id: string;
  displayName: string;
}

interface GraphChannel {
  id: string;
  displayName: string;
}

interface GraphMessageMention {
  mentioned?: {
    user?: { userIdentityType?: string };
  };
}

interface GraphMessage {
  id: string;
  createdDateTime?: string;
  webUrl?: string;
  body?: { content?: string; contentType?: string };
  from?: {
    user?: { displayName?: string; userPrincipalName?: string };
  };
  mentions?: GraphMessageMention[];
  replyToId?: string | null;
  channelIdentity?: { channelId?: string; teamId?: string };
}

interface GraphListResponse<T> {
  value: T[];
}

const msTeamsPlugin: ServicePlugin = {
  type: ServiceType.MSTeams,
  displayName: "Microsoft Teams",
  description: "Monitor Teams channel messages and @mentions",
  icon: "MessageSquare",
  color: "#0078D4",
  configFields: [
    {
      key: "userEmail",
      label: "User Email",
      type: "email",
      required: true,
      placeholder: "user@company.com",
      description: "The user whose Teams activity to monitor (UPN / mailbox address)",
    },
    {
      key: "teamId",
      label: "Team ID (optional)",
      type: "text",
      required: false,
      placeholder: "Leave blank to monitor all joined teams",
      description: "Scope polling to a single team. Leave blank for all joined teams.",
    },
    {
      key: "mentionsOnly",
      label: "Mentions Only",
      type: "select",
      required: false,
      description: "Only surface messages where the user is @mentioned",
      options: [
        { label: "All messages", value: "false" },
        { label: "@mentions only", value: "true" },
      ],
    },
    {
      key: "lookbackHours",
      label: "Lookback Window (hours)",
      type: "number",
      required: false,
      placeholder: "24",
      description: "How far back to look for messages",
    },
  ],

  async poll(
    config: ServiceConfig,
    _credentials: ServiceConfig
  ): Promise<ActivityItemData[]> {
    const userEmail = config.userEmail as string;
    if (!userEmail) throw new Error("User email is required");

    const lookbackHours = (config.lookbackHours as number) || 24;
    const mentionsOnly = config.mentionsOnly === "true";
    const teamIdFilter = config.teamId as string | undefined;

    const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

    // Discover joined teams (or use a pinned team)
    let teams: GraphTeam[];
    if (teamIdFilter) {
      const team = await graphGet<GraphTeam>(`/teams/${teamIdFilter}`);
      teams = [team];
    } else {
      const teamsResp = await graphGet<GraphListResponse<GraphTeam>>(
        `/users/${userEmail}/joinedTeams`
      );
      teams = teamsResp.value || [];
    }

    const items: ActivityItemData[] = [];

    for (const team of teams) {
      const channelsResp = await graphGet<GraphListResponse<GraphChannel>>(
        `/teams/${team.id}/channels`
      );
      const channels = channelsResp.value || [];

      for (const channel of channels) {
        let messages: GraphMessage[];
        try {
          const messagesResp = await graphGet<GraphListResponse<GraphMessage>>(
            `/teams/${team.id}/channels/${channel.id}/messages?$top=50`
          );
          messages = messagesResp.value || [];
        } catch {
          // Channel may not support message listing (e.g. private channels without access)
          continue;
        }

        for (const msg of messages) {
          if (!msg.createdDateTime) continue;
          const msgDate = new Date(msg.createdDateTime);
          if (msgDate < cutoff) continue;

          const isMention = (msg.mentions ?? []).some(
            (m) => m.mentioned?.user?.userIdentityType === "aadUser"
          );
          const isReplyToUser = !!msg.replyToId;

          if (mentionsOnly && !isMention) continue;

          let urgency: 0 | 1 | 2 = 0;
          if (isMention) urgency = 2;
          else if (isReplyToUser) urgency = 1;

          const itemType = isMention ? "teams_mention" : "teams_message";
          const senderName = msg.from?.user?.displayName;
          const senderEmail = msg.from?.user?.userPrincipalName;

          // Strip HTML tags from content for a plain-text summary
          const rawContent = msg.body?.content ?? "";
          const summary = rawContent.replace(/<[^>]*>/g, "").trim().slice(0, 200) || undefined;

          items.push({
            externalId: msg.id,
            itemType,
            title: `${senderName ?? "Unknown"} in #${channel.displayName}`,
            summary,
            urgency,
            sourceUrl: msg.webUrl ?? undefined,
            metadata: {
              teamName: team.displayName,
              teamId: team.id,
              channelName: channel.displayName,
              channelId: channel.id,
              sender: senderName,
              senderEmail,
              isMention,
              threadId: msg.replyToId ?? msg.id,
            },
            occurredAt: msgDate,
          });
        }
      }
    }

    return items;
  },

  async testConnection(config: ServiceConfig): Promise<boolean> {
    const userEmail = config.userEmail as string;
    if (!userEmail) return false;
    try {
      await graphGet(`/users/${userEmail}/joinedTeams`);
      return true;
    } catch {
      return false;
    }
  },
};

registerPlugin(msTeamsPlugin);
export default msTeamsPlugin;
