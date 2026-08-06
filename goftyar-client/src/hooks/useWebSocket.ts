import { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";

export const useWebSocket = () => {
    const ws = useRef<WebSocket | null>(null);
    const {
        token,
        addMessage,
        setOnlineUsers,
        addUserPresence,
        removeUserPresence,
        setUserTyping,
        markMessagesAsRead,
        markMessagesAsDelivered
    } = useChatStore();

    const pingIntervalRef = useRef<any>(null);
    const reconnectTimeoutRef = useRef<any>(null);

    const connect = () => {
        if (!token) return;

        // Clean up previous socket if any
        if (ws.current) {
            ws.current.close();
        }

        const socketUrl = `ws://localhost:8000/ws/chat?token=${token}`;
        const socket = new WebSocket(socketUrl);
        ws.current = socket;

        socket.onopen = () => {
            console.log("WebSocket connected successfully.");

            // Start heartbeat ping every 15 seconds to keep connection alive
            pingIntervalRef.current = setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: "ping" }));
                }
            }, 15000);
        };

        socket.onmessage = (event: MessageEvent<any>) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === "pong") {
                    return;
                }

                if (data.type === "presence_list") {
                    setOnlineUsers(data.online_users);
                    return;
                }

                if (data.type === "presence") {
                    if (data.status === "online") {
                        addUserPresence(data.user_id);
                    } else {
                        removeUserPresence(data.user_id);
                    }
                    return;
                }

                if (data.type === "typing") {
                    setUserTyping(data.sender_id, data.is_typing);
                    return;
                }

                if (data.type === "read") {
                    markMessagesAsRead(data.receiver_id, data.receiver_id);
                    return;
                }

                if (data.type === "delivered_receipt") {
                    markMessagesAsDelivered(data.receiver_id);
                    return;
                }

                if (data.type === "message" || data.content) {
                    addMessage({
                        id: data.id,
                        sender_id: data.sender_id,
                        receiver_id: data.receiver_id,
                        content: data.content,
                        message_type: data.message_type || "text",
                        client_msg_id: data.client_msg_id,
                        is_delivered: data.is_delivered,
                        is_read: data.is_read,
                        timestamp: data.timestamp
                    });
                }
            } catch (err) {
                console.error("Error parsing WebSocket message:", err);
            }
        };

        socket.onclose = () => {
            console.log("WebSocket closed. Attempting reconnect in 3 seconds...");
            cleanup();
            reconnectTimeoutRef.current = setTimeout(() => {
                connect();
            }, 3000);
        };

        socket.onerror = (err) => {
            console.error("WebSocket encountered an error:", err);
            socket.close();
        };
    };

    const cleanup = () => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
    };

    useEffect(() => {
        connect();

        return () => {
            cleanup();
            if (ws.current) {
                ws.current.onclose = null;
                ws.current.close();
                ws.current = null;
            }
        };
    }, [token]);

    const sendMessage = (
        receiver_id: number,
        content: string,
        msgType: "text" | "image" | "video" | "audio" | null,
        client_msg_id?: string
    ) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            const uniqueId = client_msg_id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            ws.current.send(JSON.stringify({
                type: "message",
                receiver_id,
                content,
                msgType: msgType || "text",
                client_msg_id: uniqueId
            }));
        } else {
            console.warn("WebSocket is not open. Unable to send message.");
        }
    };

    const sendTyping = (receiver_id: number, is_typing: boolean) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: "typing",
                receiver_id,
                is_typing
            }));
        }
    };

    const sendRead = (sender_id: number) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: "read",
                sender_id
            }));
        }
    };

    return { sendMessage, sendTyping, sendRead };
};
