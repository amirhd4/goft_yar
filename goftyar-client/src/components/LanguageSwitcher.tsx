import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLng = i18n.language === "fa" ? "en" : "fa";
    i18n.changeLanguage(nextLng);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-all shadow-sm"
      title={i18n.language === "fa" ? "English" : "پارسی"}
    >
      <Languages size={16} />
      <span>{i18n.language === "fa" ? "English" : "پارسی"}</span>
    </button>
  );
};

export default LanguageSwitcher;