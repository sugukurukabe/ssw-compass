import type { DeadlineEntry, DeadlineKind, GetDeadlineTimelineInput } from "@ssw/shared-types";

type Lang = "ja" | "en" | "id";

/**
 * Per-kind static facts (label, description, relative label, trustLevel).
 * Text is at published-fact level only (v3 §11.2, ADR-004-style policy).
 * Sprint 2 Batch 6 will replace with gyoseishoshi-reviewed wording.
 *
 * All kinds are marked trustLevel "primary_source" in Batch 3. Sprint 2
 * Batch 5 introduces the secondary/community classification together with
 * the colour badge visualisation on the UI side.
 */
const DEADLINE_FACTS: Record<
  DeadlineKind,
  {
    label: Record<Lang, string>;
    relativeLabel: Record<Lang, string>;
    description: Record<Lang, string>;
  }
> = {
  notification_14days: {
    label: {
      ja: "随時届出 (14日以内)",
      en: "Ad-hoc notification (within 14 days)",
      id: "Pemberitahuan ad-hoc (dalam 14 hari)",
    },
    relativeLabel: {
      ja: "事由発生から14日以内",
      en: "within 14 days of the event",
      id: "dalam 14 hari sejak kejadian",
    },
    description: {
      ja:
        "雇用契約の終了・開始、所属機関の名称・所在地変更等の事由が発生した際、" +
        "出入国在留管理庁への届出を事由発生から14日以内に行う必要があります。",
      en:
        "When events such as employment contract termination/commencement or changes to the " +
        "accepting organisation's name or address occur, the notification to the Immigration " +
        "Services Agency must be filed within 14 days of the event.",
      id:
        "Ketika terjadi peristiwa seperti pengakhiran/pemulaian kontrak kerja atau perubahan " +
        "nama atau alamat organisasi penerima, pemberitahuan kepada Immigration Services Agency " +
        "harus diajukan dalam 14 hari sejak kejadian.",
    },
  },
  annual_report: {
    label: {
      ja: "定期届出 (毎年4月1日〜5月31日)",
      en: "Annual report (April 1 – May 31 each year)",
      id: "Laporan tahunan (1 April – 31 Mei setiap tahun)",
    },
    relativeLabel: {
      ja: "毎年4月1日〜5月31日",
      en: "each year April 1 – May 31",
      id: "setiap tahun 1 April – 31 Mei",
    },
    description: {
      ja:
        "受入機関は、前年度の活動状況等について毎年4月1日から5月31日までの期間に" +
        "定期届出を行うことが求められています。",
      en:
        "Receiving organisations are required to file an annual report covering the previous " +
        "fiscal year's activity between April 1 and May 31 each year.",
      id:
        "Organisasi penerima diwajibkan mengajukan laporan tahunan yang mencakup kegiatan tahun " +
        "fiskal sebelumnya antara 1 April dan 31 Mei setiap tahun.",
    },
  },
  renewal_earliest: {
    label: {
      ja: "在留期間更新 最早申請可能日",
      en: "Earliest filing date for period-of-stay renewal",
      id: "Tanggal permohonan perpanjangan masa tinggal paling awal",
    },
    relativeLabel: {
      ja: "在留期限の3ヶ月前から",
      en: "from 3 months before the period expires",
      id: "mulai 3 bulan sebelum masa berlaku habis",
    },
    description: {
      ja:
        "在留期間更新許可申請は、一般に在留期限の約3ヶ月前から受け付けられます。" +
        "早めに準備し、期限内に申請することが推奨されています。",
      en:
        "Period-of-stay renewal applications are generally accepted from about three months " +
        "before the current period expires. Early preparation and filing within the window is " +
        "recommended.",
      id:
        "Permohonan perpanjangan masa tinggal umumnya diterima sekitar tiga bulan sebelum masa " +
        "berlaku habis. Persiapan dan pengajuan lebih awal dalam jangka waktu tersebut dianjurkan.",
    },
  },
  tokutei_ginou_1_cap: {
    label: {
      ja: "特定技能1号 通算5年上限",
      en: "Specified Skilled Worker (i) — 5-year cumulative cap",
      id: "Specified Skilled Worker (i) — batas kumulatif 5 tahun",
    },
    relativeLabel: {
      ja: "通算5年",
      en: "5 years cumulative",
      id: "5 tahun kumulatif",
    },
    description: {
      ja:
        "特定技能1号の在留期間は通算で5年を上限とされています。" +
        "開始年月や中断期間によって満了時期は変わるため、正確な計算は出入国在留管理庁または" +
        "行政書士に個別に確認してください。",
      en:
        "Specified Skilled Worker (i) is subject to a cumulative five-year cap. Because the exact " +
        "end depends on the start date and any interruptions, confirm the precise calculation with " +
        "the Immigration Services Agency or a gyoseishoshi.",
      id:
        "Specified Skilled Worker (i) tunduk pada batas kumulatif lima tahun. Karena berakhirnya " +
        "tepat bergantung pada tanggal mulai dan gangguan apa pun, konfirmasikan perhitungan tepat " +
        "dengan Immigration Services Agency atau gyoseishoshi.",
    },
  },
  bridge_preparation: {
    label: {
      ja: "特定活動 (特定技能移行準備) 期間",
      en: "Designated Activities (bridge to SSW) preparation period",
      id: "Periode persiapan Kegiatan Khusus (masa transisi SSW)",
    },
    relativeLabel: {
      ja: "概ね4ヶ月以内",
      en: "approximately within 4 months",
      id: "kira-kira dalam 4 bulan",
    },
    description: {
      ja:
        "技能実習修了者が特定技能1号へ移行する際の特定活動期間は、概ね4ヶ月を目安として運用されています。" +
        "この期間内に必要な試験等の準備を完了することが求められます。",
      en:
        "When transitioning from Technical Intern Training to Specified Skilled Worker (i), the " +
        "Designated Activities bridge period is generally operated as a roughly four-month window " +
        "in which the required assessments should be prepared for.",
      id:
        "Saat beralih dari Pemagangan Teknis ke Specified Skilled Worker (i), periode Kegiatan " +
        "Khusus sebagai jembatan umumnya dijalankan sebagai jendela sekitar empat bulan di mana " +
        "penilaian yang diperlukan harus dipersiapkan.",
    },
  },
};

const RELATED_FORMS_BY_CONTEXT: Partial<
  Record<
    GetDeadlineTimelineInput["eventContext"],
    Array<{ id: string; title: string; sourceUrl: string }>
  >
> = {
  contract_start: [
    {
      id: "ref-3-1-1-employment-contract-change",
      title: "特定技能雇用契約の変更に係る届出書 (参考様式第3-1-1号)",
      sourceUrl: "https://www.moj.go.jp/isa/content/001340519.xlsx",
    },
  ],
  contract_end: [
    {
      id: "ref-3-1-2-employment-contract-end",
      title: "特定技能雇用契約の終了又は締結に係る届出書 (参考様式第3-1-2号)",
      sourceUrl: "https://www.moj.go.jp/isa/content/001378824.xlsx",
    },
  ],
  employment_contract_change: [
    {
      id: "ref-3-1-1-employment-contract-change",
      title: "特定技能雇用契約の変更に係る届出書 (参考様式第3-1-1号)",
      sourceUrl: "https://www.moj.go.jp/isa/content/001340519.xlsx",
    },
  ],
  support_plan_change: [
    {
      id: "ref-3-2-support-plan-change",
      title: "支援計画変更に係る届出書 (参考様式第3-2号)",
      sourceUrl: "https://www.moj.go.jp/isa/content/001340521.xlsx",
    },
  ],
  organization_change: [
    {
      id: "ref-4-4-registration-change-appendix",
      title: "登録事項変更に関する届出書別紙 (参考様式第4-4号)",
      sourceUrl: "https://www.moj.go.jp/isa/content/001340539.docx",
    },
  ],
  regular_report: [
    {
      id: "ref-3-6-regular-report",
      title: "受入れ・活動・支援実施状況に係る届出書 (参考様式第3-6号)",
      sourceUrl: "https://www.moj.go.jp/isa/content/001454511.xlsx",
    },
  ],
};

/**
 * Subtract `months` from a YYYY-MM string and return the resulting YYYY-MM.
 * Handles cross-year boundaries (e.g. 2026-02 minus 3 months = 2025-11).
 */
export function subtractMonths(yearMonth: string, months: number): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(yearMonth);
  if (match === null) {
    throw new Error(`subtractMonths: invalid YYYY-MM input: ${yearMonth}`);
  }
  const yearPart = match[1];
  const monthPart = match[2];
  if (yearPart === undefined || monthPart === undefined) {
    throw new Error(`subtractMonths: invalid YYYY-MM input: ${yearMonth}`);
  }
  const totalMonthsZeroBased = Number(yearPart) * 12 + (Number(monthPart) - 1) - months;
  const targetYear = Math.floor(totalMonthsZeroBased / 12);
  const targetMonth = (totalMonthsZeroBased % 12) + 1;
  const mm = targetMonth.toString().padStart(2, "0");
  return `${targetYear}-${mm}`;
}

/**
 * Decide which DeadlineKind rows apply to the given (visaCategory, eventContext)
 * combination. Each row is static from DEADLINE_FACTS; only renewal_earliest
 * gets a computed `dueBy` when `referenceYearMonth` is provided.
 */
function selectKinds(
  visaCategory: GetDeadlineTimelineInput["visaCategory"],
  eventContext: GetDeadlineTimelineInput["eventContext"],
): DeadlineKind[] {
  if (eventContext === "contract_end") {
    return ["notification_14days"];
  }
  if (
    eventContext === "employment_contract_change" ||
    eventContext === "support_plan_change" ||
    eventContext === "organization_change"
  ) {
    return ["notification_14days"];
  }
  if (eventContext === "regular_report") {
    return ["annual_report"];
  }
  if (eventContext === "bridge_transition") {
    return ["bridge_preparation"];
  }
  if (visaCategory === "tokutei_ginou_1") {
    if (eventContext === "status_renewal") {
      return ["renewal_earliest", "tokutei_ginou_1_cap"];
    }
    if (eventContext === "first_entry") {
      return ["annual_report", "tokutei_ginou_1_cap"];
    }
    if (eventContext === "contract_start") {
      return ["notification_14days", "annual_report", "tokutei_ginou_1_cap"];
    }
    return ["notification_14days", "annual_report", "renewal_earliest", "tokutei_ginou_1_cap"];
  }
  if (visaCategory === "tokutei_ginou_2") {
    return ["notification_14days", "annual_report", "renewal_earliest"];
  }
  if (visaCategory === "tokutei_katsudo") {
    return ["notification_14days", "renewal_earliest", "bridge_preparation"];
  }
  if (visaCategory === "ginou_jisshu") {
    return ["notification_14days", "annual_report"];
  }
  return ["notification_14days"];
}

export function computeTimeline(args: GetDeadlineTimelineInput): DeadlineEntry[] {
  const kinds = selectKinds(args.visaCategory, args.eventContext);
  return kinds.map((kind) => {
    const facts = DEADLINE_FACTS[kind];
    const entry: DeadlineEntry = {
      kind,
      label: facts.label,
      description: facts.description[args.language],
      relativeLabel: facts.relativeLabel,
      trustLevel: "primary_source",
    };
    if (kind === "renewal_earliest" && args.referenceYearMonth !== undefined) {
      entry.dueBy = subtractMonths(args.referenceYearMonth, 3);
    }
    const relatedForms = RELATED_FORMS_BY_CONTEXT[args.eventContext];
    if (relatedForms !== undefined && relatedForms.length > 0) {
      entry.relatedForms = relatedForms;
    }
    return entry;
  });
}
