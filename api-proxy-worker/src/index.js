const UPSTREAM = "https://pulse-api.joeldavidengelman.workers.dev";
const ALLOWED_ORIGIN = "https://joelengelman.github.io";

function cors(request) {
  const origin = request.headers.get("Origin");
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Headers", "Content-Type, X-Requested-With, Accept, Authorization");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  return headers;
}

export default {
  async fetch(request) {
    const headers = cors(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    const incoming = new URL(request.url);
    const target = new URL(UPSTREAM);
    target.pathname = incoming.pathname;
    target.search = incoming.search;

    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.delete("host");
    upstreamHeaders.delete("cf-connecting-ip");
    upstreamHeaders.delete("cf-ipcountry");
    upstreamHeaders.delete("cf-ray");

    const upstreamRequest = new Request(target.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual"
    });

    try {
      const response = await fetch(upstreamRequest);
      const responseHeaders = new Headers(response.headers);
      for (const [key, value] of headers) responseHeaders.set(key, value);
      responseHeaders.set("Cache-Control", "no-store");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Proxy failed", detail: String(error) }), {
        status: 502,
        headers: new Headers({
          "Content-Type": "application/json; charset=utf-8",
          ...Object.fromEntries(headers)
        })
      });
    }
  }
};
