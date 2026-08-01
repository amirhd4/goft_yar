import {initReactI18next} from "react-i18next";
import i18n from "i18next";

const resources = {
  en: {
    translation: {
      "login": "Login",
      "username": "Username",
      "password": "Password",
      "chat": "Chat",
      "type_message": "Type your Message...",
      "send": "Send",
      "select_user": "Select a user to start chatting"
    }
  },
  fa: {
    translation: {
      "login": "ورود / ثبت نام",
      "username": "نام کاربری",
      "password": "رمز عبور",
      "chat": "گفت و گو",
      "type_message": "پیام خود را بنویسید",
      "send": "Send",
      "select_user": "Select a user to start chatting"
    }
  }
}

i18n.use(initReactI18next).init({
  resources: resources,
  lng: 'fa',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
})

i18n.on("languageChanged", (lng: string) => {
  document.documentElement.dir = lng === "fa" ? "rtl" : "ltr";
  document.documentElement.lang = lng;
});

export default i18n;