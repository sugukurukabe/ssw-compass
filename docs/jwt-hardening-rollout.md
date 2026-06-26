# JWT iss/aud ハードニング有効化手順 (T11)

> JWT iss/aud hardening rollout guide (T11)
> Panduan pengaktifan pengerasan iss/aud JWT (T11)

本書は **Pro/JWT 認可ハードニング (T11)** で追加した `iss`/`aud` 検証を、
本番 Pro ユーザーを 401 で締め出さずに有効化するための移行手順を示す。

- 関連: ADR-013 (Interface Freeze)、AGENTS.md §4「絶対に触ってはいけない境界（認証）」。
- 対象コード: `apps/server/src/auth/token-verifier.ts`、`scripts/issue-jwt.ts`。
- **このハードニングは opt-in。env 未設定なら従来どおり (iss/aud 非検証) で動作する。**

---

## 1. 背景 / なぜ opt-in か

現状の `JwtTokenVerifier` は HS256 自己検証 + `exp` + `tier` のみを検証し、
`iss`/`aud` を検証していなかった。既存の発行トークン (`scripts/issue-jwt.ts`) も
`iss`/`aud` を含まない。

したがって **`iss`/`aud` 検証をいきなり必須化すると、本番で稼働中の Pro ユーザーの
トークン (iss/aud 無し) が即座に 401 になる**。これは厳禁。

そこで本実装では、**期待値が環境変数で設定されている場合に限り** `iss`/`aud` を
検証する (opt-in)。未設定なら検証をスキップし、既存挙動を完全に維持する。

| env | 役割 | 未設定時 |
| --- | --- | --- |
| `SSW_JWT_EXPECTED_ISS` | 期待する `iss` (発行者)。例: トークン発行ゲートウェイの URL | `iss` を検証しない |
| `SSW_JWT_EXPECTED_AUD` | このリソースサーバーの canonical resource 識別子 (RFC 9728 / RFC 8707)。例: `https://mcp.ssw-compass.example/mcp` | `aud` を検証しない |

- 空文字 (`""`) は「未設定」と同義に正規化される (検証スキップ)。
- 設定時の挙動 (strict mode):
  - `SSW_JWT_EXPECTED_ISS` 設定時、トークンの `iss` が不一致 **または欠落** → `null` (→401)。
  - `SSW_JWT_EXPECTED_AUD` 設定時、トークンの `aud` に期待値が含まれない **または欠落** → `null` (→401)。
  - `aud` は文字列・文字列配列の両方を許容 (RFC 7519 §4.1.3)。配列は要素一致で受理。

> RFC 9728 (Protected Resource Metadata) / RFC 8707 (Resource Indicators):
> `SSW_JWT_EXPECTED_AUD` はこのサーバーのリソース識別子を表す。
> `.well-known/oauth-protected-resource` の公開自体は T8 で別途検討中・境界のため、
> 本タスクでは **検証ロジックと env 設計のみ** を提供する (well-known には触れない)。

---

## 2. 移行手順 (本番締め出しを避ける順序)

**順序が重要。トークン再発行を env 有効化より先に行う。**

### Phase 0 — 現状維持 (既定)

- `SSW_JWT_EXPECTED_ISS` / `SSW_JWT_EXPECTED_AUD` は **未設定**。
- 既存トークン (iss/aud 無し) はそのまま通る。挙動変化なし。

### Phase 1 — 新トークンに iss/aud を付与して再発行 (検証はまだ無効)

env を有効化する**前**に、Pro ユーザーへ iss/aud 入りトークンを配布する。

```bash
pnpm tsx scripts/issue-jwt.ts \
  --sub <user-id> --tier pro --gyoseishoshi-verified \
  --iss "https://auth.ssw-compass.example/issuer" \
  --aud "https://mcp.ssw-compass.example/mcp" \
  --expires 90d
```

- この時点では検証は無効なので、**新旧どちらのトークンも通る** (安全に移行できる)。
- 既存 Pro ユーザーのトークン (iss/aud 無し) も引き続き有効。

### Phase 2 — 全 Pro ユーザーが iss/aud 入りトークンへ移行完了するまで待つ

- 旧トークンの最大寿命 (`exp`、既定 90d) が切れる、または全員へ再発行が完了するまで待機。
- ここを飛ばして Phase 3 に進むと、未移行ユーザーが 401 になる。

### Phase 3 — env を投入して検証を有効化 (人間が実施)

> **本番 Cloud Run / Terraform の設定変更は本タスクのスコープ外。**
> env 投入とトークン再発行は **別途人間がレビューの上で実施**する。

Cloud Run サービスに以下の env を設定する (例。実値は環境に合わせる):

```bash
SSW_JWT_EXPECTED_ISS=https://auth.ssw-compass.example/issuer
SSW_JWT_EXPECTED_AUD=https://mcp.ssw-compass.example/mcp
```

- 設定後、`iss`/`aud` が一致しないトークン (= 他サーバー向け・改ざん・未移行) は 401。
- 片方だけ設定することも可能 (例: `aud` のみ厳格化)。未設定の側は検証スキップのまま。

### ロールバック

- 401 が増えた等の問題時は **env を削除 (または空文字に) するだけ** で Phase 0 に戻る。
- コード変更・再デプロイ不要 (env のみで切替可能)。

---

## 3. 検証 (有効化後の確認)

```bash
# 一致トークン → 200 (ツール実行まで到達)
curl -sS -X POST "$MCP_URL" -H "Authorization: Bearer $TOKEN_WITH_MATCHING_AUD" ...

# aud 不一致・iss 不一致・iss/aud 欠落トークン → 401
#   {"jsonrpc":"2.0","error":{"code":-32001,"message":"Unauthorized: invalid or expired token"},"id":null}
```

サーバーログには PII を含めず、拒否理由のみを記録する:

- `{"event":"jwt_rejected","reason":"issuer_mismatch"}`
- `{"event":"jwt_rejected","reason":"audience_mismatch"}`

---

## 4. トークンパススルー禁止 (確認結果)

下流呼び出しはクライアント JWT を渡さず、すべてサーバー側資格情報を使用する
(MCP のトークンパススルー禁止に準拠)。本タスクで該当箇所を確認済み:

| 下流 | 認証方式 | 該当コード |
| --- | --- | --- |
| Vertex AI Search | ADC (`SearchServiceClient`、Cloud Run SA) | `apps/server/src/vertex.ts` |
| GCS (成果物保存・署名 URL) | ADC (`@google-cloud/storage` `Storage()`) | `apps/server/src/tools/prepare-document-package/service.ts` |
| Cloud Tasks (非同期実行) | SA OIDC トークン (`oidcToken` + executor SA) | 同上 `enqueuePackageTask` |
| Supabase (承認状態) | `SUPABASE_SERVICE_ROLE_KEY` (サーバー専用) | `apps/server/src/approval/supabase-client.ts` |

- `verify()` の戻り値 `AuthContext` には**生トークンを含めない** (`user_id`/`tier` 等のみ)。
- クライアント JWT が下流 API の `Authorization` ヘッダに転送される箇所は **存在しない**。

---

## 5. 受け入れ条件チェック

- `SswCompassTokenVerifier.verify()` のシグネチャは不変 (ADR-013 Interface Freeze 準拠)。
  追加は `JwtTokenVerifier` のコンストラクタ任意第 2 引数のみ。
- `any` 不使用・biome 準拠。
- 既定 (env 未設定) では挙動変化なし = **本番への影響なし**。
