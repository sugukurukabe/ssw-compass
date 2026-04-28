/**
 * ADR-018: ja/en/id は本格対応。追加 7 言語は Sprint 4 では disclaimer のみ先行提供。
 * Vertex grounding の品質保証は Sprint 5 で順次拡張する。
 */
export const DISCLAIMER_BY_LANG = {
  // ── v3 既存 3 言語 (Vertex grounding 対応) ────────────────────────────────
  ja:
    "本回答は一般情報の提供であり、法律相談・行政書士業務には該当しません。" +
    "個別の手続きについては行政書士・弁護士・登録支援機関にご相談ください。" +
    "最新情報は出入国在留管理庁 (https://www.moj.go.jp/isa/) でご確認ください。",
  en:
    "This is general information only and does not constitute legal advice or " +
    "gyoseishoshi services under Japanese law (Gyoseishoshi-hō §1-2/§1-3). " +
    "For individual cases, consult a certified gyoseishoshi or attorney. " +
    "Authoritative source: https://www.moj.go.jp/isa/",
  id:
    "Informasi ini hanya bersifat umum dan bukan nasihat hukum. " +
    "Untuk kasus individu, silakan berkonsultasi dengan gyoseishoshi/pengacara/ " +
    "organisasi pendukung terdaftar. Sumber resmi: https://www.moj.go.jp/isa/",
  // ── v4 ADR-018 追加 7 言語 (disclaimer のみ Sprint 4 / grounding は Sprint 5) ─
  "zh-CN":
    "此回复仅为一般信息，不构成法律建议或行政书士服务。" +
    "如需个别咨询，请联系认证的行政书士或律师。" +
    "权威来源: https://www.moj.go.jp/isa/",
  "zh-TW":
    "此回覆僅為一般資訊，不構成法律建議或行政書士服務。" +
    "如需個別諮詢，請聯繫認證的行政書士或律師。" +
    "權威來源: https://www.moj.go.jp/isa/",
  vi:
    "Thông tin này chỉ mang tính tham khảo chung và không phải tư vấn pháp lý. " +
    "Để giải quyết trường hợp cụ thể, hãy tham khảo gyoseishoshi hoặc luật sư được chứng nhận. " +
    "Nguồn chính thức: https://www.moj.go.jp/isa/",
  tl:
    "Ang impormasyong ito ay pangkalahatan lamang at hindi bumubuo ng legal na payo. " +
    "Para sa mga indibidwal na kaso, kumonsulta sa sertipikadong gyoseishoshi o abogado. " +
    "Opisyal na pinagmulan: https://www.moj.go.jp/isa/",
  th:
    "ข้อมูลนี้เป็นข้อมูลทั่วไปเท่านั้น ไม่ถือเป็นคำแนะนำทางกฎหมาย " +
    "สำหรับกรณีเฉพาะราย โปรดปรึกษา gyoseishoshi หรือทนายความที่ได้รับการรับรอง " +
    "แหล่งข้อมูลที่เป็นทางการ: https://www.moj.go.jp/isa/",
  km:
    "ព័ត៌មាននេះគ្រាន់តែជាព័ត៌មានទូទៅ មិនមែនជាដំបូន្មានផ្នែកច្បាប់ទេ។ " +
    "សម្រាប់ករណីជាក់លាក់ សូមពិគ្រោះជាមួយ gyoseishoshi ឬមេធាវីដែលមានការអនុញ្ញាត។ " +
    "ប្រភពផ្លូវការ: https://www.moj.go.jp/isa/",
  my:
    "ဤသတင်းအချက်အလက်သည် ယေဘုယျသတင်းအချက်အလက်သာဖြစ်ပြီး တရားဥပဒေဆိုင်ရာ အကြံဉာဏ်မဟုတ်ပါ။ " +
    "တစ်ဦးချင်းသောကိစ္စရပ်များအတွက် လိုင်စင်ရ gyoseishoshi သို့မဟုတ် ရှေ့နေနှင့် တိုင်ပင်ပါ။ " +
    "တရားဝင်ရင်းမြစ်: https://www.moj.go.jp/isa/",
} as const;

/** @deprecated Use SupportedLanguage from ./i18n/supported-languages.ts instead (v4 ADR-018) */
export type SupportedLanguageLegacy = keyof typeof DISCLAIMER_BY_LANG;
