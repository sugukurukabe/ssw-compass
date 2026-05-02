import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

const MCP_URL = process.env["MCP_URL"] ?? "https://mcp.ssw-compass.jp/mcp";
const CHROME =
  process.env["CHROME_PATH"] ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = process.cwd();
const OUTPUT_DIR = resolve(ROOT, "docs/screenshots");
const TMP_DIR = join(tmpdir(), "ssw-compass-submission-screenshots");
const RPC_TIMEOUT_MS = Number(process.env["MCP_CAPTURE_TIMEOUT_MS"] ?? "20000");

const NOTICE = "📍 一般情報の羅針盤 — 個別案件は行政書士へ";
const AS_OF = "情報基準日";
const DISCLAIMER_FALLBACK =
  "本回答は一般情報の提供であり、法律相談・行政書士業務には該当しません。個別の手続きについては行政書士・弁護士・登録支援機関にご相談ください。最新情報は出入国在留管理庁 (https://www.moj.go.jp/isa/) でご確認ください。";

let nextRpcId = 1;

function parseSse(text) {
  const line = text.split(/\r?\n/).find((candidate) => candidate.startsWith("data: "));
  if (line === undefined) {
    throw new Error(`No SSE data line found. Response starts with: ${text.slice(0, 200)}`);
  }
  return JSON.parse(line.slice("data: ".length));
}

async function rpc(method, params, sessionId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId !== undefined) {
    headers["Mcp-Session-Id"] = sessionId;
  }
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: nextRpcId, method, params }),
    signal: controller.signal,
  });
  try {
    nextRpcId += 1;
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${method} failed: HTTP ${response.status} ${text.slice(0, 300)}`);
    }
    return { response, payload: parseSse(text) };
  } finally {
    clearTimeout(timeout);
  }
}

async function createSession() {
  const init = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {
      extensions: {
        "io.modelcontextprotocol/ui": {
          mimeTypes: ["text/html;profile=mcp-app"],
        },
      },
    },
    clientInfo: { name: "ssw-screenshot-capture", version: "1.0.0" },
  });
  const sessionId = init.response.headers.get("mcp-session-id") ?? undefined;
  if (sessionId === undefined) throw new Error("initialize did not return mcp-session-id");
  await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
  return sessionId;
}

async function callTool(sessionId, name, args) {
  console.log(`Calling ${name} ...`);
  const result = await rpc("tools/call", { name, arguments: args }, sessionId);
  const structured = result.payload.result?.structuredContent;
  if (structured === undefined) {
    throw new Error(`${name} did not return structuredContent`);
  }
  return structured;
}

async function toolOrFixture(sessionId, name, args, fixture) {
  try {
    return await callTool(sessionId, name, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Using fixture for ${name}: ${message}`);
    return fixture;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function styleFor(appName) {
  const html = readFileSync(resolve(ROOT, "ui", appName, "mcp-app.html"), "utf-8");
  const match = /<style>([\s\S]*?)<\/style>/.exec(html);
  if (match?.[1] === undefined) throw new Error(`No style block found for ${appName}`);
  return `${match[1]}
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    body { width: 1200px; }
  `;
}

function page(title, appName, body) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=1200, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>${styleFor(appName)}</style>
  </head>
  <body><div id="root">${body}</div></body>
</html>`;
}

function chips(options, selected, disabled = false) {
  return `<div class="chip-row">${options
    .map(([value, label]) => {
      const selectedClass = value === selected ? " chip--selected" : "";
      return `<button type="button" class="chip${selectedClass}"${disabled ? " disabled" : ""}>${escapeHtml(label)}</button>`;
    })
    .join("")}</div>`;
}

function renderClassifier(result) {
  const bundle = result.formBundle ?? {};
  const procedure = bundle.procedure ?? "change";
  const org = bundle.receivingOrganizationProfile ?? "corporation";
  const applicant = bundle.applicantProfile ?? "technical_intern_2_same_field";
  const industry = bundle.industry ?? "agriculture";
  const requiredSections = bundle.requiredSections ?? ["table1", "table2_2", "table3"];
  const omittedSections = bundle.omittedSections ?? [];
  const sections = {
    table1: "第1表",
    table2_1: "第2表の1",
    table2_2: "第2表の2",
    table2_3: "第2表の3",
    table3: "第3表",
  };
  const body = `
    <small class="notice-l1" role="note">${escapeHtml(NOTICE)}</small>
    <article class="decision classifier" tabindex="0">
      <h3>申請ルート判定: ${escapeHtml(result.procedureLabel?.ja ?? "在留資格変更許可申請")}</h3>
      <p class="rationale">${escapeHtml(result.rationale ?? "")}</p>
      <section class="classifier-step"><h4>1. どの申請か</h4>${chips(
        [
          ["coe", "認定"],
          ["change", "変更"],
          ["renewal", "更新"],
        ],
        procedure,
      )}</section>
      <section class="classifier-step"><h4>2. 所属機関の状況</h4>${chips(
        [
          ["same_fiscal_year_repeat", "同年度2人目以降"],
          ["table2_1_eligible", "第2表の1 該当"],
          ["corporation", "法人"],
          ["sole_proprietor", "個人事業主"],
        ],
        org,
      )}</section>
      <section class="classifier-step"><h4>3. 申請人の状況</h4>${chips(
        [
          ["technical_intern_2_same_field", "技能実習2号・同分野"],
          ["technical_intern_2_different_field", "技能実習2号・異分野"],
          ["no_exemption", "試験免除なし"],
        ],
        applicant,
      )}</section>
      <div class="profile-warning">
        技能実習の職種・作業と特定技能分野の対応を公式資料で確認してください。<br />
        同一分野として扱える場合のみ技能試験・日本語試験の両方が免除候補になります。
      </div>
      <section class="classifier-step"><h4>4. 分野</h4>${chips(
        [
          ["agriculture", "農業"],
          ["fishery", "漁業"],
          ["construction", "建設"],
          ["nursing_care", "介護"],
          ["food_service", "外食"],
          ["food_manufacturing", "飲食料品製造"],
        ],
        industry,
      )}</section>
      <section class="result-panel">
        <h4>必要になる表</h4>
        <ul>${requiredSections.map((section) => `<li>${escapeHtml(sections[section] ?? section)}</li>`).join("")}</ul>
        ${
          omittedSections.length > 0
            ? `<p class="omission">省略候補: ${omittedSections.map((section) => sections[section] ?? section).join(" / ")}</p>`
            : ""
        }
      </section>
      <div class="action-row"><button type="button" class="primary-action">この内容で必要書類チェックリストへ進む</button></div>
    </article>
    <p role="note" class="disclaimer">${escapeHtml(result.disclaimer ?? DISCLAIMER_FALLBACK)}</p>
    <p class="meta">${AS_OF}: ${escapeHtml(result.asOf ?? "2026-05")}</p>`;
  return page("SSW Compass classifier", "ssw-classify", body);
}

function trustBadge(_trustLevel) {
  return `<span class="trust-badge trust-badge--primary" aria-label="一次情報">一次情報</span>`;
}

function statusLabel(status) {
  const labels = {
    required: "必須",
    omitted_due_to_category: "条件により省略",
    applicant_specific: "申請人次第",
    sector_specific: "分野別",
  };
  return labels[status] ?? status;
}

function renderChecklist(result) {
  const groups = [
    ["table1", "第1表: 申請人"],
    ["table2", "第2表: 所属機関"],
    ["table3", "第3表: 分野"],
    ["reference_form", "参考様式"],
    ["omission", "省略候補"],
  ];
  const rows = groups
    .map(([group, title]) => {
      const docs = result.documents.filter((doc) => doc.group === group);
      if (docs.length === 0) return "";
      const items = docs
        .map((doc, index) => {
          const languageBadges = [
            doc.applicantUnderstandingRequired
              ? `<span class="language-badge language-badge--required">母国語確認</span>`
              : "",
            doc.multilingualTemplateAvailable
              ? `<span class="language-badge language-badge--available">多言語様式あり</span>`
              : "",
          ].join("");
          const checked = index === 0 && group === "table1" ? " checked" : "";
          return `<li class="doc-row">
            <input type="checkbox"${checked} />
            <div class="doc-meta">
              <label class="doc-label">
                <h3>${escapeHtml(doc.label?.ja ?? doc.id)}
                  <span class="status-badge status-${escapeHtml(doc.status)}">${escapeHtml(statusLabel(doc.status))}</span>
                  ${trustBadge(doc.trustLevel)}
                </h3>
              </label>
              <p class="desc">${escapeHtml(doc.description)}</p>
              <div class="language-badges">${languageBadges}</div>
              ${doc.ministry ? `<small class="ministry">所管: ${escapeHtml(doc.ministry)}</small>` : ""}
              ${
                doc.multilingualSourceUrl
                  ? `<small class="language-source">${escapeHtml(doc.multilingualSourceUrl)}</small>`
                  : ""
              }
            </div>
          </li>`;
        })
        .join("");
      return `<section class="doc-group"><h2>${escapeHtml(title)}</h2><ul>${items}</ul></section>`;
    })
    .join("");
  const body = `
    <small class="notice-l1" role="note">${escapeHtml(NOTICE)}</small>
    <div class="doc-list">${rows}</div>
    <div class="notes"><label>備考 (任意、個人情報は入力しないでください)</label><textarea placeholder="例: 農業分野を希望している、試験は来月受験予定 など"></textarea></div>
    <div class="commit-bar"><button type="button" class="commit-btn" disabled>この内容でAIに次の質問をする</button><span class="commit-status">変更がないと送信できません</span></div>
    <p role="note" class="disclaimer">${escapeHtml(result.disclaimer ?? DISCLAIMER_FALLBACK)}</p>
    <p class="meta">${AS_OF}: ${escapeHtml(result.asOf ?? "2026-05")}</p>`;
  return page("SSW Compass document checklist", "ssw-checklist", body);
}

function renderSearch(result) {
  const firstTitles = result.results
    .slice(0, 3)
    .map((item) => item.title)
    .join(" / ");
  const body = `
    <small class="notice-l1" role="note">${escapeHtml(NOTICE)}</small>
    <article class="summary-card">
      <h2>公式情報源にもとづく要点</h2>
      <p>${escapeHtml(`${result.results.length}件の一次情報を確認しました。まずは申請種別、必要書類、期限の順に確認してください。主な根拠: ${firstTitles}`)}</p>
      <div class="followup-row">
        <span class="followup-chip">申請種別を判定する</span>
        <span class="followup-chip">必要書類を確認する</span>
        <span class="followup-chip">期限を確認する</span>
      </div>
      <button type="button" class="sources-chip">出典を確認 (${result.results.length})</button>
    </article>
    <p role="note" class="disclaimer">${escapeHtml(result.disclaimer ?? DISCLAIMER_FALLBACK)}</p>
    <p class="meta">${AS_OF}: ${escapeHtml(result.asOf ?? "2026-05")}</p>`;
  return page("SSW Compass search summary", "ssw-search", body);
}

function renderTimeline(result) {
  const rows = result.deadlines
    .map((deadline) => {
      const forms =
        Array.isArray(deadline.relatedForms) && deadline.relatedForms.length > 0
          ? `<div class="related-forms"><strong>関連様式</strong><ul>${deadline.relatedForms
              .map(
                (form) =>
                  `<li><a href="${escapeHtml(form.sourceUrl)}">${escapeHtml(form.title)}</a></li>`,
              )
              .join("")}</ul></div>`
          : "";
      return `<li class="deadline" tabindex="0">
        <h3>${escapeHtml(deadline.label?.ja ?? deadline.kind)} ${trustBadge(deadline.trustLevel)}</h3>
        <span class="relative">${escapeHtml(deadline.relativeLabel?.ja ?? "")}</span>
        ${deadline.dueBy ? `<span class="due-by">期限 (目安): ${escapeHtml(deadline.dueBy)}</span>` : ""}
        <p class="description">${escapeHtml(deadline.description)}</p>
        ${forms}
      </li>`;
    })
    .join("");
  const body = `
    <small class="notice-l1" role="note">${escapeHtml(NOTICE)}</small>
    <section><h2 class="sr-only">期限タイムライン</h2><ul class="timeline">${rows}</ul></section>
    <p role="note" class="disclaimer">${escapeHtml(result.disclaimer ?? DISCLAIMER_FALLBACK)}</p>
    <p class="meta">${AS_OF}: ${escapeHtml(result.asOf ?? "2026-05")}</p>`;
  return page("SSW Compass deadline timeline", "ssw-timeline", body);
}

function renderZairyu(result) {
  const issues = (result.legal_basis ?? [])
    .map((basis) => `<li>${escapeHtml(basis)}</li>`)
    .join("");
  const body = `
    <article class="panel">
      <span class="badge ${escapeHtml(result.compatibility)}">${escapeHtml(result.compatibility)}</span>
      <h2>在留資格と業務の適合性</h2>
      <p>${escapeHtml(result.recommended_action)}</p>
      ${issues.length > 0 ? `<ul class="issues">${issues}</ul>` : ""}
      <div class="cta">行政書士または弁護士による確認を推奨します。</div>
      <p class="disclaimer">${escapeHtml(result.disclaimer ?? DISCLAIMER_FALLBACK)}</p>
    </article>`;
  return page("SSW Compass zairyu warning", "ssw-validate", body);
}

const FIXTURES = {
  classifier: {
    procedureType: "zairyu_shikaku_henko",
    procedureLabel: { ja: "在留資格変更許可申請", en: "Change of status", id: "Perubahan status" },
    rationale:
      "日本国内にいる技能実習2号修了者が特定技能1号へ移行するため、在留資格変更許可申請の確認が必要です。",
    formBundle: {
      procedure: "change",
      receivingOrganizationProfile: "corporation",
      applicantProfile: "technical_intern_2_same_field",
      industry: "agriculture",
      requiredSections: ["table1", "table2_2", "table3"],
      omittedSections: ["table2_1"],
    },
    references: [],
    disclaimer: DISCLAIMER_FALLBACK,
    asOf: "2026-05",
  },
  checklist: {
    documents: [
      {
        id: "table1-application",
        label: { ja: "第1表 申請人に関する必要書類", en: "Table 1", id: "Tabel 1" },
        description: "在留資格変更許可申請で申請人に関する基本情報を確認します。",
        status: "required",
        group: "table1",
        trustLevel: "primary_source",
        ministry: "出入国在留管理庁",
      },
      {
        id: "table2-org",
        label: { ja: "第2表の2 所属機関に関する必要書類 (法人)", en: "Table 2-2", id: "Tabel 2-2" },
        description: "第2表の1に該当しない法人の受入機関情報を確認します。",
        status: "required",
        group: "table2",
        trustLevel: "primary_source",
        ministry: "出入国在留管理庁",
      },
      {
        id: "table3-agriculture",
        label: {
          ja: "第3表（特定技能所属機関概要書）農業",
          en: "Table 3 agriculture",
          id: "Tabel 3 pertanian",
        },
        description: "農業分野の所属機関概要と分野別要件を確認します。",
        status: "sector_specific",
        group: "table3",
        trustLevel: "primary_source",
        ministry: "農林水産省 / 出入国在留管理庁",
      },
      {
        id: "ref-1-5-employment-contract",
        label: { ja: "特定技能雇用契約書", en: "Employment contract", id: "Kontrak kerja" },
        description: "申請人本人に特に理解いただいた上で署名が必要な様式です。",
        status: "required",
        group: "reference_form",
        trustLevel: "primary_source",
        ministry: "出入国在留管理庁",
        applicantUnderstandingRequired: true,
        multilingualTemplateAvailable: true,
        multilingualSourceUrl: "https://www.moj.go.jp/isa/applications/ssw/10_00020.html",
      },
      {
        id: "ref-1-17-support-plan",
        label: { ja: "1号特定技能外国人支援計画書", en: "Support plan", id: "Rencana dukungan" },
        description: "特定技能1号では支援計画の作成と説明が必要です。",
        status: "required",
        group: "reference_form",
        trustLevel: "primary_source",
        ministry: "出入国在留管理庁",
        applicantUnderstandingRequired: true,
        multilingualTemplateAvailable: true,
        multilingualSourceUrl: "https://www.moj.go.jp/isa/applications/ssw/10_00020.html",
      },
      {
        id: "table2-omission",
        label: {
          ja: "第2表の1 省略対象機関",
          en: "Table 2-1 omission",
          id: "Pengecualian Tabel 2-1",
        },
        description:
          "上場企業、源泉徴収税額1000万円以上、3年継続受入実績等では一部省略候補になります。",
        status: "omitted_due_to_category",
        group: "omission",
        trustLevel: "primary_source",
        ministry: "出入国在留管理庁",
      },
    ],
    disclaimer: DISCLAIMER_FALLBACK,
    asOf: "2026-05",
  },
  search: {
    results: [
      {
        title: "特定技能制度 総合案内",
        snippet: "申請種別、必要書類、届出期限を確認する入口です。",
        sourceUrl: "https://www.moj.go.jp/isa/applications/ssw/index.html",
        sourceType: "primary_source",
        sourceDate: "2026-05",
        confidence: 0.9,
      },
      {
        title: "特定技能所属機関による届出",
        snippet: "随時届出と定期届出の期限を確認します。",
        sourceUrl: "https://www.moj.go.jp/isa/applications/ssw/nyuukokukanri07_00215.html",
        sourceType: "primary_source",
        sourceDate: "2026-05",
        confidence: 0.86,
      },
      {
        title: "農業分野における特定技能外国人の受入れ",
        snippet: "農業分野の制度概要、協議会、試験情報を確認します。",
        sourceUrl: "https://www.maff.go.jp/j/new_farmer/n_syurou/t_ginou.html",
        sourceType: "primary_source",
        sourceDate: "2026-05",
        confidence: 0.82,
      },
    ],
    disclaimer: DISCLAIMER_FALLBACK,
    asOf: "2026-05",
  },
  timeline: {
    deadlines: [
      {
        kind: "notification_14days",
        label: { ja: "随時届出 (14日以内)", en: "Ad-hoc notification", id: "Pemberitahuan" },
        description:
          "支援計画を変更したときは、出入国在留管理庁への届出を事由発生から14日以内に行う必要があります。",
        relativeLabel: { ja: "事由発生から14日以内", en: "within 14 days", id: "dalam 14 hari" },
        dueBy: "2026-05",
        relatedForms: [
          {
            id: "ref-3-2-support-plan-change",
            title: "支援計画変更に係る届出書 (参考様式第3-2号)",
            sourceUrl: "https://www.moj.go.jp/isa/content/001340521.xlsx",
          },
        ],
        trustLevel: "primary_source",
      },
    ],
    references: [],
    disclaimer: DISCLAIMER_FALLBACK,
    asOf: "2026-05",
  },
  zairyu: {
    compatibility: "ILLEGAL",
    legal_basis: ["入管法 §19-1", "入管法 §73-2"],
    recommended_action:
      "就労を即時停止し、資格認定を受けた行政書士または弁護士に相談してください。入管法 §73-2 により受入企業にも過失処罰が適用されます。",
    escalate_to_professional: true,
    disclaimer: DISCLAIMER_FALLBACK,
  },
};

function capturePng(html, fileName, height = 1200) {
  mkdirSync(TMP_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const htmlPath = join(TMP_DIR, `${fileName}.html`);
  const pngPath = resolve(OUTPUT_DIR, `${fileName}.png`);
  writeFileSync(htmlPath, html);
  const result = spawnSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--window-size=1200,${height}`,
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`,
    ],
    { encoding: "utf-8" },
  );
  if (result.status !== 0) {
    throw new Error(`Chrome screenshot failed for ${fileName}: ${result.stderr || result.stdout}`);
  }
  console.log(`Wrote ${pngPath}`);
}

let sessionId;
try {
  sessionId = await createSession();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Using all fixtures: initialize failed (${message})`);
}

const classifier =
  sessionId === undefined
    ? FIXTURES.classifier
    : await toolOrFixture(
        sessionId,
        "classify_procedure",
        {
          currentStatus: "ginou_jisshu_2",
          targetStatus: "tokutei_ginou_1",
          location: "japan",
          industry: "agriculture",
          yearMonth: "2026-05",
          language: "ja",
        },
        FIXTURES.classifier,
      );
const checklist =
  sessionId === undefined
    ? FIXTURES.checklist
    : await toolOrFixture(
        sessionId,
        "list_visa_documents",
        {
          visaCategory: "tokutei_ginou_1",
          industry: "agriculture",
          language: "ja",
        },
        FIXTURES.checklist,
      );
const search =
  sessionId === undefined
    ? FIXTURES.search
    : await toolOrFixture(
        sessionId,
        "search_visa",
        {
          category: "tokutei_ginou_1",
          industry: "agriculture",
          yearMonth: "2026-05",
          language: "ja",
        },
        FIXTURES.search,
      );
const timeline =
  sessionId === undefined
    ? FIXTURES.timeline
    : await toolOrFixture(
        sessionId,
        "get_deadline_timeline",
        {
          visaCategory: "tokutei_ginou_1",
          eventContext: "support_plan_change",
          referenceYearMonth: "2026-05",
          language: "ja",
        },
        FIXTURES.timeline,
      );
const zairyu =
  sessionId === undefined
    ? FIXTURES.zairyu
    : await toolOrFixture(
        sessionId,
        "validate_zairyu_compatibility",
        {
          zairyu_status: "ryugaku",
          intended_industry: "agriculture",
          intended_task: "農業のフルタイム作業",
          expiry_date: "2027-03-31",
          language: "ja",
        },
        FIXTURES.zairyu,
      );

capturePng(renderClassifier(classifier), "01-classifier", 1300);
capturePng(renderChecklist(checklist), "02-documents-checklist", 1700);
capturePng(renderSearch(search), "03-search-summary", 900);
capturePng(renderTimeline(timeline), "04-deadline-timeline", 1100);
capturePng(renderZairyu(zairyu), "05-zairyu-warning", 900);
