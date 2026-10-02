# Listing Optimization

Detects incomplete listings and proposes better descriptions. Describes the skill only; nothing here executes.

## When to use
- One or more listings are incomplete.

## When not to use
- All listings are complete.
- A listing is only missing things the assistant cannot supply (photos, price).

## Required data
- `graph.listings.incomplete`, `graph.listings.incompleteIds`

## Read actions
- `getListings()`

## Validation rules
- Description must be non-empty.
- (Reported but not drafted: fewer than 3 photos, missing price.)

## Draft
- Suggests a description for each listing missing one.

## Write actions
- `updateListing(id, patch)` once per changed listing

## Approval requirement
- Required before any write (start approval + write approval).

## Allowed model
- `haiku-4-5`
