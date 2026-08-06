import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type PublicUser = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
};

// A user is considered online if they heartbeated within the last 90 seconds.
// The client sends a heartbeat every 30 s, so 3 missed beats = offline.
const ONLINE_THRESHOLD_MS = 90_000;

export function toPublicUser(user: typeof usersTable.$inferSelect): PublicUser {
  const isOnline =
    user.lastSeen != null &&
    Date.now() - new Date(user.lastSeen).getTime() < ONLINE_THRESHOLD_MS;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    isOnline,
    lastSeen: user.lastSeen.toISOString(),
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getUserById(id: number): Promise<PublicUser | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return user ? toPublicUser(user) : null;
}
