import { ZodError } from "zod";

type ErrorMapping = {
  status: number;
  message: string;
};

type RouteHandlerOptions = {
  fallbackMessage?: string;
  mapError?: (error: unknown) => ErrorMapping | null;
};

export class RouteError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "RouteError";
  }
}

export type AppRouteHandler<TContext = undefined> = TContext extends undefined
  ? (request: Request) => Promise<Response> | Response
  : (request: Request, context: TContext) => Promise<Response> | Response;

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export function withErrorHandler<TContext = undefined>(
  handler: AppRouteHandler<TContext>,
  options: RouteHandlerOptions = {}
): AppRouteHandler<TContext> {
  return (async (request: Request, context?: TContext) => {
    try {
      if (context === undefined) {
        return await (handler as (request: Request) => Promise<Response> | Response)(request);
      }

      return await (handler as (request: Request, context: TContext) => Promise<Response> | Response)(request, context);
    } catch (error) {
      const mapped = options.mapError?.(error);
      if (mapped) {
        return jsonError(mapped.message, mapped.status);
      }

      if (error instanceof RouteError) {
        return jsonError(error.message, error.status);
      }

      if (error instanceof ZodError) {
        const message = error.issues[0]?.message ?? error.message;
        return jsonError(message, 400);
      }

      return jsonError(options.fallbackMessage ?? "Internal Server Error", 500);
    }
  }) as AppRouteHandler<TContext>;
}
