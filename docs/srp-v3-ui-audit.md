# SRP V3 UI Audit

Branch: `srp-v3-ui-evolution` (from `srp-agentic-alignment`). Status: **audit only, no application code changed.**
Direction: *SRP – Listings & Professionals, capability-first V3* (five areas: Identity, Local Presence, Reputation, Discoverability, Content & Insights).

How to read this: every claim below comes from reading the repository. Where something could not be confirmed it says **to verify**. "Mock" means the data is generated or seeded in the browser, not read from a backend.

---

## Implementation status (after approval)

| Item | Status |
|---|---|
| P0-1 one issue source (capability tag, merged profile rules, severity only where completeness counts it) | **Done** (`presence/noraOs.ts`) |
| P0-2 overview rebuilt from existing parts | **Done** (`ui/home/*`, `OverviewPage`); `KpiCards`, `RecommendedActions`, `NoraAssistantCard` retired |
| P0-3 capability health selector (existing figures only) | **Done** (`presence/capabilities.ts`) |
| P0-4 impact on every issue from `simulate` | **Done** (points and rank effect; website, content and network keep their own audit figures) |
| P0-5 hardcoded Profile Views removed | **Done** (overview tile retired; Insights Profile tab reads the shared traffic series; `ANALYTICS` view fields deleted) |
| P1-6 name / phone / hours consistency | **Done** (`presence/nap.ts`; "Review Issue" opens the existing listing fix flow with `?fix=<field>`; nothing is copied automatically) |
| P1-7 explain on the Search Rank page | **Done** (per driver "Earned / Missing" from `explainSrs`); simulate impact on that page's own "Next best actions" is **not** done (they keep hand-set points) |
| P1-8 reply rate and unanswered reviews | **Done** in the Reputation row (derived from real replies); the public profile's "Response rate" stays seed data (it measures something else) |
| P1-9 move Listings Analytics into Insights | **Not done** (still two traffic generators besides the shared series) |
| P1-10 NORA OS as "view all" | **Done** (link from Next best action); the page itself is unchanged |
| P2 items, retiring the 7 hand-built `AiInsightBar` suggestion arrays | **Not done** |

## 1. Current Implementation

### 1.1 Stack and shape
- React 19 + TypeScript SPA (Vite), React Router 7, Tailwind. No backend in the SPA beyond three Node endpoints (`/api/ai/draft`, `/api/seo/audit`, `/profile/:id` server render).
- There is **no data API layer for the product screens**. Each module owns a persisted browser store (`src/presence/*.ts`, `createStore` in `persist.ts`) plus pure rule functions. The profile has its own store (`src/profile/store.ts`).
- `src/mock/api.ts` is a small mock "API" used **only by NORA skills** (profile, listings fixtures, accounts, reviews). The pages do not use it.
- Hooks: `useStore()` (profile), `<store>.use()` (modules), `useSrs()`, `useOsRefresh()`, `useNora*()`. Shared UI kit: `ui/kit.tsx` (`Tabs`, `Hero`, `AiInsightBar`, `Pill`, `ScoreBar`, `Ring`, `LineChart`), `ui/PageBits.tsx` (`PageHeader`, `Card`, `KpiGrid`, `EmptyState`).
- Permissions: manager **field locks** (`profile/details.ts`: `LOCK_FIELDS`, `isLocked`, `applyLocks`) and a listings **publish lock**. Login is a single mock account. There are no roles, tiers or per-feature permissions in the UI (PRO is a flag).
- States: `EmptyState` (28 uses), `Loader2` spinners (20 files), toasts, scan-failure copy. Loading/empty/error handling exists per page but is not uniform.

### 1.2 Routes and navigation (`src/App.tsx`, `ui/SiteLayout.tsx`)

| Route | Page | Sidebar item |
|---|---|---|
| `/profile` | `OverviewPage` (the owner's dashboard) | Profile & Presence |
| `/profile/:id` | `ProfilePage` (public profile; tabs Overview, Reviews, About, Services, Awards, Activity, Contact) | via Overview / directory |
| `/rank/:id` | `RankPage` (rank-page and schema formats) | via profile menu |
| `/listings` | `ListingsPage` (tabs Business Info, Publish, Analytics) | Listings |
| `/connections` | `ConnectionsPage` | Connections |
| `/analytics` | `WebAnalyticsPage` (website audit, 250 points) | Web Analytics |
| `/search-rank` | `SearchRankPage` | Search Rank Score |
| `/search-rank/how-it-works` | `SrsGuidePage` (static explanation) | link from Search Rank |
| `/insights` | `InsightsPage` (tabs Profile, Traffic, Review Sources, Google Analytics, Reports) | Insights |
| `/ai-visibility` | `AiVisibilityPage` (VOCE: authority score, studio, articles, FAQs, presence checks) | AI Visibility |
| `/network` | `NetworkPage` (Partners, Referrals, Find professionals) | Network |
| `/professionals`, `/locations` | `DirectoryPage`, `LocationsPage` | under Network |
| `/messages`, `/notifications` | inbox and notifications | top bar / account menu |
| `/nora-os` | `NoraOsPage` (Issues, NORA activity) | NORA OS |
| `/graph` | `GraphPage` (Expertise Graph) | **hidden** by `SHOW_EXPERTISE_GRAPH = false` |

Cross-cutting: floating NORA button with suggestions, NORA panel (chat + action cards), Flow trace drawer, top-bar search, "Reset demo". `OverviewPage` is built from `ui/overview.tsx`: hero card, `KpiCards`, `RecommendedActions`, `NoraAssistantCard`, `ReviewsRatings`, `RecentReviews`.

### 1.3 Where the data and logic live (reuse candidates)

| Concern | Location | Notes |
|---|---|---|
| **Search Rank Score** | `presence/srs.ts` `computeSrs` / `srsNow` / `useSrs` / `simulate` / `BANDS` | Single calculation. Drivers: Profile 100, Web Analytics 250, Reviews 300, Listings 100, Connections 100 = 850. |
| Profile completeness | `mock/rules.ts` (`missingProfileFields`, `profileCompleteness`, weights) via `profile/selectors.ts` `agentCompleteness` | 7 weighted fields. Also feeds the SRS Profile driver. |
| Profile suggestions | `profile/selectors.ts` `recommendedActions` | **A different rule set** (photo, specialties, cover, service areas, awards, bio length). |
| Listings | `presence/listings.ts` (`listingsPoints`, `dataIssues`, `proposeFix`, `publishSite`, `listingsAnalytics`) | Holds its own copy of name/address/phone/hours (`info`). |
| Connections | `presence/connections.ts` (`CONNECTIONS`, `connectionsPoints`, `connect`, `missingConnections`) | Points per network, OAuth mock. |
| Website audit | `presence/website.ts` + `server/siteAudit.ts` | `websiteItems`, `websiteIssues`, `websitePoints` (250). |
| Reviews | `profile/store.ts` (`agent.reviews`, `replyToReview`), `presence/srs.ts` `reviewsPoints`, `presence/insights.ts` (requests) | Rating, count and replies feed the SRS Reviews driver. |
| Content / AI | `presence/voce.ts` (authority score 100, articles, FAQs, `voceSuggestions`, presence checks) | Not part of the 850 (GEO is not live). |
| Issues across modules | `presence/noraOs.ts` `collectIssues` | **Already aggregates profile, connections, listings, website, reviews, content and network issues.** |
| NORA | `nora/*`, `skills/*` (6 skills), `guardrails/*` | Experience layer; keep separate from page UI. |
| Server | `server/aiDraft.ts`, `server/siteAudit.ts`, `server/profilePage.ts` | Guarded AI drafts, website scan, server-rendered public profile with JSON-LD. |

---

## 2. Capability Mapping

Decisions: **KEEP**, **KEEP + REFINE**, **CONSOLIDATE**, **REPLACE**, **RETIRE**.

| Existing UI | Current capability | V3 capability | Existing API / data | Decision | Required change |
|---|---|---|---|---|---|
| `OverviewPage` (hero + KPI tiles + recommended actions + NORA card + reviews) | Profile summary and to-do list | Entry point for all five areas | `useStore`, `agentCompleteness`, `recommendedActions`, `useSrs` | **KEEP + REFINE** | Becomes the V3 overview: header, one score summary, one next best action, five capability health rows, recent activity. Remove duplicated tiles and lists. |
| Hero card in `OverviewPage` (photo, name, title, chips, publish state) | Identity header | Identity | agent in profile store | **KEEP** | Add verification status (NMLS) only if data exists. |
| `KpiCards` Profile Completeness donut | Completeness | Identity health | `agentCompleteness` | **KEEP + REFINE** | Move into the Identity health row; keep one completeness number. |
| `KpiCards` Total Rating | Rating | Reputation health | `ratingStats` | **CONSOLIDATE** | Move into the Reputation row with reply rate. |
| `KpiCards` Profile Views (860, +18%) | Traffic | Content & Insights | `ANALYTICS` constant in `profile/seed.ts` | **REPLACE** | Hardcoded; read the Insights series instead (see section 3). |
| `KpiCards` Search Rank Score | Score | Discoverability | `useSrs` | **KEEP + REFINE** | Becomes the single `SearchRankSummary` with band, rank and points to next rank. |
| `RecommendedActions` | Profile to-do list | Next best action | `recommendedActions` | **CONSOLIDATE** | Render items from `collectIssues` instead (it already includes these). |
| `NoraAssistantCard` | Shows the same top 3 recommendations + "ask NORA" box | Next best action + NORA entry | `recommendedActions`, NORA state | **CONSOLIDATE / RETIRE** | Duplicates `RecommendedActions`. Fold the single NORA proposal into `NextBestAction`; keep the floating NORA button as the one conversational entry. |
| `ReviewsRatings`, `RecentReviews` | Rating breakdown and latest reviews | Reputation | `agent.reviews` | **KEEP + REFINE** | Keep as the Reputation detail; add reply rate and unanswered count; CTA to reply. |
| `ProfilePage` + tabs (public profile) | Public identity, reviews, services, awards, contact | Identity | profile store, `JsonLd` | **KEEP** | Public view; no change except linking edits to schema/listing impact. |
| `EditProfileModal`, `LocationHours`, cards | Edit identity, hours, locks | Identity | `actions.saveProfile`, `applyLocks` | **KEEP + REFINE** | After save, surface listing/website consistency (section 6). |
| `RankPage`, `JsonLd`, `server/profilePage.ts` | Schema and rank-page output | Identity / Discoverability | agent data | **KEEP** | Reused as the schema step in the connected flow. |
| `ListingsPage` – Business Info tab | Own copy of NAP/hours, validation, fixes | Local Presence | `listingsStore.info`, `dataIssues`, `proposeFix` | **KEEP + REFINE** | Show profile vs listing differences; offer "use profile value". Do not hold a second source silently. |
| `ListingsPage` – Publish tab | Publish to sites, locks, statuses | Local Presence | `publishSite`, `publishAllReady` | **KEEP** | Add provider-conflict and duplicate states when data exists (gap). |
| `ListingsPage` – Analytics tab | Maps, search, calls, directions, bookings | Content & Insights | `listingsAnalytics` (own generator) | **CONSOLIDATE** | Duplicates Insights; move into Insights (parity matrix already says unify). |
| `ConnectionsPage` | Connect networks, points | Local Presence | `connectionsStore`, `connect` | **KEEP + REFINE** | Show token-expiry/health only if data exists; keep points. |
| `WebAnalyticsPage`, `ui/website/*` | Website audit, NAP, tags, SSL, load time | Discoverability | `websiteStore`, `/api/seo/audit` | **KEEP + REFINE** | Keep audit; connect NAP results to the profile/listing comparison. |
| `SearchRankPage` | Score, leaderboard, drivers, next actions, history | Discoverability | `useSrs`, `leaderboard`, `nextActions`, `peers.ts` | **KEEP + REFINE** | Becomes the explain-and-improve view: why, contributions, missing, impact (simulate), act, result. |
| `SrsGuidePage` | Static explanation of the score | Explain score | `DRIVER_MAX` and copy | **KEEP** | Link target for "Why is my score this value?". |
| `ui/srs/nextActions.ts` | Score next actions ranked by points per effort | Next best action | profile, reviews, listings, connections, website stores | **CONSOLIDATE** | Third recommendation list. Merge its scoring into `collectIssues` impact. |
| `ui/srs/peers.ts` (peer breakdown, history) | Mock peer drivers and 12-week history | Ranking gaps | hash-generated | **KEEP + REFINE** | Clearly mock; label or replace when real ranking data exists. |
| `InsightsPage` (5 tabs) | Traffic, reviews, Google, reports, unlock | Content & Insights | `presence/insights.ts` | **KEEP + REFINE** | Becomes the single analytics home (absorbs Listings Analytics). Fix the Profile tab constants. |
| `AiVisibilityPage` (VOCE) | Authority score, studio, articles, FAQs, presence | Content & Insights | `presence/voce.ts` | **KEEP + REFINE** | Rename to Content in the V3 deck's language; keep. Its own score card duplicates SRS styling (`ui/voce/ScoreCard.tsx`). |
| `NetworkPage`, `DirectoryPage`, `LocationsPage`, `MessagesPage`, `NotificationsPage` | Partners, referrals, directory, inbox | Reputation / context | `networkStore`, profile store | **KEEP** | No V3 change beyond health signals if useful. |
| `NoraOsPage` Issues tab | All issues across modules, resolved history | Next best action (all) | `collectIssues`, `noraOsStore` | **CONSOLIDATE** | Becomes the "all issues" view opened from the overview; not a competing dashboard. |
| `NoraOsPage` NORA activity tab | Run log per skill | PROVE | engine log | **KEEP** | Stays as the proof-of-work view. |
| Floating NORA + `NoraPanel` + `NoraActions` | Suggestions, run approvals, drafts | UNDERSTAND / IMPROVE / ACT / PROVE | NORA engine | **KEEP + REFINE** | Keep as the experience layer; feed it from the same issue source. |
| `GraphPage` (hidden) | Expertise graph | Identity / trust | `graphModel.ts` | **KEEP (hidden)** | Leave behind the flag; revisit when verification/credentials exist. |
| Top-bar "Flow", "Reset demo", scenario menu | Prototype tooling | none | NORA engine | **KEEP (dev)** | Hide behind a dev flag for the V3 demo build (P2). |

---

## 3. Duplicate Experiences

### 3.1 Recommendations: five competing sources
1. `recommendedActions` (profile, 6 rule types) – Overview list and NORA card.
2. `nextActions` (Search Rank page) – points per effort.
3. `AiInsightBar` suggestions built by hand in **7 pages** (Listings, Connections, Web Analytics, Insights, AI Visibility, Network, Search Rank).
4. NORA skill evaluations (`skill.evaluate/proposal`) – floating card and NORA panel.
5. `collectIssues` – NORA OS issues (this one already merges 1 and parts of 3).
Result: the same fact appears with different wording, different ranking and different CTAs. On the overview, the same top three profile actions appear **twice** (Recommended Actions list and NORA card).

### 3.2 Two definitions of "complete"
- Completeness % uses 7 weighted fields (`mock/rules.ts`): the demo shows **85%** with only specialties missing.
- The overview text says **"5 items to complete"** from `recommendedActions` (cover photo, service areas, awards, bio length, specialties).
- NORA's Profile Completion skill uses the first definition, so it proposes one fix while the page lists five.

### 3.3 Search Rank Score
- **Calculation is single** (`computeSrs`). Good: no second scoring implementation.
- **Display is repeated** in: overview KPI tile, Search Rank page (hero stat, ring, "You have N of 850", leaderboard row, history chart), NORA OS tile, Insights unlock steps (`ui/insights/shared.tsx`), AI Visibility score card (`ui/voce/ScoreCard.tsx`), Expertise Graph (hidden), NORA assistant answers (`profile/assistant.ts`), NORA proposal cards (predicted score).
- **Not single:** peer scores and the 12-week history are hash-generated mock data (`ui/srs/peers.ts`, `PEERS`), and rank is computed against fixed peers.
- **Missing explain:** the page shows driver bars and a static guide, but not per-line "earned / max / missing / evidence". `simulate` exists (`presence/srs.ts`) but is only shown on NORA proposal cards, not on the Search Rank page or in editors.

### 3.4 Analytics and traffic: three unrelated sources
- `ANALYTICS` constant in `profile/seed.ts` (Overview "Profile Views 860 ↑18%", Insights Profile tab 7-day series).
- `presence/insights.ts` generator (Insights Traffic and Google tabs).
- `presence/listings.ts` `listingsAnalytics()` own generator (Listings Analytics tab).
- NORA graph analytics from scenario fixtures (`mock/user.ts`).
The same metric (views, impressions, actions) is shown with different numbers on different screens.

### 3.5 NAP (name, address, phone, hours): three copies
- Profile (`agent`), Listings (`listingsStore.info`, seeded with a different phone: `+44 121 496 0123` vs profile `+44 121 555 0142`), Website scan NAP.
- Nothing carries a profile edit to listings or compares the three. Only an invalid listing phone is fixed from the profile (`proposeFix`).

### 3.6 Reviews and reputation: four places, no one view
- Overview cards, Profile Reviews tab (reply), Insights Review Sources + requests, NORA Review Reply skill.
- **Response rate is static seed data** (`agent.responseRate = 98`), not derived from replies, while the SRS reviews driver counts replies.

### 3.7 Other repeated or competing items
- Competing CTAs for one task: "Fix with NORA", "Fix with AI", "Draft with AI", per-page suggestion buttons, floating cards.
- Navigation: 9 visible items. "Search Rank Score", "Web Analytics", "Insights" and Listings Analytics all answer "how am I performing"; "NORA OS" and the overview both answer "what should I do".
- Prototype tooling (Flow, Reset demo, scenario menu) is always visible.

---

## 4. Missing Capabilities

Capabilities in the V3 direction that the current UI does not support:

| Area | Gap |
|---|---|
| Identity | **Verification / trust** (NMLS and licence checks): NMLS is a text field only. **Experience Score** is not defined anywhere. |
| Local Presence | **NAP accuracy** across profile, listings and website; **provider sync / conflicts** (edits made at Google coming back); **duplicate listings**; **connection health** (token expiry). |
| Reputation | **Response rate** derived from real replies; **unanswered review count** on the overview; review-request timing before reviews age out (365 days) (SRS reviews points do not lapse). |
| Discoverability | **Explain** per score line with evidence and expiry; **ranking gaps** with real competitors (peers are mock); **impact before action** outside NORA. |
| Content & Insights | GEO lines (100 points) not live; **citation checks** are mock; Q&A answers live inside VOCE FAQs only; analytics from three non-matching sources. |
| Cross-cutting | One **capability health** model; one **issue/recommendation source** driving the overview; **proof of result** surfaced outside the NORA run log; recent activity is a tab inside the public profile, not on the overview. |

---

## 5. Proposed V3 Experience

Principle: reuse `/profile` as the entry point; add no new top-level page.

```
Overview (/profile)
  Who: Professional header (identity, publish state)
  Status: Search Rank Score (value, band, rank, points to next rank)  → "Why this score?" (Search Rank page)
  Next: One next best action  [Current state → Problem → Recommended action → Expected impact]
  Health: Identity · Local Presence · Reputation · Discoverability · Content & Insights
          each row = health (existing points/max or count) + top issue + one CTA
  Recent: what changed (activity, NORA runs)
```

Journey examples (each uses existing data and approvals):
1. **Phone change:** edit phone in Profile → app shows "Your Google listing phone differs from your profile" (NAP comparison) → [Review Issue] → approve listing update (existing `applyFix`) → schema updates on the public profile → Search Rank Score line changes → result shown ("+N points").
2. **New review:** review arrives → Reputation health shows 1 unanswered → [Respond to Reviews] → NORA drafts (existing skill) → approve → reply rate and Reviews points change → rank effect shown.
3. **Score:** Search Rank Score → "Why is my score this value?" (per-line earned/max/missing) → "What can I improve?" (ranked issues with `simulate` impact) → take action → actual result compared with predicted (already in the NORA eval).

Overview CTAs are never hardcoded: each comes from a real issue (section 7).

---

## 6. Proposed Component Structure

Reuse existing components where they fit. Names marked (existing) already exist.

```
OverviewPage (existing, /profile)
 ├── ProfessionalHeader            (existing hero block in OverviewPage, extracted)
 ├── SearchRankSummary             (replaces KpiCards' score tile; uses useSrs, bandOf, leaderboard)
 ├── NextBestAction                (replaces RecommendedActions + NoraAssistantCard; reads collectIssues)
 ├── CapabilityHealth              (new, small)
 │    ├── Identity                 (completeness from agentCompleteness; issue: recommendedActions items)
 │    ├── LocalPresence            (listings points + connection points; NAP comparison issue)
 │    ├── Reputation               (rating, unanswered, reply rate; reuse ReviewsRatings / RecentReviews)
 │    ├── Discoverability          (SRS drivers: website points; rank gap from leaderboard)
 │    └── ContentInsights          (authority score from voce; traffic from Insights series)
 └── RecentActivity                (agent.activity + noraOsStore resolved + run log)
```

Shared pieces to keep: `kit.tsx` (`ScoreBar`, `Ring`, `Pill`, `Tabs`), `PageBits.tsx`, `NoraActions` (act/prove stays in the NORA panel), `ConsentModal`, `Toast`.

---

## 7. Data Flow

```
Stores (profile store + presence stores)         Server (draft, audit, profile render)
        ↓                                                  ↓
Pure rule functions (existing): computeSrs, agentCompleteness, listingsPoints,
connectionsPoints, websitePoints, voce authorityScore, dataIssues, websiteIssues
        ↓
Capability state (new selector, no new scores):
  capabilityState(agent) → [{ id, label, points?, max?, count?, status, topIssue, issues[] }]
  built from computeSrs().drivers + voce authority + ratingStats + unanswered count
        ↓
Issues (one source): collectIssues(agent)   (extend; retire handwritten per-page lists)
  each issue: id, capability, title, detail, severity, to/cta, impact (from simulate)
        ↓
UI: OverviewPage (CapabilityHealth, NextBestAction), page AiInsightBars, floating NORA, NORA OS
        ↓
ACT through existing flows (edit modals, connect modal, NORA skills with approval)
        ↓
PROVE: predicted vs actual (existing eval step), activity, resolved issues
```

Rules: no duplicated data (compare values, do not copy them); no new scoring (reuse `computeSrs` and existing driver maxima); recommendations only from state.

---

## 8. Recommended Changes

### P0 — required for V3
1. **One recommendation source.** Extend `collectIssues` to include the profile rules that differ today and a capability tag; make the overview, floating NORA and page suggestion bars read it. Resolve the two "complete" definitions (3.2).
2. **Overview rebuild from existing parts:** `ProfessionalHeader`, `SearchRankSummary`, `NextBestAction`, `CapabilityHealth`, `RecentActivity`; remove duplicate tiles and the NORA assistant card duplication.
3. **Capability health selector** (`capabilityState`) using existing drivers and counts only.
4. **Impact on every issue** from the existing `simulate` (replace handwritten "+N pts" strings).
5. **Replace hardcoded Profile Views / change % (`ANALYTICS`)** with the Insights series; pick one analytics source.

### P1 — important
6. **NAP consistency:** compare profile, listings and website NAP; raise one "does not match" issue; apply with approval via existing `applyFix` (and a NORA skill if desired). Do not add a fourth copy.
7. **Search Rank page as explain-and-improve:** per-line earned/max/missing, simulate impact for each suggestion, show actual result after an action.
8. **Derive response rate** from replies; show unanswered reviews on the overview.
9. **Consolidate analytics:** move Listings Analytics into Insights; one traffic generator.
10. **Consolidate NORA OS Issues** into a "view all" from the overview; keep activity.

### P2 — nice to have
11. Hide prototype tooling (Flow, Reset demo, scenario menu) behind a dev flag.
12. Label mock peer data on the Search Rank page.
13. Connection health (token expiry) and duplicate/provider-conflict states once data exists.
14. Verification (NMLS/licence) display and Experience Score definition, pending a product decision.
15. Uniform loading/empty/error component.

---

## 9. Files Affected

### CREATED
- `docs/srp-v3-ui-audit.md` (this file)
- `src/presence/capabilities.ts` – `capabilityState` selector (derived, no stored state)
- `src/profile/ui/overview/` – `CapabilityHealth.tsx`, `NextBestAction.tsx`, `SearchRankSummary.tsx`, `RecentActivity.tsx` (or additions inside `ui/overview.tsx`)
- `src/presence/nap.ts` – compare profile / listings / website NAP (P1)
- tests for the new selectors (`src/presence/__tests__/capabilities.test.ts`, `nap.test.ts`)

### MODIFIED
- `src/profile/pages/OverviewPage.tsx`, `src/profile/ui/overview.tsx` (compose the new overview; remove duplicates)
- `src/presence/noraOs.ts` (`collectIssues`: capability tag, impact via `simulate`, profile rules merged)
- `src/profile/selectors.ts` (`recommendedActions` reduced to rules reused by `collectIssues`)
- `src/profile/pages/SearchRankPage.tsx`, `src/profile/ui/srs/nextActions.ts` (explain, simulate, merge)
- `src/profile/pages/ListingsPage.tsx`, `ui/listings/BusinessInfoTab.tsx` (show profile vs listing)
- `src/profile/pages/InsightsPage.tsx`, `ui/insights/ProfileTab.tsx` (analytics single source; absorb listings analytics)
- `src/presence/listings.ts`, `src/presence/insights.ts` (one traffic generator)
- `src/profile/seed.ts` (`ANALYTICS` removed or reduced)
- `src/profile/pages/NoraOsPage.tsx` (issues as "view all", entry from overview)
- `src/profile/ui/SiteLayout.tsx` (floating suggestions read the same issue source; dev tooling flag)
- `README.md`

### REUSED (unchanged)
- `src/presence/srs.ts`, `connections.ts`, `website.ts`, `voce.ts`, `network.ts`, `persist.ts`
- `src/nora/*`, `src/skills/*`, `src/guardrails/*`, `server/*`
- `src/profile/ui/kit.tsx`, `PageBits.tsx`, `NoraActions.tsx`, `NoraPanel.tsx`, `ConsentModal.tsx`, `Modal.tsx`, `Toast.tsx`
- `src/profile/pages/ProfilePage.tsx`, `RankPage.tsx`, `ConnectionsPage.tsx`, `WebAnalyticsPage.tsx`, `AiVisibilityPage.tsx`, `NetworkPage.tsx`, `DirectoryPage.tsx`, `LocationsPage.tsx`, `MessagesPage.tsx`, `NotificationsPage.tsx`, `SrsGuidePage.tsx`
- Existing tests (must keep passing; 299 today)

### RETIRED
- `NoraAssistantCard` (duplicate of the recommendation list on the overview)
- The overview `KpiCards` tiles for Profile Views (hardcoded) and the standalone rating tile (moved into Reputation health)
- `ANALYTICS` constant usage on the overview
- Listings **Analytics tab** (moved to Insights)
- Hand-built suggestion arrays in the 7 page `AiInsightBar` calls (replaced by the shared issue source), after parity is confirmed

### Not touched
`GraphPage` (stays hidden), the NORA engine, skills, guardrails and server code, except where a P1 NAP skill is explicitly approved.
