export interface Env {
  DB: D1Database;
  CORS_ORIGIN?: string;
  SESSION_SECRET?: string;
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("Origin");
  const allowed = env.CORS_ORIGIN || "https://joelengelman.github.io";

  return {
    "Access-Control-Allow-Origin": origin === allowed ? origin : allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, status = 200, request?: Request, env?: Env) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });

  if (request && env) {
    for (const [key, value] of Object.entries(corsHeaders(request, env))) {
      headers.set(key, value);
    }
  }

  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/api/health") {
      return json({ ok: true, service: "pulse-api" }, 200, request, env);
    }

    return json(
      {
        error: "API endpoint not implemented yet",
        path: url.pathname,
        message: "The Cloudflare backend foundation is ready. Authentication and messaging routes will be migrated next.",
      },
      404,
      request,
      env,
    );
  },
};
