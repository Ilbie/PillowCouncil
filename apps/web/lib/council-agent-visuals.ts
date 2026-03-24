import {
  Activity,
  AlertOctagon,
  Briefcase,
  Cpu,
  Lightbulb,
  Shield,
  ShieldAlert,
  Users,
  Zap,
  type LucideIcon
} from "lucide-react";

export type AgentVisual = {
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
};

const DYNAMIC_AGENT_VISUALS: readonly AgentVisual[] = [
  { icon: Briefcase, color: "text-sky-300", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  { icon: Cpu, color: "text-violet-300", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  { icon: Lightbulb, color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { icon: Shield, color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { icon: Users, color: "text-rose-300", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  { icon: Zap, color: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/20" }
];

const AGENT_VISUALS = {
  founder: { icon: Briefcase, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  user: { icon: Users, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  "staff-engineer": { icon: Cpu, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  growth: { icon: Zap, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  skeptic: { icon: AlertOctagon, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  pm: { icon: Briefcase, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  engineer: { icon: Cpu, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  designer: { icon: Lightbulb, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
  security: { icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  performance: { icon: Activity, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  maintainer: { icon: ShieldAlert, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" }
} as const satisfies Record<string, AgentVisual>;

function getKeywordVisual(role: string): AgentVisual | null {
  const normalized = role.toLowerCase();

  if (normalized.includes("security") || normalized.includes("보안")) {
    return AGENT_VISUALS.security;
  }
  if (normalized.includes("design") || normalized.includes("ux") || normalized.includes("디자인")) {
    return AGENT_VISUALS.designer;
  }
  if (normalized.includes("engineer") || normalized.includes("개발") || normalized.includes("아키텍처")) {
    return AGENT_VISUALS["staff-engineer"];
  }
  if (normalized.includes("growth") || normalized.includes("marketing") || normalized.includes("마케팅")) {
    return AGENT_VISUALS.growth;
  }
  if (normalized.includes("skeptic") || normalized.includes("review") || normalized.includes("회의") || normalized.includes("risk")) {
    return AGENT_VISUALS.skeptic;
  }
  if (normalized.includes("user") || normalized.includes("customer") || normalized.includes("고객") || normalized.includes("사용자")) {
    return AGENT_VISUALS.user;
  }
  if (normalized.includes("product") || normalized.includes("pm") || normalized.includes("전략")) {
    return AGENT_VISUALS.pm;
  }

  return null;
}

export function getAgentVisual(agentKey: string, role?: string): AgentVisual {
  const fromKey = AGENT_VISUALS[agentKey as keyof typeof AGENT_VISUALS];
  if (fromKey) {
    return fromKey;
  }

  const fromRole = role ? getKeywordVisual(role) : null;
  if (fromRole) {
    return fromRole;
  }

  const hash = [...`${agentKey}:${role ?? ""}`].reduce((total, char) => total + char.charCodeAt(0), 0);
  return DYNAMIC_AGENT_VISUALS[hash % DYNAMIC_AGENT_VISUALS.length]!;
}
