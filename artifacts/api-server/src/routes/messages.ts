import { Router } from "express";
import { db, usersTable, conversationsTable, conversationParticipantsTable, messagesTable, messageReactionsTable } from "@workspace/db";
import { eq, and, lt, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { toPublicUser } from "../lib/userHelpers";
import { getMessageReactions, buildConversation } from "./conversations";
import { SendMessageBody, EditMessageBody, AddReactionBody } from "@workspace/api-zod";
import { isBlockedEitherWay } from "./moderation";

const router = Router();

async function buildMessage(msgId: number) {
  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId)).limit(1); if (!msg) return null;
  const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, msg.senderId)).limit(1); const reactions = await getMessageReactions(msg.id);
  return { id: msg.id, conversationId: msg.conversationId, senderId: msg.senderId, sender: sender ? toPublicUser(sender) : null, content: msg.content, editedAt: msg.editedAt?.toISOString() ?? null, createdAt: msg.createdAt.toISOString(), reactions };
}

async function checkParticipant(convId: number, userId: number): Promise<{ ok: boolean; blocked: boolean }> {
  const parts = await db.select({ userId: conversationParticipantsTable.userId }).from(conversationParticipantsTable).where(eq(conversationParticipantsTable.conversationId, convId));
  if (!parts.some(p => p.userId === userId)) return { ok: false, blocked: false };
  const other = parts.find(p => p.userId !== userId);
  return { ok: true, blocked: !!other && await isBlockedEitherWay(userId, other.userId) };
}

router.get("/conversations/:conversationId/messages", requireAuth, async (req, res) => {
  const convId = parseInt(String(req.params["conversationId"] ?? "")); const me = req.session.userId!; const access = await checkParticipant(convId, me);
  if (isNaN(convId) || !access.ok) return res.status(404).json({ error: "Conversation not found" });
  if (access.blocked) return res.status(403).json({ error: "Messages are unavailable because one of you has blocked the other." });
  const limit = Math.min(parseInt((req.query["limit"] as string) ?? "50"), 100); const before = req.query["before"] ? parseInt(req.query["before"] as string) : undefined;
  const query = db.select().from(messagesTable).where(before ? and(eq(messagesTable.conversationId, convId), lt(messagesTable.id, before)) : eq(messagesTable.conversationId, convId)).$dynamic();
  const msgs = await query.orderBy(desc(messagesTable.createdAt)).limit(limit); const result = await Promise.all(msgs.map(m => buildMessage(m.id))); res.json(result.reverse());
});

router.post("/conversations/:conversationId/messages", requireAuth, async (req, res) => {
  const convId = parseInt(String(req.params["conversationId"] ?? "")); const me = req.session.userId!; const access = await checkParticipant(convId, me);
  if (isNaN(convId) || !access.ok) return res.status(404).json({ error: "Conversation not found" });
  if (access.blocked) return res.status(403).json({ error: "Message not sent. One of you has blocked the other." });
  const parsed = SendMessageBody.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const [msg] = await db.insert(messagesTable).values({ conversationId: convId, senderId: me, content: parsed.data.content }).returning();
  await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, convId));
  await db.execute(sql`UPDATE conversation_participants SET unread_count = unread_count + 1 WHERE conversation_id = ${convId} AND user_id != ${me}`);
  res.status(201).json(await buildMessage(msg.id));
});

router.patch("/conversations/:conversationId/messages/:messageId", requireAuth, async (req, res) => {
  const convId = parseInt(String(req.params["conversationId"] ?? "")); const msgId = parseInt(String(req.params["messageId"] ?? "")); const me = req.session.userId!;
  const access = await checkParticipant(convId, me); if (isNaN(convId) || isNaN(msgId) || !access.ok) return res.status(404).json({ error: "Conversation not found" }); if (access.blocked) return res.status(403).json({ error: "Conversation is blocked" });
  const parsed = EditMessageBody.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const [existing] = await db.select().from(messagesTable).where(and(eq(messagesTable.id, msgId), eq(messagesTable.conversationId, convId))).limit(1); if (!existing || existing.senderId !== me) return res.status(403).json({ error: "Forbidden" });
  await db.update(messagesTable).set({ content: parsed.data.content, editedAt: new Date() }).where(eq(messagesTable.id, msgId)); res.json(await buildMessage(msgId));
});

router.delete("/conversations/:conversationId/messages/:messageId", requireAuth, async (req, res) => {
  const convId = parseInt(String(req.params["conversationId"] ?? "")); const msgId = parseInt(String(req.params["messageId"] ?? "")); const me = req.session.userId!;
  const [existing] = await db.select().from(messagesTable).where(and(eq(messagesTable.id, msgId), eq(messagesTable.conversationId, convId))).limit(1); if (!existing || existing.senderId !== me) return res.status(403).json({ error: "Forbidden" });
  await db.delete(messagesTable).where(eq(messagesTable.id, msgId)); res.json({ ok: true });
});

router.post("/conversations/:conversationId/messages/:messageId/reactions", requireAuth, async (req, res) => {
  const msgId = parseInt(String(req.params["messageId"] ?? "")); const me = req.session.userId!; const parsed = AddReactionBody.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  await db.execute(sql`INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (${msgId}, ${me}, ${parsed.data.emoji}) ON CONFLICT (message_id, user_id, emoji) DO NOTHING`); res.json(await buildMessage(msgId));
});

router.delete("/conversations/:conversationId/messages/:messageId/reactions/:emoji", requireAuth, async (req, res) => {
  const msgId = parseInt(String(req.params["messageId"] ?? "")); const emoji = decodeURIComponent(String(req.params["emoji"] ?? "")); const me = req.session.userId!;
  await db.delete(messageReactionsTable).where(and(eq(messageReactionsTable.messageId, msgId), eq(messageReactionsTable.userId, me), eq(messageReactionsTable.emoji, emoji))); res.json(await buildMessage(msgId));
});

router.get("/messages/search", requireAuth, async (req, res) => {
  const q = (req.query["q"] as string)?.trim(); const me = req.session.userId!; if (!q) return res.json([]);
  const rows = await db.execute(sql`SELECT m.id as message_id, m.conversation_id FROM messages m INNER JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id WHERE cp.user_id = ${me} AND m.content ILIKE ${'%' + q + '%'} ORDER BY m.created_at DESC LIMIT 20`);
  const results = await Promise.all((rows.rows as any[]).map(async row => ({ message: await buildMessage(row.message_id), conversationId: row.conversation_id }))); res.json(results.filter(r => r.message !== null));
});

export default router;
