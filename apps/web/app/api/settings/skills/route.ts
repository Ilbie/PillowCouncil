import { getSkillsSettingsState, saveSkillsSettingsState, skillsSettingsPayloadSchema } from "@pillow-council/providers";

import { withErrorHandler } from "@/app/api/_utils";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await getSkillsSettingsState());
}

export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const payload = skillsSettingsPayloadSchema.parse(body);
  return Response.json(await saveSkillsSettingsState(payload));
}, { fallbackMessage: "Failed to save skills settings" });
