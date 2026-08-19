import { Link, useLocation } from "wouter";
import { MessageSquare, Users, Search, User as UserIcon, LogOut, Zap, Sun, Moon, Home as HomeIcon, Sparkles, Trophy, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useLogout, useHeartbeat } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ACHIEVEMENTS, getAchievementState, recordDailyPulse, recordNightActivity } from "@/lib/achievements";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const heartbeat = useHeartbeat();
  const [showAchievements, setShowAchievements] = useState(false);
  const [achievementState, setAchievementState] = useState({ unlocked: [] as string[] });
  const refreshAchievements = () => { if (user) setAchievementState(getAchievementState(user.username)); };
  useEffect(() => { if (!user) return; refreshAchievements(); recordDailyPulse(user.username); recordNightActivity(user.username); refreshAchievements(); }, [user?.username]);
  useEffect(() => { const handler = () => refreshAchievements(); window.addEventListener("pulse-achievement", handler); return () => window.removeEventListener("pulse-achievement", handler); }, [user?.username]);
  useEffect(() => { if (!user) return; const interval = setInterval(() => heartbeat.mutate(undefined), 30000); return () => clearInterval(interval); }, [user]);
  const handleLogout = () => logout.mutate(undefined, { onSuccess: () => { queryClient.clear(); setLocation("/login"); } });
  const navItems = [
    { href: "/feed", icon: HomeIcon, label: "Home" },
    { href: "/social", icon: Sparkles, label: "Pulse Social" },
    { href: "/conversations", icon: MessageSquare, label: "Chat" },
    { href: "/users", icon: Users, label: "Directory" },
    { href: "/search", icon: Search, label: "Search" },
    { href: "/profile", icon: UserIcon, label: "Profile" },
  ];
  return <div className="flex h-[100dvh] w-full bg-background overflow-hidden text-foreground">
    <nav className="w-[72px] lg:w-64 border-r border-border bg-card flex flex-col justify-between py-5 px-3 lg:px-4 flex-shrink-0 z-10">
      <div className="flex flex-col gap-8"><Link href="/feed" className="group outline-none flex items-center justify-center lg:justify-start gap-3 cursor-pointer" title="Pulse"><div className="flex-shrink-0 flex items-center justify-center w-11 h-11 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary/20 transition-colors"><Zap className="w-6 h-6 fill-primary" /></div><span className="font-bold text-xl tracking-tight hidden lg:block text-foreground">Pulse</span></Link>
        <div className="flex flex-col gap-1.5">{navItems.map(item => { const isActive=location.startsWith(item.href); return <Link key={item.href} href={item.href} className={`flex items-center justify-center lg:justify-start gap-3.5 p-3 rounded-xl transition-all outline-none cursor-pointer ${isActive?"bg-primary text-primary-foreground shadow-[0_0_15px_rgba(0,200,200,0.15)]":"text-muted-foreground hover:bg-secondary hover:text-foreground"}`} title={item.label}><item.icon className="w-[22px] h-[22px] flex-shrink-0"/><span className="font-medium hidden lg:block">{item.label}</span></Link>; })}</div>
        <button onClick={() => { refreshAchievements(); setShowAchievements(true); }} className="flex items-center justify-center lg:justify-start gap-3.5 p-3 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors outline-none cursor-pointer" title="Achievements"><Trophy className="w-[22px] h-[22px] flex-shrink-0"/><span className="font-medium hidden lg:block">Achievements</span></button>
      </div>
      <div className="flex flex-col gap-1.5"><button onClick={toggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="flex items-center justify-center lg:justify-start gap-3.5 p-3 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors outline-none cursor-pointer">{theme === "dark"?<Sun className="w-[22px] h-[22px]"/>:<Moon className="w-[22px] h-[22px]"/>}<span className="font-medium hidden lg:block">{theme === "dark"?"Light mode":"Dark mode"}</span></button><button onClick={handleLogout} className="flex items-center justify-center lg:justify-start gap-3.5 p-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors outline-none cursor-pointer"><LogOut className="w-[22px] h-[22px]"/><span className="font-medium hidden lg:block">Log out</span></button>{user&&<div className="hidden lg:flex items-center gap-3 px-1 pt-2 mt-1 border-t border-border"><div className="relative flex-shrink-0"><div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-border">{user.avatarUrl?<img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover"/>:<UserIcon className="w-4 h-4 text-muted-foreground"/>}</div><div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card"/></div><div className="flex flex-col overflow-hidden min-w-0"><span className="text-sm font-medium truncate">{user.displayName}</span><span className="text-xs text-muted-foreground truncate">@{user.username}</span></div></div>}<p className="hidden lg:block text-[10px] text-muted-foreground/40 text-center pt-2 tracking-wide select-none">Made by Joel Engelman</p></div>
    </nav><main className="flex-1 flex overflow-hidden bg-background relative">{children}</main>
    {showAchievements && user && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) setShowAchievements(false); }}><section className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl p-6"><div className="flex items-center justify-between mb-5"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-yellow-400/15 text-yellow-500"><Trophy className="w-6 h-6" /></div><div><h2 className="text-2xl font-bold">Achievements</h2><p className="text-sm text-muted-foreground">Unlock badges that appear next to your display name.</p></div></div><button onClick={() => setShowAchievements(false)} className="p-2 rounded-xl hover:bg-secondary cursor-pointer"><X className="w-5 h-5" /></button></div><div className="space-y-2">{ACHIEVEMENTS.map(a => { const unlocked=achievementState.unlocked.includes(a.id); return <div key={a.id} className={`flex items-center gap-3 p-3 rounded-2xl border border-border ${unlocked?"bg-yellow-400/5":"opacity-45 grayscale"}`}><div className="w-11 h-11 rounded-full bg-yellow-400/15 border border-yellow-400/25 grid place-items-center text-xl shadow-sm">{a.badge}</div><div className="flex-1 min-w-0"><div className="font-semibold">{a.name}{unlocked && <span className="ml-2 text-[10px] uppercase tracking-wide text-green-500">Unlocked</span>}</div><p className="text-xs text-muted-foreground">{a.description}</p></div></div>; })}</div><div className="mt-5 rounded-2xl bg-secondary/50 border border-border p-4 text-center"><p className="text-sm font-semibold">Your unlocked badges appear beside your name in chat.</p><p className="text-xs text-muted-foreground mt-1">Hover a badge to see what it means.</p></div><button onClick={() => setShowAchievements(false)} className="w-full mt-5 h-11 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 cursor-pointer">Done</button></section></div>}
  </div>;
}
