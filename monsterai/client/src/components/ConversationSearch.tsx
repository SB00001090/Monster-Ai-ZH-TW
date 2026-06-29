import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, X, MessageCircle } from "lucide-react";

interface Conversation {
  id: number;
  title: string;
  updatedAt: Date;
  messageCount?: number;
}

interface ConversationSearchProps {
  conversations: Conversation[];
  onSelect: (conversation: Conversation) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ConversationSearch({
  conversations,
  onSelect,
  isOpen,
  onClose,
}: ConversationSearchProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Conversation[]>([]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      
      if (!query.trim()) {
        setResults([]);
        return;
      }

      const filtered = conversations.filter((conv) =>
        conv.title.toLowerCase().includes(query.toLowerCase())
      );

      setResults(filtered);
    },
    [conversations]
  );

  const handleSelectConversation = (conversation: Conversation) => {
    onSelect(conversation);
    setSearchQuery("");
    setResults([]);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
      <Card className="w-full max-w-2xl mx-4 shadow-lg">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-muted-foreground" />
            <Input
              placeholder={t("search.searchConversations", "Search conversations...")}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
              className="border-0 focus-visible:ring-0"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {searchQuery && results.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">
                {t("search.noResults", "No conversations found")}
              </p>
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-border">
              {results.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  className="p-4 hover:bg-accent/5 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">
                        {conversation.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(conversation.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {conversation.messageCount && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageCircle className="w-3 h-3" />
                        <span>{conversation.messageCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">
                {t("search.startTyping", "Start typing to search your conversations")}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
