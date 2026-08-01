import { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";

export const useWebSocket = () => {
    const ws = useRef<WebSocket | null>(null);
    const { token, addMessage } = useChatStore();

    useEffect(() => {
        if (!token) return;

        ws.current = new WebSocket(`ws://localhost:8000/ws/chat?token=${token}`);

        ws.current.onmessage = (event: MessageEvent<any>) => {
            const data = JSON.parse(event.data);
            addMessage({
                id: data.id,
                sender_id: data.sender_id,
                receiver_id: data.receiver_id,
                content: data.content,
                timestamp: data.timestamp
            });
        };

        ws.current.onclose = () => {
          console.log("Websocket Disconnected. TODO: Implement Reconnect logic")
        };

        return () => {
            ws.current?.close();
        };
    }, [token]);

    const sendMessage = (receiver_id: number, content: string) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ receiver_id, content }));
      }
    };

    return { sendMessage };
}