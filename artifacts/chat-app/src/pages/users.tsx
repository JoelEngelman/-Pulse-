import { useState } from "react";
import { useListUsers, useCreateConversation, User, getListUsersQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Search as SearchIcon, MessageSquare, Loader2, LockKeyhole } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

export default function Users() {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const [errorMessage, setErrorMessage] = useState("");
  const searchParam = search.length >= 2 ? search : undefined;
  const { data: users, isLoading } = useListUsers({ search: searchParam }, { query: { enabled: true, queryKey: getListUsersQueryKey({ search: searchParam }) } });
  const createConversation = useCreateConversation();

  const handleStartChat = (user: User) => {
    setErrorMessage("");
    createConversation.mutate({ data: { participantId: user.id } }, { onSuccess: (conversation) => { if (!conversation?.id) { setErrorMessage("Couldn't open this conversation."); return; } setLocation(`/conversations/${conversation.id}`); }, onError: (error: any) => setErrorMessage(error?.message || "Couldn't start the conversation. Please try again.") });
  };
  const canMessage = (user: User) => !(user as any).messageSearchOnly || search.trim().toLowerCase() === user.username.toLowerCase();

  return <div className="flex flex-col w-full h-full max-w-4xl mx-auto p-4 md:p-8">
    <div className="flex items-center gap-3 mb-8"><div className="bg-primary/10 text-primary p-3 rounded-2xl"><SearchIcon className="w-6 h-6" /></div><div><h1 className="text-3xl font-bold text-foreground tracking-tight">Directory</h1><p className="text-muted-foreground">Find people to chat with on Pulse</p></div></div>
    <div className="relative mb-4 group"><SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 group-focus-within:text-primary transition-colors" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or username..." className="pl-12 h-14 text-lg bg-card/50 border-border hover:border-primary/50 transition-colors rounded-2xl shadow-sm" /></div>
    {errorMessage && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</div>}
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {isLoading ? <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div> : !users?.length ? <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-6"><SearchIcon className="w-8 h-8 opacity-50" /></div><p className="text-lg">No users found matching "{search}"</p></div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{users.map((user: User) => { const locked = Boolean((user as any).messageSearchOnly) && !canMessage(user); return <div key={user.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-2xl hover:border-primary/50 hover:bg-secondary/20 transition-all group"><div className="flex items-center gap-4 min-w-0"><div className="relative flex-shrink-0"><Avatar className="w-14 h-14 border-2 border-transparent group-hover:border-primary/20 transition-colors"><AvatarImage src={user.avatarUrl || ""} alt={user.displayName} /><AvatarFallback className="text-lg">{getInitials(user.displayName)}</AvatarFallback></Avatar><div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-card ${user.isOnline ? 'bg-green-500' : 'bg-muted-foreground'}`} /></div><div className="flex flex-col min-w-0"><span className="font-semibold text-foreground text-lg truncate">{user.displayName}</span><span className="text-sm text-muted-foreground truncate">@{user.username}</span>{user.bio && <span className="text-xs text-muted-foreground mt-1 line-clamp-1 max-w-[200px]">{user.bio}</span>}{(user as any).messageSearchOnly && <span className="text-[11px] text-primary mt-1 flex items-center gap-1"><LockKeyhole className="w-3 h-3"/>Search-only messaging</span>}</div></div><Button onClick={() => handleStartChat(user)} variant="ghost" size="sm" className="cursor-pointer rounded-xl ml-3 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all flex-shrink-0" disabled={createConversation.isPending || locked} aria-label={locked ? `Search @${user.username} to message` : `Message ${user.displayName}`}>{locked ? <LockKeyhole className="w-4 h-4 mr-2" /> : createConversation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-2" />}{locked ? "Search username" : "Message"}</Button></div>; })}</div>}
    </div>
  </div>;
}
