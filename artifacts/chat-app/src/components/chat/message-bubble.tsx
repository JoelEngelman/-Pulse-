import { useState } from "react";
import { Message, useDeleteMessage, useEditMessage, useAddReaction, useRemoveReaction, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatTime } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Pencil, Trash2, SmilePlus, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export function MessageBubble({ message, isOwn, showAvatar }: { message: Message, isOwn: boolean, showAvatar: boolean }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  
  const queryClient = useQueryClient();
  const { data: currentUser } = useGetMe();
  
  const deleteMessage = useDeleteMessage();
  const editMessage = useEditMessage();
  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();

  const handleEdit = () => {
    if (!editContent.trim() || editContent === message.content) {
      setIsEditing(false);
      return;
    }
    editMessage.mutate(
      { conversationId: message.conversationId, messageId: message.id, data: { content: editContent } },
      {
        onSuccess: () => {
          setIsEditing(false);
          queryClient.invalidateQueries({ queryKey: [`/api/conversations/${message.conversationId}/messages`] });
        }
      }
    );
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this message?")) {
      deleteMessage.mutate(
        { conversationId: message.conversationId, messageId: message.id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/conversations/${message.conversationId}/messages`] });
            queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
          }
        }
      );
    }
  };

  const toggleReaction = (emoji: string) => {
    const hasReacted = message.reactions.some(r => r.emoji === emoji && currentUser && r.userIds.includes(currentUser.id));
    if (hasReacted) {
      removeReaction.mutate(
        { conversationId: message.conversationId, messageId: message.id, emoji },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/conversations/${message.conversationId}/messages`] });
          }
        }
      );
    } else {
      addReaction.mutate(
        { conversationId: message.conversationId, messageId: message.id, data: { emoji } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/conversations/${message.conversationId}/messages`] });
          }
        }
      );
    }
  };

  return (
    <div 
      className={`flex items-end gap-2 w-full group ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar */}
      <div className="w-8 flex-shrink-0">
        {!isOwn && showAvatar && (
          <Avatar className="w-8 h-8 select-none">
            <AvatarImage src={message.sender?.avatarUrl || ""} />
            <AvatarFallback className="text-[10px]">{getInitials(message.sender?.displayName || "?")}</AvatarFallback>
          </Avatar>
        )}
      </div>

      <div className={`flex flex-col gap-1 max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
        {/* Name (if group chat / first message) */}
        {!isOwn && showAvatar && (
          <span className="text-xs text-muted-foreground ml-1">
            {message.sender?.displayName}
          </span>
        )}

        <div className="flex items-center gap-2 w-full group/actions">
          {/* Actions (Left side for own messages) */}
          {isOwn && isHovered && !isEditing && (
            <div className="flex items-center gap-1 opacity-0 group-hover/actions:opacity-100 transition-opacity mr-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setIsEditing(true)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={handleDelete}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Bubble */}
          <div className="relative group/bubble">
            {isEditing ? (
              <div className="flex items-center gap-2 bg-secondary p-2 rounded-2xl">
                <input 
                  autoFocus
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleEdit();
                    }
                    if (e.key === 'Escape') {
                      setIsEditing(false);
                      setEditContent(message.content);
                    }
                  }}
                  className="bg-transparent border-none outline-none text-sm text-foreground min-w-[200px]"
                />
                <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500 hover:text-green-400" onClick={handleEdit}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div 
                className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed relative ${
                  isOwn 
                    ? "bg-primary text-primary-foreground rounded-br-sm" 
                    : "bg-secondary text-foreground rounded-bl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <div className={`text-[10px] mt-1 flex items-center justify-end gap-1.5 opacity-60 ${isOwn ? "text-primary-foreground" : "text-muted-foreground"}`}>
                  {message.editedAt && <span>(edited)</span>}
                  <span>{formatTime(message.createdAt)}</span>
                </div>
              </div>
            )}

            {/* Hover Reaction Picker */}
            {!isEditing && isHovered && (
              <div className={`absolute -top-10 ${isOwn ? "right-0" : "left-0"} bg-card border border-border shadow-xl rounded-full px-2 py-1.5 flex items-center gap-1 z-20 animate-in fade-in zoom-in-95 duration-100`}>
                {COMMON_EMOJIS.map(emoji => (
                  <button 
                    key={emoji}
                    onClick={() => toggleReaction(emoji)}
                    className="hover:bg-secondary p-1 rounded-full text-lg transition-transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions (Right side for other's messages) */}
          {!isOwn && isHovered && !isEditing && (
            <div className="flex items-center gap-1 opacity-0 group-hover/actions:opacity-100 transition-opacity ml-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                <SmilePlus className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Reactions Display */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-0.5 max-w-full ${isOwn ? "justify-end" : "justify-start"}`}>
            {message.reactions.map(reaction => {
              const hasReacted = currentUser && reaction.userIds.includes(currentUser.id);
              return (
                <button
                  key={reaction.emoji}
                  onClick={() => toggleReaction(reaction.emoji)}
                  className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full border transition-colors ${
                    hasReacted 
                      ? "bg-primary/20 border-primary/30 text-primary" 
                      : "bg-card border-border hover:bg-secondary text-muted-foreground"
                  }`}
                >
                  <span>{reaction.emoji}</span>
                  <span className="font-semibold">{reaction.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
