# NORA + Profile prototype

Prototype: an agent **Profile page** with **NORA**, an agent orchestrator. The data is in-memory mock data with no database. Two drafts can be written by a real model (see *AI drafting*); everything else is deterministic.

```bash
npm install
npm run dev      # http://localhost:5173  (redirects to /login until you sign in)
npm test         # engine, skills, mock layer, profile store, auth
```

**Sign in** with the demo account (there is a *Fill demo credentials* button on the login page): `arjunan@newamerican.example` / `demo1234`. Authentication is a mock: one hard-coded account and a flag in `localStorage` (`nora-auth`), so it is not real security. Signing in makes NORA greet you in the centre of the screen after about 5 seconds; *Sign out* (avatar menu) returns to `/login`. Every route except `/login` requires the session.

## Look and feel

Left icon rail (collapsible), a top bar with Back, breadcrumb, `⌘K` search, Reset demo, a light/dark switch and notifications. Cards, KPI grid, peach NORA summary banner and icon tabs follow the reference dashboard.

**Theme:** every colour is a CSS variable (`tailwind.config.js`), so dark mode is a variable remap, not per-component `dark:` classes. Neutrals invert; accent tints and deep shades swap; mid shades (buttons, icons) stay put. The choice is saved in `localStorage` (`nora-theme`). Tailwind reads its config at startup, so **restart `npm run dev` after editing `tailwind.config.js`**.

## NORA

NORA greets you **in the centre of the screen about 5 seconds after you log in** (once per browser session; `GREET_DELAY_MS` in `NoraContext.tsx`). Until then it sits as the small launcher pill; opening or minimizing it yourself first cancels the greeting. *Reset demo* brings it up immediately.

NORA also appears after the same wait when you **switch to a different person's profile** (it is about to be asked about them, and the greeting says whose profile you are viewing). Opening or minimizing it yourself first cancels that, a second switch restarts the wait, and ordinary page navigation does nothing. It is chat-first:

- **Hello {name}**, then **what NORA found**: one numbered action card per applicable skill, in ranked order, each with tags, the expected outcome (e.g. profile completeness 85% → 100%) and *View Analysis* / *Review with NORA*.
- **⚡ quick actions** and a **message box** are hidden behind footer icons; below them a self-advancing slider of tool chips (pauses on hover, drag or swipe, and with reduced motion).
- **Minimize** (—), Esc or a click outside collapses NORA into a floating launcher pill that shows *Working…* or a dot when it needs you. The launcher brings it back.
- **Stop** appears while NORA is reading, validating or drafting. It discards the run, changes nothing and brings the proposal back. It is not offered once NORA is writing.
- **Focus mode:** while NORA works, the rest of the app dims and blurs and NORA glows.
- **Fix with NORA** links (Insights, the profile summary banner, the completeness figure) bring NORA up, select the matching action, start it, and narrate in the chat: *On it…*, *The draft is ready…*, *Done. …* or *Stopped.*

Orchestration flow:

```
read profile data → ask every skill "do you apply?" → rank → select
  → Approval 1 (start) → read → validate → draft
  → Approval 2 (write: before/after, Reject / Approve & Apply) → skill actions.ts → mock API → profile store
  → rebuild graph → re-evaluate → next skill, or "You're all set" + Explore (VOCE)
```

Reject at either approval and nothing is written. If the profile is edited on the page, NORA notices and re-evaluates by itself.

## Layout

| Path | Role |
|---|---|
| `src/nora/` | Engine (`noraEngine.ts`), state machine (`noraMachine.ts`), skill registry, LLM abstraction. No domain logic. |
| `src/skills/<name>/` | `SKILL.md` (documentation only) and `actions.ts` (thin adapter to the mock API): Profile Completion, Listing Optimization, Web Analytics Insight, VOCE Explore. |
| `src/mock/` | NORA's mock data: scenarios, API, derived graph, data-quality rules. |
| `src/profile/` | The app: store, seed data, pages and UI. NORA UI is `ui/NoraPanel.tsx` (chat shell) and `ui/NoraActions.tsx` (action cards); `NoraContext.tsx` holds the engine, chat and panel state. |

- NORA only iterates `skillRegistry`; there is no "if profile missing then profile skill".
- The graph is **derived** from data after every write; it is never written to directly.
- Skills declare their `allowedModel`; NORA never picks one. `generateSkillDraft()` asks the AI service when a skill supplies an `ai` block, and otherwise (or when the service is unavailable) returns the skill's template draft.
- VOCE (explore) has the lowest priority, so it only surfaces when nothing is actionable.
- A skill the user rejected or completed is not proposed again until the data changes.

## One profile, two views

The profile has a single source of truth, the Profile page store (`src/profile/store.ts`). NORA's `getProfile/updateProfile` read and write it (via `mock/database.ts`). After *Approve & Apply* the page shows the new data, an Activity entry ("NORA updated your specialties") and a bell notification. Listings, analytics, connections and VOCE are NORA-local mock data.

## Demo scenarios

Account menu (avatar, top right) → **NORA demo scenario**:

- **Live (Profile page data)** (default): NORA works on the real profile. Arjunan has 3 specialties (5 needed), so NORA proposes a fix.
- **Profile Needs Improvement**: clears the bio and trims specialties *on the Profile page*.
- **Everything Complete**: nothing actionable; VOCE create card.
- **VOCE Profile Exists**: VOCE stats card (78 / 12 / 18).
- **Multiple Actions (ranking)**: profile gap, incomplete listing and +38% traffic; shows ranking and "Next up".

**Reset demo** (top bar, with a confirm) restores the seed profile, reviews, messages and notifications, clears the NORA chat and restarts NORA on the live profile. The same action is in the account menu.

## Profile page

Routes: `/profile/:id` (default `arjunan`, the owner), `/professionals`, `/locations`, `/messages`, `/insights`.

- **Header:** search (agents / cities / services), notifications, account menu.
- **Profile:** Change cover, Edit Profile (6 sections, validation, uploads), Request Referral, Share, ⋮ (contact card, print, report).
- **Computed from reviews:** rating, Top Rated badge, satisfaction, NORA Insights. Posting a review changes them.
- **Tabs:** Overview, Reviews (filter, sort, owner replies, write a review), About (inline edit), Services, Awards, Activity, Contact.
- **Messages:** conversation list with search, thread header linking to the profile, and a composer. Referral requests create a thread; the agent auto-replies after ~4.5s with a notification.
- **Professionals / Locations / Insights:** KPI strips, filter chips, city cards, a profile-views chart with hover tooltips, a completeness gauge and recent activity, all in the same card style.

State persists to `localStorage` (`nora-profile-demo-v2`).

## Mock-data notes

- With three reviews (5, 5, 4) the computed rating is **4.67**, not 4.79 as in the design.
- Anyone can review any profile, including their own, so ratings can be watched changing.
- Requesting a referral on your own profile logs a thread with yourself; use another agent's page to see the auto-reply.
- Mock API calls wait 250ms and drafts 600ms (`setApiLatency` / `setDraftLatency`).

## AI drafting (real model)

Three things are written by Claude when a key is configured:

- **NORA's profile bio draft** (Profile Completion skill). Specialties stay deterministic.
- **Review replies** (Reviews tab, owner only): *Reply* then *Draft with AI* fills the reply box. Nothing is posted until the owner clicks **Post**.
- **Service tagline and description** (Edit Profile → Services): each service has *Draft with AI* (or *Rewrite with AI* when it already has copy). It fills both fields, locks them while it works, offers **Undo** to restore what was there, and nothing is saved until **Save Changes**. Existing copy is sent so the AI improves rather than replaces its meaning; the model must answer in a strict two-line format, and anything else is rejected rather than guessed at.

Both go through the same path, so they share the safeguards:

```
browser (kind + facts only) --POST /api/ai/draft--> server handler (server/aiDraft.ts) --> Anthropic SDK --> claude-haiku-4-5
```

- **The key never reaches the browser.** It is read by the dev server (`.env.local`, never `VITE_`-prefixed). The browser sends only a task kind and structured facts; the **prompts, model and length limits live on the server** (`server/aiDraft.ts`, `src/profile/aiTasks.ts`), so the client cannot choose a model or supply its own prompt.
- **Privacy:** only the facts a bio needs are sent (title, company, location, experience, specialties, services, rating, up to three review excerpts). Never email, phone, or reviewer names. A reply sends the reviewer's first name, rating and text. A service sends its name, your title, location, years of experience and specialties, and its current copy.
- **Untrusted text:** review text is fenced in tags and the prompt says to ignore instructions inside it. Output is trimmed to the field's limit.
- **Model settings:** both tasks use **Claude Haiku 4.5**, the cheapest current model ($1 / $5 per million tokens), which is plenty for a short, well-specified draft and answers in 1 to 2 seconds. The request is built per model (`buildRequest` in `server/aiDraft.ts`, capabilities in `MODEL_CAPS`): Haiku takes no `effort` setting and has no refusal fallback; Sonnet 5.5 and Opus 5.5 get `effort: low`, room for their always-on thinking, and the server-side refusal fallback (`AI_FALLBACKS=off` disables it). No temperature or prefill anywhere.
- **Limits:** 32 KB request cap, 20 requests per minute per process, 20 s timeout.
- **Always works:** with no key, a rate limit, a refusal, a timeout or no network, the template draft is used and **labelled** ("template draft (No AI key is configured)"). A template is never shown as AI output.
- **Human approval stays:** NORA's draft still needs *Approve & Apply*, and replies still need *Post*.

### Turn it on

```bash
cp .env.example .env.local     # then put your key in ANTHROPIC_API_KEY=
npm run dev                    # restart: the server reads the key at startup
```

The endpoint exists only in `vite dev` and `vite preview`. A production deployment needs the same handler (`createAiDraftHandler`) behind a real backend.

To change a task's model, edit `AI_TASKS` in `src/profile/aiTasks.ts`: set `model` to `claude-sonnet-5-5` (about 2x Haiku's price, richer writing) or `claude-opus-5-5` (about 4x), and `allowedModel` to the matching label the NORA skill shows. Nothing else changes.
