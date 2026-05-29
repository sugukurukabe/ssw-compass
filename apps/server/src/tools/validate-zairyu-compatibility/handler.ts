/**
 * validate_zairyu_compatibility handler (v4 §2.4 H06 / sprint-4-plan §4 B.5)
 *
 * legalLevel: L1 (Free OK — 情報提供のみ)
 * H06_ILLEGAL_WORK_ALERT: 不法就労リスクを検出して赤色警告 + 行政書士相談 CTA を返す。
 *
 * 根拠: 入管法 §73-2 不法就労助長罪 (2025-06 施行、5年以下拘禁刑/500万円以下罰金、過失処罰あり)
 * 在留カード確認の徹底が受入企業に求められる。
 *
 * Sprint 4: 静的ルールセットで判定 (Vertex grounding なし)。
 * Sprint 5: Vertex へのルールデータ ingestion で高度化予定。
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  DISCLAIMER_BY_LANG,
  type SupportedLanguage,
  ValidateZairyuCompatibilityInput,
} from "@ssw/shared-types";
import { logger } from "../../logger.js";
import { instrumentTool } from "../../otel.js";
import { scrubInputForPII } from "../../pii/index.js";

/** 就労が基本的に不可な在留資格 */
const WORK_INELIGIBLE_STATUSES = new Set([
  "ryugaku", // 留学 (資格外活動許可なしの就労は不可)
  "kazoku_taizai", // 家族滞在 (資格外活動許可なしの就労は不可)
]);

export const validateZairyuCompatibilityHandler = instrumentTool(
  "validate_zairyu_compatibility",
  async (rawArgs: unknown): Promise<CallToolResult> => {
    const args = ValidateZairyuCompatibilityInput.parse(rawArgs);
    const lang = args.language as SupportedLanguage;
    const disclaimer = DISCLAIMER_BY_LANG[lang];
    const piiCheck = await scrubInputForPII(args);
    if (piiCheck.blocked) {
      logger.warn(
        { tool: "validate_zairyu_compatibility", reason: "pii_blocked", findings: piiCheck.types },
        "pii_blocked",
      );
      return {
        isError: true,
        content: [
          {
            type: "text",
            // 全レスポンス (エラーパス含む) に免責を含める (.cursor/rules/tools.mdc)
            text:
              "個人情報 (在留番号・パスポート番号・マイナンバー等) は入力できません。" +
              `一般的な質問のみ受け付けます。\n\n${disclaimer}`,
          },
        ],
      };
    }

    const t0 = performance.now();
    const today = new Date();
    const expiryDate = new Date(args.expiry_date);

    let compatibility: "OK" | "WARNING" | "ILLEGAL" = "OK";
    const legalBasis: string[] = [];
    const issues: string[] = [];

    // 1. 在留資格が就労を許可しているか
    if (WORK_INELIGIBLE_STATUSES.has(args.zairyu_status)) {
      compatibility = "ILLEGAL";
      legalBasis.push("入管法 §19-1", "入管法 §73-2");
      issues.push(
        `在留資格「${args.zairyu_status}」は原則として就労が認められていません。` +
          "資格外活動許可がある場合は週28時間以内の就労のみ可能です。",
      );
    }

    // 2. 在留期限チェック
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / 86400000);

    if (daysUntilExpiry < 0) {
      // 期限切れ — オーバーステイ
      compatibility = "ILLEGAL";
      legalBasis.push("入管法 §70-1-2", "入管法 §73-2");
      issues.push(
        "在留期限が切れています (オーバーステイ)。直ちに就労を停止し、入管に相談してください。",
      );
    } else if (daysUntilExpiry < 30) {
      // 30日以内の期限切れが迫っている — WARNING
      if (compatibility === "OK") compatibility = "WARNING";
      issues.push(
        `在留期限まで残り${daysUntilExpiry}日です。速やかに更新申請または変更申請を行ってください。`,
      );
    }

    // 3. 特定技能と想定業務の整合
    if (args.zairyu_status === "tokutei_ginou_1" || args.zairyu_status === "tokutei_ginou_2") {
      // 技能実習の分野外就労チェック (簡易版: subcategory ヒント)
      if (args.zairyu_status_subcategory !== undefined) {
        const hint = args.zairyu_status_subcategory.toLowerCase();
        if (!hint.includes(args.intended_industry.replace(/_/g, " "))) {
          if (compatibility === "OK") compatibility = "WARNING";
          issues.push(
            `在留資格のサブカテゴリ「${args.zairyu_status_subcategory}」と` +
              `想定業務分野「${args.intended_industry}」に不一致の可能性があります。行政書士に確認してください。`,
          );
        }
      }
    }

    const escalate = compatibility !== "OK";

    let recommendedAction: string;
    if (compatibility === "ILLEGAL") {
      recommendedAction =
        "就労を即時停止し、資格認定を受けた行政書士または弁護士に相談してください。" +
        "入管法 §73-2 により受入企業にも過失処罰が適用されます。";
    } else if (compatibility === "WARNING") {
      recommendedAction = "行政書士による在留資格の確認と更新申請手続きを早急に進めてください。";
    } else {
      recommendedAction =
        "現在の在留資格で就労継続が可能です。在留期限の定期確認を怠らないでください。";
    }

    logger.info(
      {
        tool: "validate_zairyu_compatibility",
        duration_ms: performance.now() - t0,
        status: args.zairyu_status,
        industry: args.intended_industry,
        compatibility,
        escalate,
      },
      "validate_zairyu_compatibility_ok",
    );

    return {
      content: [
        {
          type: "text",
          text:
            `判定結果: ${compatibility}\n` +
            (issues.length > 0 ? `${issues.map((i) => `⚠️ ${i}`).join("\n")}\n` : "") +
            `\n推奨アクション: ${recommendedAction}\n\n${disclaimer}`,
        },
      ],
      structuredContent: {
        compatibility,
        legal_basis: legalBasis,
        recommended_action: recommendedAction,
        escalate_to_professional: escalate,
        disclaimer,
      },
    };
  },
);
