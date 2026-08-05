import { create } from "zustand";

export interface Message {
  id?: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  message_type: "text" | "image" | "video" | "audio";
  client_msg_id?: string;
  is_delivered?: boolean;
  is_read?: boolean;
  timestamp?: string;
}

export function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

interface ChatState {
  token: string | null;
  currentUser: { id: number; username: string } | null;
  selectedUser: { id: number; username: string } | null;
  messages: Message[];
  onlineUsers: number[];
  typingUsers: { [userId: number]: boolean };
  setToken: (token: string | null) => void;
  setCurrentUser: (user: any) => void;
  setSelectedUser: (user: any) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (msg: Message) => void;
  setOnlineUsers: (users: number[]) => void;
  addUserPresence: (userId: number) => void;
  removeUserPresence: (userId: number) => void;
  setUserTyping: (userId: number, isTyping: boolean) => void;
  markMessagesAsRead: (senderId: number, receiverId: number) => void;
  markMessagesAsDelivered: (receiverId: number) => void;
  logout: () => void;
}

const initialToken = localStorage.getItem("chat_token");
const initialUser = initialToken ? (() => {
  const payload = parseJwt(initialToken);
  return payload ? { id: payload.user_id, username: payload.sub } : null;
})() : null;

export const useChatStore = create<ChatState>((set) => ({
  token: initialToken,
  currentUser: initialUser,
  selectedUser: null,
  messages: [],
  onlineUsers: [],
  typingUsers: {},
  setToken: (token) => {
    if (token) {
      localStorage.setItem("chat_token", token);
      const payload = parseJwt(token);
      const user = payload ? { id: payload.user_id, username: payload.sub } : null;
      set({ token, currentUser: user });
    } else {
      localStorage.removeItem("chat_token");
      set({ token, currentUser: null, messages: [], selectedUser: null, onlineUsers: [], typingUsers: {} });
    }
  },
  setCurrentUser: (user) => set({ currentUser: user }),
  setSelectedUser: (user) => set({ selectedUser: user, messages: [] }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((state) => {
    // Prevent duplicates by client_msg_id if present
    if (msg.client_msg_id && state.messages.some(m => m.client_msg_id === msg.client_msg_id)) {
      return {
        messages: state.messages.map(m => m.client_msg_id === msg.client_msg_id ? { ...m, id: msg.id, is_delivered: msg.is_delivered, is_read: msg.is_read } : m)
      };
    }
    // Prevent duplicates by server id if present
    if (msg.id && state.messages.some(m => m.id === msg.id)) {
      return state;
    }
    return { messages: [...state.messages, msg] };
  }),
  setOnlineUsers: (users) => set({ onlineUsers: users }),
  addUserPresence: (userId) => set((state) => {
    if (state.onlineUsers.includes(userId)) return state;
    return { onlineUsers: [...state.onlineUsers, userId] };
  }),
  removeUserPresence: (userId) => set((state) => ({
    onlineUsers: state.onlineUsers.filter(id => id !== userId)
  })),
  setUserTyping: (userId, isTyping) => set((state) => ({
    typingUsers: { ...state.typingUsers, [userId]: isTyping }
  })),
  markMessagesAsRead: (senderId, receiverId) => set((state) => ({
    messages: state.messages.map(m =>
      (m.sender_id === senderId && m.receiver_id === receiverId) ? { ...m, is_read: true, is_delivered: true } : m
    )
  })),
  markMessagesAsDelivered: (receiverId) => set((state) => ({
    messages: state.messages.map(m =>
      (m.receiver_id === receiverId) ? { ...m, is_delivered: true } : m
    )
  })),
  logout: () => {
    localStorage.removeItem("chat_token");
    set({ token: null, currentUser: null, selectedUser: null, messages: [], onlineUsers: [], typingUsers: {} });
  },
}));
