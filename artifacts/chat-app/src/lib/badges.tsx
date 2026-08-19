import React from "react";
import { getAchievementState } from "@/lib/achievements";

export type BadgeUser = {
  id?: string;
  username?: string;
  displayName?: string;
  followerCount?: number;
  followersCount?: number;
  followers?: number;
  postCount?: number;
  postsCount?: number;
  likeCount?: number;
  likesReceived?: number;
};

export type PulseBadge = {
  id: string;
  icon: string;
  name: string;
  description: string;
  className: string;
};

export const SOCIAL_BADGES: PulseBadge[] = [
  { id: "social-starter", icon: "✦", name: "Social Starter", description: "Made your first Pulse Social post", className: "bg-cyan-400/15 text-cyan-400 border-cyan-400/25" },
  { id: "10-followers", icon: "👥", name: "10 Followers", description: "Reach 10 followers", className: "bg-blue-400/15 text-blue-400 border-blue-400/25" },
  { id: "50-followers", icon: "🔥", name: "50 Followers", description: "Reach 50 followers", className: "bg-orange-400/15 text-orange-400 border-orange-400/25" },
  { id: "100-followers", icon: "💎", name: "100 Followers", description: "Reach 100 followers", className: "bg-violet-400/15 text-violet-400 border-violet-400/25" },
  { id: "500-followers", icon: "👑", name: "500 Followers", description: "Reach 500 followers", className: "bg-yellow-400/15 text-yellow-400 border-yellow-400/25" },
  { id: "10-posts", icon: "📝", name: "10 Posts", description: "Make 10 Pulse Social posts", className: "bg-emerald-400/15 text-emerald-400 border-emerald-400/25" },
  { id: "100-likes", icon: "❤️", name: "100 Likes", description: "Receive 100 likes on your posts", className: "bg-pink-400/15 text-pink-400 border-pink-400/25" },
];

function numberFromUser(user: BadgeUser, ...keys: (keyof BadgeUser)[]) {
  for (const key of keys) {
    const value = user[key];
    if (typeof value === "number") return value;
  }
  return 0;
}

export function getSocialBadges(user: BadgeUser) {
  const followers = numberFromUser(user, "followerCount", "followersCount", "followers");
  const posts = numberFromUser(user, "postCount", "postsCount");
  const likes = numberFromUser(user, "likeCount", "likesReceived");
  const result: PulseBadge[] = [];

  if (user.username && getAchievementState(user.username).unlocked.includes("social-starter")) result.push(SOCIAL_BADGES[0]);
  if (followers >= 10) result.push(SOCIAL_BADGES[1]);
  if (followers >= 50) result.push(SOCIAL_BADGES[2]);
  if (followers >= 100) result.push(SOCIAL_BADGES[3]);
  if (followers >= 500) result.push(SOCIAL_BADGES[4]);
  if (posts >= 10) result.push(SOCIAL_BADGES[5]);
  if (likes >= 100) result.push(SOCIAL_BADGES[6]);

  return result;
}

export function BadgeList({ user, compact = false }: { user: BadgeUser; compact?: boolean }) {
  const badges = getSocialBadges(user);
  if (!badges.length) return null;
  return <span className="inline-flex items-center gap-1 ml-1 align-middle">
    {badges.slice(0, compact ? 2 : badges.length).map(b => <span key={b.id} title={`${b.name} — ${b.description}`} className={`inline-flex items-center justify-center rounded-full border ${b.className} ${compact ? "h-5 min-w-5 px-1 text-[10px]" : "h-6 min-w-6 px-1.5 text-[11px]"}`}>{b.icon}</span>)}
    {compact && badges.length > 2 && <span className="text-[10px] text-muted-foreground">+{badges.length - 2}</span>}
  </span>;
}

export function BadgeCollection({ user }: { user: BadgeUser }) {
  const badges = getSocialBadges(user);
  if (!badges.length) return <p className="text-sm text-muted-foreground">No badges unlocked yet.</p>;
  return <div className="flex flex-wrap gap-2">{badges.map(b => <span key={b.id} title={b.description} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${b.className}`}><span>{b.icon}</span>{b.name}</span>)}</div>;
}
