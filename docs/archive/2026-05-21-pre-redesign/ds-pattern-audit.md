# DS Pattern Audit for issue #107

Date: 2026-05-22
Scope: `packages/web/src/`

## Summary

Recurring ad-hoc UI compositions were still present after the LP, dashboard,
and automation rebuilds. The audit promoted three patterns with 3+ existing
uses into documented UI components:

| Pattern                           | Evidence                                                                                                                                                               | Decision                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Icon + label row                  | `grep -R --include='*.tsx' -n 'flex items-center gap-2' packages/web/src` still returns 109 residual matches after refactoring promoted spots.                         | Promoted `IconLabel`.              |
| Label + control + optional helper | `grep -R --include='*.tsx' -n 'className="space-y-2"' packages/web/src/app packages/web/src/components` returns 129 residual matches after refactoring promoted spots. | Promoted `FormRow`.                |
| Status badge mappings             | `grep -R --include='\*.tsx' -n 'variant="destructive"\\                                                                                                                | variant="secondary"\\              | variant={.\*status\\                                                                                                | bg-green-50\\                                                                                                                     | bg-red-50\\ | bg-yellow-50' packages/web/src/app packages/web/src/components` returns 65 residual matches after refactoring promoted spots. | Promoted `StatusBadge`. |
| Bordered interactive cards        | `grep -R --include='*.tsx' -n 'rounded-lg border .*hover:bg-muted/50\\                                                                                                 | cursor-pointer hover:bg-muted/50\\ | rounded-lg border bg-background p-4' packages/web/src/app packages/web/src/components` returns 14 residual matches. | Documented as follow-up candidate; not promoted in this slice because the usages mix radio options, stat tiles, and article rows. |
| Dashboard stat tiles              | Existing `MetricCard` already covers KPI cards; remaining tiles use feature-specific loading/icon behavior.                                                            | No new component in this slice.    |

## Promoted Components

### `IconLabel`

Repeated shape: a Lucide icon followed by label text in headings, inline status
messages, row actions, and checklist items.

Refactored spots:

- `packages/web/src/app/(dashboard)/dashboard/automation/AutomationSettingsClient.tsx`
- `packages/web/src/app/(dashboard)/dashboard/websites/[id]/edit/AutoScheduleForm.tsx`
- `packages/web/src/app/(dashboard)/dashboard/websites/external/[id]/edit/ExternalWebsiteAutoScheduleForm.tsx`
- `packages/web/src/app/(dashboard)/dashboard/page.tsx`
- `packages/web/src/app/(dashboard)/dashboard/automation-status-card.tsx`
- `packages/web/src/app/(dashboard)/dashboard/websites/external/ExternalWebsiteList.tsx`

### `FormRow`

Repeated shape: `space-y-2` wrapper, `Label`, control, optional helper copy.

Refactored spots:

- `packages/web/src/app/(dashboard)/dashboard/websites/new/NewWebsiteForm.tsx`
- `packages/web/src/app/(dashboard)/dashboard/websites/[id]/edit/AutoScheduleForm.tsx`
- `packages/web/src/app/(dashboard)/dashboard/websites/external/[id]/edit/ExternalWebsiteAutoScheduleForm.tsx`
- `packages/web/src/app/(dashboard)/dashboard/websites/external/ExternalWebsiteList.tsx`

### `StatusBadge`

Repeated shape: ad-hoc `Badge` variant switches and hand-coded
green/yellow/red badge class names.

Refactored spots:

- `packages/web/src/app/(dashboard)/dashboard/websites/external/ExternalWebsiteList.tsx`
- `packages/web/src/components/articles/ArticleStatusBadge.tsx`
- `packages/web/src/components/articles/PublishPlanTable.tsx`
- `packages/web/src/app/(dashboard)/dashboard/articles/manage/components/ArticleList.tsx`
- `packages/web/src/app/(dashboard)/dashboard/admin/subscriptions/page.tsx`
- `packages/web/src/app/(dashboard)/dashboard/automation-status-card.tsx`

## Verification Notes

- Added component tests for `IconLabel`, `FormRow`, and `StatusBadge`.
- Ran focused UI tests and web typecheck during implementation.
- No new design tokens were introduced; promoted components use existing
  semantic and state token classes.
