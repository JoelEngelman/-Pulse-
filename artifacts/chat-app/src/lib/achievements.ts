export type Achievement = {
  id: string;
  icon: string;
  name: string;
  description: string;
  badge: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: "sleep-walker", icon: "☾", name: "Sleep Walker", description: "Be online late at night", badge: "🌙" },
  { id: "first-pulse", icon: "ϟ", name: "First Pulse", description: "Send your first message", badge: "⚡" },
  { id: "conversation-starter", icon: "✉", name: "Conversation Starter", description: "Send 10 messages", badge: "💬" },
  { id: "profile-artist", icon: "🎨", name: "Profile Artist", description: "Customize your profile", badge: "🎨" },
  { id: "connected", icon: "📞", name: "Connected", description: "Complete your first call", badge: "📞" },
  { id: "daily-pulse", icon: "☀", name: "Daily Pulse", description: "Open Pulse 3 days in a row", badge: "☀️" },
  { id: "night-owl", icon: "★", name: "Night Owl", description: "Stay online past midnight for 7 nights", badge: "⭐" },
];

const key = (username: string, suffix: string) => `pulse-achievements:${username}:${suffix}`;

export function getAchievementState(username: string) {
  const unlocked = JSON.parse(localStorage.getItem(key(username, "unlocked")) || "[]") as string[];
  return { unlocked };
}

export function getUnlockedBadges(username: string) {
  const state = getAchievementState(username);
  return ACHIEVEMENTS.filter(a => state.unlocked.includes(a.id));
}

export function awardAchievement(username: string, id: string) {
  const achievement = ACHIEVEMENTS.find(a => a.id === id);
  if (!achievement) return false;
  const state = getAchievementState(username);
  if (state.unlocked.includes(id)) return false;
  state.unlocked.push(id);
  localStorage.setItem(key(username, "unlocked"), JSON.stringify(state.unlocked));
  window.dispatchEvent(new CustomEvent("pulse-achievement", { detail: achievement }));
  return true;
}

export function recordMessage(username: string) {
  const countKey = key(username, "messages");
  const count = Number(localStorage.getItem(countKey) || "0") + 1;
  localStorage.setItem(countKey, String(count));
  if (count === 1) awardAchievement(username, "first-pulse");
  if (count === 10) awardAchievement(username, "conversation-starter");
}

export function recordProfileCustomization(username: string) {
  awardAchievement(username, "profile-artist");
}

export function recordCall(username: string) {
  awardAchievement(username, "connected");
}

export function recordDailyPulse(username: string) {
  const today = new Date().toISOString().slice(0, 10);
  const last = localStorage.getItem(key(username, "last-day"));
  if (last === today) return;
  const previousCount = Number(localStorage.getItem(key(username, "day-count")) || "0");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const wasYesterday = last === yesterday.toISOString().slice(0, 10);
  const count = wasYesterday ? previousCount + 1 : 1;
  localStorage.setItem(key(username, "last-day"), today);
  localStorage.setItem(key(username, "day-count"), String(count));
  if (count >= 3) awardAchievement(username, "daily-pulse");
}

export function recordNightActivity(username: string) {
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 5) awardAchievement(username, "sleep-walker");
  const today = new Date().toISOString().slice(0, 10);
  const nightKey = key(username, "nights");
  const nights = JSON.parse(localStorage.getItem(nightKey) || "[]") as string[];
  if ((hour >= 0 && hour < 5) && !nights.includes(today)) {
    nights.push(today);
    localStorage.setItem(nightKey, JSON.stringify(nights.slice(-7)));
    if (nights.length >= 7) awardAchievement(username, "night-owl");
  }
}
