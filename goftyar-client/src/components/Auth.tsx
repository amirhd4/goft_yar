import { useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../store/useChatStore";
import LanguageSwitcher from "./LanguageSwitcher";
import * as React from "react";

const Auth = () => {
  const { t, i18n } = useTranslation();
  const setToken = useChatStore((state) => state.setToken);

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const isRtl = i18n.language === "fa";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        const formData = new URLSearchParams();
        formData.append("username", username);
        formData.append("password", password);

        const res = await axios.post("http://localhost:8000/api/auth/login", formData, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        setToken(res.data.access_token);
      } else {
        await axios.post("http://localhost:8000/api/auth/register", { username, password });
        setIsLogin(true);
        setError(t("register_success"));
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.response?.data?.detial || t("error_occurred");
      setError(errMsg);
    }
  };

  return (
    <div className="relative flex items-center justify-center h-screen bg-gray-100" dir={isRtl ? "rtl" : "ltr"}>
      <div className={`absolute top-4 ${isRtl ? "left-4" : "right-4"}`}>
        <LanguageSwitcher />
      </div>

      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">
          {isLogin ? t("login") : t("register")}
        </h2>
        {error && <div className="mb-4 text-red-500 text-sm text-center">{error}</div>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder={t("username") || "Username"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            required
          />
          <input
            type="password"
            placeholder={t("password") || "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            required
          />
          <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition text-sm font-semibold">
            {isLogin ? t("login") : t("register")}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-600 cursor-pointer hover:underline" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? t("no_account") : t("has_account")}
        </p>
      </div>
    </div>
  );
};

export default Auth;
