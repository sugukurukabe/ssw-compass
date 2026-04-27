import type { DocumentEntry, ListVisaDocumentsInput } from "@ssw/shared-types";

/**
 * Document catalog (Sprint 2 Batch 5 fixture).
 *
 * Scope per user-approved Interface Freeze Q2 (option A):
 * - agriculture gets the full 7-document set.
 * - Every other industry (and the industry-omitted case) receives the
 *   5-item agnostic baseline.
 * - Non-SSW visa categories get 3-4 generic entries.
 * - `other` category returns an empty array so the handler can respond
 *   with a "general information only" text.
 *
 * Batch 6 will replace this table with gyoseishoshi-reviewed wording and
 * expand every industry individually.
 */

type Lang = "ja" | "en" | "id";

function label(ja: string, en: string, id: string): Record<Lang, string> {
  return { ja, en, id };
}

const DOC_EMPLOYMENT_CONTRACT: DocumentEntry = {
  id: "employment_contract",
  label: label("雇用契約書", "Employment contract", "Kontrak kerja"),
  description:
    "受入機関と本人との間で締結された雇用契約書。賃金、労働時間、業務内容等の記載が必要とされています。",
  category: "required",
  ministry: "法務省",
  trustLevel: "primary_source",
  sourceUrl: "https://www.moj.go.jp/isa/policies/policies/ssw/index.html",
};

const DOC_APPLICATION_FORM: DocumentEntry = {
  id: "zairyu_application_form",
  label: label(
    "在留資格変更許可申請書 / 在留資格認定証明書交付申請書",
    "Status-of-residence change / Certificate of Eligibility application form",
    "Formulir permohonan perubahan status tinggal / Certificate of Eligibility",
  ),
  description:
    "出入国在留管理庁の公式様式に従って記入する申請書。手続き種別 (認定/変更/更新) によって様式が異なります。",
  category: "required",
  ministry: "法務省",
  trustLevel: "primary_source",
  sourceUrl: "https://www.moj.go.jp/isa/applications/procedures/nyuukokukanri07_00201.html",
};

const DOC_RESUME: DocumentEntry = {
  id: "resume",
  label: label("履歴書", "Résumé", "Daftar riwayat hidup"),
  description: "学歴・職歴を時系列で記載した書類。様式は出入国在留管理庁の参考様式に準じます。",
  category: "required",
  ministry: "法務省",
  trustLevel: "primary_source",
};

const DOC_SUPPORT_PLAN: DocumentEntry = {
  id: "support_plan",
  label: label(
    "1号特定技能外国人支援計画書",
    "Support plan for SSW (i) foreign nationals",
    "Rencana dukungan untuk pekerja asing SSW (i)",
  ),
  description:
    "特定技能1号の受入機関が作成する支援計画書。生活支援・日本語学習機会の提供等の項目を含みます。",
  category: "required",
  ministry: "法務省",
  trustLevel: "primary_source",
};

const DOC_PLEDGE: DocumentEntry = {
  id: "pledge",
  label: label(
    "誓約書 (特定技能受入れ機関)",
    "Pledge (receiving organisation)",
    "Surat pernyataan (organisasi penerima)",
  ),
  description:
    "受入機関が出入国在留管理庁に提出する誓約書。法令遵守や支援体制の確保について誓約する書類です。",
  category: "required",
  ministry: "法務省",
  trustLevel: "primary_source",
};

const DOC_SKILL_TEST: DocumentEntry = {
  id: "skill_test_certificate",
  label: label(
    "技能試験合格証 (分野別)",
    "Skills test certificate (sector-specific)",
    "Sertifikat ujian keterampilan (khusus sektor)",
  ),
  description:
    "特定技能1号取得のため、所管省庁が指定する技能試験に合格した旨の証明書。分野ごとに試験主体と証明書様式が異なります。",
  category: "conditional",
  ministry: "所管省庁 (分野により異なる)",
  trustLevel: "primary_source",
};

const DOC_JLPT_CERT: DocumentEntry = {
  id: "japanese_test_certificate",
  label: label(
    "日本語試験合格証 (JFT-Basic 等)",
    "Japanese-language test certificate (JFT-Basic or equivalent)",
    "Sertifikat ujian bahasa Jepang (JFT-Basic atau setara)",
  ),
  description:
    "特定技能1号に必要とされる日本語能力を証明する書類。JFT-Basic または日本語能力試験 N4 以上が一般的な目安です。",
  category: "conditional",
  ministry: "所管省庁 (国際交流基金等)",
  trustLevel: "primary_source",
};

const DOC_MAFF_AGRI_PLAN: DocumentEntry = {
  id: "maff_agriculture_plan",
  label: label(
    "農業分野特有の運用要領に基づく書類一式",
    "Agriculture-sector operational-guidelines documents",
    "Dokumen pedoman operasional khusus sektor pertanian",
  ),
  description:
    "農業分野の特定技能1号では、農林水産省所管の運用要領で指定される書類が追加で必要となります。具体的な様式は農林水産省公式案内を参照してください。",
  category: "conditional",
  ministry: "農林水産省",
  trustLevel: "primary_source",
  sourceUrl: "https://www.maff.go.jp/j/new_farmer/n_syurou/t_ginou.html",
};

const BASELINE_SSW1: readonly DocumentEntry[] = [
  DOC_EMPLOYMENT_CONTRACT,
  DOC_APPLICATION_FORM,
  DOC_RESUME,
  DOC_SUPPORT_PLAN,
  DOC_PLEDGE,
];

const AGRICULTURE_SSW1: readonly DocumentEntry[] = [
  ...BASELINE_SSW1,
  DOC_SKILL_TEST,
  DOC_JLPT_CERT,
  DOC_MAFF_AGRI_PLAN,
];

const GENERIC_SSW2: readonly DocumentEntry[] = [
  DOC_EMPLOYMENT_CONTRACT,
  DOC_APPLICATION_FORM,
  DOC_RESUME,
];

const GINOU_JISSHU_DOCS: readonly DocumentEntry[] = [
  {
    id: "ginou_completion_cert",
    label: label(
      "技能実習修了証明書",
      "Technical Intern Training completion certificate",
      "Sertifikat penyelesaian Pemagangan Teknis",
    ),
    description:
      "技能実習を修了したことを証明する書類。特定活動 (bridge) や特定技能への移行時に必要となる場合があります。",
    category: "required",
    ministry: "法務省・厚生労働省",
    trustLevel: "primary_source",
  },
  DOC_APPLICATION_FORM,
  DOC_RESUME,
];

const BRIDGE_DOCS: readonly DocumentEntry[] = [
  ...GINOU_JISSHU_DOCS,
  {
    id: "bridge_study_plan",
    label: label(
      "試験等の受験計画書",
      "Assessment preparation plan",
      "Rencana persiapan penilaian",
    ),
    description: "特定活動 (特定技能移行準備) 期間中に受験予定の試験や学習計画を記載した書類。",
    category: "conditional",
    ministry: "法務省",
    trustLevel: "primary_source",
  },
];

const GIJINKOKU_DOCS: readonly DocumentEntry[] = [
  DOC_EMPLOYMENT_CONTRACT,
  DOC_APPLICATION_FORM,
  DOC_RESUME,
  {
    id: "diploma",
    label: label(
      "学位証明書・卒業証明書",
      "Diploma / graduation certificate",
      "Ijazah / sertifikat kelulusan",
    ),
    description:
      "技術・人文知識・国際業務の在留資格では、職務内容との関連性を示す学歴証明が求められることが一般的です。",
    category: "required",
    ministry: "法務省",
    trustLevel: "primary_source",
  },
];

const KAZOKU_DOCS: readonly DocumentEntry[] = [
  DOC_APPLICATION_FORM,
  {
    id: "family_relationship_cert",
    label: label(
      "親族関係を証する書類",
      "Document proving family relationship",
      "Dokumen yang membuktikan hubungan keluarga",
    ),
    description: "家族滞在の在留資格では、扶養者との親族関係を公的書類で証明する必要があります。",
    category: "required",
    ministry: "法務省",
    trustLevel: "primary_source",
  },
  {
    id: "supporter_income_cert",
    label: label(
      "扶養者の収入を証する書類",
      "Document proving supporter's income",
      "Dokumen yang membuktikan pendapatan penjamin",
    ),
    description:
      "扶養者の収入状況を確認するための書類 (所得証明書、源泉徴収票等) が必要となるのが一般的です。",
    category: "required",
    ministry: "法務省",
    trustLevel: "primary_source",
  },
];

export function lookupDocuments(args: ListVisaDocumentsInput): readonly DocumentEntry[] {
  const { visaCategory, industry } = args;
  if (visaCategory === "tokutei_ginou_1") {
    if (industry === "agriculture") return AGRICULTURE_SSW1;
    return BASELINE_SSW1;
  }
  if (visaCategory === "tokutei_ginou_2") return GENERIC_SSW2;
  if (visaCategory === "ginou_jisshu") return GINOU_JISSHU_DOCS;
  if (visaCategory === "tokutei_katsudo") return BRIDGE_DOCS;
  if (visaCategory === "gijinkoku") return GIJINKOKU_DOCS;
  if (visaCategory === "kazokutaizai") return KAZOKU_DOCS;
  return [];
}
