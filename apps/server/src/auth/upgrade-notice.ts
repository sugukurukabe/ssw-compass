/**
 * Phase 2a: Graceful upgrade explanation (docs/ux/free-to-pro-experience.md §3.2)
 *
 * Free ユーザーが Pro 専用ツールに未認可で触れた時、素の拒否エラーではなく、
 * 丁寧で有用な構造化説明を返すための共通ヘルパ。
 * Shared helper that turns a Pro-tool denial into a calm, useful structured
 * explanation instead of a bare error.
 * Helper bersama yang mengubah penolakan alat Pro menjadi penjelasan terstruktur
 * yang tenang dan berguna, bukan sekadar error.
 *
 * 重要な境界 (絶対厳守) / Boundaries:
 * - 認可ゲートを弱めない / バイパスしない。これは「拒否の UX を親切にする」だけで、
 *   アクセス付与ではない。Pro 機能は未認可では一切実行しない (副作用ゼロ)。
 * - 既存の拒否契約 (403 + -32003 + WWW-Authenticate / 200 + isError) を壊さない。
 *   本ヘルパは応答の「内容」を充実させるだけで、ステータス / コード / コントラクトは不変。
 * - アプリ内課金 UI を出さない。価格・契約・決済は外部のみ。説明は非モーダル・1 回・控えめ。
 * - PII / 内部 ID を応答に含めない (trace / session / 監査 ID 等を出力しない)。
 * - 外部リンクは許可ドメインのみ。`_meta.redirect_domains` (T12) で外部 Pro ドメインのみ宣言。
 * - 本人 / 家族には Pro を勧めない (提案書 §2 P3 / §8)。Pro 訴求は行政書士向けに限定。
 */

import { DISCLAIMER_BY_LANG, type SupportedLanguage } from "@ssw/shared-types";
import type { CompassScope } from "./scopes.js";

/**
 * 外部 Pro ランディング URL。
 * 要確認: 実ドメインは未確定。本番ドメイン確定後に確定値へ差し替えること。
 * 環境変数 COMPASS_PRO_UPGRADE_URL で上書き可能 (許可ドメインのみ)。
 * TODO(要確認): replace the placeholder domain once the production Pro URL is fixed.
 */
export const DEFAULT_PRO_UPGRADE_URL = "https://compass.sugukuru.example/pro";

/**
 * 設定可能な外部 Pro URL を返す (env > 既定定数)。
 * Returns the configurable external Pro URL (env override > default).
 */
export function proUpgradeUrl(): string {
  const fromEnv = process.env["COMPASS_PRO_UPGRADE_URL"];
  return fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : DEFAULT_PRO_UPGRADE_URL;
}

/**
 * `_meta.redirect_domains` (T12) に宣言する外部 Pro ドメインのみを返す。
 * Returns only the external Pro origin to declare in `_meta.redirect_domains`.
 */
export function proRedirectDomains(): string[] {
  try {
    return [new URL(proUpgradeUrl()).origin];
  } catch {
    return [];
  }
}

/**
 * 上位移行説明の構造化ペイロード (要素 5 点)。PII / 内部 ID を含まない。
 * Structured upgrade-explanation payload (5 elements). Contains no PII / internal IDs.
 */
export interface UpgradeNotice {
  /** 対象 Pro ツール名 / target Pro tool */
  tool: string;
  /** scope ゲートで不足していた scope (HITL 経路では null) */
  required_scope: CompassScope | null;
  /** 訴求対象は行政書士に限定 (本人 / 家族には勧めない) */
  audience: "gyoseishoshi";
  /** 表示は非モーダル・1 回 (ダークパターン禁止) */
  presentation: "non_modal_once";
  /** ① 何ができるか (価値) */
  what_you_can_do: string;
  /** ② なぜ今使えないか (行政書士資格 + Pro 契約) */
  why_unavailable: string;
  /** ③ どうすれば使えるか (外部リンク導線の説明文) */
  how_to_unlock: string;
  /** ③ 外部リンク (許可ドメインのみ) */
  upgrade_url: string;
  /** ④ Free で今できること (代替の読み取りツール導線) */
  free_alternatives: string;
  /** ④ 代替の読み取りツール名 */
  free_alternative_tools: string[];
  /** ⑤ §19 免責 (DISCLAIMER_BY_LANG を逐語使用) */
  disclaimer: string;
}

/** Free で案内する代替の読み取りツール (情報提供の下ごしらえ導線) */
const FREE_ALTERNATIVE_TOOLS = [
  "list_visa_documents",
  "classify_procedure",
  "get_deadline_timeline",
] as const;

interface NoticeStrings {
  what_you_can_do: string;
  why_unavailable: string;
  how_to_unlock: (url: string) => string;
  free_alternatives: (tools: string) => string;
}

/**
 * 多言語の説明文 (まず ja/en/id。他言語は en にフォールバック。免責は別途逐語注入)。
 * Localized copy (ja/en/id first; other languages fall back to en). Disclaimer is
 * injected verbatim separately.
 */
const NOTICE_COPY: Record<"ja" | "en" | "id", NoticeStrings> = {
  ja: {
    what_you_can_do:
      "Pro では、申請区分・分野から書類パッケージを冪等生成し、承認を監査記録できます (行政書士の作業を効率化する道具です)。",
    why_unavailable:
      "この機能は行政書士資格の確認 (gyoseishoshi_verified) と Pro 契約が必要です。本サービスは情報提供のみで、申請の代理は行いません。",
    how_to_unlock: (url) => `行政書士の方へ: 資格確認・お申し込みは外部ページからどうぞ → ${url}`,
    free_alternatives: (tools) =>
      `Free のままでも、まずは読み取りツールで下調べができます: ${tools}`,
  },
  en: {
    what_you_can_do:
      "Pro idempotently generates document packages from the application type and field, and records approvals for audit (a tool to streamline a gyoseishoshi's work).",
    why_unavailable:
      "This feature requires gyoseishoshi verification (gyoseishoshi_verified) and a Pro contract. This service provides information only and does not act as a filing agent.",
    how_to_unlock: (url) =>
      `For certified gyoseishoshi: complete verification and sign up on the external page → ${url}`,
    free_alternatives: (tools) =>
      `You can still prepare for free using the read-only tools first: ${tools}`,
  },
  id: {
    what_you_can_do:
      "Pro membuat paket dokumen secara idempoten dari jenis permohonan dan bidang, serta mencatat persetujuan untuk audit (alat untuk mengefisienkan pekerjaan gyoseishoshi).",
    why_unavailable:
      "Fitur ini memerlukan verifikasi gyoseishoshi (gyoseishoshi_verified) dan kontrak Pro. Layanan ini hanya memberi informasi dan tidak bertindak sebagai agen pengajuan.",
    how_to_unlock: (url) =>
      `Untuk gyoseishoshi bersertifikat: lakukan verifikasi dan daftar di halaman eksternal → ${url}`,
    free_alternatives: (tools) =>
      `Anda tetap bisa bersiap secara gratis dengan alat baca-saja terlebih dahulu: ${tools}`,
  },
};

function copyForLanguage(lang: SupportedLanguage): NoticeStrings {
  if (lang === "ja" || lang === "en" || lang === "id") {
    return NOTICE_COPY[lang];
  }
  return NOTICE_COPY.en;
}

/**
 * 上位移行説明の構造化ペイロードを組み立てる。
 * Builds the structured upgrade-explanation payload.
 * Membangun payload penjelasan upgrade terstruktur.
 */
export function buildUpgradeNotice(input: {
  tool: string;
  lang: SupportedLanguage;
  requiredScope?: CompassScope | undefined;
}): UpgradeNotice {
  const copy = copyForLanguage(input.lang);
  const url = proUpgradeUrl();
  const tools = [...FREE_ALTERNATIVE_TOOLS];
  return {
    tool: input.tool,
    required_scope: input.requiredScope ?? null,
    audience: "gyoseishoshi",
    presentation: "non_modal_once",
    what_you_can_do: copy.what_you_can_do,
    why_unavailable: copy.why_unavailable,
    how_to_unlock: copy.how_to_unlock(url),
    upgrade_url: url,
    free_alternatives: copy.free_alternatives(tools.join(", ")),
    free_alternative_tools: tools,
    disclaimer: DISCLAIMER_BY_LANG[input.lang],
  };
}

/**
 * 構造化ペイロードを人間向けの説明テキストに整形する (免責は含めない)。
 * 呼び出し側が末尾に DISCLAIMER_BY_LANG を逐語付与すること。
 * Renders the human-readable explanation (without the disclaimer). The caller
 * appends DISCLAIMER_BY_LANG verbatim at the end.
 */
export function renderUpgradeExplanation(notice: UpgradeNotice): string {
  return [
    notice.what_you_can_do,
    notice.why_unavailable,
    notice.how_to_unlock,
    notice.free_alternatives,
  ].join("\n");
}

/**
 * `_meta` に載せる上位移行ペイロード (構造化説明 + redirect_domains)。
 * Builds the `_meta` payload (structured explanation + redirect_domains).
 *
 * `compass/upgrade_notice` は構造化説明、`redirect_domains` は許可外部ドメインのみ。
 */
export function buildUpgradeNoticeMeta(notice: UpgradeNotice): Record<string, unknown> {
  return {
    "compass/upgrade_notice": notice,
    redirect_domains: proRedirectDomains(),
  };
}

/**
 * scope ゲート (HTTP 403) の JSON-RPC ボディを組み立てる。
 * Builds the JSON-RPC body for the scope gate (HTTP 403).
 * Membangun body JSON-RPC untuk gerbang scope (HTTP 403).
 *
 * 既存契約を維持する: `error.code` は -32003、`error.message` は
 * `Insufficient scope: <scope>` のまま不変。ステータス 403 と WWW-Authenticate
 * ヘッダは呼び出し側 (enforceScopes) が従来どおり設定する。
 * 本関数は `error.data` に graceful な構造化説明を、トップレベル `_meta` に
 * redirect_domains を「上乗せ」するだけ (拒否は維持・副作用ゼロ)。
 */
export function buildScopeDenialBody(input: {
  tool: string | undefined;
  requiredScope: CompassScope;
  id: unknown;
  lang: SupportedLanguage;
}): Record<string, unknown> {
  const notice = buildUpgradeNotice({
    tool: input.tool ?? "unknown",
    lang: input.lang,
    requiredScope: input.requiredScope,
  });
  return {
    jsonrpc: "2.0",
    error: {
      code: -32003,
      message: `Insufficient scope: ${input.requiredScope}`,
      data: { upgrade_notice: notice },
    },
    id: input.id ?? null,
    _meta: buildUpgradeNoticeMeta(notice),
  };
}
