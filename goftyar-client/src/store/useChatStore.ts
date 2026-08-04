import { create } from "zustand";

interface Message {
  id?: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  message_type: "text" | "image" | "video" | "audio";
  timestamp?: string;
}

interface ChatState {
  token: string | null;
  currentUser: { id: number; username: string } | null;
  selectedUser: { id: number; username: string } | null;
  messages: Message[];
  setToken: (token: string | null) => void
  setCurrentUser: (user: any) => void;
  setSelectedUser: (user: any) => void
  setMessages: (messages: Message[]) => void;
  addMessage: (msg: Message) => void;
  logout: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  token: localStorage.getItem("chat_token"),
  currentUser: null,
  selectedUser: null,
  messages: [],
  setToken: (token) => {
    if (token) localStorage.setItem("chat_token", token);
    else localStorage.removeItem("chat_token")
    set({ token });
  },
  setCurrentUser: (user) => set({ currentUser: user }),
  setSelectedUser: (user) => set({ selectedUser: user, messages: [] }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  logout: () => set({ token: null, currentUser: null, selectedUser: null, messages: [] }),
}));
