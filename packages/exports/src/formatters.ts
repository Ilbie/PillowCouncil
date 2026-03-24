import type { SessionDetailResponse } from "@ship-council/shared";
import { parseRebuttalTargetHeader } from "@ship-council/shared/types";

function formatLanguage(language: string): string {
  switch (language) {
    case "ko":
      return "Korean";
    case "en":
      return "English";
    case "ja":
      return "Japanese";
    default:
      return language;
  }
}

function formatThinkingIntensity(intensity: string): string {
  if (intensity.trim().length === 0) {
    return "Balanced";
  }

  switch (intensity) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "deep":
      return "Deep";
    case "high":
      return "High";
    default:
      return intensity
        .split(/[-_/ ]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

export function toMarkdown(detail: SessionDetailResponse): string {
  const lines: string[] = [
    `# ${detail.session.title}`,
    ``,
    `- Preset: ${detail.session.customPreset?.name ?? detail.session.presetId}`,
    `- Provider: ${detail.session.provider}`,
    `- Model: ${detail.session.model}`,
    `- Language: ${formatLanguage(detail.session.language)}`,
    `- Thinking Intensity: ${formatThinkingIntensity(detail.session.thinkingIntensity)}`,
    `- Debate Cycles: ${detail.session.debateIntensity}`,
    `- Status: ${detail.run?.status ?? "draft"}`,
    `- Prompt: ${detail.session.prompt}`,
    ``
  ];

  for (const round of detail.rounds) {
    lines.push(`## Round ${round.roundNumber} - ${round.title}`);
    if (round.summary) {
      lines.push(round.summary, "");
    }

    for (const message of round.messages) {
      const parsed = parseRebuttalTargetHeader(message.content);
      lines.push(`### ${message.agentName}`);
      if (message.kind === "rebuttal" && parsed.metadata) {
        lines.push(`- Targets: ${parsed.metadata.targetAgentName} (${parsed.metadata.targetAgentKey})`);
        lines.push(`- Claim: ${parsed.metadata.weakestClaim}`);
        lines.push(`- Attack Point: ${parsed.metadata.attackPoint}`);
      }
      lines.push(parsed.body, "");
    }
  }

  if (detail.decision) {
    lines.push(`## Decision Summary`);
    lines.push(detail.decision.finalSummary, "");
    lines.push(`### Top Recommendation`);
    lines.push(detail.decision.topRecommendation, "");

    if (detail.decision.risks.length > 0) {
      lines.push(`### Risks`);
      for (const risk of detail.decision.risks) {
        lines.push(`- ${risk}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}

export function toExportJson(detail: SessionDetailResponse): string {
  return JSON.stringify(
    {
      session: {
        ...detail.session
      },
      run: detail.run,
      rounds: detail.rounds,
      decision: detail.decision
        ? {
            topRecommendation: detail.decision.topRecommendation,
            risks: detail.decision.risks,
            finalSummary: detail.decision.finalSummary
          }
        : null,
      usage: detail.usage
    },
    null,
    2
  );
}
