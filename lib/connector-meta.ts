import {
  GitBranch,
  Globe,
  Mail,
  MessageCircle,
  MessageSquare,
  Plug,
  type LucideIcon,
} from "lucide-react";

import type { ConnectorType } from "@/lib/db/schema";

export interface ConnectorMeta {
  label: string;
  Icon: LucideIcon;
  accountLabel: string;
  accountPlaceholder: string;
  secretLabel: string;
}

export const CONNECTOR_META: Record<ConnectorType, ConnectorMeta> = {
  slack: {
    label: "Slack",
    Icon: MessageSquare,
    accountLabel: "Workspace / channel",
    accountPlaceholder: "#general or workspace URL",
    secretLabel: "Bot / app token (optional)",
  },
  gmail: {
    label: "Gmail",
    Icon: Mail,
    accountLabel: "Email address",
    accountPlaceholder: "client@gmail.com",
    secretLabel: "App password (optional)",
  },
  google: {
    label: "Google",
    Icon: Globe,
    accountLabel: "Account / email",
    accountPlaceholder: "client@company.com",
    secretLabel: "Token / password (optional)",
  },
  whatsapp: {
    label: "WhatsApp",
    Icon: MessageCircle,
    accountLabel: "Phone number",
    accountPlaceholder: "+1 555 000 1234",
    secretLabel: "API token (optional)",
  },
  github: {
    label: "GitHub",
    Icon: GitBranch,
    accountLabel: "Org / repo",
    accountPlaceholder: "acme/website",
    secretLabel: "Personal access token (optional)",
  },
  custom: {
    label: "Custom",
    Icon: Plug,
    accountLabel: "Identifier",
    accountPlaceholder: "account / handle / URL",
    secretLabel: "Secret (optional)",
  },
};

export const CONNECTOR_TYPES = Object.keys(CONNECTOR_META) as ConnectorType[];
