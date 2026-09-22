import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  is_guest: boolean;
  workspace_id?: number | null;
}

interface Message {
  id?: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  message_type: string;
  client_msg_id?: string | null;
  is_delivered: boolean;
  is_read: boolean;
  timestamp: string;
}

interface ChatState {
  token: string | null;
  currentUser: User | null;
  selectedUser: User | null;
  messages: Message[];
  onlineUsers: number[];
  typingUsers: Record<number, boolean>;
  rateLimitError: string | null;
  
  // WebRTC Calling State
  callState: 'idle' | 'calling' | 'incoming' | 'connected';
  callPartner: User | null;
  incomingOffer: any | null;

  setToken: (token: string | null) => void;
  setCurrentUser: (user: User | null) => void;
  setSelectedUser: (user: User | null) => void;
  setMessages: (messages: Message[]) => void;
  prependMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setRateLimitError: (error: string | null) => void;
  setOnlineUsers: (users: number[]) => void;
  setTypingUser: (userId: number, isTyping: boolean) => void;
  logout: () => void;

  // WebRTC actions
  setCallState: (state: 'idle' | 'calling' | 'incoming' | 'connected') => void;
  setCallPartner: (partner: User | null) => void;
  setIncomingOffer: (offer: any | null) => void;
  resetCall: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  token: localStorage.getItem('token'),
  currentUser: JSON.parse(localStorage.getItem('currentUser') || 'null'),
  selectedUser: null,
  messages: [],
  onlineUsers: [],
  typingUsers: {},
  
  callState: 'idle',
  callPartner: null,
  incomingOffer: null,

  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ token });
  },

  setCurrentUser: (user) => {
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
    set({ currentUser: user });
  },

  setSelectedUser: (user) => set({ selectedUser: user }),
  
  setMessages: (messages) => set({ messages }),

  prependMessages: (olderMessages) => set((state) => {
    // Filter out messages that already exist by id or client_msg_id
    const existingIds = new Set(state.messages.map(m => m.id).filter(Boolean));
    const filteredOlder = olderMessages.filter(m => !m.id || !existingIds.has(m.id));
    return { messages: [...filteredOlder, ...state.messages] };
  }),
  
  addMessage: (message) => set((state) => {
    // Prevent duplicate messages by checking client_msg_id or ID
    const exists = state.messages.some(
      (m) => (m.client_msg_id && m.client_msg_id === message.client_msg_id) || (m.id && m.id === message.id)
    );
    if (exists) {
      // Update receipt fields if they changed
      return {
        messages: state.messages.map((m) => {
          if ((m.client_msg_id && m.client_msg_id === message.client_msg_id) || (m.id && m.id === message.id)) {
            return { ...m, is_delivered: message.is_delivered, is_read: message.is_read };
          }
          return m;
        })
      };
    }
    return { messages: [...state.messages, message] };
  }),

  rateLimitError: null,
  setRateLimitError: (error) => set({ rateLimitError: error }),
  setOnlineUsers: (users) => set({ onlineUsers: users }),

  setTypingUser: (userId, isTyping) => set((state) => ({
    typingUsers: { ...state.typingUsers, [userId]: isTyping }
  })),

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    set({ token: null, currentUser: null, selectedUser: null, messages: [], onlineUsers: [] });
  },

  setCallState: (callState) => set({ callState }),
  setCallPartner: (callPartner) => set({ callPartner }),
  setIncomingOffer: (incomingOffer) => set({ incomingOffer }),
  resetCall: () => set({ callState: 'idle', callPartner: null, incomingOffer: null })
}));
