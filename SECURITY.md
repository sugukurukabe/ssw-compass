# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 4.x (current) | ✅ |
| 3.x and below | ❌ |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

To report a security vulnerability:

1. Email: **a_kabe@sugu-kuru.co.jp**
2. Subject: `[SECURITY] SSW Compass vulnerability report`
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested mitigations (optional)

You will receive an acknowledgement within **48 hours** and a detailed response within **7 business days**.

## Security Considerations

### PII Protection

SSW Compass is designed to never process personal information:
- Residence card numbers, passport numbers, My Number are **automatically blocked** before processing
- Cloud DLP provides a second detection layer
- No personal data is stored in Vertex AI Search or application logs (hashes only in audit log)

### Authentication

- Free tier: anonymous (no credentials required)
- Pro tier: HS256 JWT (ADR-013)
- Cloud Run: IAM + `allow_unauthenticated=true` + Cloud Armor WAF

### Infrastructure

- All traffic via Global HTTPS LB + Cloud Armor WAF
- VPC egress with static NAT IP
- No SSH access to production infrastructure
- WIF (Workload Identity Federation) for CI/CD — no long-lived credentials

### Known Security Limitations

1. **Vertex AI Search in fixture mode**: Real content not yet indexed (Sprint 5 Phase B1)
2. **DLP sensitivity**: Custom ZAIRYU_CARD_NUMBER infoType via Cloud DLP (regex as fallback)
3. **Pro tier JWT issuance**: Manual token issuance (OAuth AS planned Sprint 5)

## Disclosure Policy

We follow **responsible disclosure**:
- 90-day window to patch before public disclosure
- We will credit reporters in the release notes (unless they prefer anonymity)
- We will not take legal action against good-faith security researchers

## License

This security policy is part of the SSW Compass project, licensed under Apache-2.0.
