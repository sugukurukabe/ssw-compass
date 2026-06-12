import type { SupportedLanguage } from "../i18n/supported-languages.js";

export const ERROR_KINDS = [
  "communication_failed",
  "timeout",
  "input_invalid",
  "expired",
  "retry_hint",
] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];
export type ErrorDictionaryKey = `error.${ErrorKind}`;

export const ERROR_DICTIONARY: Record<SupportedLanguage, Record<ErrorDictionaryKey, string>> = {
  ja: {
    "error.communication_failed": "通信に失敗しました。",
    "error.timeout": "処理がタイムアウトしました。",
    "error.input_invalid": "入力内容を確認してください。",
    "error.expired": "有効期限が切れました。もう一度実行してください。",
    "error.retry_hint": "同じ内容でもう一度試す",
  },
  en: {
    "error.communication_failed": "Communication failed.",
    "error.timeout": "The request timed out.",
    "error.input_invalid": "Please check the input.",
    "error.expired": "This request has expired. Please run it again.",
    "error.retry_hint": "Try again with the same input",
  },
  id: {
    "error.communication_failed": "Komunikasi gagal.",
    "error.timeout": "Permintaan melewati batas waktu.",
    "error.input_invalid": "Periksa kembali input.",
    "error.expired": "Permintaan ini kedaluwarsa. Jalankan lagi.",
    "error.retry_hint": "Coba lagi dengan input yang sama",
  },
  "zh-CN": {
    "error.communication_failed": "通信失败。",
    "error.timeout": "请求超时。",
    "error.input_invalid": "请检查输入内容。",
    "error.expired": "此请求已过期。请重新执行。",
    "error.retry_hint": "使用相同输入重试",
  },
  "zh-TW": {
    "error.communication_failed": "通訊失敗。",
    "error.timeout": "請求逾時。",
    "error.input_invalid": "請確認輸入內容。",
    "error.expired": "此請求已過期。請重新執行。",
    "error.retry_hint": "使用相同輸入重試",
  },
  vi: {
    "error.communication_failed": "Giao tiếp thất bại.",
    "error.timeout": "Yêu cầu đã hết thời gian chờ.",
    "error.input_invalid": "Vui lòng kiểm tra nội dung nhập.",
    "error.expired": "Yêu cầu này đã hết hạn. Vui lòng chạy lại.",
    "error.retry_hint": "Thử lại với cùng nội dung",
  },
  tl: {
    "error.communication_failed": "Nabigo ang komunikasyon.",
    "error.timeout": "Nag-timeout ang kahilingan.",
    "error.input_invalid": "Pakisuri ang inilagay.",
    "error.expired": "Nag-expire na ang kahilingang ito. Patakbuhin muli.",
    "error.retry_hint": "Subukan muli gamit ang parehong input",
  },
  th: {
    "error.communication_failed": "การสื่อสารล้มเหลว",
    "error.timeout": "คำขอหมดเวลา",
    "error.input_invalid": "โปรดตรวจสอบข้อมูลที่ป้อน",
    "error.expired": "คำขอนี้หมดอายุแล้ว โปรดลองอีกครั้ง",
    "error.retry_hint": "ลองอีกครั้งด้วยข้อมูลเดิม",
  },
  km: {
    "error.communication_failed": "ការទំនាក់ទំនងបរាជ័យ។",
    "error.timeout": "សំណើបានអស់ពេល។",
    "error.input_invalid": "សូមពិនិត្យទិន្នន័យដែលបានបញ្ចូល។",
    "error.expired": "សំណើនេះផុតកំណត់ហើយ។ សូមដំណើរការម្តងទៀត។",
    "error.retry_hint": "សាកល្បងម្តងទៀតជាមួយទិន្នន័យដដែល",
  },
  my: {
    "error.communication_failed": "ဆက်သွယ်မှု မအောင်မြင်ပါ။",
    "error.timeout": "တောင်းဆိုမှု အချိန်ကုန်ဆုံးသွားပါပြီ။",
    "error.input_invalid": "ထည့်သွင်းချက်ကို စစ်ဆေးပါ။",
    "error.expired": "ဤတောင်းဆိုမှုသည် သက်တမ်းကုန်ဆုံးသွားပါပြီ။ ထပ်မံလုပ်ဆောင်ပါ။",
    "error.retry_hint": "တူညီသောထည့်သွင်းချက်ဖြင့် ထပ်စမ်းပါ",
  },
};

export function getErrorMessage(language: SupportedLanguage, key: ErrorDictionaryKey): string {
  return ERROR_DICTIONARY[language][key];
}
