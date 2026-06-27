import type { AgentProviderId } from "@/types";

/** Provider badge styles (design system §8). */
export const AGENT_BADGE: Record<AgentProviderId, string> = {
  anthropic: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  openai: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  github_copilot: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  custom: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};
