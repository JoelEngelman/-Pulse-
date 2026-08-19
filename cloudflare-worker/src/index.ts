export interface Env {
  DB: D1Database;
  CORS_ORIGIN?: string;
}

const SESSION_COOKIE = "pulse_session";
const SESSION_DAYS = 30;

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

function json(data: unknown, status = 200, request?: Request, env?: Env, extra?: HeadersInit) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(extra || {}),
  });
  if (request && env) {
    for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, value);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function error(message: string, status: number, request: Request, env: Env) {
  return json({ error: message }, status, request, env);
}

function parseBody(request: Request): Promise<any> {
  return request.json().catch(() => ({}));
}

function id(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
}

function publicUser(row: any, online = false) {
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name || row.username,
    avatarUrl: row.avatar_url ?? null,
    bio: row.bio ?? null,
    isOnline: online,
    lastSeen: row.updated_at || row.created_at,
    createdAt: row.created_at,
  };
}

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function sessionCookie(value: string, maxAge = SESSION_DAYS * 86400): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=None`;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey("raw", data, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createPasswordHash(password: string): Promise<string> {
  const salt = crypto.randomUUID();
  return `${salt}:${await hashPassword(password, salt)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":", 2);
  if (!salt || !hash) return false;
  const actual = await hashPassword(password, salt);
  return actual === hash;
}

async function currentUser(request: Request, env: Env): Promise<any | null> {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const session = await env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ? LIMIT 1`,
  ).bind(token, new Date().toISOString()).first<any>();
  return session || null;
}

async function requireUser(request: Request, env: Env): Promise<any | null> {
  return currentUser(request, env);
}

async function ensureExtraTables(env: Env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS message_reactions (
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id, emoji)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS typing_indicators (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (conversation_id, user_id)
    )`),
  ]);
}

async function reactions(env: Env, messageId: string) {
  const rows = await env.DB.prepare(
    `SELECT emoji, user_id FROM message_reactions WHERE message_id = ? ORDER BY emoji`,
  ).bind(messageId).all<any>();
  const map = new Map<string, number[]>();
  for (const row of rows.results) {
    if (!map.has(row.emoji)) map.set(row.emoji, []);
    map.get(row.emoji)!.push(Number(row.user_id));
  }
  return Array.from(map, ([emoji, userIds]) => ({ emoji, count: userIds.length, userIds }));
}

async function messageObject(env: Env, row: any) {
  const sender = await env.DB.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).bind(row.sender_id).first<any>();
  return {
    id: Number(row.id),
    conversationId: Number(row.conversation_id),
    senderId: Number(row.sender_id),
    sender: sender ? publicUser(sender) : null,
    content: row.body,
    editedAt: null,
    createdAt: row.created_at,
    reactions: await reactions(env, row.id),
  };
}

async function conversationObject(env: Env, conversationId: string, me: string) {
  const participants = await env.DB.prepare(`
    SELECT u.* FROM conversation_members cm JOIN users u ON u.id = cm.user_id
    WHERE cm.conversation_id = ?
  `).bind(conversationId).all<any>();
  const last = await env.DB.prepare(`
    SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1
  `).bind(conversationId).first<any>();
  const unread = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ? AND sender_id != ?
  `).bind(conversationId, me).first<any>();
  const conv = await env.DB.prepare(`SELECT * FROM conversations WHERE id = ?`).bind(conversationId).first<any>();
  return {
    id: Number(conversationId),
    participants: participants.results.map((u: any) => publicUser(u)),
    lastMessage: last ? await messageObject(env, last) : null,
    unreadCount: Number(unread?.count || 0),
    createdAt: conv?.created_at,
    updatedAt: conv?.updated_at,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      await ensureExtraTables(env);
      const url = new URL(request.url);
      const path = url.pathname.replace(/\\/+$/, "") || "/";

      if (path === "/api/health" && request.method === "GET") return json({ ok: true }, 200, request, env);

      if (path === "/api/auth/register" && request.method === "POST") {
        const body = await parseBody(request);
        const username = String(body.username || "").trim();
        const displayName = String(body.displayName || username).trim();
        const password = String(body.password || "");
        if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) return error("Username must be 3-32 characters using letters, numbers, or underscores", 400, request, env);
        if (password.length < 6) return error("Password must be at least 6 characters", 400, request, env);
        const exists = await env.DB.prepare(`SELECT id FROM users WHERE lower(username) = lower(?) LIMIT 1`).bind(username).first();
        if (exists) return error("Username already exists", 409, request, env);
        const userId = id();
        const now = new Date().toISOString();
        const passwordHash = await createPasswordHash(password);
        await env.DB.prepare(`INSERT INTO users (id, username, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(userId, username, displayName, passwordHash, now, now).run();
        const sessionId = crypto.randomUUID();
        const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
        await env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).bind(sessionId, userId, expires).run();
        const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first<any>();
        return json(publicUser(user, true), 201, request, env, { "Set-Cookie": sessionCookie(sessionId) });
      }

      if (path === "/api/auth/login" && request.method === "POST") {
        const body = await parseBody(request);
        const username = String(body.username || "").trim();
        const password = String(body.password || "");
        const user = await env.DB.prepare(`SELECT * FROM users WHERE lower(username) = lower(?) LIMIT 1`).bind(username).first<any>();
        if (!user || !(await verifyPassword(password, user.password_hash))) return error("Invalid credentials", 401, request, env);
        const sessionId = crypto.randomUUID();
        const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
        await env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).bind(sessionId, user.id, expires).run();
        return json(publicUser(user, true), 200, request, env, { "Set-Cookie": sessionCookie(sessionId) });
      }

      if (path === "/api/auth/logout" && request.method === "POST") {
        const token = getCookie(request, SESSION_COOKIE);
        if (token) await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(token).run();
        return json({ ok: true }, 200, request, env, { "Set-Cookie": sessionCookie("", 0) });
      }

      if (path === "/api/auth/me" && request.method === "GET") {
        const user = await requireUser(request, env);
        if (!user) return error("Not authenticated", 401, request, env);
        return json(publicUser(user, true), 200, request, env);
      }

      const me = await requireUser(request, env);
      if (!me) return error("Not authenticated", 401, request, env);

      if (path === "/api/users" && request.method === "GET") {
        const search = (url.searchParams.get("search") || "").trim();
        const rows = search
          ? await env.DB.prepare(`SELECT * FROM users WHERE id != ? AND (lower(username) LIKE lower(?) OR lower(display_name) LIKE lower(?)) ORDER BY username LIMIT 20`).bind(me.id, `%${search}%`, `%${search}%`).all<any>()
          : await env.DB.prepare(`SELECT * FROM users WHERE id != ? ORDER BY username LIMIT 30`).bind(me.id).all<any>();
        return json(rows.results.map((u: any) => publicUser(u)), 200, request, env);
      }

      if (path === "/api/users/me" && request.method === "GET") return json(publicUser(me, true), 200, request, env);

      if (path === "/api/users/me" && request.method === "PATCH") {
        const body = await parseBody(request);
        const displayName = body.displayName !== undefined ? String(body.displayName).trim() : me.display_name;
        const bio = body.bio !== undefined ? String(body.bio).trim().slice(0, 200) : (me.bio ?? null);
        const avatarUrl = body.avatarUrl !== undefined ? String(body.avatarUrl) : me.avatar_url;
        await env.DB.prepare(`UPDATE users SET display_name = ?, avatar_url = ?, bio = ?, updated_at = ? WHERE id = ?`).bind(displayName, avatarUrl, bio, new Date().toISOString(), me.id).run();
        const updated = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(me.id).first<any>();
        return json(publicUser(updated, true), 200, request, env);
      }

      if (path === "/api/users/me/heartbeat" && request.method === "POST") return json({ ok: true }, 200, request, env);

      if (path === "/api/conversations" && request.method === "GET") {
        const rows = await env.DB.prepare(`SELECT conversation_id FROM conversation_members WHERE user_id = ?`).bind(me.id).all<any>();
        const result = await Promise.all(rows.results.map((r: any) => conversationObject(env, r.conversation_id, me.id)));
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return json(result, 200, request, env);
      }

      if (path === "/api/conversations" && request.method === "POST") {
        const body = await parseBody(request);
        const participantId = String(body.participantId || "");
        const participant = await env.DB.prepare(`SELECT id FROM users WHERE id = ?`).bind(participantId).first();
        if (!participant || participantId === String(me.id)) return error("Invalid participant", 400, request, env);
        const existing = await env.DB.prepare(`SELECT a.conversation_id FROM conversation_members a JOIN conversation_members b ON a.conversation_id = b.conversation_id WHERE a.user_id = ? AND b.user_id = ? LIMIT 1`).bind(me.id, participantId).first<any>();
        let convId = existing?.conversation_id;
        if (!convId) {
          convId = id();
          const now = new Date().toISOString();
          await env.DB.batch([
            env.DB.prepare(`INSERT INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)`).bind(convId, now, now),
            env.DB.prepare(`INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)`).bind(convId, me.id, convId, participantId),
          ]);
        }
        return json(await conversationObject(env, convId, me.id), 201, request, env);
      }

      const convMatch = path.match(/^\\/api\\/conversations\\/([^/]+)$/);
      if (convMatch && request.method === "GET") {
        const convId = convMatch[1];
        const member = await env.DB.prepare(`SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?`).bind(convId, me.id).first();
        if (!member) return error("Conversation not found", 404, request, env);
        return json(await conversationObject(env, convId, me.id), 200, request, env);
      }

      const readMatch = path.match(/^\\/api\\/conversations\\/([^/]+)\\/read$/);
      if (readMatch && request.method === "POST") return json({ ok: true }, 200, request, env);

      const typingMatch = path.match(/^\\/api\\/conversations\\/([^/]+)\\/typing$/);
      if (typingMatch && request.method === "POST") {
        const body = await parseBody(request);
        const convId = typingMatch[1];
        const isTyping = !!body.isTyping;
        if (isTyping) await env.DB.prepare(`INSERT INTO typing_indicators (conversation_id, user_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(conversation_id,user_id) DO UPDATE SET updated_at=excluded.updated_at`).bind(convId, me.id, new Date().toISOString()).run();
        else await env.DB.prepare(`DELETE FROM typing_indicators WHERE conversation_id = ? AND user_id = ?`).bind(convId, me.id).run();
        return json({ ok: true }, 200, request, env);
      }

      const typingStatusMatch = path.match(/^\\/api\\/conversations\\/([^/]+)\\/typing-status$/);
      if (typingStatusMatch && request.method === "GET") {
        const rows = await env.DB.prepare(`SELECT u.* FROM typing_indicators t JOIN users u ON u.id=t.user_id WHERE t.conversation_id=? AND t.user_id != ? AND t.updated_at > ?`).bind(typingStatusMatch[1], me.id, new Date(Date.now() - 5000).toISOString()).all<any>();
        return json(rows.results.map((u: any) => ({ userId: Number(u.id), username: u.username, displayName: u.display_name })), 200, request, env);
      }

      const messagesMatch = path.match(/^\\/api\\/conversations\\/([^/]+)\\/messages$/);
      if (messagesMatch) {
        const convId = messagesMatch[1];
        const member = await env.DB.prepare(`SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?`).bind(convId, me.id).first();
        if (!member) return error("Conversation not found", 404, request, env);
        if (request.method === "GET") {
          const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);
          const before = url.searchParams.get("before");
          const rows = before
            ? await env.DB.prepare(`SELECT * FROM messages WHERE conversation_id = ? AND CAST(id AS INTEGER) < CAST(? AS INTEGER) ORDER BY created_at DESC LIMIT ?`).bind(convId, before, limit).all<any>()
            : await env.DB.prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?`).bind(convId, limit).all<any>();
          const result = await Promise.all(rows.results.reverse().map((r: any) => messageObject(env, r)));
          return json(result, 200, request, env);
        }
        if (request.method === "POST") {
          const body = await parseBody(request);
          const content = String(body.content || "").trim();
          if (!content) return error("Message cannot be empty", 400, request, env);
          const messageId = id();
          const now = new Date().toISOString();
          await env.DB.batch([
            env.DB.prepare(`INSERT INTO messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)`).bind(messageId, convId, me.id, content, now),
            env.DB.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).bind(now, convId),
          ]);
          const message = await env.DB.prepare(`SELECT * FROM messages WHERE id = ?`).bind(messageId).first<any>();
          return json(await messageObject(env, message), 201, request, env);
        }
      }

      return error("Not found", 404, request, env);
    } catch (err: any) {
      console.error(err);
      return error(err?.message || "Internal server error", 500, request, env);
    }
  },
};
