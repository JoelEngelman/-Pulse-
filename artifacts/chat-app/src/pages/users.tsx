import { useState } from "react";
import { useListUsers, useCreateConversation, User, getListUsersQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Search as SearchIcon, MessageSquare, Loader2, LockKeyhole } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { ModerationMenu } from "@/components/moderation-menu";

export default function Users() {
  const [search, setSearch] = useState(""); const [, setLocation] = useLocation(); const [errorMessage, setErrorMessage] = useState("");
  const searchParam = search.length >= 2 ? search : undefined;
  const { data: users, isLoading } = useListUsers({ search: searchParam }, { query: { enabled: true, queryKey: getListUsersQueryKey({ search: searchParam }) } });
  const createConversation = useCreateConversation();
  const handleStartChat = (user: User) => { setErrorMessage(""); createConversation.mutate({ data: { participantId: user.id } }, { onSuccess: conversation => { if (!conversation?.id) return setErrorMessage("Couldn't open this conversation."); setLocation(`/conversations/${conversation.id}`); }, onError: (error: any) => setErrorMessage(error?.message || "Couldn't start the conversation. Please try again.") }); };
  const canMessage = (user: User) => !(user as any).messageSearchOnly || search.trim().toLowerCase() === user.username.toLowerCase();
  return <div className="flex flex-col w-full h-full max-w-4xl mx-auto p-4 md:p-8">
    <div className="flex items-center gap-3 mb-8"><div className="bg-primary/10 text-primary p-3 rounded-2xl"><SearchIcon className="w-6 h-6" /></div><div><h1 className="text-3xl font-bold text-foreground tracking-tight">Directory</h1><p className="text-muted-foreground">Find people to chat with on Pulse</p></div></div>
    <div className="relative mb-4 group"><SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or username..." className="pl-12 h-14 text-lg bg-card/50 border-border rounded-2xl shadow-sm" /></div>
    {errorMessage && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</div>}
    <div className="flex-1 overflow-y-auto custom-scrollbar">{isLoading ? <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div> : !users?.length ? <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><SearchIcon className="w-8 h-8 opacity-50 mb-4" /><p className="text-lg">No users found matching "{search}"</p></div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{users.map((user: User) => { const locked = Boolean((user as any).messageSearchOnly) && !canMessage(user); return <div key={user.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-2xl hover:border-primary/50 transition-all"><div className="flex items-center gap-4 min-w-0"><Avatar className="w-14 h-14"><AvatarImage src={user.avatarUrl || ""} alt={user.displayName} /><AvatarFallback>{getInitials(user.displayName)}</AvatarFallback></Avatar><div className="flex flex-col min-w-0"><span className="font-semibold text-foreground text-lg truncate">{user.displayName}</span><span className="text-sm text-muted-foreground truncate">@{user.username}</span>{user.bio && <span className="text-xs text-muted-foreground mt-1 line-clamp-1">{user.bio}</span>}</div></div><div className="flex items-center gap-1 ml-3"><ModerationMenu username={user.username} /><Button onClick={() => handleStartChat(user)} variant="ghost" size="sm" className="cursor-pointer rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground" disabled={createConversation.isPending || locked}>{locked ? <LockKeyhole className="w-4 h-4 mr-2" /> : createConversation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-2" />}{locked ? "Search username" : "Message"}</Button></div></div>; })}</div>}</div>
  </div>;
}
