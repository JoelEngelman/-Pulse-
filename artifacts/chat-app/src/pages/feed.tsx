import { useCallback, useEffect, useState } from "react";
import { Heart, MessageCircle, Repeat2, Send, Loader2, UserPlus, UserCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

const API = "https://pulse-api.joeldavidengelman.workers.dev";

type User = { id: number; username: string; displayName: string; avatarUrl?: string | null; bio?: string | null };
type Comment = { id: string; content: string; createdAt: string; user: User };
type Post = {
  id: string;
  content: string;
  createdAt: string;
  user: User;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  following: boolean;
  comments?: Comment[];
};

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
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [mode, setMode] = useState<"for-you" | "following">("for-you");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPosts(await api(`/api/feed?mode=${mode}`));
    } catch (e: any) {
      setError(e?.message || "Couldn't load the feed.");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const createPost = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || posting) return;
    setPosting(true);
    setError("");
    try {
      const post = await api("/api/posts", { method: "POST", body: JSON.stringify({ content }) });
      setPosts((current) => [post, ...current]);
      setDraft("");
    } catch (e: any) {
      setError(e?.message || "Couldn't create the post.");
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (post: Post) => {
    try {
      const updated = await api(`/api/posts/${post.id}/like`, { method: post.liked ? "DELETE" : "POST" });
      setPosts((current) => current.map((p) => p.id === post.id ? { ...p, ...updated } : p));
    } catch (e: any) { setError(e?.message || "Couldn't update the like."); }
  };

  const toggleFollow = async (post: Post) => {
    try {
      const updated = await api(`/api/users/${post.user.id}/follow`, { method: post.following ? "DELETE" : "POST" });
      setPosts((current) => current.map((p) => p.user.id === post.user.id ? { ...p, following: updated.following } : p));
    } catch (e: any) { setError(e?.message || "Couldn't update the follow."); }
  };

  const toggleComments = async (post: Post) => {
    if (post.comments) {
      setPosts((current) => current.map((p) => p.id === post.id ? { ...p, comments: undefined } : p));
      return;
    }
    try {
      const comments = await api(`/api/posts/${post.id}/comments`);
      setPosts((current) => current.map((p) => p.id === post.id ? { ...p, comments } : p));
    } catch (e: any) { setError(e?.message || "Couldn't load comments."); }
  };

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pulse</h1>
            <p className="text-muted-foreground text-sm mt-1">See what's happening.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={loadFeed} className="cursor-pointer" title="Refresh feed"><RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} /></Button>
        </div>

        <div className="flex gap-2 mb-5 bg-card border border-border rounded-xl p-1">
          <button onClick={() => setMode("for-you")} className={`cursor-pointer flex-1 rounded-lg py-2 text-sm font-semibold transition ${mode === "for-you" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>For You</button>
          <button onClick={() => setMode("following")} className={`cursor-pointer flex-1 rounded-lg py-2 text-sm font-semibold transition ${mode === "following" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>Following</button>
        </div>

        <form onSubmit={createPost} className="bg-card border border-border rounded-2xl p-4 mb-5 shadow-sm">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder="What's happening?" className="min-h-[90px] resize-none border-0 bg-background/40 focus-visible:ring-1" />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">{draft.length}/500</span>
            <Button type="submit" disabled={!draft.trim() || posting} variant="glow" className="cursor-pointer">
              {posting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Post
            </Button>
          </div>
        </form>

        {error && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-primary animate-spin" /></div>
        ) : posts.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
            <p className="font-medium text-foreground">Nothing here yet.</p>
            <p className="text-sm mt-1">Make the first post on Pulse!</p>
          </div>
        ) : posts.map((post) => (
          <article key={post.id} className="bg-card border border-border rounded-2xl p-4 mb-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Avatar className="w-11 h-11 flex-shrink-0"><AvatarImage src={post.user.avatarUrl || ""} /><AvatarFallback>{getInitials(post.user.displayName)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{post.user.displayName}</span>
                  <span className="text-sm text-muted-foreground truncate">@{post.user.username}</span>
                  <span className="text-xs text-muted-foreground">· {timeAgo(post.createdAt)}</span>
                  <button onClick={() => toggleFollow(post)} className="cursor-pointer ml-auto flex items-center gap-1 text-xs font-semibold text-primary hover:underline" title={post.following ? "Unfollow" : "Follow"}>
                    {post.following ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    {post.following ? "Following" : "Follow"}
                  </button>
                </div>
                <p className="whitespace-pre-wrap break-words mt-3 text-[15px] leading-6">{post.content}</p>

                <div className="flex items-center gap-5 mt-4 pt-3 border-t border-border">
                  <button onClick={() => toggleLike(post)} className={`cursor-pointer flex items-center gap-1.5 text-sm transition ${post.liked ? "text-pink-500" : "text-muted-foreground hover:text-pink-500"}`}>
                    <Heart className={`w-4 h-4 ${post.liked ? "fill-current" : ""}`} /> {post.likeCount}
                  </button>
                  <button onClick={() => toggleComments(post)} className="cursor-pointer flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition">
                    <MessageCircle className="w-4 h-4" /> {post.commentCount}
                  </button>
                  <button className="cursor-pointer flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition"><Repeat2 className="w-4 h-4" /> Repost</button>
                </div>

                {post.comments && <Comments post={post} onCountChange={(count) => setPosts((current) => current.map((p) => p.id === post.id ? { ...p, commentCount: count } : p))} />}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Comments({ post, onCountChange }: { post: Post; onCountChange: (count: number) => void }) {
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<Comment[]>(post.comments || []);
  const [sending, setSending] = useState(false);

  const sendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const comment = await api(`/api/posts/${post.id}/comments`, { method: "POST", body: JSON.stringify({ content }) });
      const next = [...comments, comment];
      setComments(next);
      setDraft("");
      onCountChange(next.length);
    } finally { setSending(false); }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-2">
          <Avatar className="w-7 h-7"><AvatarImage src={comment.user.avatarUrl || ""} /><AvatarFallback>{getInitials(comment.user.displayName)}</AvatarFallback></Avatar>
          <div className="rounded-xl bg-secondary/60 px-3 py-2 min-w-0">
            <p className="text-xs font-semibold">{comment.user.displayName} <span className="font-normal text-muted-foreground">@{comment.user.username}</span></p>
            <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{comment.content}</p>
          </div>
        </div>
      ))}
      <form onSubmit={sendComment} className="flex gap-2">
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={300} placeholder="Write a comment..." className="min-h-[42px] h-[42px] resize-none" />
        <Button type="submit" size="icon" disabled={!draft.trim() || sending} className="cursor-pointer shrink-0"><Send className="w-4 h-4" /></Button>
      </form>
    </div>
  );
}
