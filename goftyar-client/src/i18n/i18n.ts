import {initReactI18next} from "react-i18next";
import i18n from "i18next";

const resources = {
  en: {
    translation: {
      "login": "Login",
      "register": "Register",
      "username": "Username",
      "password": "Password",
      "chat": "Chat",
      "type_message": "Type your message...",
      "send": "Send",
      "select_user": "Select a user to start chatting",
      "logged_in_as": "Logged in as",
      "logout": "Logout",
      "online": "Online",
      "offline": "Offline",
      "typing": "typing...",
      "is_typing": "is typing...",
      "image": "Image",
      "video": "Video",
      "audio": "Audio",
      "upload_file": "Upload file",
      "record_voice": "Record audio",
      "no_account": "Don't have an account? Register",
      "has_account": "Already have an account? Login",
      "register_success": "Registration successful. Please login.",
      "error_occurred": "An error occurred!",
      "read_receipt": "Read",
      "delivered_receipt": "Delivered",
      "sent_receipt": "Sent",
      "widget": "Widget",
      "goftyar": "Goftyar",
      "select_language": "Select Language"
    }
  },
  fa: {
    translation: {
      "login": "ورود",
      "register": "ثبت نام",
      "username": "نام کاربری",
      "password": "رمز عبور",
      "chat": "گفتگو",
      "type_message": "پیام خود را بنویسید...",
      "send": "ارسال",
      "select_user": "یک گفتگو را برای شروع انتخاب کنید",
      "logged_in_as": "وارد شده به عنوان",
      "logout": "خروج",
      "online": "برخط",
      "offline": "پشت خط",
      "typing": "در حال تایپ...",
      "is_typing": "(در حال تایپ...)",
      "image": "نگاره پویا",
      "video": "ویدیو",
      "audio": "سدا",
      "upload_file": "فرستادن پرونده",
      "record_voice": "سدا برداری",
      "no_account": "حساب کاربری ندارید؟ ثبت نام کنید",
      "has_account": "حساب دارید؟ وارد شوید",
      "register_success": "ثبت نام موفقیت آمیز بود. اکنون وارد شوید.",
      "error_occurred": "خطایی رخ داد!",
      "read_receipt": "خوانده شده",
      "delivered_receipt": "رسیده به کاربر",
      "sent_receipt": "ارسال شده",
      "widget": "ویجت",
      "goftyar": "گفت‌یار",
      "select_language": "انتخاب زبان"
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