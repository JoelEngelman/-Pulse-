# Deploy the Pulse API proxy

The proxy Worker is in `api-proxy-worker/`.

## Cloudflare Workers settings

When connecting this repository to Cloudflare Workers Builds, use:

- **Root directory:** `api-proxy-worker`
- **Build command:** leave empty
- **Deploy command:** `npx wrangler@latest deploy`

Do not use the repository root as the Worker root. The repository root is the main Pulse pnpm workspace, so Cloudflare would otherwise run `pnpm install --frozen-lockfile` for all workspace projects.

## Worker files

- `wrangler.toml` is the only Wrangler config used for this proxy.
- `src/index.js` is the proxy entry point.

The proxy forwards every Pulse API path to the current direct API deployment and preserves request/response cookies for session authentication.

The current upstream is the deploy-specific API URL:
`https://94cbf40d-pulse-api.joeldavidengelman.workers.dev`

The frontend should use the deployed `pulse-api-proxy` Worker URL as its API base instead of calling the direct API URL.
