import { useState, useEffect } from "react";
import { useSearchMessages, MessageSearchResult, getSearchMessagesQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Search as SearchIcon, Loader2, MessageSquare, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, formatDate } from "@/lib/utils";

export default function Search() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Simple debounce logic inline for search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(handler);
  }, [query]);

  // If debounced query is less than 3 chars, don't search
  const isSearchable = debouncedQuery.length >= 3;

  const { data: results, isLoading } = useSearchMessages(
    { q: debouncedQuery },
    {
      query: {
        enabled: isSearchable,
        queryKey: getSearchMessagesQueryKey({ q: debouncedQuery })
      }
    }
  );

  return (
    <div className="flex flex-col w-full h-full max-w-4xl mx-auto p-4 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-accent/10 text-accent p-3 rounded-2xl">
          <SearchIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Global Search</h1>
          <p className="text-muted-foreground">Search through all your messages</p>
        </div>
      </div>

      <div className="relative mb-8 group">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 group-focus-within:text-accent transition-colors" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for words, phrases..."
          className="pl-12 h-14 text-lg bg-card/50 border-border hover:border-accent/50 focus-visible:ring-accent transition-colors rounded-2xl shadow-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {!isSearchable ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="w-24 h-24 bg-secondary/50 rounded-full flex items-center justify-center mb-6 border border-border border-dashed">
              <SearchIcon className="w-10 h-10 opacity-30" />
            </div>
            <p className="text-lg">Type at least 3 characters to search</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        ) : !results?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="w-24 h-24 bg-secondary/50 rounded-full flex items-center justify-center mb-6 border border-border">
              <SearchIcon className="w-10 h-10 opacity-30" />
            </div>
            <p className="text-lg text-foreground font-medium mb-1">No results found</p>
            <p>We couldn't find anything matching "{debouncedQuery}"</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Found {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            {results.map((result: MessageSearchResult) => (
              <Link 
                key={result.message.id} 
                href={`/conversations/${result.conversationId}`}
                className="flex flex-col p-4 bg-card border border-border rounded-2xl hover:border-accent/50 hover:bg-secondary/20 transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={result.message.sender?.avatarUrl || ""} />
                      <AvatarFallback className="text-[10px]">{getInitials(result.message.sender?.displayName || "?")}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-sm text-foreground">
                      {result.message.sender?.displayName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-full">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(result.message.createdAt)}</span>
                  </div>
                </div>
                
                <div className="bg-background border border-border/50 rounded-xl p-3 text-sm relative overflow-hidden group-hover:border-accent/30 transition-colors">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent/50 rounded-l-xl" />
                  <p className="pl-2 text-foreground/90 leading-relaxed">
                    {/* Highlight matching text logic could go here, keeping it simple for now */}
                    {result.message.content}
                  </p>
                </div>
                
                <div className="mt-3 flex items-center gap-1 text-xs text-accent font-medium opacity-0 group-hover:opacity-100 transition-opacity translate-y-1 group-hover:translate-y-0">
                  <span>Go to conversation</span>
                  <MessageSquare className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
