import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useGetConversation, useGetMessages, useSendMessage, useMarkRead, useSetTyping, useGetTypingStatus, useGetMe, getGetMeQueryKey, Message, getGetConversationQueryKey, getGetMessagesQueryKey, getGetTypingStatusQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ConversationsList } from "@/components/chat/conversations-list";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, Send, MoreVertical, Loader2, Phone, Video } from "lucide-react";
import { MediaButton } from "@/components/chat/media-picker";
import { getInitials } from "@/lib/utils";
import { recordMessage } from "@/lib/achievements";
import { startPulseCall } from "@/components/calling/call-manager";

const PRESENCE_API = "https://pulse-api-proxy.joeldavidengelman.workers.dev";
function isActuallyOnline(user: any) {
  if (!user) return false;
  const lastSeen = user.lastSeen ? new Date(user.lastSeen).getTime() : 0;
  return !!user.isOnline && (!lastSeen || Date.now() - lastSeen < 45_000);
}

export default function Chat() {
  const [, params] = useRoute("/conversations/:id");
  const conversationId = params?.id || "";
  const hookConversationId = conversationId as any;

  const [content, setContent] = useState("");
  const [sendError, setSendError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: currentUser } = useGetMe({
    query: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      queryKey: getGetMeQueryKey(),
    },
  });

  const { data: conversation, isLoading: isLoadingConv } = useGetConversation(
    hookConversationId,
    {
      query: {
        enabled: !!conversationId,
        queryKey: getGetConversationQueryKey(hookConversationId),
      },
    }
  );

  const { data: messages, isLoading: isLoadingMessages } = useGetMessages(
    hookConversationId,
    undefined,
    {
      query: {
        enabled: !!conversationId,
        refetchInterval: 2000,
        queryKey: getGetMessagesQueryKey(hookConversationId),
      },
    }
  );

  const { data: typingStatus } = useGetTypingStatus(hookConversationId, {
    query: {
      enabled: !!conversationId,
      refetchInterval: 1000,
      queryKey: getGetTypingStatusQueryKey(hookConversationId),
    },
  });

  const sendMessage = useSendMessage();
  const markRead = useMarkRead();
  const setTyping = useSetTyping();

  useEffect(() => {
    let alive = true;
    const beat = () => {
      if (alive)
        fetch(`${PRESENCE_API}/api/users/me/heartbeat`, {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
    };
    beat();
    const timer = window.setInterval(beat, 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (conversationId && conversation?.unreadCount)
      markRead.mutate(
        { conversationId: hookConversationId },
        {
          onSuccess: () =>
            queryClient.invalidateQueries({
              queryKey: ["/api/conversations"],
            }),
        }
      );
  }, [conversationId, conversation?.unreadCount]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!conversationId) return;
    const timeout = setTimeout(
      () =>
        setTyping.mutate({
          conversationId: hookConversationId,
          data: { isTyping: content.length > 0 },
        }),
      300
    );
    return () => clearTimeout(timeout);
  }, [content, conversationId]);

  const awardMessageAchievement = () => {
    if (currentUser?.username) recordMessage(currentUser.username);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || !conversationId || sendMessage.isPending) return;

    setSendError("");
    sendMessage.mutate(
      { conversationId: hookConversationId, data: { content: trimmed } },
      {
        onSuccess: () => {
          setContent("");
          awardMessageAchievement();
          queryClient.invalidateQueries({
            queryKey: getGetMessagesQueryKey(hookConversationId),
          });
          queryClient.invalidateQueries({
            queryKey: ["/api/conversations"],
          });
          setTyping.mutate({
            conversationId: hookConversationId,
            data: { isTyping: false },
          });
        },
        onError: (error: any) =>
          setSendError(
            error?.message || "Couldn't send that message. Please try again."
          ),
      }
    );
  };

  const handleMediaSelect = (mediaContent: string) => {
    setSendError("");
    sendMessage.mutate(
      { conversationId: hookConversationId, data: { content: mediaContent } },
      {
        onSuccess: () => {
          awardMessageAchievement();
          queryClient.invalidateQueries({
            queryKey: getGetMessagesQueryKey(hookConversationId),
          });
          queryClient.invalidateQueries({
            queryKey: ["/api/conversations"],
          });
        },
        onError: (error: any) =>
          setSendError(
            error?.message || "Couldn't send that message. Please try again."
          ),
      }
    );
  };

  const participant = conversation?.participants?.[0];
  const otherUser =
    conversation?.participants?.find((p) => p.id !== currentUser?.id) ||
    participant;
  const isSelfChat =
    !!currentUser &&
    !!otherUser &&
    otherUser.id === currentUser.id;
  const typingUsers = typingStatus?.filter(
    (u) => u.userId !== currentUser?.id
  );
  const isOtherUserTyping = !!typingUsers?.length;
  const online = isActuallyOnline(otherUser);

  return (
    <div className="flex w-full h-full">
      <div className="hidden md:flex w-80 lg:w-96 border-r border-border bg-card/30 flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold">Messages</h2>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationsList activeId={hookConversationId} />
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-background/50 h-full relative">
        <div className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-4 justify-between flex-shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <Link
              href="/conversations"
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            {otherUser ? (
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage
                    src={otherUser?.avatarUrl || ""}
                    alt={otherUser?.displayName}
                  />
                  <AvatarFallback>
                    {getInitials(otherUser?.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">
                    {isSelfChat
                      ? `${otherUser.displayName} (You)`
                      : otherUser?.displayName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        online
                          ? "bg-green-500"
                          : "bg-muted-foreground"
                      }`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {online
                        ? "Online"
                        : otherUser?.lastSeen
                          ? `Last seen ${new Date(
                              otherUser?.lastSeen
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : "Offline"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-48 h-10 bg-secondary/50 animate-pulse rounded-lg" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={!otherUser || isSelfChat}
              onClick={() =>
                otherUser &&
                startPulseCall({
                  id: otherUser.id,
                  displayName: otherUser.displayName,
                  username: otherUser.username,
                  avatarUrl: otherUser.avatarUrl,
                }, "voice")
              }
              className="text-primary hover:text-primary hover:bg-primary/10 cursor-pointer disabled:cursor-not-allowed"
              title="Voice call"
            >
              <Phone className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!otherUser || isSelfChat}
              onClick={() =>
                otherUser &&
                startPulseCall({
                  id: otherUser.id,
                  displayName: otherUser.displayName,
                  username: otherUser.username,
                  avatarUrl: otherUser.avatarUrl,
                }, "video")
              }
              className="text-primary hover:text-primary hover:bg-primary/10 cursor-pointer disabled:cursor-not-allowed"
              title="Video call"
            >
              <Video className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <MoreVertical className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-6"
        >
          {isLoadingMessages || isLoadingConv ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : !messages?.length ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
                <Avatar className="w-10 h-10 opacity-50 grayscale">
                  <AvatarImage src={otherUser?.avatarUrl || ""} />
                  <AvatarFallback>
                    {getInitials(otherUser?.displayName || "?")}
                  </AvatarFallback>
                </Avatar>
              </div>
              <p>This is the beginning of your conversation.</p>
              <p className="text-sm mt-1">
                {isSelfChat
                  ? "Send yourself a message."
                  : `Say hi to ${otherUser?.displayName}!`}
              </p>
            </div>
          ) : (
            messages.map((message: Message, idx: number) => {
              const prevMessage = idx > 0 ? messages[idx - 1] : null;
              const showAvatar =
                !prevMessage || prevMessage.senderId !== message.senderId;
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.senderId === currentUser?.id}
                  showAvatar={showAvatar}
                />
              );
            })
          )}
          {isOtherUserTyping && (
            <div className="flex items-end gap-2">
              <Avatar className="w-8 h-8 opacity-70">
                <AvatarImage src={otherUser?.avatarUrl || ""} />
                <AvatarFallback>
                  {getInitials(otherUser?.displayName || "?")}
                </AvatarFallback>
              </Avatar>
              <div className="bg-secondary rounded-2xl rounded-bl-sm p-3 py-4 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                <span className="w-1.5 h-5 bg-muted-foreground rounded-full animate-bounce" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-card/30 border-t border-border flex-shrink-0">
          {sendError && (
            <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {sendError}
            </div>
          )}
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 bg-background border border-border rounded-xl pr-2 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all overflow-visible"
          >
            <div className="pl-2 flex-shrink-0">
              <MediaButton onSelect={handleMediaSelect} />
            </div>
            <Input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 border-0 bg-transparent ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 h-12"
            />
            <Button
              type="submit"
              size="icon"
              variant="glow"
              disabled={!content.trim() || sendMessage.isPending}
              className="h-9 w-9 rounded-lg shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
