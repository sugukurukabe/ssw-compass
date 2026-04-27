import type { ClassifyProcedureInput, ClassifyProcedureType } from "@vcj/shared-types";

/**
 * Rule-based procedure classifier (Sprint 2 Batch 2).
 *
 * Rules fire top-to-bottom; first match wins. Each rule restates a
 * well-publicised feature of the Japanese immigration procedure framework:
 *
 *   1. 国外からの新規取得は在留資格認定証明書交付申請。
 *   2-3. 技能実習 2号/3号 修了者が特定技能 1号 を目指す場合は特定活動
 *       (準備活動) に一旦移行する運用。
 *   4. 同一資格の継続は在留期間更新許可申請。
 *   5. 国内で異なる資格への切替えは在留資格変更許可申請。
 *   6. 国内で在留資格がない状態は本ツールの想定外 (不法残留等の個別相談は
 *      行政書士・弁護士が必要)。
 *
 * `industry` is carried into the result for downstream use (reference retrieval,
 * logging) but does NOT affect this decision in Sprint 2. Sprint 3+ will add
 * industry-sector branches to `rationale` / `nextSteps` based on each省庁の
 * 運用要領.
 */

export interface ClassifyDecision {
  type: ClassifyProcedureType;
  ruleId: string;
}

export function classifyProcedure(args: ClassifyProcedureInput): ClassifyDecision {
  const { currentStatus, targetStatus, location } = args;

  if (location === "overseas") {
    return { type: "ninte_shoumeisho_koufu", ruleId: "R1.overseas_new" };
  }

  if (
    (currentStatus === "ginou_jisshu_2" || currentStatus === "ginou_jisshu_3") &&
    targetStatus === "tokutei_ginou_1"
  ) {
    return { type: "tokutei_katsudo_bridge", ruleId: "R2.ginou_to_tg1" };
  }

  if (currentStatus === targetStatus) {
    return { type: "zairyu_kikan_koshin", ruleId: "R3.same_status_renewal" };
  }

  if (currentStatus === "no_status") {
    return { type: "not_applicable", ruleId: "R4.no_status_in_japan" };
  }

  return { type: "zairyu_shikaku_henko", ruleId: "R5.status_change" };
}

type Lang = "ja" | "en" | "id";

export const PROCEDURE_LABEL: Record<ClassifyProcedureType, Record<Lang, string>> = {
  ninte_shoumeisho_koufu: {
    ja: "在留資格認定証明書交付申請",
    en: "Certificate of Eligibility issuance application",
    id: "Permohonan penerbitan Certificate of Eligibility",
  },
  zairyu_shikaku_henko: {
    ja: "在留資格変更許可申請",
    en: "Status of residence change application",
    id: "Permohonan perubahan status tinggal",
  },
  zairyu_kikan_koshin: {
    ja: "在留期間更新許可申請",
    en: "Period of stay renewal application",
    id: "Permohonan perpanjangan masa tinggal",
  },
  tokutei_katsudo_bridge: {
    ja: "特定活動 (特定技能移行準備) への変更許可申請",
    en: "Designated Activities (bridge to Specified Skilled Worker) change application",
    id: "Permohonan perubahan ke Kegiatan Khusus (masa transisi SSW)",
  },
  not_applicable: {
    ja: "該当なし",
    en: "Not applicable",
    id: "Tidak berlaku",
  },
};

/**
 * Rationale text — published-fact level only. No individual-case judgement.
 * Sprint 2 Batch 6 will replace these with gyoseishoshi-reviewed wording.
 */
export const PROCEDURE_RATIONALE: Record<ClassifyProcedureType, Record<Lang, string>> = {
  ninte_shoumeisho_koufu: {
    ja:
      "国外から新たに就労等の在留資格を取得する場合、原則として所属予定の機関を通じて在留資格認定証明書交付申請を行い、" +
      "交付後に在外公館で査証 (ビザ) を取得して入国する運用が基本です。",
    en:
      "When applying for a new work-based status of residence from overseas, the accepting organisation in Japan " +
      "generally files a Certificate of Eligibility application first; the applicant then obtains a visa at the Japanese " +
      "embassy/consulate before entering Japan.",
    id:
      "Untuk mengajukan status tinggal kerja baru dari luar negeri, biasanya organisasi penerima di Jepang " +
      "mengajukan permohonan Certificate of Eligibility terlebih dahulu; pemohon kemudian memperoleh visa di perwakilan " +
      "Jepang sebelum masuk Jepang.",
  },
  zairyu_shikaku_henko: {
    ja:
      "国内で現在の在留資格とは異なる資格での活動に切り替える場合、在留資格変更許可申請を行うのが原則です。" +
      "提出書類は資格ごとの標準様式に従います。",
    en:
      "When switching to a different status of residence while already in Japan, a status change application is filed in principle. " +
      "Required documents follow the official form set for the target status.",
    id:
      "Ketika beralih ke status tinggal yang berbeda sambil sudah berada di Jepang, pada prinsipnya diajukan permohonan perubahan status tinggal. " +
      "Dokumen yang diperlukan mengikuti formulir resmi untuk status tujuan.",
  },
  zairyu_kikan_koshin: {
    ja:
      "同一の在留資格で在留期間を延長する場合、在留期間更新許可申請を行います。" +
      "一般的に在留期限の約3ヶ月前から申請が可能です。",
    en:
      "When extending the period of stay under the same status of residence, a period-of-stay renewal application is filed. " +
      "In general, the application can be submitted from roughly three months before the current period expires.",
    id:
      "Untuk memperpanjang masa tinggal dengan status yang sama, diajukan permohonan perpanjangan masa tinggal. " +
      "Secara umum, permohonan dapat diajukan sekitar tiga bulan sebelum masa berlaku habis.",
  },
  tokutei_katsudo_bridge: {
    ja:
      "技能実習2号・3号を良好に修了した方が特定技能1号へ移行する場合、試験準備等のため一時的に特定活動 " +
      "(特定技能移行準備) への在留資格変更を行う運用が一般的です。最長で概ね4ヶ月が目安とされています。",
    en:
      "When a person who has successfully completed Technical Intern Training 2 or 3 transitions to Specified Skilled " +
      "Worker (i), it is common practice to first change to Designated Activities (bridge to SSW) while preparing for " +
      "any required assessments. The general guideline period is up to approximately four months.",
    id:
      "Ketika seseorang yang telah menyelesaikan Pemagangan Teknis 2 atau 3 beralih ke Specified Skilled Worker (i), " +
      "praktik umumnya adalah mengubah status terlebih dahulu ke Kegiatan Khusus (masa transisi SSW) sambil menyiapkan " +
      "penilaian yang diperlukan. Pedoman umum adalah hingga sekitar empat bulan.",
  },
  not_applicable: {
    ja:
      "国内に在留資格のない状態での今後の手続きは個別事情に依存するため、行政書士または弁護士への相談が必要です。" +
      "本ツールでは判定を行いません。",
    en:
      "When a person is in Japan without a current status of residence, the appropriate next step depends on individual " +
      "circumstances and requires consultation with a gyoseishoshi or attorney. This tool does not make a determination.",
    id:
      "Ketika seseorang berada di Jepang tanpa status tinggal saat ini, langkah berikutnya tergantung pada keadaan " +
      "individu dan memerlukan konsultasi dengan gyoseishoshi atau pengacara. Alat ini tidak membuat penentuan.",
  },
};

/**
 * Next steps — general-public-level guidance. No individual-case judgement.
 * Sprint 2 Batch 6 will replace these with gyoseishoshi-reviewed wording.
 */
export const PROCEDURE_NEXT_STEPS: Record<
  ClassifyProcedureType,
  Record<Lang, readonly string[]>
> = {
  ninte_shoumeisho_koufu: {
    ja: [
      "受入機関と雇用契約または受入条件を確認する。",
      "出入国在留管理庁の公式案内で申請書の様式と添付書類を確認する。",
      "受入機関または代理人を通じて在留資格認定証明書交付申請を提出する。",
      "交付後、本人が在外公館で査証を申請して入国する。",
    ],
    en: [
      "Confirm the employment contract or acceptance terms with the receiving organisation.",
      "Check the application form and required attachments on the Immigration Services Agency's official guidance.",
      "File the Certificate of Eligibility application via the receiving organisation or an agent.",
      "Once issued, apply for the visa at the Japanese embassy/consulate abroad before entering Japan.",
    ],
    id: [
      "Konfirmasikan kontrak kerja atau syarat penerimaan dengan organisasi penerima.",
      "Periksa formulir permohonan dan lampiran yang diperlukan pada panduan resmi Immigration Services Agency.",
      "Ajukan permohonan Certificate of Eligibility melalui organisasi penerima atau agen.",
      "Setelah diterbitkan, ajukan visa di kedutaan/konsulat Jepang di luar negeri sebelum masuk Jepang.",
    ],
  },
  zairyu_shikaku_henko: {
    ja: [
      "目的の在留資格について公式の必要書類リストを確認する。",
      "所属予定の機関に関する書類 (契約書、会社概要等) を準備する。",
      "地方出入国在留管理局で在留資格変更許可申請を行う。",
      "標準処理期間の目安は概ね2週間〜1ヶ月とされている。",
    ],
    en: [
      "Check the official required-documents list for the target status of residence.",
      "Prepare documents related to the receiving organisation (contract, company overview, etc.).",
      "File the status change application at the regional Immigration Services Bureau.",
      "The general standard processing period guideline is roughly two weeks to one month.",
    ],
    id: [
      "Periksa daftar dokumen resmi yang diperlukan untuk status tinggal tujuan.",
      "Siapkan dokumen terkait organisasi penerima (kontrak, profil perusahaan, dll.).",
      "Ajukan permohonan perubahan status di Biro Imigrasi regional.",
      "Pedoman masa proses standar umum adalah sekitar dua minggu hingga satu bulan.",
    ],
  },
  zairyu_kikan_koshin: {
    ja: [
      "現在の在留期限を確認し、3ヶ月前から申請可能であることを把握する。",
      "継続の雇用・在留活動を示す書類を整備する。",
      "地方出入国在留管理局で在留期間更新許可申請を行う。",
      "処理期間の目安は概ね2週間〜1ヶ月とされている。",
    ],
    en: [
      "Check the current period-of-stay expiry; applications are accepted from about three months before expiry.",
      "Prepare documents evidencing continued employment or residence activity.",
      "File the period-of-stay renewal application at the regional Immigration Services Bureau.",
      "The general standard processing period guideline is roughly two weeks to one month.",
    ],
    id: [
      "Periksa masa berlaku status tinggal saat ini; permohonan diterima sekitar tiga bulan sebelum masa berlaku habis.",
      "Siapkan dokumen yang membuktikan kelanjutan pekerjaan atau kegiatan tinggal.",
      "Ajukan permohonan perpanjangan masa tinggal di Biro Imigrasi regional.",
      "Pedoman masa proses standar umum adalah sekitar dua minggu hingga satu bulan.",
    ],
  },
  tokutei_katsudo_bridge: {
    ja: [
      "技能実習の修了証明書等を準備する。",
      "特定活動 (特定技能移行準備) の必要書類を公式案内で確認する。",
      "地方出入国在留管理局で在留資格変更許可申請を行う。",
      "必要な試験合格等の条件を整えた後、改めて特定技能1号への在留資格変更許可申請を行う。",
    ],
    en: [
      "Prepare Technical Intern Training completion certificates and related documents.",
      "Check the required documents for Designated Activities (bridge to SSW) on official guidance.",
      "File a status change application to Designated Activities at the regional Immigration Services Bureau.",
      "After meeting the required assessment conditions, file a further status change application to Specified Skilled Worker (i).",
    ],
    id: [
      "Siapkan sertifikat penyelesaian Pemagangan Teknis dan dokumen terkait.",
      "Periksa dokumen yang diperlukan untuk Kegiatan Khusus (masa transisi SSW) pada panduan resmi.",
      "Ajukan permohonan perubahan status ke Kegiatan Khusus di Biro Imigrasi regional.",
      "Setelah memenuhi syarat penilaian yang diperlukan, ajukan permohonan perubahan status lanjutan ke Specified Skilled Worker (i).",
    ],
  },
  not_applicable: {
    ja: [
      "本ツールでは判定できない状況です。",
      "行政書士または弁護士に個別の状況を相談してください。",
      "出入国在留管理庁の公式案内 (https://www.moj.go.jp/isa/) も参照してください。",
    ],
    en: [
      "This tool cannot make a determination for this situation.",
      "Please consult a gyoseishoshi or attorney about individual circumstances.",
      "Refer also to the Immigration Services Agency official guidance (https://www.moj.go.jp/isa/).",
    ],
    id: [
      "Alat ini tidak dapat membuat penentuan untuk situasi ini.",
      "Silakan konsultasikan keadaan individu dengan gyoseishoshi atau pengacara.",
      "Lihat juga panduan resmi Immigration Services Agency (https://www.moj.go.jp/isa/).",
    ],
  },
};
