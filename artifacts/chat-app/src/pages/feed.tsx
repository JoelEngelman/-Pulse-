import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, MessageCircle, Repeat2, Send, Loader2, UserPlus, UserCheck, RefreshCw, ImagePlus, Music2, X, SlidersHorizontal, Search, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

const API = "https://pulse-api-proxy.joeldavidengelman.workers.dev";

type User = { id: number; username: string; displayName: string; avatarUrl?: string | null; bio?: string | null };
type Comment = { id: string; content: string; createdAt: string; user: User };
type Media = { image?: string; filter?: string; music?: { title: string; artist: string; previewUrl: string; artwork?: string } };
type Post = { id: string; content: string; createdAt: string; user: User; likeCount: number; commentCount: number; liked: boolean; following: boolean; comments?: Comment[]; media?: Media };
type Track = { trackName: string; artistName: string; previewUrl?: string; artworkUrl100?: string };

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, { ...options, credentials: "include", headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function timeAgo(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function encodeMedia(media: Media) {
  if (!media.image && !media.music && !media.filter) return "";
  return `\n\n[PULSE_MEDIA:${btoa(unescape(encodeURIComponent(JSON.stringify(media))))}]`;
}

function decodePost(raw: Post): Post {
  const match = raw.content.match(/\n\n\[PULSE_MEDIA:([^\]]+)\]$/);
  if (!match) return raw;
  try {
    const media = JSON.parse(decodeURIComponent(escape(atob(match[1]))));
    return { ...raw, content: raw.content.slice(0, match.index).trimEnd(), media };
  } catch { return raw; }
}

async function fileToImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  const bitmap = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't prepare that image.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

const filters = [
  ["Normal", "none"], ["Mono", "grayscale(1)"], ["Warm", "sepia(.35) saturate(1.25)"], ["Cool", "saturate(.8) hue-rotate(25deg)"], ["Fade", "contrast(.88) brightness(1.08) saturate(.72)"], ["Vivid", "contrast(1.15) saturate(1.35)"],
] as const;

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [mode, setMode] = useState<"for-you" | "following">("for-you");
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<string>();
  const [filter, setFilter] = useState("Normal");
  const [music, setMusic] = useState<Media["music"]>();
  const [showMusic, setShowMusic] = useState(false);
  const [musicQuery, setMusicQuery] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [audio] = useState(() => new Audio());
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const loadFeed = useCallback(async () => {
    setLoading(true); setError("");
    try { setPosts((await api(`/api/feed?mode=${mode}`)).map(decodePost)); }
    catch (e: any) { setError(e?.message || "Couldn't load the feed."); }
    finally { setLoading(false); }
  }, [mode]);
  useEffect(() => { loadFeed(); }, [loadFeed]);
  useEffect(() => () => { audio.pause(); }, [audio]);

  const searchMusic = async () => {
    if (!musicQuery.trim()) return;
    setMusicLoading(true);
    try {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(musicQuery)}&media=music&entity=song&limit=12`);
      const data = await response.json();
      setTracks((data.results || []).filter((t: Track) => t.previewUrl));
    } catch { setError("Couldn't search the music library."); }
    finally { setMusicLoading(false); }
  };

  const chooseMusic = (track: Track) => {
    if (!track.previewUrl) return;
    setMusic({ title: track.trackName, artist: track.artistName, previewUrl: track.previewUrl, artwork: track.artworkUrl100 });
    setShowMusic(false); setPlaying(null); audio.pause();
  };

  const previewTrack = (track: Track) => {
    if (!track.previewUrl) return;
    if (playing === track.previewUrl) { audio.pause(); setPlaying(null); return; }
    audio.src = track.previewUrl; audio.play().catch(() => {}); setPlaying(track.previewUrl);
    audio.onended = () => setPlaying(null);
  };

  const createPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!draft.trim() && !image && !music) || posting) return;
    setPosting(true); setError("");
    try {
      const content = `${draft.trim()}${encodeMedia({ image, filter: image ? filter : undefined, music })}`.trim();
      const post = decodePost(await api("/api/posts", { method: "POST", body: JSON.stringify({ content }) }));
      setPosts((current) => [post, ...current]);
      setDraft(""); setImage(undefined); setMusic(undefined); setFilter("Normal");
    } catch (e: any) { setError(e?.message || "Couldn't create the post."); }
    finally { setPosting(false); }
  };

  const toggleLike = async (post: Post) => { try { const updated = await api(`/api/posts/${post.id}/like`, { method: post.liked ? "DELETE" : "POST" }); setPosts((c) => c.map((p) => p.id === post.id ? { ...p, ...updated } : p)); } catch (e: any) { setError(e?.message || "Couldn't update the like."); } };
  const toggleFollow = async (post: Post) => { try { const updated = await api(`/api/users/${post.user.id}/follow`, { method: post.following ? "DELETE" : "POST" }); setPosts((c) => c.map((p) => p.user.id === post.user.id ? { ...p, following: updated.following } : p)); } catch (e: any) { setError(e?.message || "Couldn't update the follow."); } };
  const toggleComments = async (post: Post) => {
    if (post.comments) { setPosts((c) => c.map((p) => p.id === post.id ? { ...p, comments: undefined } : p)); return; }
    try { const comments = await api(`/api/posts/${post.id}/comments`); setPosts((c) => c.map((p) => p.id === post.id ? { ...p, comments } : p)); } catch (e: any) { setError(e?.message || "Couldn't load comments."); }
  };

  const selectedFilter = useMemo(() => filters.find(([name]) => name === filter)?.[1] || "none", [filter]);

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
        <div className="flex items-center justify-between mb-6"><div><h1 className="text-3xl font-bold tracking-tight">Pulse</h1><p className="text-muted-foreground text-sm mt-1">See what's happening.</p></div><Button variant="ghost" size="icon" onClick={loadFeed} className="cursor-pointer" title="Refresh feed"><RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} /></Button></div>
        <div className="flex gap-2 mb-5 bg-card border border-border rounded-xl p-1"><button onClick={() => setMode("for-you")} className={`cursor-pointer flex-1 rounded-lg py-2 text-sm font-semibold ${mode === "for-you" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>For You</button><button onClick={() => setMode("following")} className={`cursor-pointer flex-1 rounded-lg py-2 text-sm font-semibold ${mode === "following" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>Following</button></div>

        <form onSubmit={createPost} className="bg-card border border-border rounded-2xl p-4 mb-5 shadow-sm">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder="What's happening?" className="min-h-[90px] resize-none border-0 bg-background/40 focus-visible:ring-1" />
          {image && <div className="relative mt-3 rounded-xl overflow-hidden border border-border"><img src={image} alt="Post preview" className="w-full max-h-[420px] object-cover" style={{ filter: selectedFilter }} /><button type="button" onClick={() => setImage(undefined)} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 cursor-pointer"><X className="w-4 h-4" /></button></div>}
          {music && <div className="mt-3 flex items-center gap-3 rounded-xl bg-secondary/70 p-3"><img src={music.artwork || ""} className="w-12 h-12 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{music.title}</p><p className="text-xs text-muted-foreground truncate">{music.artist} · 30 sec preview</p></div><button type="button" onClick={() => setMusic(undefined)} className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button></div>}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"><ImagePlus className="w-4 h-4" /> Photo<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { setImage(await fileToImage(file)); } catch (err: any) { setError(err.message); } e.currentTarget.value = ""; }} /></label>
            <button type="button" onClick={() => setShowMusic((v) => !v)} className="cursor-pointer inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"><Music2 className="w-4 h-4" /> Music</button>
            {image && <div className="relative"><button type="button" onClick={() => document.getElementById("pulse-filters")?.classList.toggle("hidden")} className="cursor-pointer inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"><SlidersHorizontal className="w-4 h-4" /> Filter</button><div id="pulse-filters" className="hidden absolute z-20 bottom-full left-0 mb-2 bg-card border border-border rounded-xl p-2 shadow-xl min-w-[220px]"><div className="grid grid-cols-3 gap-2">{filters.map(([name, value]) => <button type="button" key={name} onClick={() => setFilter(name)} className={`cursor-pointer rounded-lg p-1.5 text-xs ${filter === name ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}><div className="h-12 rounded-md bg-secondary mb-1" style={{ filter: value }} />{name}</button>)}</div></div></div>}
            <span className="text-xs text-muted-foreground ml-auto">{draft.length}/500</span>
            <Button type="submit" disabled={(!draft.trim() && !image && !music) || posting} variant="glow" className="cursor-pointer">{posting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Post</Button>
          </div>

          {showMusic && <div className="mt-3 border border-border rounded-xl p-3 bg-background/60"><div className="flex gap-2"><Input value={musicQuery} onChange={(e) => setMusicQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchMusic(); } }} placeholder="Search songs or artists..." /><Button type="button" size="icon" onClick={searchMusic} disabled={musicLoading} className="cursor-pointer">{musicLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}</Button></div><p className="text-[11px] text-muted-foreground mt-2">Music search uses Apple's iTunes music catalogue. Pulse stores only the selected track's preview information.</p><div className="mt-2 max-h-64 overflow-y-auto">{tracks.map((track) => <div key={`${track.trackName}-${track.artistName}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary"><img src={track.artworkUrl100 || ""} className="w-10 h-10 rounded-md" /><div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{track.trackName}</p><p className="text-xs text-muted-foreground truncate">{track.artistName}</p></div><button type="button" onClick={() => previewTrack(track)} className="cursor-pointer p-2 rounded-full hover:bg-background" title="Preview">{playing === track.previewUrl ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button><button type="button" onClick={() => chooseMusic(track)} className="cursor-pointer text-xs font-semibold text-primary px-2">Add</button></div>)}</div></div>}
        </form>

        {error && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
        {loading ? <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-primary animate-spin" /></div> : posts.length === 0 ? <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground"><p className="font-medium text-foreground">Nothing here yet.</p><p className="text-sm mt-1">Make the first post on Pulse!</p></div> : posts.map((post) => <article key={post.id} className="bg-card border border-border rounded-2xl p-4 mb-4 shadow-sm"><div className="flex items-start gap-3"><Avatar className="w-11 h-11 flex-shrink-0"><AvatarImage src={post.user.avatarUrl || ""} /><AvatarFallback>{getInitials(post.user.displayName)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-semibold truncate">{post.user.displayName}</span><span className="text-sm text-muted-foreground truncate">@{post.user.username}</span><span className="text-xs text-muted-foreground">· {timeAgo(post.createdAt)}</span><button onClick={() => toggleFollow(post)} className="cursor-pointer ml-auto flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{post.following ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}{post.following ? "Following" : "Follow"}</button></div>{post.content && <p className="whitespace-pre-wrap break-words mt-3 text-[15px] leading-6">{post.content}</p>}{post.media?.image && <img src={post.media.image} alt="" className="w-full max-h-[520px] object-cover rounded-xl mt-3" style={{ filter: filters.find(([n]) => n === post.media?.filter)?.[1] || "none" }} />}{post.media?.music && <div className="mt-3 flex items-center gap-3 rounded-xl bg-secondary/70 p-3"><img src={post.media.music.artwork || ""} className="w-12 h-12 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{post.media.music.title}</p><p className="text-xs text-muted-foreground truncate">{post.media.music.artist}</p></div><audio controls preload="none" src={post.media.music.previewUrl} className="w-36" /></div>}<div className="flex items-center gap-5 mt-4 pt-3 border-t border-border"><button onClick={() => toggleLike(post)} className={`cursor-pointer flex items-center gap-1.5 text-sm ${post.liked ? "text-pink-500" : "text-muted-foreground hover:text-pink-500"}`}><Heart className={`w-4 h-4 ${post.liked ? "fill-current" : ""}`} /> {post.likeCount}</button><button onClick={() => toggleComments(post)} className="cursor-pointer flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"><MessageCircle className="w-4 h-4" /> {post.commentCount}</button><button className="cursor-pointer flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"><Repeat2 className="w-4 h-4" /> Repost</button></div>{post.comments && <Comments post={post} onCountChange={(count) => setPosts((c) => c.map((p) => p.id === post.id ? { ...p, commentCount: count } : p))} />}</div></div></article>)}
      </div>
    </div>
  );
}

function Comments({ post, onCountChange }: { post: Post; onCountChange: (count: number) => void }) {
  const [draft, setDraft] = useState(""); const [comments, setComments] = useState<Comment[]>(post.comments || []); const [sending, setSending] = useState(false);
  const sendComment = async (e: React.FormEvent) => { e.preventDefault(); const content = draft.trim(); if (!content || sending) return; setSending(true); try { const comment = await api(`/api/posts/${post.id}/comments`, { method: "POST", body: JSON.stringify({ content }) }); const next = [...comments, comment]; setComments(next); setDraft(""); onCountChange(next.length); } catch {} finally { setSending(false); } };
  return <div className="mt-3 pt-3 border-t border-border space-y-3">{comments.map((comment) => <div key={comment.id} className="flex gap-2"><Avatar className="w-7 h-7"><AvatarImage src={comment.user.avatarUrl || ""} /><AvatarFallback>{getInitials(comment.user.displayName)}</AvatarFallback></Avatar><div className="rounded-xl bg-secondary/60 px-3 py-2 min-w-0"><p className="text-xs font-semibold">{comment.user.displayName} <span className="font-normal text-muted-foreground">@{comment.user.username}</span></p><p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{comment.content}</p></div></div>)}<form onSubmit={sendComment} className="flex gap-2"><Textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={300} placeholder="Write a comment..." className="min-h-[42px] h-[42px] resize-none" /><Button type="submit" size="icon" disabled={!draft.trim() || sending} className="cursor-pointer shrink-0"><Send className="w-4 h-4" /></Button></form></div>;
}
