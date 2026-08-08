import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../store/useChatStore.ts";
import { useWebSocket } from "../hooks/useWebSocket.ts";
import axios from "axios";
import { Paperclip, Mic, Send, LogOut } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";


const ChatDashboard = () => {
    const { t, i18n } = useTranslation();
    const {
        token,
        currentUser,
        selectedUser,
        setSelectedUser,
        messages,
        setMessages,
        onlineUsers,
        typingUsers,
        logout
    } = useChatStore();

    const { sendMessage, sendTyping, sendRead } = useWebSocket();
    const [users, setUsers] = useState<any[]>([]);
    const [input, setInput] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const isRtl = i18n.language === "fa";

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Fetch initial users list
    useEffect(() => {
        axios.get("http://localhost:8000/api/auth/users").then(res => {
            // Filter out current user from the list
            const currentUserId = currentUser?.id;
            const filteredUsers = res.data.filter((u: any) => u.id !== currentUserId);
            setUsers(filteredUsers);
        }).catch(err => console.error("Error fetching users:", err));
    }, [currentUser]);

    // Fetch chat history with dynamic current_user_id
    useEffect(() => {
        if (selectedUser && token && currentUser) {
            axios.get(`http://localhost:8000/api/messages/${selectedUser.id}`, {
                params: { current_user_id: currentUser.id }
            }).then(res => {
                setMessages(res.data);
                // Mark messages as read on client & notify server
                sendRead(selectedUser.id);
            }).catch(err => console.error("Error fetching messages:", err));
        }
    }, [selectedUser, currentUser]);

    // Mark incoming messages as read
    useEffect(() => {
        if (selectedUser && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.sender_id === selectedUser.id && !lastMessage.is_read) {
                sendRead(selectedUser.id);
            }
        }
    }, [messages, selectedUser]);

    const handleInputChange = (val: string) => {
        setInput(val);
        if (selectedUser) {
            sendTyping(selectedUser.id, true);

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                sendTyping(selectedUser.id, false);
            }, 1500);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedUser) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await axios.post("http://localhost:8000/api/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            const fileUrl = res.data.file_url;
            const fileType = res.data.type;

            let msgType: "text" | "image" | "video" | "audio" = "text";
            if (fileType.startsWith("image/")) msgType = "image";
            else if (fileType.startsWith("video/")) msgType = "video";
            else if (fileType.startsWith("audio/")) msgType = "audio";

            const clientMsgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            sendMessage(selectedUser.id, fileUrl, msgType, clientMsgId);
        } catch (err) {
            console.error("Error uploading file", err);
        }
    };

    const renderMessageContent = (msg: any) => {
        switch (msg.message_type) {
            case "image":
                return <img src={`http://localhost:8000${msg.content}`} alt={t("image") || "تصویر"} className="max-w-xs rounded-lg shadow-sm" />;
            case "video":
                return <video src={`http://localhost:8000${msg.content}`} controls className="max-w-xs rounded-lg shadow-sm" />;
            case "audio":
                return <audio src={`http://localhost:8000${msg.content}`} controls className="w-64" />;
            default:
                return <span className="text-[15px] leading-relaxed break-words">{msg.content}</span>;
        }
    };

    const renderTicks = (msg: any) => {
        if (msg.sender_id !== currentUser?.id) return null;

        const spaceClass = isRtl ? "mr-1" : "ml-1";

        if (msg.is_read) {
            return <span className={`text-blue-500 font-bold ${spaceClass} text-xs`} title={t("read_receipt") || "خوانده شده"}>✓✓</span>;
        } else if (msg.is_delivered) {
            return <span className={`text-gray-400 font-bold ${spaceClass} text-xs`} title={t("delivered_receipt") || "رسیده به کاربر"}>✓✓</span>;
        } else {
            return <span className={`text-gray-300 font-bold ${spaceClass} text-xs`} title={t("sent_receipt") || "ارسال شده"}>✓</span>;
        }
    };

    const handleSend = () => {
        if (input.trim() && selectedUser) {
            const clientMsgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            sendMessage(selectedUser.id, input, "text", clientMsgId);
            setInput("");
            sendTyping(selectedUser.id, false);
        }
    };

    const isUserOnline = (userId: number) => {
        return onlineUsers.includes(userId);
    };

    const getMessageDir = (content: string) => {
        const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u0FB50-\uFD3F\uFE70-\uFEFC]/;
        return rtlChars.test(content) ? "rtl" : "ltr";
    };

    return (
        <div className="flex h-screen bg-gray-100" dir={isRtl ? "rtl" : "ltr"}>
            <div className={`w-1/3 bg-white ${isRtl ? "border-l" : "border-r"} border-gray-200 flex flex-col p-4 overflow-hidden shadow-sm`}>
                <div className="flex items-center justify-between mb-6 pb-2 border-b gap-2">
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold text-gray-800">{t('chat')}</h2>
                        {currentUser && (
                            <span className="text-xs text-green-600 font-medium block truncate">
                                {t('logged_in_as') || 'کاربر'}: <span className="font-bold">{currentUser.username}</span>
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <LanguageSwitcher />
                        <button
                            onClick={() => logout()}
                            className="text-gray-500 hover:text-red-500 transition-colors p-1.5 rounded-full hover:bg-gray-100"
                            title={t('logout') || 'خروج'}
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {users.map(u => {
                        const online = isUserOnline(u.id);
                        const typing = typingUsers[u.id];
                        return (
                            <div
                                key={u.id}
                                onClick={() => setSelectedUser(u)}
                                className={`p-3.5 rounded-xl cursor-pointer transition-all duration-200 flex items-center justify-between ${
                                    selectedUser?.id === u.id
                                        ? 'bg-blue-600 text-white shadow-md transform scale-[1.01]'
                                        : 'bg-gray-50 hover:bg-gray-150 text-gray-700'
                                }`}
                            >
                                <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-[15px] truncate">{u.username}</span>
                                    {typing ? (
                                        <span className={`text-xs mt-0.5 animate-pulse truncate ${selectedUser?.id === u.id ? 'text-blue-100' : 'text-blue-500 font-medium'}`}>
                                            {t('typing')}
                                        </span>
                                    ) : null}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {online ? (
                                        <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-sm animate-pulse" title={t('online') || 'آنلاین'} />
                                    ) : (
                                        <span className="h-2.5 w-2.5 rounded-full bg-gray-300" title={t('offline') || 'آفلاین'} />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Chat Area */}
            <div className="w-2/3 flex flex-col h-full bg-gray-50">
                {selectedUser ? (
                    <>
                        {/* Chat Header */}
                        <div className="bg-white p-4 shadow-sm border-b flex items-center justify-between">
                            <div className="flex flex-col">
                                <h3 className="text-lg font-bold text-gray-800">{selectedUser.username}</h3>
                                <span className="text-xs text-gray-500 mt-0.5">
                                    {isUserOnline(selectedUser.id) ? (
                                        <span className="text-green-600 font-medium">{t('online')}</span>
                                    ) : (
                                        <span>{t('offline')}</span>
                                    )}
                                    {typingUsers[selectedUser.id] && (
                                        <span className="text-blue-500 font-semibold mx-1 animate-pulse">
                                            {t('is_typing')}
                                        </span>
                                    )}
                                </span>
                            </div>
                        </div>

                        {/* Messages List */}
                        <div className="flex-1 p-5 overflow-y-auto bg-gray-50 bg-[url('pattern.png')] space-y-4">
                            {messages.map((msg, idx) => {
                                const isMe = msg.sender_id === currentUser?.id;
                                const contentDir = msg.message_type === "text" ? getMessageDir(msg.content) : (isRtl ? "rtl" : "ltr");
                                return (
                                    <div
                                        key={idx}
                                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            dir={contentDir}
                                            className={`p-3 max-w-[70%] rounded-2xl shadow-sm relative transition-all duration-300 ${
                                                isMe
                                                    ? `bg-blue-600 text-white ${isRtl ? 'rounded-tl-none' : 'rounded-tr-none'}`
                                                    : `bg-white text-gray-800 ${isRtl ? 'rounded-tr-none' : 'rounded-tl-none'} border border-gray-100`
                                            }`}
                                        >
                                            <div className="pb-1 text-right-align">
                                                {renderMessageContent(msg)}
                                            </div>

                                            <div className={`flex items-center justify-end gap-1 mt-1.5 text-[10px] ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                                                <span>
                                                    {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit"
                                                    })}
                                                </span>
                                                {renderTicks(msg)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t flex items-center gap-3 shadow-md">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="text-gray-500 hover:text-blue-600 transition p-2 rounded-full hover:bg-gray-50"
                                title={t('upload_file') || "ارسال فایل"}
                            >
                                <Paperclip size={22} />
                                <input
                                    type="file"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept="image/*,video/*,audio/*"
                                />
                            </button>

                            <input
                                type="text"
                                value={input}
                                onChange={e => handleInputChange(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && handleSend()}
                                placeholder={t("type_message") || "پیام خود را بنویسید..."}
                                className="flex-1 border-none bg-gray-100 rounded-full px-6 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-[15px]"
                            />

                            {input.trim() ? (
                                <button
                                    onClick={handleSend}
                                    className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition shadow-md flex-shrink-0"
                                >
                                    <Send size={18} className={isRtl ? "" : "transform rotate-180"} />
                                </button>
                            ) : (
                                <button
                                    className="bg-gray-100 text-gray-500 p-3 rounded-full hover:bg-gray-200 transition flex-shrink-0"
                                    title={t('record_voice') || "ضبط صدا"}
                                >
                                    <Mic size={18} />
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 select-none">
                        <span className="text-lg font-medium">{t('select_user')}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatDashboard;
