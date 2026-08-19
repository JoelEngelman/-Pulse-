export type Achievement = { id: string; icon: string; name: string; description: string; badge: string };

export const ACHIEVEMENTS: Achievement[] = [
  { id: "creator", icon: "👑", name: "Creator", description: "The creator of Pulse", badge: "👑" },
  { id: "sleep-walker", icon: "☾", name: "Sleep Walker", description: "Be online late at night", badge: "🌙" },
  { id: "first-pulse", icon: "ϟ", name: "First Pulse", description: "Send your first message", badge: "⚡" },
  { id: "conversation-starter", icon: "✉", name: "Conversation Starter", description: "Send 10 messages", badge: "💬" },
  { id: "profile-artist", icon: "🎨", name: "Profile Artist", description: "Customize your profile", badge: "🎨" },
  { id: "daily-pulse", icon: "☀", name: "Daily Pulse", description: "Open Pulse 3 days in a row", badge: "☀️" },
  { id: "night-owl", icon: "★", name: "Night Owl", description: "Stay online past midnight for 7 nights", badge: "⭐" },
  { id: "social-starter", icon: "✦", name: "Social Starter", description: "Make your first Pulse Social post", badge: "✦" },
  { id: "followers-10", icon: "👥", name: "Rising Star", description: "Reach 10 followers on Pulse Social", badge: "👥" },
  { id: "followers-50", icon: "🔥", name: "Popular", description: "Reach 50 followers on Pulse Social", badge: "🔥" },
  { id: "followers-100", icon: "💎", name: "Influencer", description: "Reach 100 followers on Pulse Social", badge: "💎" },
  { id: "followers-500", icon: "👑", name: "Pulse Legend", description: "Reach 500 followers on Pulse Social", badge: "👑" },
  { id: "posts-10", icon: "📝", name: "Content Creator", description: "Make 10 Pulse Social posts", badge: "📝" },
  { id: "likes-100", icon: "❤️", name: "Loved", description: "Receive 100 likes on Pulse Social", badge: "❤️" },
];

const key = (username: string, suffix: string) => `pulse-achievements:${username}:${suffix}`;
const CREATOR_USERNAME = "joeldavidengelman";

export function getAchievementState(username: string) {
  if (username.toLowerCase() === CREATOR_USERNAME) return { unlocked: ACHIEVEMENTS.map(a => a.id) };
  return { unlocked: JSON.parse(localStorage.getItem(key(username, "unlocked")) || "[]") as string[] };
}

export function getUnlockedBadges(username: string) {
  const s = getAchievementState(username);
  return ACHIEVEMENTS.filter(a => s.unlocked.includes(a.id));
}

export function awardAchievement(username: string, id: string) {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return false;
  const s = getAchievementState(username);
  if (s.unlocked.includes(id)) return false;
  s.unlocked.push(id);
  localStorage.setItem(key(username, "unlocked"), JSON.stringify(s.unlocked));
  window.dispatchEvent(new CustomEvent("pulse-achievement", { detail: a }));
  return true;
}

export function recordMessage(username: string) {
  if (username.toLowerCase() === CREATOR_USERNAME) return;
  const k = key(username, "messages"), n = Number(localStorage.getItem(k) || "0") + 1;
  localStorage.setItem(k, String(n));
  if (n === 1) awardAchievement(username, "first-pulse");
  if (n === 10) awardAchievement(username, "conversation-starter");
}

export function recordProfileCustomization(username: string) { if (username.toLowerCase() !== CREATOR_USERNAME) awardAchievement(username, "profile-artist"); }

export function recordSocialPost(username: string) {
  if (username.toLowerCase() === CREATOR_USERNAME) return;
  const k = key(username, "social-posts"), n = Number(localStorage.getItem(k) || "0") + 1;
  localStorage.setItem(k, String(n));
  if (n === 1) awardAchievement(username, "social-starter");
  if (n >= 10) awardAchievement(username, "posts-10");
}

export function recordDailyPulse(username: string) {
  if (username.toLowerCase() === CREATOR_USERNAME) return;
  const today = new Date().toISOString().slice(0, 10), last = localStorage.getItem(key(username, "last-day"));
  if (last === today) return;
  const previous = Number(localStorage.getItem(key(username, "day-count")) || "0"), y = new Date();
  y.setDate(y.getDate() - 1);
  const count = last === y.toISOString().slice(0, 10) ? previous + 1 : 1;
  localStorage.setItem(key(username, "last-day"), today);
  localStorage.setItem(key(username, "day-count"), String(count));
  if (count >= 3) awardAchievement(username, "daily-pulse");
}

export function recordNightActivity(username: string) {
  if (username.toLowerCase() === CREATOR_USERNAME) return;
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 5) awardAchievement(username, "sleep-walker");
  const today = new Date().toISOString().slice(0, 10), k = key(username, "nights"), n = JSON.parse(localStorage.getItem(k) || "[]") as string[];
  if (hour >= 0 && hour < 5 && !n.includes(today)) {
    n.push(today);
    localStorage.setItem(k, JSON.stringify(n.slice(-7)));
    if (n.length >= 7) awardAchievement(username, "night-owl");
  }
}
