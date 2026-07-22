import { useListConversations, Conversation, useGetMe, getListConversationsQueryKey } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

export function ConversationsList({ activeId }: { activeId?: number }) {
  const { data: currentUser } = useGetMe();
  const { data: conversations, isLoading } = useListConversations({
    query: {
      refetchInterval: 3000,
      queryKey: getListConversationsQueryKey()
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col p-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
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

  if (!conversations?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground">
        <p className="mb-4">No conversations yet.</p>
        <Link href="/users" className="text-primary hover:underline font-medium">
          Find someone to chat with
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full overflow-y-auto overflow-x-hidden p-2 gap-1 custom-scrollbar">
      {conversations.map((conv: Conversation) => {
        const otherUser = conv.participants.find((p) => p.id !== currentUser?.id) || conv.participants[0];
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
              <Avatar className="w-12 h-12 border-2 border-transparent">
                <AvatarImage src={otherUser?.avatarUrl || ""} alt={otherUser?.displayName} />
                <AvatarFallback>{getInitials(otherUser?.displayName || "?")}</AvatarFallback>
              </Avatar>
              {otherUser?.isOnline && (
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card" />
              )}
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex justify-between items-baseline mb-1">
                <span className={`font-semibold truncate ${hasUnread ? "text-foreground" : ""}`}>
                  {otherUser?.displayName}
                </span>
                {conv.lastMessage && (
                  <span className="text-xs flex-shrink-0 ml-2 opacity-70">
                    {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: false }).replace('about ', '')}
                  </span>
                )}
              </div>
              
              <div className="flex justify-between items-center gap-2">
                <span className={`text-sm truncate ${hasUnread ? "font-medium text-foreground" : "opacity-80"}`}>
                  {conv.lastMessage?.content || "No messages yet"}
                </span>
                {hasUnread && (
                  <div className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                    {conv.unreadCount}
                  </div>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
