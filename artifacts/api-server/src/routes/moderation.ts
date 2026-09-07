import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// The public help form intentionally does not require a Pulse or GitHub login.
// Keep a small in-memory rate limit so the endpoint cannot be trivially spammed.
const publicReportHits = new Map<string, { count: number; resetAt: number }>();

function cleanUsername(value: unknown) {
  return String(value ?? "").trim().replace(/^@/, "").slice(0, 50);
}

function rateLimitPublicReport(req: any) {
  const key = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
  const now = Date.now();
  const current = publicReportHits.get(key);
  if (!current || current.resetAt <= now) {
    publicReportHits.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (current.count >= 10) return false;
  current.count++;
  return true;
}

router.post("/moderation/block/:username", requireAuth, async (req, res) => {
  const username = cleanUsername(req.params["username"]);
  const me = req.session.userId!;
  if (!username) return res.status(400).json({ error: "Username is required" });

  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === me) return res.status(400).json({ error: "You cannot block yourself" });

  await db.execute(sql`
    INSERT INTO pulse_blocks (blocker_id, blocked_id)
    VALUES (${me}, ${target.id})
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING
  `);
  res.json({ ok: true, blocked: true, username: target.id });
});

router.delete("/moderation/block/:username", requireAuth, async (req, res) => {
  const username = cleanUsername(req.params["username"]);
  const me = req.session.userId!;
  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!target) return res.status(404).json({ error: "User not found" });

  await db.execute(sql`DELETE FROM pulse_blocks WHERE blocker_id = ${me} AND blocked_id = ${target.id}`);
  res.json({ ok: true, blocked: false });
});

router.get("/moderation/blocked", requireAuth, async (req, res) => {
  const me = req.session.userId!;
  const rows = await db.execute(sql`
    SELECT u.id, u.username, u.display_name AS "displayName", u.avatar_url AS "avatarUrl"
    FROM pulse_blocks b
    INNER JOIN users u ON u.id = b.blocked_id
    WHERE b.blocker_id = ${me}
    ORDER BY u.username
  `);
  res.json(rows.rows);
});

async function createReport(req: any, res: any, isPublic: boolean) {
  if (isPublic && !rateLimitPublicReport(req)) {
    res.status(429).json({ error: "Too many reports. Please try again later." });
    return;
  }

  const body = req.body || {};
  const reportedUsername = cleanUsername(body.reportedUsername || body.username);
  const reporterUsername = cleanUsername(body.reporterUsername);
  const reason = String(body.reason || "Other").trim().slice(0, 100);
  const description = String(body.description || "").trim().slice(0, 4000);
  const messageId = body.messageId ? Number(body.messageId) : null;

  if (!reportedUsername || !description) {
    res.status(400).json({ error: "reportedUsername and description are required" });
    return;
  }

  const [reported] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, reportedUsername)).limit(1);
  if (!reported) {
    res.status(404).json({ error: "Reported user not found" });
    return;
  }

  const reporterId = !isPublic ? req.session.userId! : null;
  const safeReporterUsername = reporterUsername || (reporterId ? null : "anonymous");

  await db.execute(sql`
    INSERT INTO pulse_reports
      (reporter_id, reporter_username, reported_id, reported_username, reason, description, message_id, source, status)
    VALUES
      (${reporterId}, ${safeReporterUsername}, ${reported.id}, ${reported.username}, ${reason}, ${description}, ${Number.isFinite(messageId) ? messageId : null}, ${isPublic ? "help" : "pulse"}, 'pending')
  `);

  res.status(201).json({ ok: true, message: "Report submitted successfully" });
}

router.post("/moderation/reports", requireAuth, (req, res) => createReport(req, res, false));
router.post("/moderation/public-reports", (req, res) => createReport(req, res, true));

router.get("/moderation/reports", requireAuth, async (req, res) => {
  const me = req.session.userId!;
  const [admin] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, me)).limit(1);
  if (!admin || admin.username.toLowerCase() !== "joelengelman") return res.status(403).json({ error: "Admin access required" });

  const status = String(req.query["status"] || "").trim();
  const rows = status
    ? await db.execute(sql`SELECT * FROM pulse_reports WHERE status = ${status} ORDER BY created_at DESC LIMIT 200`)
    : await db.execute(sql`SELECT * FROM pulse_reports ORDER BY created_at DESC LIMIT 200`);
  res.json(rows.rows);
});

router.patch("/moderation/reports/:id", requireAuth, async (req, res) => {
  const me = req.session.userId!;
  const [admin] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, me)).limit(1);
  if (!admin || admin.username.toLowerCase() !== "joelengelman") return res.status(403).json({ error: "Admin access required" });

  const id = Number(req.params["id"]);
  const status = String(req.body?.status || "").trim();
  if (!Number.isInteger(id) || !["pending", "reviewing", "resolved", "dismissed"].includes(status)) {
    return res.status(400).json({ error: "Invalid report status" });
  }
  await db.execute(sql`UPDATE pulse_reports SET status = ${status}, reviewed_at = NOW() WHERE id = ${id}`);
  res.json({ ok: true });
});

export async function isBlockedEitherWay(a: number, b: number) {
  const rows = await db.execute(sql`
    SELECT 1 FROM pulse_blocks
    WHERE (blocker_id = ${a} AND blocked_id = ${b})
       OR (blocker_id = ${b} AND blocked_id = ${a})
    LIMIT 1
  `);
  return rows.rows.length > 0;
}

export default router;
