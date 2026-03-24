import { presetGenerationInputSchema } from "@ship-council/agents/generation";
import { PresetGenerationError, generatePreset } from "@ship-council/agents/preset-generation-service";

import { RouteError, withErrorHandler } from "@/app/api/_utils";

export const runtime = "nodejs";

export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const input = presetGenerationInputSchema.parse(body);
  const preset = await generatePreset(input);

  return Response.json({ preset });
}, {
  fallbackMessage: "Failed to generate preset",
  mapError(error) {
    if (error instanceof PresetGenerationError) {
      return {
        status: error.status,
        message: error.message
      };
    }

    if (error instanceof RouteError) {
      return {
        status: error.status,
        message: error.message
      };
    }

    return null;
  }
});
