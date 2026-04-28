import {
  Bot,
  Calendar,
  CalendarDays,
  CheckSquare,
  Database,
  FileCheck,
  Globe,
  Mail,
  MessageSquare,
  Plug,
  type LucideProps,
} from "lucide-react";
import type { FC } from "react";

const ICON_MAP: Record<string, FC<LucideProps>> = {
  Bot,
  Calendar,
  CalendarDays,
  CheckSquare,
  Database,
  FileCheck,
  Globe,
  Mail,
  MessageSquare,
  Plug,
};

export default function ServiceIcon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  const Icon = ICON_MAP[name] ?? Plug;
  return <Icon size={size} aria-hidden="true" />;
}
