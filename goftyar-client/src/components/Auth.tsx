import { useTranslation } from "react-i18next";
import { useChatStore } from "../store/useChatStore.ts";
import { useState } from "react";
import axios from "axios";

// Dynamic base URL detection for flexible local and production development
const getApiBaseUrl = () => {
    return window.location.protocol + "//" + window.location.hostname + (window.location.port ? ":" + window.location.port : "");
};

const API_BASE_URL = getApiBaseUrl();

const Auth = () => {
    const { t } = useTranslation();
    const { setToken, setCurrentUser } = useChatStore();

    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage("");
        setError("");

        if (!username || !password) return;

        try {
            if (isLogin) {
                const formData = new URLSearchParams();
                formData.append("username", username);
                formData.append("password", password);

                const response = await axios.post(`${API_BASE_URL}/api/auth/login`, formData, {
                    headers: { "Content-Type": "application/x-www-form-urlencoded" }
                });

                const token = response.data.access_token;
                setToken(token);

                // Fetch current user info
                const userRes = await axios.get(`${API_BASE_URL}/api/auth/users`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const user = userRes.data.find((u: any) => u.username === username);
                if (user) {
                    setCurrentUser(user);
                } else {
                    // Fallback
                    setCurrentUser({ id: 0, username, is_guest: false });
                }

            } else {
                await axios.post(`${API_BASE_URL}/api/auth/register`, { username, password });
                setMessage(t("register_success"));
                setIsLogin(true);
                setPassword("");
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || t("error_occurred"));
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-md border border-gray-100">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        {isLogin ? t("login") : t("register")}
                    </h2>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm space-y-4">
                        <div>
                            <label className="text-sm font-semibold text-gray-700 block mb-1">
                                {t("username")}
                            </label>
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="appearance-none rounded-xl relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-700 block mb-1">
                                {t("password")}
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none rounded-xl relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                            />
                        </div>
                    </div>

                    {message && (
                        <div className="text-green-600 text-sm font-medium text-center bg-green-50 p-2 rounded-lg">
                            {message}
                        </div>
                    )}

                    {error && (
                        <div className="text-red-600 text-sm font-medium text-center bg-red-50 p-2 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition shadow-md"
                        >
                            {isLogin ? t("login") : t("register")}
                        </button>
                    </div>

                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError("");
                                setMessage("");
                            }}
                            className="text-sm font-medium text-blue-600 hover:text-blue-500"
                        >
                            {isLogin ? t("no_account") : t("has_account")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Auth;
