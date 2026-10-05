# Connection Setup

Suggests connecting the accounts that earn the most Search Rank Score points. Today it handles Google Business Profile. Describes the skill only; nothing here executes.

## When to use
- Google Business Profile is not connected.
- The user has not already declined this suggestion in the session.

## When not to use
- Google is already connected.
- The user declined it ("Not now").

## Required data
- `graph.accounts.google`, `graph.accounts.points`

## Read actions
- Reads the Connections page store (which accounts are connected, and the permissions Google would ask for).

## Validation rules
- Google must still be unconnected when the draft is prepared.

## Draft
- A before and after of the connection: not connected now, connected as the business account after, with the points it earns.
- Lists the three permissions Google will ask for. No AI model is used; there is no text to write.

## Write actions
- Connects Google, but only after the user grants access on the Google consent screen. NORA never sees a Google password.

## Approval requirement
- Required before any write: approval to start, then consent on Google's own screen (Allow or Cancel).
- Cancelling on Google's screen changes nothing and the card stays open so it can be retried.

## Allowed model
- `none`
