# Reviewer Instructions / 審査担当者向け手順

SSW Compass is a public, anonymous MCP app for Japanese Specified Skilled Worker procedure information. It provides information only, does not provide legal advice, does not represent users as a gyoseishoshi, and does not accept personal identifiers.

## Test Endpoints

- MCP endpoint: `https://mcp.ssw-compass.jp/mcp`
- Server Card: `https://mcp.ssw-compass.jp/.well-known/mcp.json`
- OpenAI manifest: `https://mcp.ssw-compass.jp/.well-known/ai-plugin.json`
- OpenAPI document: `https://mcp.ssw-compass.jp/.well-known/openapi.json`
- Privacy policy: `https://mcp.ssw-compass.jp/privacy`
- Pro information page: `https://ssw-compass.jp/pro` (also available at `https://mcp.ssw-compass.jp/pro`)
- Support contact: `a_kabe@sugu-kuru.co.jp`

## Expected Tool Visibility

Anonymous `tools/list` returns exactly these 6 read-only tools:

- `search_visa`
- `classify_procedure`
- `get_deadline_timeline`
- `list_visa_documents`
- `validate_zairyu_compatibility`
- `list_law_updates`

The 3 Pro tools are contractual and gated. They are not shown to anonymous callers:

- `prepare_document_package`
- `submit_gyoseishoshi_approval`
- `get_package_status`

Authenticated Pro review contexts may see those tools. Execution remains protected by scope and HITL gates, so anonymous or free callers cannot run Pro workflows.

## Sample Prompts

Use prompts without names, card numbers, passport numbers, My Number, or full dates of birth.

- Japanese: `技能実習2号を農業分野で良好に修了しました。特定技能1号・農業に切り替えるには、どの申請が必要ですか？試験免除になるかも教えてください。`
- English: `Show me the list of documents required for a Change of Status application to Specified Skilled Worker (i) in agriculture. If any documents can be omitted, please separate them out.`
- Bahasa Indonesia: `Saya ingin memeriksa tenggat pemberitahuan dan formulir saat rencana dukungan berubah. Tolong rangkum juga periode pemberitahuan berkala, waktu perpanjangan visa, dan batas kumulatif 5 tahun.`

Expected behavior: answers are grounded in official sources, include the standard disclaimer, and stay within information-only guidance.

## Origin Policy

POST `/mcp` accepts requests from native MCP clients with no `Origin` header and from Claude / ChatGPT web origins. Other browser origins receive `403`.
