import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ilike, ne, or } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { toPublicUser } from "../lib/userHelpers";
import { UpdateMeBody } from "@workspace/api-zod";

const router = Router();

router.get("/users", requireAuth, async (req, res) => {
  const search = req.query["search"] as string | undefined;
  const me = req.session.userId!;

  let users;
  if (search && search.trim()) {
    users = await db
      .select()
      .from(usersTable)
      .where(
        or(
          ilike(usersTable.username, `%${search}%`),
          ilike(usersTable.displayName, `%${search}%`),
        ),
      )
      .limit(20);
  } else {
    users = await db.select().from(usersTable).where(ne(usersTable.id, me)).limit(30);
  }

  res.json(users.map(toPublicUser));
});

router.get("/users/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(toPublicUser(user));
});

router.patch("/users/me", requireAuth, async (req, res) => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const updates: Record<string, string> = {};
  if (parsed.data.displayName) updates["displayName"] = parsed.data.displayName;
  if (parsed.data.bio !== undefined) updates["bio"] = parsed.data.bio ?? "";
  if (parsed.data.avatarUrl !== undefined) updates["avatarUrl"] = parsed.data.avatarUrl ?? "";

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.session.userId!)).returning();
  res.json(toPublicUser(user));
});

router.post("/users/me/heartbeat", requireAuth, async (req, res) => {
  await db.update(usersTable).set({ isOnline: true, lastSeen: new Date() }).where(eq(usersTable.id, req.session.userId!));
  res.json({ ok: true });
});

router.get("/users/:userId", requireAuth, async (req, res) => {
  const userId = parseInt(String(req.params["userId"] ?? ""));
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(toPublicUser(user));
});

export default router;
