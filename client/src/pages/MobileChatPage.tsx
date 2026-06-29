import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useGuest } from "@/contexts/GuestContext";
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
  User,
  History,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import CharacterAvatar from "@/components/CharacterAvatar";
import MobileFeedbackPanel from "@/components/MobileFeedbackPanel";
import { STABLE_EMPTY_ARRAY } from "@/lib/queryDefaults";

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
  const { isGuest } = useGuest();
  const canUse = Boolean(user) || isGuest;
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
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(
    null
  );
  const [selectedCharacterName, setSelectedCharacterName] = useState<string | null>(
    null
  );
  const [selectedCharacterAvatar, setSelectedCharacterAvatar] = useState<string | null>(
    null
  );
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // tRPC queries and mutations
  const { data: conversationsData } = trpc.chat.getConversations.useQuery(
    undefined,
    {
      enabled: canUse,
    }
  );
  const conversations = conversationsData ?? STABLE_EMPTY_ARRAY;

  const { data: chatMessagesData } = trpc.chat.getMessages.useQuery(
    { conversationId: currentConversationId! },
    { enabled: !!currentConversationId }
  );

  const myCharactersQuery = trpc.characters.getMyCharacters.useQuery(undefined, {
    enabled: canUse,
  });
  const publicCharactersQuery = trpc.characters.getPublic.useQuery(undefined, {
    enabled: canUse,
  });

  const chatHistory = (conversations as Array<{
    id: number;
    title: string;
    mode: string;
    character?: { id: number; name: string; avatarUrl?: string | null };
    messageCount?: number;
    lastMessage?: string | null;
  }>).filter((c) => c.mode === "chat");

  const allCharacters = [
    ...(myCharactersQuery.data ?? []),
    ...(publicCharactersQuery.data ?? []).filter(
      (pc) => !myCharactersQuery.data?.some((mc) => mc.id === pc.id)
    ),
  ];

  const createConversationMutation = trpc.chat.createConversation.useMutation();
  const sendMessageMutation = trpc.chat.sendMessage.useMutation();
  const deleteMessageMutation = trpc.chat.deleteMessage.useMutation();
  const deleteConversationMutation = trpc.chat.deleteConversation.useMutation();
  const submitFeedbackMutation = trpc.feedback.submitFeedback.useMutation();

  useEffect(() => {
    if (!currentConversationId || !chatMessagesData) return;
    setMessages(
      chatMessagesData.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(msg.createdAt),
      }))
    );
  }, [chatMessagesData, currentConversationId]);

  useEffect(() => {
    if (!currentConversationId) return;
    const conv = conversations.find((c) => c.id === currentConversationId) as {
      character?: { id: number; name: string; avatarUrl?: string | null };
      characterId?: number;
    } | undefined;
    if (conv?.character) {
      setSelectedCharacterId(conv.character.id);
      setSelectedCharacterName(conv.character.name);
      setSelectedCharacterAvatar(conv.character.avatarUrl ?? null);
    }
  }, [currentConversationId, conversationsData]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize first conversation
  useEffect(() => {
    if (!currentConversationId && conversations.length > 0) {
      setCurrentConversationId(conversations[0].id);
    }
  }, [conversationsData, currentConversationId]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const handleSelectCharacter = async (character: {
    id: number;
    name: string;
    openingLine?: string;
  }) => {
    try {
      const result = await createConversationMutation.mutateAsync({
        title: `Chat with ${character.name}`,
        mode: "chat",
        characterId: character.id,
      });
      setCurrentConversationId(result.id);
      setSelectedCharacterId(character.id);
      setSelectedCharacterName(character.name);
      setSelectedCharacterAvatar((character as { avatarUrl?: string }).avatarUrl ?? null);
      setShowCharacterPicker(false);
      setShowMenu(false);

      if (result.openingMessage) {
        setMessages([
          {
            id: result.openingMessage.id,
            role: "assistant",
            content: result.openingMessage.content,
            createdAt: new Date(result.openingMessage.createdAt ?? Date.now()),
          },
        ]);
      } else {
        setMessages([]);
      }
      toast.success(t("chat.startedWith", { name: character.name }));
    } catch {
      toast.error(t("chat.failedToStart"));
    }
  };

  const handleResumeConversation = (conv: (typeof chatHistory)[number]) => {
    setCurrentConversationId(conv.id);
    setShowHistoryPicker(false);
    setShowMenu(false);
    if (conv.character) {
      setSelectedCharacterId(conv.character.id);
      setSelectedCharacterName(conv.character.name);
      setSelectedCharacterAvatar(conv.character.avatarUrl ?? null);
    }
  };

  const handleDeleteConversation = async (convId: number) => {
    if (!confirm(t("chat.deleteConfirm"))) return;
    try {
      await deleteConversationMutation.mutateAsync({ conversationId: convId });
      if (currentConversationId === convId) {
        setCurrentConversationId(null);
        setMessages([]);
        setSelectedCharacterId(null);
        setSelectedCharacterName(null);
        setSelectedCharacterAvatar(null);
      }
      toast.success(t("chat.deleted"));
    } catch {
      toast.error(t("chat.deleteFailed"));
    }
  };

  const handleNewConversation = async () => {
    try {
      const result = await createConversationMutation.mutateAsync({
        title: `Chat - ${new Date().toLocaleString()}`,
        mode: "chat",
      });
      setCurrentConversationId(result.id);
      setSelectedCharacterId(null);
      setSelectedCharacterName(null);
      setSelectedCharacterAvatar(null);
      setMessages([]);
      setShowMenu(false);
      toast.success(t("chat.newConversation"));
    } catch {
      toast.error(t("chat.failedToStart"));
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
        characterId: selectedCharacterId ?? undefined,
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
    } catch {
      toast.error(t("chat.failedToSend"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success(t("chat.copied"));
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      await deleteMessageMutation.mutateAsync({ messageId });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success(t("chat.messageDeleted"));
    } catch {
      toast.error(t("chat.messageDeleteFailed"));
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
      toast.success(t("chat.feedbackSubmitted"));
      setFeedbackMessageId(null);
    } catch {
      toast.error(t("chat.feedbackFailed"));
    }
  };

  return (
    <div className="relative flex flex-col h-screen bg-background">
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
          {selectedCharacterName && (
            <CharacterAvatar
              name={selectedCharacterName}
              avatarUrl={selectedCharacterAvatar}
              size="sm"
            />
          )}
          <div>
            <h1 className="font-bold text-base">
              {selectedCharacterName ?? t("chat.title")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {selectedCharacterName
                ? t("chat.roleplay")
                : t("chat.conversationCount", { count: conversations.length })}
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
                onClick={() => {
                  setShowHistoryPicker(true);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-background/50 flex items-center gap-2"
              >
                <History className="w-4 h-4" />
                {t("chat.history")}
              </button>
              <button
                onClick={() => {
                  setShowCharacterPicker(true);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-background/50 flex items-center gap-2 border-t border-border"
              >
                <User className="w-4 h-4" />
                {t("chat.pickCharacter")}
              </button>
              <button
                onClick={handleNewConversation}
                className="w-full px-4 py-2 text-left text-sm hover:bg-background/50 flex items-center gap-2 border-t border-border"
              >
                <MessageCircle className="w-4 h-4" />
                {t("chat.characters")}
              </button>
              {onSwitchToImage && (
                <button
                  onClick={onSwitchToImage}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-background/50 flex items-center gap-2 border-t border-border"
                >
                  <ImageIcon className="w-4 h-4" />
                  {t("home.textToImage")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showHistoryPicker && (
        <div className="absolute inset-0 z-50 bg-background/95 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{t("chat.history")}</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowHistoryPicker(false)}>
              {t("common.close")}
            </Button>
          </div>
          <div className="space-y-2">
            {chatHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("chat.noHistory")}</p>
            ) : (
              chatHistory.map((conv) => (
                <Card key={conv.id} className="p-3">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      className="flex-1 text-left min-w-0"
                      onClick={() => handleResumeConversation(conv)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {conv.character ? (
                          <CharacterAvatar
                            name={conv.character.name}
                            avatarUrl={conv.character.avatarUrl}
                            size="sm"
                          />
                        ) : (
                          <MessageCircle className="w-8 h-8 text-muted-foreground" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {conv.character?.name ?? conv.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {conv.messageCount ?? 0} {t("chat.messages")}
                          </p>
                        </div>
                      </div>
                      {conv.lastMessage && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {conv.lastMessage}
                        </p>
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteConversation(conv.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {showCharacterPicker && (
        <div className="absolute inset-0 z-50 bg-background/95 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{t("chat.selectCharacter")}</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowCharacterPicker(false)}>
              {t("common.close")}
            </Button>
          </div>
          <div className="space-y-2">
            {allCharacters.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("chat.noCharactersHint")}
              </p>
            ) : (
              allCharacters.map((character) => (
                <Card
                  key={character.id}
                  className="p-3 cursor-pointer hover:border-accent/50"
                  onClick={() => handleSelectCharacter(character)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CharacterAvatar
                      name={character.name}
                      avatarUrl={character.avatarUrl}
                      size="sm"
                    />
                    <p className="font-medium">{character.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {character.description}
                  </p>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              {selectedCharacterName
                ? t("chat.sayHello", { name: selectedCharacterName })
                : t("chat.startGeneral")}
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
            placeholder={t("chat.typeMessage")}
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
