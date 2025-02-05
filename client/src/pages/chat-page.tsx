import { useAuth } from "@/hooks/use-auth";
import { Message, User } from "@shared/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { encryptMessage, decryptMessage } from "@/lib/encryption";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";
import { Link } from "wouter";

type DecryptedMessage = Message & { decryptedContent?: string };

export default function ChatPage() {
  const { user } = useAuth();
  const { userId } = useParams();
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<DecryptedMessage[]>([]);
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", userId],
    enabled: !!userId && !!user
  });

  const { data: recipient, isLoading: recipientLoading } = useQuery<User>({
    queryKey: ["/api/users", userId],
    enabled: !!userId && !!user
  });

  // Decrypt messages when they change
  useEffect(() => {
    const decryptMessages = async () => {
      if (!messages || !user?.publicKey) return;

      const decrypted = await Promise.all(
        messages.map(async (msg) => {
          try {
            if (msg.senderId === user.id) {
              // Message sent by current user, don't decrypt
              return { ...msg, decryptedContent: msg.content };
            }
            if (!user.publicKey) {
              return { ...msg, decryptedContent: "No decryption key available" };
            }
            // Try to decrypt the message
            const decryptedContent = await decryptMessage(user.publicKey, msg.content);
            return { ...msg, decryptedContent };
          } catch (error) {
            console.error("Failed to decrypt message:", error);
            return { ...msg, decryptedContent: "Failed to decrypt message" };
          }
        })
      );

      setDecryptedMessages(decrypted);
    };

    decryptMessages();
  }, [messages, user?.publicKey]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !socket || !recipient?.publicKey) {
      toast({
        title: "Cannot send message",
        description: !recipient?.publicKey 
          ? "Recipient hasn't set up encryption yet" 
          : "Please check your connection and try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      const encryptedContent = await encryptMessage(recipient.publicKey, message);

      socket.emit("chat_message", {
        type: "chat",
        senderId: user?.id,
        receiverId: Number(userId),
        content: encryptedContent,
      });

      setMessage("");
    } catch (error) {
      console.error("Encryption error:", error);
      toast({
        title: "Encryption Error",
        description: "Failed to encrypt message. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!user?.id || !userId) return;

    const newSocket = io(window.location.origin, {
      auth: { token: "session" },
      query: { userId: user.id },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("Socket.IO connected");
      setSocket(newSocket);
      setConnecting(false);
      setError(null);
      newSocket.emit("join", user.id);
    });

    newSocket.on("connect_error", (err) => {
      console.error("Socket.IO connection error:", err);
      setConnecting(false);
      setError("Failed to connect to chat server");
      toast({
        title: "Connection Error",
        description: "Failed to connect to chat server. Please try again.",
        variant: "destructive",
      });
    });

    newSocket.on("new_message", (message: Message) => {
      queryClient.setQueryData<Message[]>(["/api/messages", userId], (oldMessages) => {
        if (!oldMessages) return [message];
        return [...oldMessages, message];
      });
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    newSocket.on("user_status_changed", (data: { userId: number; status: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", data.userId] });
    });

    newSocket.on("error", (error: { message: string }) => {
      toast({
        title: "Message Error",
        description: error.message,
        variant: "destructive",
      });
    });

    newSocket.on("disconnect", () => {
      console.log("Socket.IO disconnected");
      setSocket(null);
      setConnecting(true);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user?.id, userId, toast, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [decryptedMessages]);

  if (messagesLoading || recipientLoading || connecting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-destructive">{error}</h2>
              <Button 
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!recipient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold">User not found</h2>
              <Link href="/">
                <Button className="mt-4">Back to Contacts</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Card className="rounded-none sm:rounded-lg sm:max-w-4xl sm:mx-auto sm:my-8">
        <CardHeader className="border-b px-4 py-4">
          <CardTitle className="flex items-center gap-4">
            <Link href="/">
              <a className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-6 w-6" />
              </a>
            </Link>
            <Avatar>
              <AvatarFallback>{recipient.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <div>{recipient.username}</div>
              <div className="text-sm text-muted-foreground capitalize">
                {recipient.status} 
                {recipient.status === "online" && "🟢"}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-16rem)] sm:h-[60vh] p-4">
            <div className="space-y-4">
              {decryptedMessages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  No messages yet. Start the conversation!
                </div>
              )}
              {decryptedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.senderId === user?.id ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      msg.senderId === user?.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary"
                    }`}
                  >
                    {msg.decryptedContent}
                    <div className="text-xs opacity-70 mt-1">
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          <form onSubmit={sendMessage} className="border-t p-4 flex gap-4">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              disabled={!socket}
            />
            <Button type="submit" disabled={!socket || !message.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}