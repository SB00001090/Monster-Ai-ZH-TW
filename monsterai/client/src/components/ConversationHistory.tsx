import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Archive, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format } from "date-fns";

interface Conversation {
  id: number;
  characterId: number;
  characterName: string;
  title: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
}

interface ConversationHistoryProps {
  conversations: Conversation[];
  onSelectConversation: (id: number) => void;
  onDeleteConversation: (id: number) => void;
  onArchiveConversation: (id: number) => void;
  selectedId?: number;
}

export default function ConversationHistory({
  conversations,
  onSelectConversation,
  onDeleteConversation,
  onArchiveConversation,
  selectedId,
}: ConversationHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.characterName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesArchived = showArchived ? conv.isArchived : !conv.isArchived;
    return matchesSearch && matchesArchived;
  });

  const handleExport = (conversation: Conversation) => {
    const data = {
      title: conversation.title,
      character: conversation.characterName,
      messageCount: conversation.messageCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${conversation.title}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Conversation exported");
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Conversation History</CardTitle>
        <CardDescription>
          {filteredConversations.length} conversation{filteredConversations.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Search Bar */}
        <div className="flex gap-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 pl-9"
          />
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? "Archived" : "Active"}
          </Button>
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-4">
            {filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No conversations found</p>
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedId === conversation.id
                      ? "bg-accent border-accent text-accent-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() => onSelectConversation(conversation.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{conversation.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {conversation.characterName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {conversation.messageCount} messages
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(conversation.updatedAt), "MMM d, HH:mm")}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExport(conversation);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onArchiveConversation(conversation.id);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conversation.id);
                        }}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
