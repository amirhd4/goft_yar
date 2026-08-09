import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../store/useChatStore.ts";
import { useWebSocket } from "../hooks/useWebSocket.ts";
import axios from "axios";
import { Paperclip, Mic, Send, LogOut, Video, Phone, PhoneOff, Copy, Check } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";

const iceConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
    ]
};

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
        logout,
        // WebRTC call state
        callState,
        callPartner,
        incomingOffer,
        setCallState,
        setCallPartner,
        resetCall
    } = useChatStore();

    const {
        sendMessage,
        sendTyping,
        sendRead,
        sendCallOffer,
        sendCallAnswer,
        sendIceCandidate,
        sendHangup
    } = useWebSocket();

    const [users, setUsers] = useState<any[]>([]);
    const [input, setInput] = useState("");

    // Workspace state
    const [workspace, setWorkspace] = useState<any>(null);
    const [wsNameInput, setWsNameInput] = useState("");
    const [copiedScript, setCopiedScript] = useState(false);

    // WebRTC connection refs
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

    // WebRTC control states
    const [micEnabled, setMicEnabled] = useState(true);
    const [cameraEnabled, setCameraEnabled] = useState(true);

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

    // Fetch workspace details
    const fetchWorkspace = () => {
        if (token) {
            axios.get("http://localhost:8000/api/auth/workspaces/my", {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
                setWorkspace(res.data);
            }).catch(err => console.error("Error fetching workspace:", err));
        }
    };

    // Fetch initial users list
    const fetchUsers = () => {
        if (token) {
            axios.get("http://localhost:8000/api/auth/users", {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
                const currentUserId = currentUser?.id;
                const filteredUsers = res.data.filter((u: any) => u.id !== currentUserId);
                setUsers(filteredUsers);
            }).catch(err => console.error("Error fetching users:", err));
        }
    };

    useEffect(() => {
        if (token) {
            fetchWorkspace();
            fetchUsers();
        }
    }, [currentUser, token]);

    // Fetch chat history
    useEffect(() => {
        if (selectedUser && token && currentUser) {
            axios.get(`http://localhost:8000/api/messages/${selectedUser.id}`, {
                params: { current_user_id: currentUser.id }
            }).then(res => {
                setMessages(res.data);
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

    // Create a new Workspace
    const handleCreateWorkspace = () => {
        if (!wsNameInput.trim() || !token) return;
        axios.post("http://localhost:8000/api/auth/workspaces", {
            name: wsNameInput
        }, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
            setWorkspace(res.data);
            setWsNameInput("");
            fetchUsers(); // Refresh users to get workspace guests
        }).catch(err => console.error("Error creating workspace:", err));
    };

    const handleCopyScript = () => {
        if (!workspace) return;
        const scriptText = `<script src="http://localhost:8000/static/widget.js" data-api-key="${workspace.api_key}"></script>`;
        navigator.clipboard.writeText(scriptText);
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2000);
    };

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


    // ==========================================
    // ========== WebRTC CALLING LOGIC ==========
    // ==========================================

    // Listen to incoming WebRTC events
    useEffect(() => {
        const handleWebRTCEvent = async (e: Event) => {
            const data = (e as CustomEvent).detail;

            if (data.type === "answer_call") {
                if (peerConnectionRef.current) {
                    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                    setCallState("connected");
                }
            } else if (data.type === "ice_candidate") {
                if (peerConnectionRef.current) {
                    try {
                        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                    } catch (err) {
                        console.error("Error adding ice candidate:", err);
                    }
                }
            } else if (data.type === "hangup") {
                cleanupCallState();
            }
        };

        window.addEventListener("webrtc_event", handleWebRTCEvent);
        return () => window.removeEventListener("webrtc_event", handleWebRTCEvent);
    }, [callPartner, selectedUser]);

    // Setup streams when call becomes active
    useEffect(() => {
        if ((callState === "connected" || callState === "calling") && localStreamRef.current) {
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
            }
        }
    }, [callState]);

    const startCall = async () => {
        if (!selectedUser) return;

        setCallState("calling");
        setCallPartner(selectedUser);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            setMicEnabled(true);
            setCameraEnabled(true);

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            const pc = new RTCPeerConnection(iceConfiguration);
            peerConnectionRef.current = pc;

            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    sendIceCandidate(selectedUser.id, event.candidate);
                }
            };

            pc.ontrack = (event) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendCallOffer(selectedUser.id, offer);

        } catch (err) {
            console.error("Error accessing media devices:", err);
            cleanupCallState();
        }
    };

    const acceptCall = async () => {
        if (!callPartner || !incomingOffer) return;

        setCallState("connected");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            setMicEnabled(true);
            setCameraEnabled(true);

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            const pc = new RTCPeerConnection(iceConfiguration);
            peerConnectionRef.current = pc;

            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    sendIceCandidate(callPartner.id, event.candidate);
                }
            };

            pc.ontrack = (event) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            sendCallAnswer(callPartner.id, answer);

        } catch (err) {
            console.error("Error accepting video call:", err);
            cleanupCallState();
        }
    };

    const declineCall = () => {
        if (callPartner) {
            sendHangup(callPartner.id);
        }
        cleanupCallState();
    };

    const hangupActiveCall = () => {
        if (callPartner) {
            sendHangup(callPartner.id);
        }
        cleanupCallState();
    };

    const cleanupCallState = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

        resetCall();
    };

    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setMicEnabled(audioTrack.enabled);
            }
        }
    };

    const toggleCamera = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setCameraEnabled(videoTrack.enabled);
            }
        }
    };


    return (
        <div className="flex h-screen bg-gray-100" dir={isRtl ? "rtl" : "ltr"}>
            {/* Sidebar */}
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

                {/* Users List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
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
                                    <span className="font-semibold text-[15px] truncate">
                                        {u.username} {u.is_guest ? <span className="text-xs font-normal opacity-85">({t('widget')})</span> : ""}
                                    </span>
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

                {/* Workspace Settings Section (Senior Feature) */}
                <div className="border-t pt-4 bg-white mt-auto">
                    <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        {t('workspace_title')}
                    </h3>
                    {workspace ? (
                        <div className="bg-gray-50 p-3 rounded-xl space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-medium">{t('workspace_name')}:</span>
                                <span className="font-bold text-gray-800">{workspace.name}</span>
                            </div>
                            <div className="space-y-1">
                                <span className="text-gray-500 font-medium block">{t('workspace_key')}:</span>
                                <code className="block bg-gray-200 p-1.5 rounded text-[10px] break-all select-all font-mono text-blue-700">
                                    {workspace.api_key}
                                </code>
                            </div>
                            <div className="space-y-1 pt-1 border-t">
                                <span className="text-gray-500 font-medium block">{t('widget_script')}:</span>
                                <button
                                    onClick={handleCopyScript}
                                    className="w-full flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded transition shadow-sm"
                                >
                                    {copiedScript ? <Check size={14} /> : <Copy size={14} />}
                                    <span>{copiedScript ? t('copied') : t('copy_script')}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 p-3 rounded-xl space-y-2">
                            <input
                                type="text"
                                placeholder={t('workspace_name') || "نام فضای کاری"}
                                value={wsNameInput}
                                onChange={e => setWsNameInput(e.target.value)}
                                className="w-full bg-white border rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                            <button
                                onClick={handleCreateWorkspace}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded text-xs transition shadow-sm"
                            >
                                {t('create_workspace')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="w-2/3 flex flex-col h-full bg-gray-50 relative">
                {selectedUser ? (
                    <>
                        {/* Chat Header */}
                        <div className="bg-white p-4 shadow-sm border-b flex items-center justify-between">
                            <div className="flex flex-col">
                                <h3 className="text-lg font-bold text-gray-800">
                                    {selectedUser.username} {selectedUser.is_guest ? <span className="text-xs font-normal text-gray-500">({t('widget')})</span> : ""}
                                </h3>
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

                            {/* Start Voice/Video Call Action (Phase 4) */}
                            <button
                                onClick={startCall}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 p-2.5 rounded-full transition shadow-sm"
                                title={t('call_user') || 'شروع تماس تصویری'}
                            >
                                <Video size={20} />
                            </button>
                        </div>

                        {/* Messages List */}
                        <div className="flex-1 p-5 overflow-y-auto bg-gray-50 space-y-4">
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

                {/* ========================================== */}
                {/* ========== WebRTC calling overlay ======== */}
                {/* ========================================== */}
                {callState !== "idle" && (
                    <div className="absolute inset-0 bg-slate-900 z-50 flex flex-col items-center justify-between p-6">
                        {/* Status section */}
                        <div className="text-center mt-6">
                            <h2 className="text-white text-2xl font-bold mb-1">
                                {callPartner?.username || "User"}
                            </h2>
                            <span className="text-slate-400 text-sm italic">
                                {callState === "calling" && (t('calling') || "در حال تماس...")}
                                {callState === "incoming" && (t('incoming_call') || "تماس تصویری ورودی...")}
                                {callState === "connected" && (t('online') || "برخط")}
                            </span>
                        </div>

                        {/* Video display */}
                        <div className="relative w-full max-w-xl h-[450px] bg-black rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center border border-slate-800">
                            {/* Remote stream */}
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />
                            {/* Local stream in PIP */}
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="absolute bottom-4 right-4 w-32 h-44 object-cover rounded-xl border-2 border-white shadow-xl bg-slate-800"
                            />
                        </div>

                        {/* Controls bar */}
                        <div className="flex items-center gap-4 mb-4">
                            {/* Toggle Mic */}
                            {(callState === "connected" || callState === "calling") && (
                                <button
                                    onClick={toggleMic}
                                    className={`p-3.5 rounded-full transition-colors ${
                                        micEnabled ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"
                                    }`}
                                >
                                    <Mic size={20} />
                                </button>
                            )}

                            {/* Toggle Camera */}
                            {(callState === "connected" || callState === "calling") && (
                                <button
                                    onClick={toggleCamera}
                                    className={`p-3.5 rounded-full transition-colors ${
                                        cameraEnabled ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"
                                    }`}
                                >
                                    <Video size={20} />
                                </button>
                            )}

                            {/* Reject / Hang up button */}
                            {callState === "incoming" ? (
                                <>
                                    <button
                                        onClick={acceptCall}
                                        className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-full transition-colors shadow-lg"
                                        title={t('accept_call')}
                                    >
                                        <Phone size={24} />
                                    </button>
                                    <button
                                        onClick={declineCall}
                                        className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-full transition-colors shadow-lg"
                                        title={t('decline_call')}
                                    >
                                        <PhoneOff size={24} />
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={hangupActiveCall}
                                    className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-full transition-colors shadow-lg"
                                    title={t('end_call')}
                                >
                                    <PhoneOff size={24} />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatDashboard;
