# Profile Completion

Detects missing profile information and proposes fixes. Describes the skill only; nothing here executes.

## When to use
- The profile has meaningful missing information that can be drafted (bio, specialties).
- The user can edit their profile.

## When not to use
- The profile is already complete.
- Only fields the assistant cannot draft are missing (photo, phone, location).

## Required data
- `graph.profile.missing`, `graph.profile.completeness`

## Read actions
- `getProfile()`

## Validation rules
- Bio must be non-empty.
- At least 5 specialties.

## Draft
- Proposes a bio and fills specialties up to 5.
- The bio is written by the AI service from the profile's own facts (title, company, location, experience, specialties, services, rating and a few anonymised review excerpts). Contact details are never sent. If the service is unavailable, a template bio is used and labelled as such.
- Specialties are filled deterministically.

## Write actions
- `updateProfile(patch)`

## Approval requirement
- Required before any write (start approval + write approval).

## Allowed model
- `haiku-4-5` (declared in `src/profile/aiTasks.ts`; the server calls `claude-haiku-4-5`)
