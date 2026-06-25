# SSW Compass Privacy Policy

> **Status**: Full version — Pending final gyoseishoshi review (wording must be reviewed by a certified gyoseishoshi)
> **Last updated**: 2026-06-26
> **URL**: https://mcp.ssw-compass.jp/privacy
> **Canonical**: The body served at `/privacy` is `apps/server/src/privacy/policy.ts`. This document is its human-facing mirror.

---

## 1. Service Operator

- **Name**: Sugukuru Inc. (スグクル株式会社)
- **Address**: Kagoshima Prefecture, Japan
- **Contact**: a_kabe@sugu-kuru.co.jp

---

## 2. Information We Collect

SSW Compass does **not collect personal information**.

The following are **not accepted** as inputs:
- Residence card numbers, passport numbers, My Number (個人番号)
- Full names, dates of birth (year-month only is permitted), home addresses
- Any other personally identifiable information

When detected: automatically blocked and not processed.

**Operational metadata handled** (Google Cloud Logging):
- Service access timestamps and security metadata (IP addresses may be processed by Cloud Run / Cloud Armor logs for security, but are not used for profiling)
- Tool invocation types (no personal data)
- Error logs

---

## 3. Purpose of Use

- Service stability and quality improvement
- Detection and prevention of unauthorized access and abuse
- Retention of records required by law and audit obligations

---

## 4. Data Storage and Retention

- We do not store personal information. Visa application content and personal identifiers are not stored on our servers.
- Audit logs are forwarded from Cloud Logging to WORM storage on GCS and retained for **7 years** (tamper-resistant, append-only; ADR-015). Audit logs contain no PII.
- Operational metadata is retained only as long as necessary, then deleted.

---

## 5. Third-Party Disclosure

We do not sell or provide collected operational metadata to third parties. Because we hold no personal information, no PII is shared with third parties. We may respond, only within the scope of law:
- When required by law
- To protect life, body, or property

---

## 6. Data Location and Cross-Border Transfer

| Service | Purpose | Data location |
|---|---|---|
| Google Cloud Run | Application hosting | Japan (asia-northeast1) |
| Google Cloud Logging | Log collection | Japan |
| Google Cloud Armor | Security WAF | Global |
| Vertex AI Search | Information retrieval | Japan |

We do not intentionally collect personal information. Operational security metadata may be processed by Google Cloud global edge services such as Cloud Armor; no visa application content or personal identifiers are transferred cross-border by SSW Compass.

---

## 7. Your Rights

This is an anonymous, free informational service that, as a rule, holds no personal information. Accordingly, there is normally no data tied to a specific individual that is subject to disclosure, correction, or deletion. For privacy questions or requests, contact a_kabe@sugu-kuru.co.jp; we will respond appropriately under applicable law.

> **Pending gyoseishoshi review**: concrete request-handling procedures under APPI.

---

## 8. Security

- TLS 1.2/1.3 encryption for all communications
- Cloud Armor WAF for unauthorized access prevention
- Automatic PII detection and blocking (multi-stage defense)
- Output sanitizer for indirect prompt injection defense
- 7-year WORM audit log storage

---

## 9. Legal Status and Disclaimer

This service provides general information only.
**It does not constitute legal advice or gyoseishoshi services.**
For individual cases, consult a certified gyoseishoshi, attorney, or registered support organization.
It complies with the amended Gyoseishoshi Act Article 19 (scope of information provision) and does not prepare official application documents on your behalf.

> **Pending gyoseishoshi review**: definitive statements on specific statutes to be finalized after professional review.

---

## 10. Policy Changes

When this policy is updated, the revision date will be noted here.
Significant changes will be announced in advance where feasible.

---

## 11. Contact

Privacy inquiries: a_kabe@sugu-kuru.co.jp

---

## 12. Governing Law

This policy is governed by the laws of Japan and is interpreted and operated in accordance with the Act on the Protection of Personal Information (APPI) and related laws.

---

*The final wording of this policy must be reviewed by a certified gyoseishoshi before publication.*
