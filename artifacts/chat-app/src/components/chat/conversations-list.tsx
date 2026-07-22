import { useState } from "react";
import {
  useListConversations,
  useListUsers,
  useCreateConversation,
  useGetMe,
  Conversation,
  User,
  getListConversationsQueryKey,
} from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";
import { Search, MessageSquarePlus, Loader2 } from "lucide-react";

export function ConversationsList({ activeId }: { activeId?: number }) {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const { data: currentUser } = useGetMe();
  const { data: conversations, isLoading } = useListConversations({
    query: { refetchInterval: 3000, queryKey: getListConversationsQueryKey() },
  });
  const { data: users } = useListUsers(
    { search: search.length >= 1 ? search : undefined },
    { query: { enabled: true } }
  );
  const createConversation = useCreateConversation();

  const startChat = (userId: number) => {
    createConversation.mutate(
      { data: { participantId: userId } },
      { onSuccess: (conv) => { setSearch(""); setLocation(`/conversations/${conv.id}`); } }
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col p-4 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-secondary/50" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-secondary/50 rounded w-1/2" />
              <div className="h-3 bg-secondary/50 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const hasConversations = conversations && conversations.length > 0;

  // Filter people already in a conversation when not searching
  const convUserIds = new Set(
    (conversations ?? []).flatMap((c: Conversation) =>
      c.participants.map((p) => p.id)
    )
  );

  // While searching: show all matching users. When not searching: only show if no conversations yet.
  const showUserSearch = search.length >= 1;
  const showUserSuggestions = !hasConversations && !showUserSearch;

  const filteredUsers = (users ?? []).filter(
    (u: User) => u.id !== currentUser?.id
  );

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {/* Search / New chat bar */}
      <div className="p-3 border-b border-border flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people…"
            className="pl-9 h-9 bg-secondary/40 border-transparent focus:border-primary text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Show search results */}
        {showUserSearch && (
          <div className="flex flex-col p-2 gap-1">
            {filteredUsers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No users found</p>
            )}
            {filteredUsers.map((user: User) => (
              <button
                key={user.id}
                onClick={() => startChat(user.id)}
                disabled={createConversation.isPending}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/60 transition-all text-left w-full group"
              >
                <div className="relative flex-shrink-0">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={user.avatarUrl || ""} />
                    <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                  </Avatar>
                  {user.isOnline && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                </div>
                <MessageSquarePlus className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* No conversations yet: show all users as suggestions */}
        {showUserSuggestions && (
          <div className="flex flex-col">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-4 pb-2">
              People on Pulse
            </p>
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 px-4">
                No one else here yet — share the link and invite someone!
              </p>
            ) : (
              filteredUsers.map((user: User) => (
                <button
                  key={user.id}
                  onClick={() => startChat(user.id)}
                  disabled={createConversation.isPending}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-all text-left w-full group"
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="w-11 h-11">
                      <AvatarImage src={user.avatarUrl || ""} />
                      <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                    </Avatar>
                    {user.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.isOnline ? "Online" : user.bio || `@${user.username}`}
                    </p>
                  </div>
                  <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    Message
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Normal conversation list */}
        {!showUserSearch && hasConversations && (
          <div className="flex flex-col p-2 gap-1">
            {(conversations ?? []).map((conv: Conversation) => {
              const otherUser =
                conv.participants.find((p) => p.id !== currentUser?.id) ||
                conv.participants[0];
              const isActive = activeId === conv.id;
              const hasUnread = conv.unreadCount > 0;

              return (
                <Link
                  key={conv.id}
                  href={`/conversations/${conv.id}`}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all outline-none group
                    ${isActive ? "bg-secondary text-foreground" : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={otherUser?.avatarUrl || ""} />
                      <AvatarFallback>{getInitials(otherUser?.displayName || "?")}</AvatarFallback>
                    </Avatar>
                    {otherUser?.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className={`font-semibold text-sm truncate ${hasUnread ? "text-foreground" : ""}`}>
                        {otherUser?.displayName}
                      </span>
                      {conv.lastMessage && (
                        <span className="text-xs flex-shrink-0 ml-2 opacity-60">
                          {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: false }).replace("about ", "")}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className={`text-xs truncate ${hasUnread ? "font-medium text-foreground" : "opacity-70"}`}>
                        {conv.lastMessage?.content || "Start the conversation"}
                      </span>
                      {hasUnread && (
                        <div className="bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 min-w-[18px] text-center">
                          {conv.unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
