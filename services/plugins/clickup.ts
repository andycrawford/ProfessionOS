import type { ServicePlugin, ActivityItemData, ServiceConfig } from "@/services/types";
import { ServiceType } from "@/services/types";
import { registerPlugin } from "@/services/registry";

const clickupPlugin: ServicePlugin = {
  type: ServiceType.ClickUp,
  displayName: "ClickUp",
  description: "Monitor ClickUp tasks, assignments, and due dates",
  icon: "CheckSquare",
  color: "#7B68EE",
  configFields: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      required: true,
      placeholder: "pk_...",
      description: "Your ClickUp personal API token",
    },
    {
      key: "teamId",
      label: "Team (Workspace) ID",
      type: "text",
      required: true,
      placeholder: "12345678",
      description: "Your ClickUp workspace/team ID",
    },
    {
      key: "assignee",
      label: "Filter by Assignee",
      type: "text",
      required: false,
      placeholder: "me",
      description: "Filter tasks assigned to this user (leave blank for all)",
    },
    {
      key: "includeSubtasks",
      label: "Include Subtasks",
      type: "select",
      required: false,
      options: [
        { label: "Yes", value: "true" },
        { label: "No", value: "false" },
      ],
    },
  ],

  async poll(
    config: ServiceConfig,
    credentials: ServiceConfig
  ): Promise<ActivityItemData[]> {
    const apiKey = (credentials.apiKey as string) || (config.apiKey as string);
    if (!apiKey) return [];

    const teamId = config.teamId as string;
    if (!teamId) return [];

    const params = new URLSearchParams({
      order_by: "due_date",
      reverse: "true",
      subtasks: (config.includeSubtasks as string) === "true" ? "true" : "false",
      include_closed: "false",
    });

    const response = await fetch(
      `https://api.clickup.com/api/v2/team/${teamId}/task?${params}`,
      {
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`ClickUp API error: ${response.status}`);
    }

    const data = await response.json();
    const tasks = data.tasks || [];

    return tasks.map((task: Record<string, unknown>): ActivityItemData => {
      const dueDate = task.due_date
        ? new Date(Number(task.due_date))
        : undefined;
      const priority = task.priority as {
        id?: string;
        priority?: string;
      } | null;
      const status = task.status as { status?: string; type?: string } | null;
      const list = task.list as { name?: string } | null;

      // ClickUp priority: 1=urgent, 2=high, 3=normal, 4=low → urgency 0–2
      let urgency: 0 | 1 | 2 = 0;
      const priorityId = priority?.id ? parseInt(priority.id) : 3;
      if (priorityId === 1) urgency = 2;
      else if (priorityId === 2) urgency = 1;

      // Overdue tasks are always urgent
      if (dueDate && dueDate < new Date()) urgency = 2;

      return {
        externalId: task.id as string,
        itemType: "task",
        title: (task.name as string) || "(Untitled Task)",
        summary: list?.name ? `List: ${list.name}` : undefined,
        urgency,
        sourceUrl: (task.url as string) || undefined,
        metadata: {
          status: status?.status,
          statusType: status?.type,
          priority: priority?.priority,
          priorityId: priority?.id,
          list: list?.name,
          dueDate: dueDate?.toISOString(),
          tags: task.tags,
        },
        occurredAt: dueDate || new Date(Number(task.date_created)),
      };
    });
  },

  async testConnection(
    config: ServiceConfig,
    credentials: ServiceConfig
  ): Promise<boolean> {
    const apiKey = (credentials.apiKey as string) || (config.apiKey as string);
    if (!apiKey) return false;
    const response = await fetch("https://api.clickup.com/api/v2/user", {
      headers: { Authorization: apiKey },
    });
    return response.ok;
  },
};

registerPlugin(clickupPlugin);
export default clickupPlugin;
