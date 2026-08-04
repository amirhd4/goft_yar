import {useEffect, useRef, useState} from "react"
import { useTranslation } from "react-i18next";
import {useChatStore} from "../store/useChatStore.ts";
import {useWebSocket} from "../hooks/useWebSocket.ts";
import axios from "axios";
import { Paperclip, Mic, Send } from "lucide-react";


const ChatDashboard = () => {
    const { t } = useTranslation();
    const { token, selectedUser, setSelectedUser, messages, setMessages } = useChatStore();
    const { sendMessage } = useWebSocket();
    const [users, setUsers] = useState<any[]>([]);
    const [input, setInput] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedUser) return;

      const formData = new FormData();
      formData.append("file", file)

      try {
        const res = await axios.post("http://localhost:8000/api/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });

        const fileUrl = res.data.file_url;
        const fileType = res.data.type

          let msgType = "text"
          if (fileType.startsWith("image/")) msgType = "image"
          else if (fileType.startsWith("video/")) msgType = "video"
          else if (fileType.startsWith("audio/")) msgType = "audio"

          sendMessage(selectedUser.id, fileUrl, msgType);
      } catch (err) {
          console.log("خطا در آپلود فایل", err)
      }
    };

    const renderMessageContent = (msg: any)  => {
      switch (msg.message_type) {
        case "image":
          return <img src={`http://localhost:8000${msg.content}`} alt="تصویر" className="max-w-xs rounded-lg" />;
        case "video":
          return <video src={`http://localhost:8000${msg.content}`} controls className="max-w-xs rounded-lg" />;
        case "audio":
          return <audio src={`http://localhost:8000${msg.content}`} controls className="w-64" />;
        default:
          return <span>{msg.content}</span>;
      }
    };

    useEffect(() => {
      axios.get("http://localhost:8000/api/auth/users").then(res=> setUsers(res.data))
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
        sendMessage(selectedUser.id, input, null);
        setInput("");
      }
    }

    return (
        <div className="flex h-screen bg-gray-100">
          <div className="w-1/3 bg-white border-r/l border-gray-200 p-4 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{t('chat')}</h2>
              {users.map(u => (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className={`p-3 mb-2 rounded cursor-pointer ${selectedUser?.id === u.id ? 'bg-blue-500 text-white' : 'bg-gray-50 hover:bg-gray-200'}`}
                  >
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

                  <div className="flex-1 p-4 overflow-y-auto bg-gray-50 bg-[url('pattern.png')]">
                    {messages.map((msg, idx) => (
                      <div key={idx} className={`mb-4 flex ${msg.receiver_id === selectedUser.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-3 rounded-xl shadow-sm ${msg.receiver_id === selectedUser.id ? "bg-blue-100 rounded-br-none" : "bg-white rounded-bl-none" }`}>
                          {renderMessageContent(msg)}
                          <span className="text-xs text-gray-400 mt-1 block text-right">
                            {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-white border-t flex items-center gap-3">

                    <button onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-blue-500 transition">
                      <Paperclip size={25} />
                      <input
                        type="file"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/*,video/*,audio/*"
                      />
                    </button>

                    <input type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleSend()}
                      placeholder={t("type_message")}
                      className="flex-1 border-none bg-gray-100 rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />

                    {input.trim() ? (
                      <button onClick={handleSend} className="bg-blue-500 text-white p-3 rounded-full hover:bg-blue-600">
                        <Send size={20} />
                      </button>
                    ) : (
                      <button className="bg-gray-200 text-gray-600 p-3 rounded-full hover:bg-gray-300">
                        <Mic size={20} />
                      </button>
                    )}
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