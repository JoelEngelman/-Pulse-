# Deploy the Pulse API proxy

The proxy Worker is in `api-proxy-worker/`.

Cloudflare Workers deployment:

1. Create a Worker named `pulse-api-proxy`.
2. Upload/deploy `api-proxy-worker/src/index.ts` with `api-proxy-worker/wrangler.jsonc`.
3. Confirm the Worker responds to `/`.
4. Change Pulse's browser API base URL from the direct `94cbf40d-pulse-api...workers.dev` host to the proxy Worker URL.

The proxy forwards all Pulse API paths to the existing API deployment and preserves cookies for session authentication.
