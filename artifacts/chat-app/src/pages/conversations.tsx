import { ConversationsList } from "@/components/chat/conversations-list";
import { MessageSquare } from "lucide-react";

export default function Conversations() {
  return (
    <div className="flex w-full h-full">
      {/* Sidebar Panel - always visible here */}
      <div className="w-full md:w-80 lg:w-96 border-r border-border bg-card/30 flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold">Messages</h2>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationsList />
        </div>
      </div>

      {/* Main Panel - Empty State (Desktop Only) */}
      <div className="hidden md:flex flex-1 items-center justify-center bg-background/50 relative overflow-hidden">
        {/* Subtle background element */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none">
          <MessageSquare className="w-96 h-96" />
        </div>
        
        <div className="text-center z-10 flex flex-col items-center max-w-sm px-4">
          <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-6">
            <MessageSquare className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-2xl font-bold mb-2">Pulse Messaging</h3>
          <p className="text-muted-foreground text-center">
            Select a conversation from the sidebar or start a new one to begin messaging.
          </p>
        </div>
      </div>
    </div>
  );
}
