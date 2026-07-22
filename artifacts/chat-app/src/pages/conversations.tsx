import { useState } from "react";
import { useLocation } from "wouter";
import { ConversationsList } from "@/components/chat/conversations-list";
import { useListUsers, useCreateConversation, useGetMe, User } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";
import { Search, MessageSquarePlus, Zap } from "lucide-react";

function StartChatPanel() {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const { data: currentUser } = useGetMe();
  const { data: users } = useListUsers(
    { search: search.length >= 1 ? search : undefined },
    { query: { enabled: true } }
  );
  const createConversation = useCreateConversation();

  const startChat = (userId: number) => {
    createConversation.mutate(
      { data: { participantId: userId } },
      { onSuccess: (conv) => setLocation(`/conversations/${conv.id}`) }
    );
  };

  const people = (users ?? []).filter((u: User) => u.id !== currentUser?.id);

  return (
    <div className="flex flex-col h-full max-w-xl mx-auto w-full px-8 py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary/10 text-primary p-2 rounded-xl">
            <Zap className="w-5 h-5 fill-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Start a conversation</h2>
        </div>
        <p className="text-muted-foreground text-sm ml-[52px]">
          Pick someone below to message them instantly.
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or username…"
          className="pl-9 bg-card/50 border-border"
        />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2">
        {people.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">
              {search ? `No one found for "${search}"` : "No other users yet — invite someone to join!"}
            </p>
          </div>
        )}
        {people.map((user: User) => (
          <button
            key={user.id}
            onClick={() => startChat(user.id)}
            disabled={createConversation.isPending}
            className="flex items-center gap-4 w-full px-4 py-3 rounded-xl hover:bg-secondary/50 transition-all text-left group"
          >
            <div className="relative flex-shrink-0">
              <Avatar className="w-12 h-12">
                <AvatarImage src={user.avatarUrl || ""} />
                <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
              </Avatar>
              {user.isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{user.displayName}</p>
              <p className="text-sm text-muted-foreground truncate">
                {user.isOnline ? "🟢 Online" : user.bio || `@${user.username}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <MessageSquarePlus className="w-4 h-4" />
              Message
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Conversations() {
  return (
    <div className="flex w-full h-full">
      {/* Sidebar */}
      <div className="w-full md:w-72 lg:w-80 border-r border-border bg-card/30 flex flex-col flex-shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold">Messages</h2>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationsList />
        </div>
      </div>

      {/* Right panel – desktop only */}
      <div className="hidden md:flex flex-1 bg-background/50 overflow-hidden">
        <StartChatPanel />
      </div>
    </div>
  );
}
