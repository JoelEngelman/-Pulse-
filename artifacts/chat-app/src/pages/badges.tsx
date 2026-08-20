import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ACHIEVEMENTS, getAchievementState } from "@/lib/achievements";

export default function Badges(){
  const { user } = useAuth();
  const [state,setState]=useState({unlocked:[] as string[]});
  useEffect(()=>{if(user?.username)setState(getAchievementState(user.username));},[user?.username]);
  return <div className="w-full h-full overflow-y-auto custom-scrollbar"><div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-12"><div className="flex items-center gap-3 mb-6"><div className="p-3 rounded-2xl bg-yellow-400/15 text-yellow-500"><Trophy className="w-7 h-7"/></div><div><h1 className="text-3xl font-bold">Badges</h1><p className="text-muted-foreground">Every Pulse badge, including badges you have not unlocked yet.</p></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{ACHIEVEMENTS.map(a=>{const unlocked=state.unlocked.includes(a.id);return <article key={a.id} className={`flex items-center gap-4 rounded-2xl border border-border p-4 ${unlocked?"bg-yellow-400/5":"opacity-55"}`}><div className="w-14 h-14 shrink-0 rounded-2xl bg-yellow-400/15 grid place-items-center text-2xl">{a.badge}</div><div className="min-w-0"><div className="font-semibold flex items-center gap-2">{a.name}{unlocked&&<span className="text-[10px] uppercase tracking-wide text-green-500">Unlocked</span>}</div><p className="text-sm text-muted-foreground">{a.description}</p></div></article>})}</div></div></div>;
}
