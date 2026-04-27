export const DISCLAIMER_BY_LANG = {
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
} as const;

export type SupportedLanguage = keyof typeof DISCLAIMER_BY_LANG;
