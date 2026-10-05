# Review Reply

Drafts a public reply to a client review that has no reply yet, in the agent's voice, with the AI model. Describes the skill only; nothing here executes.

## When to use
- One or more reviews have no public reply.
- The review text is safe to use (the input guardrails pass).

## When not to use
- Every review already has a reply.
- The user declined the suggestion ("Not now").
- The guardrails block the review text. A plain template reply is offered instead, with the reason.

## Required data
- `graph.reviews.total`, `graph.reviews.unreplied`

## Read actions
- `getReviewsToReply()`: the reviews with no reply (best-rated and newest first) and the agent's first name and title.

## Validation rules
- One review per run: the best-rated, newest unreplied review.
- Only the reviewer's first name, the rating and the review text (cut to 1000 characters) are sent. Sensitive details in the review are masked first.

## Draft
- The AI service writes the reply from those facts. The server owns the prompt and the model; the review is fenced as data and the guardrails run again on the server.
- If the service is unavailable, a template reply shaped by the rating is used and labelled as a template.
- The text is limited to 500 characters and the user can edit it before approving.

## Write actions
- `replyToReview(reviewId, text)`: saves the public reply on the review. The model never posts anything.

## Approval requirement
- Required before any write: approval to start, then approval of the final text (edit it, then Approve & Apply).
- After a reply is posted, NORA offers the next unreplied review until none are left.

## Allowed model
- `haiku-4-5` (declared in `src/profile/aiTasks.ts`; the server calls `claude-haiku-4-5`)
