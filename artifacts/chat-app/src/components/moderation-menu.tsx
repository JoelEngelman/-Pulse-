import { useState } from "react";
import { Ban, Flag, MoreVertical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const API = "https://pulse-api-proxy.joeldavidengelman.workers.dev";

type Props = { username: string; messageId?: number; onChanged?: () => void };

export function ModerationMenu({ username, messageId, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const block = async () => {
    if (!confirm(`Block @${username}? They will no longer be able to message you.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/moderation/block/${encodeURIComponent(username)}`, { method: "POST", credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't block this user.");
      alert(`@${username} has been blocked.`);
      setOpen(false); onChanged?.();
    } catch (e: any) { alert(e?.message || "Couldn't block this user."); }
    finally { setBusy(false); }
  };

  const report = async () => {
    const reason = prompt("Why are you reporting this?\n\nExamples: harassment, spam, inappropriate content, threats, impersonation", "Harassment");
    if (!reason) return;
    const description = prompt("Tell Pulse what happened. Please include useful details.");
    if (!description?.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/moderation/reports`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportedUsername: username, reason, description, messageId }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't submit the report.");
      alert("Thanks. Your report has been sent to Pulse moderation.");
      setOpen(false);
    } catch (e: any) { alert(e?.message || "Couldn't submit the report."); }
    finally { setBusy(false); }
  };

  return <div className="relative">
    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setOpen(v => !v)} disabled={busy} aria-label={`Moderate @${username}`}>
      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <MoreVertical className="w-5 h-5" />}
    </Button>
    {open && <>
      <button aria-label="Close moderation menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
      <div className="absolute right-0 top-full mt-2 z-50 min-w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl">
        <button className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-secondary cursor-pointer" onClick={report}><Flag className="w-4 h-4" /> Report {messageId ? "message" : "user"}</button>
        <button className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10 cursor-pointer" onClick={block}><Ban className="w-4 h-4" /> Block @{username}</button>
      </div>
    </>}
  </div>;
}
