import { WebSocket } from "ws";
import { storage } from "./storage";
import { Message } from "@shared/schema";

interface ChatMessage {
  type: "chat";
  senderId: number;
  receiverId: number;
  content: string;
}

export function handleWebSocketMessage(
  ws: WebSocket,
  message: string,
  broadcast: (data: string) => void
) {
  try {
    const data = JSON.parse(message) as ChatMessage;

    if (data.type === "chat") {
      // Validate sender and receiver exist
      Promise.all([
        storage.getUser(data.senderId),
        storage.getUser(data.receiverId)
      ]).then(([sender, receiver]) => {
        if (!sender || !receiver) {
          ws.send(JSON.stringify({ error: "Invalid sender or receiver" }));
          return;
        }

        // Ensure the message is encrypted
        if (!data.content.match(/^[A-Za-z0-9+/=]+$/)) {
          ws.send(JSON.stringify({ error: "Message must be encrypted" }));
          return;
        }

        return storage.createMessage({
          senderId: data.senderId,
          receiverId: data.receiverId,
          content: data.content,
        });
      })
      .then((savedMessage: Message | undefined) => {
        if (savedMessage) {
          broadcast(JSON.stringify({
            type: "new_message",
            message: savedMessage
          }));
        }
      })
      .catch((error) => {
        console.error("Failed to save message:", error);
        ws.send(JSON.stringify({ error: "Failed to save message" }));
      });
    }
  } catch (error) {
    console.error("Failed to parse message:", error);
    ws.send(JSON.stringify({ error: "Invalid message format" }));
  }
}