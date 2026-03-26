import type { SessionDetailResponse } from "@pillow-council/shared";
import { parseRebuttalTargetHeader } from "@pillow-council/shared/types";

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

function getMarkdownLabels(language: string): {
  preset: string;
  provider: string;
  model: string;
  language: string;
  thinkingIntensity: string;
  debateCycles: string;
  status: string;
  prompt: string;
  round: string;
  decisionSummary: string;
  topRecommendation: string;
  risks: string;
  targets: string;
  claim: string;
  attackPoint: string;
} {
  switch (language) {
    case "ko":
      return {
        preset: "프리셋",
        provider: "공급사",
        model: "모델",
        language: "언어",
        thinkingIntensity: "사고 강도",
        debateCycles: "토론 반복",
        status: "상태",
        prompt: "주제",
        round: "라운드",
        decisionSummary: "결정 요약",
        topRecommendation: "최우선 권고안",
        risks: "리스크",
        targets: "대상",
        claim: "문제 주장",
        attackPoint: "반박 포인트"
      };
    case "ja":
      return {
        preset: "プリセット",
        provider: "プロバイダー",
        model: "モデル",
        language: "言語",
        thinkingIntensity: "思考強度",
        debateCycles: "討論サイクル",
        status: "状態",
        prompt: "トピック",
        round: "ラウンド",
        decisionSummary: "意思決定サマリー",
        topRecommendation: "最優先の提案",
        risks: "リスク",
        targets: "対象",
        claim: "対象主張",
        attackPoint: "反論ポイント"
      };
    default:
      return {
        preset: "Preset",
        provider: "Provider",
        model: "Model",
        language: "Language",
        thinkingIntensity: "Thinking Intensity",
        debateCycles: "Debate Cycles",
        status: "Status",
        prompt: "Prompt",
        round: "Round",
        decisionSummary: "Decision Summary",
        topRecommendation: "Top Recommendation",
        risks: "Risks",
        targets: "Targets",
        claim: "Claim",
        attackPoint: "Attack Point"
      };
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
  const labels = getMarkdownLabels(detail.session.language);
  const lines: string[] = [
    `# ${detail.session.title}`,
    ``,
    `- ${labels.preset}: ${detail.session.customPreset?.name ?? detail.session.presetId}`,
    `- ${labels.provider}: ${detail.session.provider}`,
    `- ${labels.model}: ${detail.session.model}`,
    `- ${labels.language}: ${formatLanguage(detail.session.language)}`,
    `- ${labels.thinkingIntensity}: ${formatThinkingIntensity(detail.session.thinkingIntensity)}`,
    `- ${labels.debateCycles}: ${detail.session.debateIntensity}`,
    `- ${labels.status}: ${detail.run?.status ?? "draft"}`,
    `- ${labels.prompt}: ${detail.session.prompt}`,
    ``
  ];

  for (const round of detail.rounds) {
    lines.push(`## ${labels.round} ${round.roundNumber} - ${round.title}`);
    if (round.summary) {
      lines.push(round.summary, "");
    }

    for (const message of round.messages) {
      const parsed = parseRebuttalTargetHeader(message.content);
      lines.push(`### ${message.agentName}`);
      if (message.kind === "rebuttal" && parsed.metadata) {
        lines.push(`- ${labels.targets}: ${parsed.metadata.targetAgentName} (${parsed.metadata.targetAgentKey})`);
        lines.push(`- ${labels.claim}: ${parsed.metadata.weakestClaim}`);
        lines.push(`- ${labels.attackPoint}: ${parsed.metadata.attackPoint}`);
      }
      lines.push(parsed.body, "");
    }
  }

  if (detail.decision) {
    lines.push(`## ${labels.decisionSummary}`);
    lines.push(detail.decision.finalSummary, "");
    lines.push(`### ${labels.topRecommendation}`);
    lines.push(detail.decision.topRecommendation, "");

    if (detail.decision.risks.length > 0) {
      lines.push(`### ${labels.risks}`);
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
