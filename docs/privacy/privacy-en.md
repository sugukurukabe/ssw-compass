# SSW Compass Privacy Policy

> **Status**: Active public draft — Pending final gyoseishoshi review
> **Last updated**: 2026-04-29
> **URL**: https://mcp.ssw-compass.jp/privacy

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
- Full names, dates of birth, home addresses
- Any other personally identifiable information

When detected: automatically blocked and not processed.

**Log data collected** (Google Cloud Logging):
- Service access timestamps and security metadata (IP addresses may be processed by Cloud Run / Cloud Armor logs for security, but are not used for profiling)
- Tool invocation types (no personal data)
- Error logs

---

## 3. Purpose of Data Use

- Service stability and quality improvement
- Unauthorized access detection and prevention
- Audit log retention (7 years — per Gyoseishoshi Act §9 business records requirement)

---

## 4. Third-Party Disclosure

We do not sell or provide log data to third parties, except:
- When required by law
- To protect life, body, or property

---

## 5. Cloud Services Used

| Service | Purpose | Data location |
|---|---|---|
| Google Cloud Run | Application hosting | Japan (asia-northeast1) |
| Google Cloud Logging | Log collection | Japan |
| Google Cloud Armor | Security WAF | Global |
| Vertex AI Search | Information retrieval | Japan |

We do not intentionally collect personal information. Operational security metadata may be processed by Google Cloud global edge services such as Cloud Armor; no visa application content or personal identifiers are transferred cross-border by SSW Compass.

---

## 6. Security

- TLS 1.2/1.3 encryption for all communications
- Cloud Armor WAF for unauthorized access prevention
- Automatic PII detection and blocking (Cloud DLP + regex, two-stage)
- Output sanitizer for indirect prompt injection defense
- 7-year WORM audit log storage

---

## 7. Disclaimer

This service provides general information only.
**It does not constitute legal advice or gyoseishoshi services.**
For individual cases, consult a certified gyoseishoshi, attorney, or registered support organization.
Per the amended Gyoseishoshi Act §19 (effective January 1, 2026), preparation of
official documents as a service may only be performed by a gyoseishoshi.

---

## 8. Policy Changes

When this policy is updated, the revision date will be noted here.
Significant changes will be announced in advance.

---

## 9. Contact

Privacy inquiries: a_kabe@sugu-kuru.co.jp

---

*This policy will be published in its final form after review by a certified gyoseishoshi.*
*The current draft is for reference purposes only.*
