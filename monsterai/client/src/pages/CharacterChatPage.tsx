import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Plus, MessageCircle, User, Star, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { useTranslation } from "react-i18next";
import { useTTS } from "@/hooks/useTTS";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface Character {
  id: number;
  name: string;
  description: string;
  worldview: string;
  openingLine: string;
  averageRating: number;
  usageCount: number;
}

export default function CharacterChatPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { speak, stop, isPlaying } = useTTS();
  const [playingMessageId, setPlayingMessageId] = useState<number | null>(null);

  // State
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCharacterSelector, setShowCharacterSelector] = useState(true);

  // Queries and mutations
  const myCharactersQuery = trpc.characters.getMyCharacters.useQuery();
  const publicCharactersQuery = trpc.characters.getPublic.useQuery();
  const createConversationMutation = trpc.chat.createConversation.useMutation();
  const sendMessageMutation = trpc.chat.sendMessage.useMutation();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle character selection
  const handleSelectCharacter = async (character: Character) => {
    setSelectedCharacter(character);
    setSelectedCharacterId(character.id);
    setMessages([]);
    setShowCharacterSelector(false);

    // Create a new conversation for this character
    try {
      const newConversation = await createConversationMutation.mutateAsync({
        title: `Chat with ${character.name}`,
        mode: "chat",
      });
      setConversationId(newConversation.id);
      toast.success(`Started chatting with ${character.name}`);
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast.error("Failed to start conversation");
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedCharacterId || !conversationId) return;

    const userMessage = inputMessage;
    setInputMessage("");
    setIsLoading(true);

    try {
      // Add user message to UI
      const tempUserMessage: Message = {
        id: Date.now(),
        role: "user",
        content: userMessage,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, tempUserMessage]);

      // Send message to backend
      const result = await sendMessageMutation.mutateAsync({
        conversationId: conversationId,
        message: userMessage,
        characterId: selectedCharacterId,
      });

      // Add assistant response
      const tempAssistantMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: result.message,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, tempAssistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
      // Remove the user message if it failed
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  // Get all available characters
  const allCharacters = [
    ...(myCharactersQuery.data || []),
    ...(publicCharactersQuery.data || []).filter(
      (pc) => !myCharactersQuery.data?.some((mc) => mc.id === pc.id)
    ),
  ];

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Please log in to chat with characters</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Character Selector Sidebar */}
      {showCharacterSelector && (
        <div className="w-80 border-r border-border bg-card flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">Select a Character</h2>
            <p className="text-sm text-muted-foreground mt-1">Choose who to chat with</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {allCharacters.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">No characters available</p>
                <Button onClick={() => navigate("/characters")} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create Character
                </Button>
              </div>
            ) : (
              allCharacters.map((character) => (
                <button
                  key={character.id}
                  onClick={() => handleSelectCharacter(character)}
                  className="w-full text-left p-3 rounded-lg border border-border/50 hover:border-accent/50 hover:bg-muted/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-foreground truncate">{character.name}</h3>
                    {character.averageRating > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-medium">{character.averageRating}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {character.description}
                  </p>
                  {character.usageCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {character.usageCount} conversations
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {selectedCharacter && (
          <div className="border-b border-border bg-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/50 to-accent/30 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h1 className="font-bold text-foreground">{selectedCharacter.name}</h1>
                <p className="text-sm text-muted-foreground">{selectedCharacter.description}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowCharacterSelector(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Change Character
            </Button>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 && selectedCharacter && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-accent/50 to-accent/30 flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-accent" />
                </div>
                <h2 className="text-xl font-bold mb-2 text-foreground">
                  Chat with {selectedCharacter.name}
                </h2>
                <p className="text-muted-foreground mb-4">
                  {selectedCharacter.openingLine}
                </p>
                <Badge variant="secondary">{selectedCharacter.worldview}</Badge>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}
            >
              <div
                className={`max-w-2xl p-4 rounded-lg ${
                  msg.role === "user"
                    ? "bg-accent text-accent-foreground rounded-br-none"
                    : "bg-card text-card-foreground border border-border/50 rounded-bl-none"
                }`}
              >
                <div className="flex gap-3">
                  {msg.role === "assistant" && (
                    <MessageCircle className="w-5 h-5 flex-shrink-0 mt-1" />
                  )}
                  <div className="flex-1">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                  {msg.role === "assistant" && (
                    <button
                      onClick={() => {
                        if (playingMessageId === msg.id) {
                          stop();
                          setPlayingMessageId(null);
                        } else {
                          speak(msg.content);
                          setPlayingMessageId(msg.id);
                        }
                      }}
                      className="flex-shrink-0 p-1 hover:bg-muted rounded transition-colors"
                      title="Play audio"
                    >
                      {playingMessageId === msg.id && isPlaying ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  {msg.role === "user" && (
                    <User className="w-5 h-5 flex-shrink-0 mt-1" />
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-card text-card-foreground border border-border/50 p-4 rounded-lg rounded-bl-none">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {selectedCharacter && (
          <div className="border-t border-border bg-card p-4 sm:p-6">
            <div className="flex gap-2">
              <Input
                placeholder="Type your message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className="gap-2 bg-accent hover:bg-accent/90"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
