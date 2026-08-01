import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next";
import {useChatStore} from "../store/useChatStore.ts";
import {useWebSocket} from "../hooks/useWebSocket.ts";
import axios from "axios";

const ChatDashboard = () => {
    const { t } = useTranslation();
    const { token, selectedUser, setSelectedUser, messages, setMessages } = useChatStore();
    const { sendMessage } = useWebSocket();
    const [users, setUsers] = useState<any[]>([]);
    const [input, setInput] = useState("");

    useEffect(() => {
      axios.get("http://localhost:8000/api/auth/users").then(res=> setUsers(res.data));
    }, []);

    useEffect(() => {
      if (selectedUser && token) {
        axios.get(`http://localhost:8000/api/messages/${selectedUser.id}`, {
          params: { current_user_id: 1 }
        }).then(res => setMessages(res.data));
      }
    }, [selectedUser]);

    const handleSend = () => {
        if (input.trim() && selectedUser) {
          sendMessage(selectedUser.id, input);
          setInput('');
        }
    };

    return (
        <div className="flex h-screen bg-gray-100">
          <div className="w-1/3 bg-white border-r/l border-gray-200 p-4 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{t('chat')}</h2>
              {users.map(u => (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUser(u.id)}>
                      {u.username}
                  </div>
              ))}
          </div>

          <div className="w-2/3 flex flex-col">
              {selectedUser ? (
                <>
                  <div className="bg-white p-4 shadow-sm border-b">
                      <h3 className="text-lg font-semibold">{selectedUser.username}</h3>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                    {messages.map((msg, idx) => (
                      <div key={idx} className={`mb-4 flex ${msg.receiver_id === selectedUser.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-3 rounded-lg max-w-xs ${msg.receiver_id === selectedUser.id ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800" }`}>
                            {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                    <input
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyPress={e => e.key === "Enter" && handleSend()}
                      placeholder={t('type_message')}
                      className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={handleSend} className="bg-blue-500 text-white px-6 py-2 rounded-lg">
                      {t('send')}
                    </button>
                  </div>
                </>
              ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    {t('select_user')}
                  </div>
                )
              };
          </div>
        </div>
    );
};

export default ChatDashboard;