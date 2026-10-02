# Web Analytics Insight

Surfaces a meaningful traffic trend. Read-only. Describes the skill only; nothing here executes.

## When to use
- Traffic moved by 20% or more versus the previous period.

## When not to use
- Traffic is roughly flat.

## Required data
- `graph.analytics.trend`, `graph.analytics.changePct`

## Read actions
- `getAnalytics()`

## Validation rules
- Recompute the change; only report it if it is still meaningful.

## Write actions
- None

## Approval requirement
- Start approval only. Nothing is written.

## Allowed model
- `none`
