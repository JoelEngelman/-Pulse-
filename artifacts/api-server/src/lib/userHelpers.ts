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

export function toPublicUser(user: typeof usersTable.$inferSelect): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    isOnline: user.isOnline,
    lastSeen: user.lastSeen.toISOString(),
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getUserById(id: number): Promise<PublicUser | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return user ? toPublicUser(user) : null;
}
