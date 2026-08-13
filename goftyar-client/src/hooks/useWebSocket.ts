import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';

// Dynamic base URL detection for flexible local and production development
const getApiBaseUrl = () => {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl) {
        return envUrl;
    }
    return window.location.protocol + "//" + window.location.hostname + (window.location.port ? ":" + window.location.port : "");
};

const API_BASE_URL = getApiBaseUrl();

export const useWebSocket = () => {
  const {
    token,
    addMessage,
    setMessages,
    setOnlineUsers,
    setTypingUser,
    setCallState,
    setCallPartner,
    setIncomingOffer
  } = useChatStore();

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const cleanUrl = API_BASE_URL.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProto}://${cleanUrl}/ws/chat?token=${token}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'presence_list') {
        setOnlineUsers(data.online_users);
      } else if (data.type === 'presence') {
        // Multi-user presence tracking: dynamically modify online state array
        const currentOnline = useChatStore.getState().onlineUsers;
        if (data.status === 'online') {
          if (!currentOnline.includes(data.user_id)) {
            setOnlineUsers([...currentOnline, data.user_id]);
          }
        } else {
          setOnlineUsers(currentOnline.filter(id => id !== data.user_id));
        }
      } else if (data.type === 'typing') {
        setTypingUser(data.sender_id, data.is_typing);
      } else if (data.type === 'read') {
        // Correct read receipt update without losing chat history
        const currentMsgs = useChatStore.getState().messages;
        const updated = currentMsgs.map(m => {
          if (m.receiver_id === data.receiver_id) {
            return { ...m, is_read: true };
          }
          return m;
        });
        setMessages(updated);
      } else if (data.type === 'delivered_receipt') {
        // Correct delivery receipt update without losing chat history
        const currentMsgs = useChatStore.getState().messages;
        const updated = currentMsgs.map(m => {
          if (m.receiver_id === data.receiver_id) {
            return { ...m, is_delivered: true };
          }
          return m;
        });
        setMessages(updated);
      } else if (data.type === 'message') {
        addMessage(data);
      } else if (['call_user', 'answer_call', 'ice_candidate', 'hangup'].includes(data.type)) {
        // Handle Call events
        if (data.type === 'call_user') {
          setCallState('incoming');
          setCallPartner({ id: data.sender_id, username: 'User ' + data.sender_id, is_guest: false });
          setIncomingOffer(data.offer);
        } else {
          // Dispatch custom event to let ChatDashboard component WebRTC layer handle it
          const event = new CustomEvent('webrtc_event', { detail: data });
          window.dispatchEvent(event);
        }
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed. Reconnecting...');
    };

    return () => {
      ws.close();
    };
  }, [token]);

  const sendMessage = (receiverId: number, content: string, messageType: string = 'text', clientMsgId?: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        receiver_id: receiverId,
        content,
        message_type: messageType,
        client_msg_id: clientMsgId
      }));
    }
  };

  const sendTyping = (receiverId: number, isTyping: boolean) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'typing',
        receiver_id: receiverId,
        is_typing: isTyping
      }));
    }
  };

  const sendRead = (senderId: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'read',
        sender_id: senderId
      }));
    }
  };

  const sendCallOffer = (receiverId: number, offer: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'call_user',
        receiver_id: receiverId,
        offer
      }));
    }
  };

  const sendCallAnswer = (receiverId: number, answer: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'answer_call',
        receiver_id: receiverId,
        answer
      }));
    }
  };

  const sendIceCandidate = (receiverId: number, candidate: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'ice_candidate',
        receiver_id: receiverId,
        candidate
      }));
    }
  };

  const sendHangup = (receiverId: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'hangup',
        receiver_id: receiverId
      }));
    }
  };

  return {
    sendMessage,
    sendTyping,
    sendRead,
    sendCallOffer,
    sendCallAnswer,
    sendIceCandidate,
    sendHangup
  };
};
export default useWebSocket;
