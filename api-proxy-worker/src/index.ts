const UPSTREAM = "https://pulse-api.joeldavidengelman.workers.dev";
const ALLOWED_ORIGIN = "https://joelengelman.github.io";

function cors(request: Request): Headers {
  const origin = request.headers.get("Origin");
  const h = new Headers();
  if (origin === ALLOWED_ORIGIN) h.set("Access-Control-Allow-Origin", origin);
  h.set("Access-Control-Allow-Credentials", "true");
  h.set("Access-Control-Allow-Headers", "Content-Type, X-Requested-With, Accept, Authorization");
  h.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  h.set("Access-Control-Max-Age", "86400");
  h.set("Vary", "Origin");
  return h;
}

function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of cors(request)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });

    const incoming = new URL(request.url);
    const upstream = new URL(UPSTREAM);
    upstream.pathname = incoming.pathname;
    upstream.search = incoming.search;

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("content-length");

    try {
      const response = await fetch(upstream, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        redirect: "manual",
      });
      return withCors(request, response);
    } catch (error) {
      console.error("Pulse proxy upstream failure", error);
      return withCors(request, new Response(JSON.stringify({ error: "Upstream API unavailable" }), {
        status: 502,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      }));
    }
  },
};
