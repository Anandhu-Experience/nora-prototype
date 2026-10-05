# NORA + Profile prototype

Prototype: an agent **Profile page** with **NORA**, an agent orchestrator. The data is in-memory mock data with no database. Two drafts can be written by a real model (see *AI drafting*); everything else is deterministic.

```bash
npm install
npm run dev      # http://localhost:5173  (redirects to /login until you sign in)
npm test         # engine, skills, mock layer, profile store, auth
```

**Sign in** with the demo account (there is a *Fill demo credentials* button on the login page): `matt.reeves@newamerican.example` / `demo1234`. Authentication is a mock: one hard-coded account and a flag in `localStorage` (`nora-auth`), so it is not real security. *Sign out* (avatar menu) returns to `/login`. Every route except `/login` requires the session.

## Look and feel

A labelled left sidebar of the product modules (a drawer on phones) and a top bar with `⌘K` search, Reset demo, a light/dark switch, notifications and the account menu. Messages and Notifications are in the top bar and account menu, not the sidebar.

**Theme:** every colour is a CSS variable (`tailwind.config.js`), so dark mode is a variable remap, not per-component `dark:` classes. The choice is saved in `localStorage` (`nora-theme`). Restart `npm run dev` after editing `tailwind.config.js`.

## NORA

When you land on the app, suggestions appear as action cards **above the round floating NORA button** in the bottom-right corner (they rise in with a short animation and the button bobs). On a page with its own *NORA suggests* strip these are that page's suggestions; on other pages they are the issues NORA found. **Every card opens the NORA panel and stays on the page:** an issue opens NORA with that skill selected (Connect Google on the Connections page does too), and any other page suggestion is posted as a message from NORA with one button that does it (open a form, go to a page, draft with AI). The × hides them on that page for the session. The button opens NORA any time. *Reset demo* does not open NORA: it closes the panel and the suggestions reappear above the button.

NORA also appears after the same wait when you **switch to a different person's profile** (it is about to be asked about them, and the greeting says whose profile you are viewing). Opening or minimizing it yourself first cancels that, a second switch restarts the wait, and ordinary page navigation does nothing. It is chat-first:

- **Hello {name}**, then **what NORA found**: one numbered action card per applicable skill, in ranked order, each with tags, the expected outcome (e.g. profile completeness 85% → 100%) and *View Analysis* / *Review with NORA*.
- **Hide / Show** tucks the suggestion cards away (remembered in the browser). The action you chose always comes first and is never hidden: picking an issue from the floating panel, *Fix with NORA* or a NORA OS issue shows it again, and an action that is running or waiting for your approval stays visible.
- **⚡ quick actions** and a **message box** are hidden behind footer icons; below them a self-advancing slider of tool chips (pauses on hover, drag or swipe, and with reduced motion).
- **Minimize** (—), Esc or a click outside minimizes NORA. The floating NORA button shows a spinner while it works and a red dot when it needs you, and brings it back.
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

**Review Reply (a skill the AI model writes).** *Review Reply* (priority 85) proposes *N of your reviews have no reply yet. Shall I draft one in your voice?* Approval 1 reads the unreplied reviews and picks the best-rated, newest one; the server then writes the reply with `claude-haiku-4-5` from only the reviewer's first name, the rating and the review text (masked, injection-checked, fenced as data and checked again on the server). The card shows the review and the reply in an editable box (500 characters); **Post reply** (Approval 2) saves exactly what is in the box on the review, with activity and a notification. If the model is unavailable or the review is blocked by the guardrails, a labelled template reply is offered instead and no model is called. It is `repeatable`: after one reply NORA offers the next unreplied review until none are left. The skill is `src/skills/reviews/`; the *Reviews Need Replies* scenario sets it up.

**Connect Google (a skill that needs consent).** On login NORA ranks *Connection Setup* first (priority 95) while Google Business Profile is not connected: *Connect Google to unlock Insights. Shall I start?* (+30 points, 25 → 55 of 100). Approval 1 starts it; the draft card then shows the before and after and what Google will ask to allow; the second approval is a mock Google consent screen opened by **Continue to Google**. **Allow** connects Google through the mock API (the Connections page, Search Rank Score and NORA's graph all update) and NORA confirms in the chat. **Cancel** changes nothing and the card stays open to retry; **Reject** drops it. No AI model is used, no real Google account is touched and no password is asked for. The skill is `src/skills/connections/`, the consent screen `src/profile/ui/ConsentModal.tsx`, and a skill opts in with `consent` on the `Skill`.

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

## Product modules (from the v3 plan)

Besides Profile, the sidebar has the plan's other modules, each a page with mock data, working actions and an **NORA suggests** strip (a one-line read of the page, up to three actions that disappear once done, and *Ask NORA*):

| Page | What it does |
|---|---|
| **Listings** `/listings` | Business info (validated edit, manager-lock demo), data issues with *Fix with AI* (review then apply), 14 publish sites with async publish/retry, analytics + CSV report. Google needs the Google connection. The retired Q&A tab is replaced by a note. |
| **Connections** `/connections` | 11 networks with a mock OAuth consent or profile-URL flow, points per network (Google is worth most), sync, disconnect. |
| **Web Analytics** `/analytics` | Website audit out of 250: URL verification with a one-click fix path, NAP, load time, 8 meta tags, on-page reviews, SSL. *Draft with AI* for the meta description, printable report. |
| **Search Rank Score** `/search-rank` | The 850 score, its drivers, a peer leaderboard, ranked next actions and a 12-week history. |
| **Insights** `/insights` | Profile, Traffic, Review Sources, Google Analytics and Reports tabs with a shared date range. Google-sourced charts unlock when Google is connected and the score is 400+. Review requests, real CSV/print/XLS export. |
| **AI Visibility** `/ai-visibility` | AI Authority Score /100, a writing studio (articles drafted by AI, with approval, credits, schedule/publish), FAQs with AI answers, content analytics and a simulated AI-answer presence panel. |
| **Network** `/network` | Partners (promote up to 8, promo code, requests), Referrals table (received, requested, given, follow-ups), and the professionals directory. Promoted partners show on your public profile. **Messages** gained Inbox / Starred / Archived and AI-drafted replies. |

**One score, many modules.** The Search Rank Score is the sum of five drivers: Profile 100, Web Analytics 250, Reviews 300, Listings 100, Connections 100 (`src/presence/srs.ts`). The Overview card, the Search Rank page and NORA all read it, so connecting Google or fixing a meta tag moves every one of them. Leaderboard peers are fixed demo data.

**Data layer:** each module owns a persisted store in `src/presence/` (`createStore`, localStorage keys `nora-presence-*`), and *Reset demo* restores them all. Page-aware NORA: ask about the score, listings, connections, website, AI visibility, partners or traffic and it answers from live data, with quick actions for the page you are on (`src/profile/assistant.ts`).

**More AI drafts** (same safeguards as above: server-side prompt, Haiku 4.5, labelled template fallback, nothing saved until you approve): website meta description, AI-visibility article, FAQ answer.


## NORA OS

The **NORA OS** sidebar item (`/nora-os`) keeps every issue in one place. Nothing is stored twice: issues are derived from each module's live data (`src/presence/noraOs.ts`), so they vanish as soon as the user fixes them anywhere, and the page only reads.

- **Issues:** open issues from Profile, Connections, Listings, Web Analytics, Reviews (unanswered), AI Visibility and Network, most important first, with the points each would earn, a module filter and an *Open / Resolved* switch. Items NORA can do (Connect Google, add specialties) say so and run through NORA (*Fix with NORA*); the rest open the right page.
- **Resolved:** the first time an issue is seen and the time it disappeared are kept in the browser (`nora-presence-os-v1`, cleared by Reset demo). An always-on hook in the layout stamps them, so the time is when it was fixed, not when the page was opened.
- **NORA activity:** what NORA did this session and which skills it handled. Clicking a resolved issue that a NORA skill fixed opens this tab filtered to that skill, and clicking a skill in *Skills handled* filters the log to it (*Show all* clears it).

## V3 overview (capability-first)

`/profile` is organised around the professional (`docs/srp-v3-ui-audit.md` has the audit and the status). It shows the header, **one** Search Rank Score summary (value, band, rank, points to the next rank, link to *why*), a **Next best action** (current state, problem, action, expected impact), and **Your presence, by capability**: Identity, Local Presence, Reputation, Discoverability and Content & Insights, each with its health and its top issue. Recent activity and the review cards follow.

- **One issue list** (`collectIssues`) feeds the overview, NORA OS and the floating NORA button, so they always agree. Each issue has a capability, a priority, and the points and rank effect of fixing it, priced with the live score's own `simulate` (no separate estimate). Recommendations come from real state, never from hardcoded text.
- **Capability health** (`presence/capabilities.ts`) creates no scores: it reuses the score's drivers, the profile completeness rules, review counts and the content authority score.
- **Name, phone and hours** are compared across the profile, the listing and the website scan (`presence/nap.ts`). A mismatch becomes a high-priority issue; **Review Issue** opens the existing listing fix with the profile's value, and it applies only when you click Apply. Nothing is copied behind your back.
- The Search Rank page shows, for each driver, what earned its points and what is missing. Profile page views come from the Insights traffic series everywhere.

## Output compliance and score prediction (from the SRP agentic architecture doc)

- **Output compliance** (`src/guardrails/compliance.ts`): what the model writes is checked before it reaches you, with deterministic mortgage rules first: rate or APR claims, payment examples and guarantees (blocked), Fair Housing wording (blocked), unproven "best rates" claims and client deal details (flagged). A blocked draft is replaced by the labelled template with the reason; a flagged one is shown with a note, and every write still needs your approval. The server checks the model's text, and your own edits to a reply are checked the same way (the **Post reply** button is disabled while an edit breaks a rule). The Flow trace has an *Output compliance* step. A classifier pass for what rules cannot see is not built. These rules are for planning and need legal review.
- **Score prediction** (`simulate` in `src/presence/srs.ts`): NORA prices a skill's change in the Search Rank Score before it runs (*Search Rank Score 506 → 536 +30* on the proposal card), using the same maths as the live score on a copy of the data. After the write, the Flow trace compares *predicted vs actual* in the evals. Skills declare the change with `scoreChange`.
- **Score bands** (Poor 0 to 349, Fair 350 to 499, Good 500 to 649, Excellent 650 to 850) show on the Search Rank page and NORA OS. Each public reply now adds 1 point to Reviews (up to 75, capped at 300 with the rest); V2 scores replies but the value is assumed. Not adopted from the doc: recent reviews lapsing after 365 days, because it would drop the demo score by over 100 points.

## Input guardrails

Everything a person types or pastes goes through four checks before it reaches the AI model or NORA (`src/guardrails/`, plain TypeScript with no dependencies and no cost, shared by the server and the browser):

1. **Mask sensitive information:** emails, phones, SSNs, cards (Luhn), bank accounts, dates of birth, loan IDs, API keys, addresses and IPs become `[EMAIL]`, `[PHONE]` and so on. Only counts are kept.
2. **Detect prompt injection:** weighted signals. 5 or more blocks, 2 to 4 is allowed with a warning. Our own fence tags are rewritten so text cannot close one.
3. **Content safety:** threats, hate, sexual content, self-harm, fraud and discriminatory lending are blocked; profanity is starred out.
4. **Scope validation:** article topics and FAQ questions must be about mortgage or home finance (strict); NORA chat only refuses clearly unrelated requests (lenient).

They run in the draft handler (`server/aiDraft.ts`, authoritative: a blocked request answers 422 `guardrail_blocked` and never reaches the model), in the browser before a draft request, and in NORA chat. A bad review snippet is dropped from a bio request instead of blocking it. **Flow trace:** the **Flow** button in the top bar (and *View steps* under a NORA answer) opens a panel. A **Skill run** is added only when you pick an action (the start approval); proposals you never act on, and "Not now", leave nothing here. It follows the architecture from the issue to the evals: 1 user graph, 2 analyze, 3 prioritize, 4 select skill (your Approval 1), 5 model routing, 6 guardrails + execute (read, validate, allow-list, checks, draft, Approval 2), 7 update data and the graph, 8 run evals (resolved? expected outcome met? result recorded). Declined, rejected and stopped runs close as *Declined*, and a proposal replaced by a newer one as *Replaced*. Chat messages and AI drafts started from a *Draft with AI* button are shown as their own runs: input, the four guardrail checks, the agent, the server's second check, the LLM and the output, each with a status and a time. It updates live while a run is in progress and keeps the last 30 (`src/guardrails/trace.ts`). Chat shows the LLM step as skipped, because NORA's chat answers are rule-based. Try it: ask NORA "Write a poem", paste a phone number into the chat, or write an article about pasta. Limits: rules, not a trained classifier, English only; it checks input, not what the model writes.

**When NORA has no input box (guided design).** Guardrails protect every place untrusted data enters, not only a chat box:

| Entry point | Check |
|---|---|
| Button and skill ids sent to the draft endpoint | Action allow-list (`src/guardrails/actions.ts`): an unknown skill or a kind it may not request answers 400 `invalid_action` before any model call. A test fails if a skill in the registry is missing from the list |
| The user's own profile text used as AI facts | The four checks above |
| Third-party text (reviews, scanned website title, description and tags) | `guardUntrusted`: text that tries to instruct an AI, or is unsafe, is blanked and reported in the scan's `flagged` list and notes instead of failing the scan; hidden characters are stripped |
| Any remaining free text field | `guardInput` / `guardChat` as before |

The Flow panel shows an **Action allow-list** step for each draft. With nothing typed, output checks (compliance, groundedness, output masking) become the main safety layer; they are not built yet.

## Live website scan (Web Analytics)

`/analytics` now scans real websites. The server (`server/siteAudit.ts`, mounted at `POST /api/seo/audit` in `vite.config.ts`) fetches the public page itself and returns: title, meta description, robots, language, charset, Open Graph, Google and Twitter tags, review schema, whether name, phone and address appear in the text, the SSL certificate and expiry, the http to https redirect, and load time plus Lighthouse SEO and Performance scores from Google's free **PageSpeed Insights API** (key in `PAGESPEED_API_KEY` in `.env.local`, see `.env.example`; it works without a key at a much lower quota). A scan takes 10 to 30 seconds.

- **Safety:** the server only fetches public http(s) addresses on ports 80 and 443. Every address and every redirect is checked (no localhost, private ranges, link-local, or names that resolve to them), with a time limit, a 1.5 MB cap and 6 scans a minute.
- **Fallback:** demo addresses (`newamerican.example` and similar), a missing endpoint or a failed scan show labelled **sample data** with the reason. A live scan is labelled **Live scan**. If PageSpeed fails, the rest still shows and Load Time says "Not measured".
- **Still mock:** ownership verification (the tag check) is unchanged. Restart `npm run dev` after adding the key or pulling this change, because the server reads `vite.config.ts` and `.env.local` at startup.

## Deploying on Vercel

The two API endpoints are Vite dev-server middleware, so on Vercel they are separate serverless functions under `api/` (`api/seo/audit.js`, `api/profile.js`), bundled from `api-src/` and `server/` with `npm run build:api`. **Run `npm run build:api` after changing anything in `server/` or `api-src/`, and commit `api/`** (Vercel finds functions in the repo, not in build output).

- **Environment variables** (Project → Settings → Environment Variables): `PAGESPEED_API_KEY` for the scan. `ANTHROPIC_API_KEY` is only needed if you also add the AI draft function (not added yet, so AI drafts show labelled templates on Vercel).
- **`vercel.json`:** `/profile/:id` is rewritten to `api/profile.js`, which returns the app with a real `<title>`, description, canonical, Open Graph and Twitter tags, schema.org JSON-LD and the profile text already in the HTML (so crawlers that skip JavaScript can read it). Every other path falls back to `index.html`. The scan function may run up to 60 seconds.
- **The agent's website** is now `<deployed origin>/profile/arjunan`, so **Web Analytics → Re-scan** checks the live page. On localhost it keeps the old demo address (sample data) unless you set `VITE_SITE_URL=https://your-app.vercel.app` in `.env.local` and restart `npm run dev`; then the local app scans the deployed page (the scan runs on your local server).
- **Limits:** the profile HTML is built from the seeded demo data, so edits made in a visitor's browser are not in it. The endpoints are public and the rate limit is per function instance, so set a spend limit on any keys and consider adding authentication before sharing the URL widely.

## Expertise Graph

`/graph` (sidebar: Expertise Graph) draws everything known about the professional as a graph: the person and their Search Rank Score at the centre, eight rings round it (Identity, Credentials & Licenses, Products & Services, Social & sameAs, Reviews, Content, Place & Geo, Hierarchy) and a node for each fact. It is built from the profile record plus the Connections, Listings, Reviews, AI Visibility, Network and Web Analytics data (`src/profile/graphModel.ts`), so it changes when they do. Scroll or use the buttons to zoom, drag to pan, hover a ring to isolate its branch, and click a node to see its source, schema.org mapping and verification state. The side panel shows how many nodes each ring has ("not captured" when empty); the top cards count live nodes (from connected modules), record nodes (from the profile record), rings populated and the Search Rank Score.

## One profile, two views

The profile has a single source of truth, the Profile page store (`src/profile/store.ts`). NORA's `getProfile/updateProfile` read and write it (via `mock/database.ts`). After *Approve & Apply* the page shows the new data, an Activity entry ("NORA updated your specialties") and a bell notification. Listings, analytics, connections and VOCE are NORA-local mock data.

## Demo scenarios

Account menu (avatar, top right) → **NORA demo scenario**:

- **Live (Profile page data)** (default): NORA works on the real profile. Google is not connected and Matt has 3 specialties (5 needed), so NORA proposes connecting Google first, then the profile fix.
- **Reviews Need Replies**: everything healthy except client reviews with no reply, so NORA drafts one with the AI model.
- **Google Not Connected**: everything healthy except Google Business Profile, so NORA suggests connecting it.
- **Profile Needs Improvement**: clears the bio and trims specialties *on the Profile page*.
- **Everything Complete**: nothing actionable; VOCE create card.
- **VOCE Profile Exists**: VOCE stats card (78 / 12 / 18).
- **Multiple Actions (ranking)**: profile gap, incomplete listing and +38% traffic; shows ranking and "Next up".

**Reset demo** (top bar, with a confirm) restores the seed profile, reviews, messages and notifications, clears the NORA chat and restarts NORA on the live profile. The same action is in the account menu.

## Profile page

Routes: **`/profile` is the Profile Overview** (the owner's dashboard), `/profile/:id` is the public profile (default `arjunan`, the owner), `/professionals` (Network), `/locations`, `/messages`, `/notifications`, `/insights`.

### Profile Overview (`/profile`)

- **Hero:** photo (change it from the camera button), PRO badge, bio with *Show more*, specialty chips with *+N*, and the **Published** status with *Unpublish / Publish now* (an unpublished profile shows a notice on its public page).
- **KPI cards:** profile completeness (the same rules NORA uses), total rating from your reviews, profile views and search rank score. The rank score is computed from completeness and reviews, so improving the profile moves it. The 30-day views and the percentage trends are mock figures.
- **Recommended Actions** are derived from your real data (photo, specialties, cover, service areas, awards, bio), each stops applying once you fix it, and each button does something: *Fix with NORA* runs NORA's profile skill; the others open Edit Profile at the right section (Photos, Location with service areas, Awards, About) or the cover picker.
- **NORA AI Assistant card** shows the top three actions with the same buttons, NORA's pending proposal if there is one, and an input that sends your question to NORA.
- **Reviews & Ratings** with the distribution and the Google / Facebook / Experience.com split, and a **Recent Reviews** carousel.

- **Locations and hours:** Edit Profile has *Location* (several addresses, one primary, 8 amenities) and *Hours* (per day, time zone). The Contact tab shows a demo map per address, the amenities, and the week with an *Open now* badge. The map is drawn, not live tiles.
- **Manager locks:** fields a manager locked (seed: NMLS, company) are read-only in Edit Profile. *Manager view (demo)* lets a manager lock or unlock fields and edit locked ones. The store, NORA and Recommended Actions respect the locks.
- **Rank page and schema** (`/rank/:id`, Overview ⋮ menu): three shareable formats (card, banner, review-led) with copy link and embed code, a schema.org checklist, and the JSON-LD that is also added to the public profile (`src/profile/details.ts`).
- **Header:** search (agents / cities / services), notifications, account menu.
- **Profile:** Change cover, Edit Profile (6 sections, validation, uploads), Request Referral, Share, ⋮ (contact card, print, report).
- **Computed from reviews:** rating, Top Rated badge, satisfaction, NORA Insights. Posting a review changes them.
- **Tabs:** Overview, Reviews (filter, sort, owner replies, write a review), About (inline edit), Services, Awards, Activity, Contact.
- **Messages:** conversation list with search, thread header linking to the profile, and a composer. Referral requests create a thread; the agent auto-replies after ~4.5s with a notification.
- **Professionals / Locations / Insights:** KPI strips, filter chips, city cards, a profile-views chart with hover tooltips, a completeness gauge and recent activity, all in the same card style.

State persists to `localStorage` (`nora-profile-demo-v3`; the key changed when service areas, awards editing and review sources were added, so older saved data is ignored).

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
