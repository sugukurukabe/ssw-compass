# Screenshot Capture Guide — Sprint 5 UX

> Target: Anthropic Connectors Directory MCP Apps carousel.
> Format: PNG, width >= 1000px, cropped to app response only.

## Required screenshots

| # | Prompt | Expected UI | File name |
|---|---|---|---|
| 1 | `技能実習2号から特定技能1号・農業へ変更したい。どの申請で、どの表が必要？` | `classify_procedure` 4-step classifier with technical-intern field-mapping warning | `01-classifier.png` |
| 2 | `特定技能1号・農業で必要書類チェックリストを見せて。省略できる書類も分けて` | grouped `list_visa_documents` checklist with omission + multilingual badges | `02-documents-checklist.png` |
| 3 | `特定技能1号・農業の手続きで、まず何から確認すべき？` | summary-first `search_visa` card, sources collapsed | `03-search-summary.png` |
| 4 | `支援計画を変更したときの届出期限と様式を確認して` | compact `get_deadline_timeline` UI with related form links | `04-deadline-timeline.png` |
| 5 | `留学ビザの人を農業でフルタイム雇用してよいか確認して` | `validate_zairyu_compatibility` H06 warning UI | `05-zairyu-warning.png` |

## Manual capture

1. Open Claude Web with SSW Compass enabled.
2. Run the prompt.
3. Wait until the widget iframe title becomes `ssw compass の埋め込み`.
4. Open Chrome DevTools Elements.
5. Select the widget iframe or its immediate app-response container.
6. Use `Capture node screenshot`.
7. Save under `docs/screenshots/`.
8. Verify width:

```bash
sips -g pixelWidth docs/screenshots/*.png
```

## Acceptance checks

- Prompt text is not visible in the image.
- Claude sidebar / composer / browser chrome are not visible.
- The app card width is >= 1000px.
- Screenshot #3 has sources collapsed by default.
- Screenshot #1 shows the four classifier rows and the technical-intern field-mapping warning.
- Screenshot #2 shows grouped sections including at least one omission candidate and multilingual/native-language badges.
- Screenshot #4 shows a related official form link.
- Screenshot #5 shows a warning or illegal-work risk state.

## Machine checks

After placing screenshots under `docs/screenshots/`, run:

```bash
pnpm check:submission
```

This command reports missing screenshots as pending. Before final submission,
run strict mode:

```bash
pnpm check:submission:strict
```

Strict mode must pass before submitting to Anthropic or OpenAI.

