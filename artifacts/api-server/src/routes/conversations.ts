import { Router } from "express";
import { db, usersTable, conversationsTable, conversationParticipantsTable, messagesTable, messageReactionsTable, typingIndicatorsTable } from "@workspace/db";
import { eq, and, ne, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { toPublicUser } from "../lib/userHelpers";
import { CreateConversationBody, SetTypingBody } from "@workspace/api-zod";
import { isBlockedEitherWay } from "./moderation";

const router = Router();

async function buildConversation(convId: number, myUserId: number) {
  const participants = await db.select({ user: usersTable }).from(conversationParticipantsTable).innerJoin(usersTable, eq(conversationParticipantsTable.userId, usersTable.id)).where(eq(conversationParticipantsTable.conversationId, convId));
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
  const [myPart] = await db.select().from(conversationParticipantsTable).where(and(eq(conversationParticipantsTable.conversationId, convId), eq(conversationParticipantsTable.userId, myUserId))).limit(1);
  const lastMessages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, convId)).orderBy(desc(messagesTable.createdAt)).limit(1);
  let lastMessage = null;
  if (lastMessages.length > 0) {
    const msg = lastMessages[0]; const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, msg.senderId)).limit(1); const reactions = await getMessageReactions(msg.id);
    lastMessage = { id: msg.id, conversationId: msg.conversationId, senderId: msg.senderId, sender: sender ? toPublicUser(sender) : null, content: msg.content, editedAt: msg.editedAt?.toISOString() ?? null, createdAt: msg.createdAt.toISOString(), reactions };
  }
  return { id: conv.id, participants: participants.map((p) => toPublicUser(p.user)), lastMessage, unreadCount: myPart?.unreadCount ?? 0, createdAt: conv.createdAt.toISOString(), updatedAt: conv.updatedAt.toISOString() };
}

async function getMessageReactions(messageId: number) {
  const rows = await db.select().from(messageReactionsTable).where(eq(messageReactionsTable.messageId, messageId));
  const map = new Map<string, number[]>(); for (const row of rows) { if (!map.has(row.emoji)) map.set(row.emoji, []); map.get(row.emoji)!.push(row.userId); }
  return Array.from(map.entries()).map(([emoji, userIds]) => ({ emoji, count: userIds.length, userIds }));
}

router.get("/conversations", requireAuth, async (req, res) => {
  const me = req.session.userId!; const myConvs = await db.select({ conversationId: conversationParticipantsTable.conversationId }).from(conversationParticipantsTable).where(eq(conversationParticipantsTable.userId, me));
  const result = await Promise.all(myConvs.map((c) => buildConversation(c.conversationId, me))); result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()); res.json(result);
});

router.post("/conversations", requireAuth, async (req, res) => {
  const parsed = CreateConversationBody.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const me = req.session.userId!; const { participantId } = parsed.data;
  if (participantId === me) return res.status(400).json({ error: "You cannot start a conversation with yourself" });
  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, participantId)).limit(1);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (await isBlockedEitherWay(me, participantId)) return res.status(403).json({ error: "You cannot message this user because one of you has blocked the other." });
  const existing = await db.execute(sql`SELECT cp1.conversation_id FROM conversation_participants cp1 INNER JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id WHERE cp1.user_id = ${me} AND cp2.user_id = ${participantId} LIMIT 1`);
  if (existing.rows.length > 0) return res.json(await buildConversation((existing.rows[0] as any).conversation_id as number, me));
  const [conv] = await db.insert(conversationsTable).values({}).returning();
  await db.insert(conversationParticipantsTable).values([{ conversationId: conv.id, userId: me }, { conversationId: conv.id, userId: participantId }]);
  res.status(201).json(await buildConversation(conv.id, me));
});

router.get("/conversations/:conversationId", requireAuth, async (req, res) => {
  const convId = parseInt(String(req.params["conversationId"] ?? "")); if (isNaN(convId)) return res.status(400).json({ error: "Invalid conversation ID" });
  const me = req.session.userId!; const [part] = await db.select().from(conversationParticipantsTable).where(and(eq(conversationParticipantsTable.conversationId, convId), eq(conversationParticipantsTable.userId, me))).limit(1);
  if (!part) return res.status(404).json({ error: "Conversation not found" });
  const participants = await db.select({ user: usersTable }).from(conversationParticipantsTable).innerJoin(usersTable, eq(conversationParticipantsTable.userId, usersTable.id)).where(eq(conversationParticipantsTable.conversationId, convId));
  const other = participants.find(p => p.user.id !== me)?.user;
  if (other && await isBlockedEitherWay(me, other.id)) return res.status(403).json({ error: "This conversation is unavailable because one of you has blocked the other." });
  res.json(await buildConversation(convId, me));
});

router.post("/conversations/:conversationId/read", requireAuth, async (req, res) => {
  const convId = parseInt(String(req.params["conversationId"] ?? "")); const me = req.session.userId!;
  await db.update(conversationParticipantsTable).set({ unreadCount: 0, lastReadAt: new Date() }).where(and(eq(conversationParticipantsTable.conversationId, convId), eq(conversationParticipantsTable.userId, me))); res.json({ ok: true });
});

router.post("/conversations/:conversationId/typing", requireAuth, async (req, res) => {
  const convId = parseInt(String(req.params["conversationId"] ?? "")); const me = req.session.userId!; const parsed = SetTypingBody.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  if (parsed.data.isTyping) await db.execute(sql`INSERT INTO typing_indicators (conversation_id, user_id, updated_at) VALUES (${convId}, ${me}, NOW()) ON CONFLICT (conversation_id, user_id) DO UPDATE SET updated_at = NOW()`); else await db.delete(typingIndicatorsTable).where(and(eq(typingIndicatorsTable.conversationId, convId), eq(typingIndicatorsTable.userId, me))); res.json({ ok: true });
});

router.get("/conversations/:conversationId/typing-status", requireAuth, async (req, res) => {
  const convId = parseInt(String(req.params["conversationId"] ?? "")); const me = req.session.userId!;
  await db.execute(sql`DELETE FROM typing_indicators WHERE updated_at < NOW() - INTERVAL '5 seconds'`);
  const typing = await db.select({ user: usersTable }).from(typingIndicatorsTable).innerJoin(usersTable, eq(typingIndicatorsTable.userId, usersTable.id)).where(and(eq(typingIndicatorsTable.conversationId, convId), ne(typingIndicatorsTable.userId, me)));
  res.json(typing.map((t) => ({ userId: t.user.id, username: t.user.username, displayName: t.user.displayName })));
});

export { buildConversation, getMessageReactions };
export default router;
