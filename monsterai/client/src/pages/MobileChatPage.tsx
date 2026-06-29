import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Send,
  Copy,
  Trash2,
  MessageCircle,
  Image as ImageIcon,
  ChevronLeft,
  MoreVertical,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import MobileFeedbackPanel from "@/components/MobileFeedbackPanel";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
};

type Conversation = {
  id: number;
  title: string;
  mode: "chat" | "image";
  createdAt: Date;
};

interface MobileChatPageProps {
  onBack?: () => void;
  onSwitchToImage?: () => void;
}

export default function MobileChatPage({
  onBack,
  onSwitchToImage,
}: MobileChatPageProps) {
  const { user, loading: authLoading } = useAuth();
  const [currentConversationId, setCurrentConversationId] = useState<
    number | null
  >(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [feedbackMessageId, setFeedbackMessageId] = useState<number | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // tRPC queries and mutations
  const { data: conversations = [] } = trpc.chat.getConversations.useQuery(
    undefined,
    {
      enabled: !!user,
    }
  );

  const { data: chatMessages = [] } = trpc.chat.getMessages.useQuery(
    { conversationId: currentConversationId! },
    { enabled: !!currentConversationId }
  );

  const createConversationMutation = trpc.chat.createConversation.useMutation();
  const sendMessageMutation = trpc.chat.sendMessage.useMutation();
  const deleteMessageMutation = trpc.chat.deleteMessage.useMutation();
  const submitFeedbackMutation = trpc.feedback.submitFeedback.useMutation();

  // Update messages when fetched
  useEffect(() => {
    if (chatMessages.length > 0) {
      setMessages(
        chatMessages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: new Date(msg.createdAt),
        }))
      );
    }
  }, [chatMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize first conversation
  useEffect(() => {
    if (!currentConversationId && conversations.length > 0) {
      setCurrentConversationId(conversations[0].id);
    }
  }, [conversations, currentConversationId]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const handleNewConversation = async () => {
    try {
      const result = await createConversationMutation.mutateAsync({
        title: `Chat - ${new Date().toLocaleString()}`,
        mode: "chat",
      });
      setCurrentConversationId((result as any).insertId || Date.now());
      setMessages([]);
      setShowMenu(false);
      toast.success("New conversation created");
    } catch (error) {
      toast.error("Failed to create conversation");
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !currentConversationId) return;

    const userMessage = inputValue;
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await sendMessageMutation.mutateAsync({
        conversationId: currentConversationId,
        message: userMessage,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "user",
          content: userMessage,
          createdAt: new Date(),
        },
        {
          id: Date.now() + 1,
          role: "assistant",
          content: (response as any).message || (response as any).content || '',
          createdAt: new Date(),
        },
      ]);
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      await deleteMessageMutation.mutateAsync({ messageId });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success("Message deleted");
    } catch (error) {
      toast.error("Failed to delete message");
    }
  };

  const handleSubmitFeedback = async (rating: number, comment?: string, tags?: string) => {
    if (feedbackMessageId === null) return;
    try {
      await submitFeedbackMutation.mutateAsync({
        messageId: feedbackMessageId,
        rating,
        comment,
        tags,
      });
      toast.success("Feedback submitted!");
      setFeedbackMessageId(null);
    } catch (error) {
      toast.error("Failed to submit feedback");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Mobile Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-0 h-auto"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
          <div>
            <h1 className="font-bold text-base">MonsterAi Chat</h1>
            <p className="text-xs text-muted-foreground">
              {conversations.length} conversations
            </p>
          </div>
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMenu(!showMenu)}
            className="p-0 h-auto"
          >
            <MoreVertical className="w-5 h-5" />
          </Button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50">
              <button
                onClick={handleNewConversation}
                className="w-full px-4 py-2 text-left text-sm hover:bg-background/50 flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                New Chat
              </button>
              {onSwitchToImage && (
                <button
                  onClick={onSwitchToImage}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-background/50 flex items-center gap-2 border-t border-border"
                >
                  <ImageIcon className="w-4 h-4" />
                  Generate Image
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              Start a conversation with MonsterAi
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <Card
                className={`max-w-xs px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-accent text-accent-foreground"
                    : "bg-card border-border"
                }`}
              >
                <div className="text-sm">
                  {msg.role === "assistant" ? (
                    <Streamdown>{msg.content}</Streamdown>
                  ) : (
                    msg.content
                  )}
                </div>

                {/* Message Actions */}
                <div className="flex gap-2 mt-2">
                  {msg.role === "assistant" && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyMessage(msg.content)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFeedbackMessageId(msg.id)}
                        className="h-6 w-6 p-0"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Feedback UI */}
                {feedbackMessageId === msg.id && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <MobileFeedbackPanel
                      messageId={msg.id}
                      onSubmit={handleSubmitFeedback}
                      onClose={() => setFeedbackMessageId(null)}
                    />
                  </div>
                )}
              </Card>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-card border-t border-border p-4 sticky bottom-0">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !isLoading) {
                handleSendMessage();
              }
            }}
            placeholder="Ask MonsterAi..."
            className="flex-1 bg-background text-foreground border-border text-sm"
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="bg-accent text-accent-foreground hover:bg-accent/90 px-3"
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
