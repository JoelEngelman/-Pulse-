interface Env {
  DB: D1Database;
  CORS_ORIGIN?: string;
}

import app from "./index";

const SESSION_COOKIE = "pulse_session";

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("Origin");
  const allowed = env.CORS_ORIGIN || "https://joelengelman.github.io";
  return {
    "Access-Control-Allow-Origin": origin === allowed ? origin : allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, X-Requested-With, Accept, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(data: unknown, status: number, request: Request, env: Env, extra?: HeadersInit) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extra,
  });
  for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, value);
  return new Response(JSON.stringify(data), { status, headers });
}

function error(message: string, status: number, request: Request, env: Env) {
  return json({ error: message }, status, request, env);
}

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function currentUser(request: Request, env: Env): Promise<any | null> {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  return env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ? LIMIT 1`
  ).bind(token, new Date().toISOString()).first<any>();
}

async function ensureModerationTables(env: Env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS pulse_blocks (blocker_id TEXT NOT NULL, blocked_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (blocker_id, blocked_id))`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pulse_blocks_blocker ON pulse_blocks(blocker_id)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pulse_blocks_blocked ON pulse_blocks(blocked_id)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS pulse_reports (id TEXT PRIMARY KEY, reporter_id TEXT, reported_user_id TEXT, reported_username TEXT NOT NULL, message_id TEXT, reason TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pulse_reports_status ON pulse_reports(status, created_at)`),
  ]);
}

async function parseBody(request: Request): Promise<any> {
  return request.json().catch(() => ({}));
}

async function moderation(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\\/+$/, "") || "/";
  if (!path.startsWith("/api/moderation")) return null;

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  await ensureModerationTables(env);
  const me = await currentUser(request, env);
  if (!me) return error("Not authenticated", 401, request, env);

  const blockMatch = path.match(/^\/api\/moderation\/block\/([^/]+)$/);
  if (blockMatch && request.method === "POST") {
    const username = decodeURIComponent(blockMatch[1]).trim();
    const target = await env.DB.prepare(`SELECT * FROM users WHERE lower(username) = lower(?) LIMIT 1`).bind(username).first<any>();
    if (!target) return error("User not found", 404, request, env);
    if (String(target.id) === String(me.id)) return error("You can't block yourself", 400, request, env);
    await env.DB.prepare(`INSERT OR IGNORE INTO pulse_blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)`)
      .bind(String(me.id), String(target.id), new Date().toISOString()).run();
    return json({ ok: true, blockedUsername: target.username }, 200, request, env);
  }

  if (blockMatch && request.method === "DELETE") {
    const username = decodeURIComponent(blockMatch[1]).trim();
    const target = await env.DB.prepare(`SELECT id FROM users WHERE lower(username) = lower(?) LIMIT 1`).bind(username).first<any>();
    if (!target) return error("User not found", 404, request, env);
    await env.DB.prepare(`DELETE FROM pulse_blocks WHERE blocker_id = ? AND blocked_id = ?`).bind(String(me.id), String(target.id)).run();
    return json({ ok: true }, 200, request, env);
  }

  if (path === "/api/moderation/blocked" && request.method === "GET") {
    const rows = await env.DB.prepare(`SELECT u.id, u.username, u.display_name, u.avatar_url, b.created_at FROM pulse_blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ? ORDER BY b.created_at DESC`).bind(String(me.id)).all<any>();
    return json(rows.results, 200, request, env);
  }

  if (path === "/api/moderation/reports" && request.method === "POST") {
    const body = await parseBody(request);
    const reportedUsername = String(body.reportedUsername || "").trim();
    const reason = String(body.reason || "").trim().slice(0, 100);
    const description = String(body.description || "").trim().slice(0, 4000);
    if (!reportedUsername || !reason || !description) return error("Report details are required", 400, request, env);
    const target = await env.DB.prepare(`SELECT id, username FROM users WHERE lower(username) = lower(?) LIMIT 1`).bind(reportedUsername).first<any>();
    if (!target) return error("User not found", 404, request, env);
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO pulse_reports (id, reporter_id, reported_user_id, reported_username, message_id, reason, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`)
      .bind(crypto.randomUUID(), String(me.id), String(target.id), target.username, body.messageId == null ? null : String(body.messageId), reason, description, now, now).run();
    return json({ ok: true }, 201, request, env);
  }

  if (path === "/api/moderation/reports" && request.method === "GET") {
    if (String(me.username).toLowerCase() !== "joelengelman") return error("Forbidden", 403, request, env);
    const rows = await env.DB.prepare(`SELECT * FROM pulse_reports ORDER BY created_at DESC LIMIT 200`).all<any>();
    return json(rows.results, 200, request, env);
  }

  const reportMatch = path.match(/^\/api\/moderation\/reports\/([^/]+)$/);
  if (reportMatch && request.method === "PATCH") {
    if (String(me.username).toLowerCase() !== "joelengelman") return error("Forbidden", 403, request, env);
    const body = await parseBody(request);
    const status = ["open", "reviewing", "resolved", "dismissed"].includes(String(body.status)) ? String(body.status) : null;
    if (!status) return error("Invalid report status", 400, request, env);
    await env.DB.prepare(`UPDATE pulse_reports SET status = ?, updated_at = ? WHERE id = ?`).bind(status, new Date().toISOString(), reportMatch[1]).run();
    return json({ ok: true }, 200, request, env);
  }

  return error("Not found", 404, request, env);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const result = await moderation(request, env);
    if (result) return result;
    return app.fetch(request, env, ctx);
  },
};
