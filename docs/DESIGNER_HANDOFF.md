# Designer Handoff — CallscraperCRM ↔ callscraper.com

**Audience**: the designer working on callscraper.com.
**Goal**: make callscraper.com and CallscraperCRM feel like one product.
**Source of truth**: this document. Everything the designer needs to align
the two surfaces lives here — tokens, layout grammar, interaction patterns,
auth-handoff UX, writeback contract, URL structure, and a deliverables
checklist.

This handoff is paired with `INTEGRATION.md` (technical contract for Ken,
the callscraper.com developer). If you're the designer: **read this first**,
read `INTEGRATION.md` only if you need to understand why a technical
constraint exists.

---

## 1. What this handoff covers

1. The relationship between the two products — who owns what.
2. The shared visual system — tokens, type, spacing, motion.
3. The shared layout grammar — how every page is built from the same parts.
4. Interaction patterns the designer should mirror — modals, drawers,
   tables, empty states.
5. The URL structure when the CRM is mounted under `callscraper.com/crm`.
6. The user-visible auth-handoff UX — "Open in CRM" → land authenticated.
7. The writeback badge — how CRM status flows back onto call cards.
8. Brand consistency rules — do's and don'ts.
9. A deliverables checklist.
10. Where to ask questions.

---

## 2. Product relationship — what lives where

- **callscraper.com** = call tracking, transcripts, agent coaching, inbound
  lead capture. Owns: the phone number, the recording, the transcript, the
  first-touch lead.
- **CallscraperCRM** = everything that happens *after* the lead lands:
  opportunity lifecycle, estimates, signatures, jobs, dispatch, invoices,
  tickets, reporting, workflow automation.
- **One-way sync**: callscraper.com → CRM. The CRM never writes back to the
  upstream database. A lightweight **writeback** endpoint (see §8) lets the
  CRM *push a status badge* to callscraper.com so agents see "this lead
  became a $4,850 booked job" on their call card, but the CRM never mutates
  callscraper's records.
- **Hosting**: CRM runs at `callscraper.com/crm/*` via Nginx reverse-proxy.
  **Assume every CRM URL** the user sees begins with `callscraper.com/crm/`
  — never a separate subdomain in marketing copy, help docs, or support
  scripts.

---

## 3. Shared design tokens — use these exact values

### 3.1 Palette

All values are Tailwind tokens from `apps/web/tailwind.config.ts`. Use the
exact hex.

| Token | Hex | Role |
|---|---|---|
| `bg` | `#0a0a0a` | Page background (dark chrome) |
| `panel` | `#111113` | Cards, sidebar, dropdowns |
| `border` | `#1f1f23` | 1px dividers, input borders |
| `muted` | `#7a7a85` | Secondary text, disabled |
| `text` | `#e7e7ea` | Primary text |
| `accent` | `#7c5cff` | Brand CTA, focus rings |

### 3.2 Status tints

Pair each background with its matching text color. These are the ONLY
colors allowed for status badges.

- draft → `bg-accent/10 + text-accent`
- sent / booked / in_progress → `bg-blue-500/15 + text-blue-500`
- paid / accepted / confirmed / completed → `bg-green-500/15 + text-green-500`
- overdue / declined / archived → `bg-red-500/15 + text-red-500`
- partial / en_route → `bg-amber-500/15 + text-amber-500`
- void / not_started → `bg-muted/10 + text-muted`

### 3.3 Typography

The app uses the system sans stack. **Do not introduce a custom typeface.**

- Base: `-apple-system, Segoe UI, Roboto, sans-serif`.
- Hierarchy:
  - `text-2xl font-bold` — page h1 (rarely used).
  - `text-sm font-semibold` — section titles.
  - `text-sm` — body.
  - `text-xs text-muted` — labels, helpers.
  - `text-[10px] uppercase tracking-wide` — table-header micro-labels.
- Monospace for numbers and IDs: `font-mono text-xs`.

### 3.4 Spacing

4px base scale: `xs=4 sm=8 md=12 lg=16 xl=24 2xl=32`.
Tables and rows are intentionally dense (`px-3 py-2`) to maximize data per
screen. Don't pad the CRM like a consumer product — it's a power-user tool.

### 3.5 Radius

- `rounded-md` (6px) default.
- `rounded-lg` (8px) for large cards.
- No fully rounded pill buttons except status badges.

### 3.6 Focus ring

`focus-visible:ring-2 ring-accent/60` (no ring-offset — both the dark chrome
and the light public estimate page need it to show). **Never rely on color
alone for focus state** — always a visible ring.

### 3.7 Motion

- `transition-colors` on hover.
- `animate-spin` on loaders.
- No dramatic slide/fade on navigation. Page transitions are instant.

---

## 4. Shared layout grammar — every page is built from the same parts

```
┌─── Sidebar (60px) ──┬─── TopBar (48px) ─────────────────────────┐
│                      ├───────────────────────────────────────────┤
│  • Home              │ SubNav (optional, 36px)                   │
│  • Calendars         ├───────────────────────────────────────────┤
│  • Tasks             │                                           │
│  • Sales             │                                           │
│  • Customers         │           Page content                    │
│  • Dispatch          │                                           │
│  • Customer Service  │                                           │
│  • Marketing         │                                           │
│  • Accounting        │                                           │
│  • Reports           │                                           │
│  • Settings          │                                           │
└──────────────────────┴───────────────────────────────────────────┘
```

- **Sidebar** (60px wide): brand mark at top, section icons + labels below,
  hover highlight `bg-white/5`, active state `bg-accent/15 text-accent`.
  Collapses to icon-only below the `md` breakpoint.
- **TopBar** (48px tall): breadcrumb (left) · global search (center) ·
  `[+ New]` · `🔔 notifications` · `Ask Claude` pill · user avatar (right).
  Always present on every authenticated page.
- **SubNav** (36px, optional): tab bar for pages with related views
  (Customer Service → Tickets active/completed; Dispatch → Scheduling /
  Customer Confirmation / etc.). Uses an underline-under-active pattern.
- **Page content**: `p-5` padding; `space-y-4` for vertical rhythm between
  cards/tables.

### 4.1 Embedding the CRM TopBar in callscraper.com

When callscraper.com embeds the CRM `TopBar` via
`callscraper.com/crm/embed/topbar`, treat that component as **the source of
truth**. Do not re-skin it.

If callscraper.com needs to add a callscraper-specific action (e.g. "Start
a call"), put it into the `+ New` menu — don't bolt a new button on the
TopBar.

---

## 5. Interaction patterns — mirror these

### 5.1 Tables (everywhere lists appear)

- Row density: `px-3 py-2` cells, `text-sm` body, `text-xs` headers with
  `bg-accent/5` tint.
- Row hover: `bg-accent/5`.
- Row click → right-side drawer (420px slide-in).
- Sort: clickable column headers with ↑/↓ arrow.
- Filters above the table: search inputs, dropdown selects, chip toggles
  (`[All][Hot][Warm][Cold]`).
- Empty state: dashed border card with icon + title + description + CTA.
- Load-more: button below table (`Load more (N remaining)`), not infinite
  scroll.

### 5.2 Drawer (right-slide, 420px)

- Used for: event detail, opportunity preview, custom-record edit.
- Always `position: fixed`, `border-l border-border`, `bg-panel`.
- Close via: X button, backdrop click, Escape key.
- Animated via transform, not display toggles.

### 5.3 Modal (centered, 480–560px)

- Used for: confirmations, destructive actions, simple forms, "Send
  Estimate".
- Focus-trapped: Tab cycles inside, Shift+Tab wraps, Escape closes.
- Backdrop: `bg-black/30`.

### 5.4 Inline popover (below trigger button)

- Used for: crew picker on dispatch rows (`aria-expanded`,
  `aria-controls`).
- Trigger button shows current state as a chip; click expands below the row.
- Save closes the popover; Cancel closes without save.

### 5.5 Forms

- Vertical stack, `space-y-3`.
- Labels: `text-xs font-medium`; required marker: red `*` + sr-only text.
- Inputs: `px-2 py-1.5 text-sm bg-bg border-border rounded-md`.
- Errors: `role="alert"` below input, red text.
- `aria-invalid` wired to a **field-keyed error state** — never
  substring-match a free-text error string.

### 5.6 Buttons

- Primary: `bg-accent text-white`.
- Secondary: `border border-border bg-panel text-text hover:bg-accent/5`.
- Ghost: `text-text hover:bg-accent/5`.
- Danger: `bg-red-600 text-white`.
- Sizes: `sm` (px-2), `md` (default, px-3), `lg` (px-4).
- Loading state: inline spinner + `aria-busy`.

### 5.7 Status badges

Always use the `<StatusBadge status="…" />` pill — NEVER hand-roll color
and copy. The token map in `apps/web/src/lib/tokens.ts` is the single
source. If callscraper.com needs a new status, open a ticket to add it
there — don't fork.

---

## 6. URL structure under the reverse-proxy

When CRM is mounted at `callscraper.com/crm`, URLs become:

| CRM internal URL | User-facing URL |
|---|---|
| `/` | `https://callscraper.com/crm/` |
| `/customers/abc-123` | `https://callscraper.com/crm/customers/abc-123` |
| `/accounting/invoices/inv-42` | `https://callscraper.com/crm/accounting/invoices/inv-42` |
| `/estimate/est-9/?t=…` (public) | `https://callscraper.com/crm/estimate/est-9/?t=…` |
| `/launch?t=…&call_id=…` | `https://callscraper.com/crm/launch?t=…&call_id=…` |
| `/embed/topbar` | `https://callscraper.com/crm/embed/topbar` (iframe use) |

**Rules**:

- Every marketing page, help article, support reply, in-app link, and
  email template must link to the `/crm/…` form. Never a separate
  subdomain.
- The `/crm/` prefix is fixed — don't shorten to `/app/` or `/c/`. The
  reverse-proxy path is load-bearing across auth and cookie-domain rules.
- Do not link to an internal domain (e.g. `crm.internal.example.com`).
  Pilots and external users should never see those.

---

## 7. Auth-handoff UX — the "Open in CRM" flow

As the user experiences it:

1. User is logged into `callscraper.com`. Opens an inbound-call card.
2. Clicks **"Open in CRM"**.
3. callscraper.com server-side mints a short-lived JWT (5-minute expiry)
   signed with the shared `BRIDGE_SIGNING_SECRET`. Payload:
   `{sub, email, company_id, call_id, jti, exp}`. Prefix: `v1b.`
4. User is redirected to
   `callscraper.com/crm/launch?t=<token>&call_id=<uuid>`.
5. CRM validates the token via `auth-bridge.ts`, mints a Supabase session
   (this arrives in Integration Sprint M4), and looks up the call's
   linked customer.
6. If **one** org matches `upstream_company_id`: 307-redirect to
   `/crm/customers/<customer_id>` (Sales tab active).
7. If **multiple** orgs match: a chooser page (one card per matching
   org). User picks; redirect as above.
8. If token is invalid or expired: inline error card on `/crm/launch`
   with a "Back to callscraper.com" link.

### 7.1 Design notes for the "Open in CRM" button

- Visual style: match the CRM chrome the button will take the user into —
  accent color `#7c5cff`, small right-arrow icon.
- The transition should feel instant. Show a **1-second loading shim** on
  callscraper.com's side (centered spinner + "Opening CRM…"). The CRM
  land page has no splash — the user should land directly on the customer
  record.
- The error card copy on `/launch` is already written:
  > "This link is missing its authentication token. Ask callscraper.com
  > to generate a fresh link."

  Don't rewrite that copy. Do ensure callscraper.com's side has a retry
  affordance that regenerates the token and relaunches.

---

## 8. Writeback badge — CRM status on the call card

After Integration Sprint M5 lands, the CRM pushes a status badge to
callscraper.com via `POST /api/callscraper/writeback` (HMAC-signed with a
new `v1w` prefix — see `INTEGRATION.md`). The designer needs to design:

### 8.1 Where the badge appears

Recommendation: a single row above the agent's notes on the call card.
1–3 chips, laid out like:

```
[● Booked · $4,850]   [Active opportunity · 3 days]   [⚠ 1 open claim]
```

### 8.2 Chip colors

Use the CRM status palette (§3.2):

- green → paid / booked / completed
- red → overdue / open-claim
- amber → partial / en_route
- blue → active opportunity / in-progress

### 8.3 Click behavior

Clicking a chip opens `/crm/customers/<id>` in the same tab, via the
auth-handoff flow (§7). No separate auth step.

### 8.4 Empty state

If the call has no CRM activity, show nothing. Don't render a "no record"
pill — that adds noise.

### 8.5 "CRM unreachable" state

If the writeback endpoint returns a non-2xx, show a single muted chip:
`[CRM sync paused]` with a retry icon. Never block the call card from
rendering.

---

## 9. Brand consistency rules

### 9.1 Do

- Use the exact token hex values in §3 for any CRM-adjacent surface.
- Use the `TopBar` embed (§4.1) when callscraper.com renders CRM global
  actions inside a callscraper page.
- Put all CRM deep links through `/crm/…` — never a subdomain.
- Match the CRM copy tone: short, sentence-case, no emoji in buttons, no
  exclamation points.
- Use the `StatusBadge` component for any status display. Never
  hand-roll a colored label.
- Use the existing empty-state format: icon · title · description ·
  action CTA.
- Use the **locked-vocabulary nouns**:
  - Customer, Opportunity, Job, Estimate, Invoice, Ticket, Claim, Task,
    Activity, Event.
  - Never "Deal," "Contact," "Order," "Case."

### 9.2 Don't

- Don't introduce a second typeface. The system stack is deliberate.
- Don't use gradients as brand elements. A gradient may appear in a hero
  illustration, but never in a button or a status chip.
- Don't introduce a light-mode variant for authenticated CRM pages — the
  dark chrome is canonical. The **only** light-themed surface is the
  public `/estimate/[id]` signing page, and that is intentional
  (customers are outside the dark-chrome context).
- Don't re-skin `TopBar`, `EntityTable`, or `StatusBadge`. If you need a
  variant, open a ticket to add it to `lib/tokens.ts`. Don't fork.
- Don't use Inter, IBM Plex, or any custom UI font. Don't use purple
  gradients. The accent is a single hex: `#7c5cff`.
- Don't invent new status labels. Each object's enum is locked — if
  callscraper.com needs a status not in the enum, request a DB migration
  via the CRM team.
- Don't create a `callscraper.com/app/…` or a subdomain. The proxy path
  is `/crm/` permanently.

---

## 10. Designer deliverables checklist

For the Integration Sprint to land cleanly, the designer should deliver:

- [ ] **"Open in CRM" button** on the callscraper.com call card —
      accent-color primary button, right-arrow icon, placement above the
      transcript summary. Include hover, focus, and loading states.
- [ ] **Writeback status-badge component** (design, not code) for the
      call card — 1–3 chip row using the CRM status palette (§3.2).
      Include empty, single-chip, multi-chip, and "CRM unreachable"
      states.
- [ ] **Redirect shim** (1-second transition between callscraper.com and
      CRM) — centered spinner with "Opening CRM…" copy, same palette.
- [ ] **Workspace chooser page** at `/crm/launch/choose-org` when
      multiple CRM orgs match a single upstream company — card grid, one
      card per matching org, org name + member count + "Open →" button
      per card. Use the CRM layout grammar (§4).
- [ ] **Error-card variant** for `/crm/launch` when the token is
      invalid or expired — match the CRM's muted error palette (red
      border at `red-500/40`, alert-triangle icon).
- [ ] **Audit** of all callscraper.com CTAs that should link into the
      CRM — produce a list with the target paths
      (`/crm/customers/:id`, `/crm/calendars/team`, etc.). The CRM team
      will confirm each route exists before you ship.
- [ ] **Notification parity** — callscraper.com's bell should use the
      same visual language as the CRM's `NotificationsBell` (same
      counter pill, same dropdown density).
- [ ] **Shared help-doc template** — a single Help layout that reads
      correctly from either product, with a breadcrumb like
      `callscraper / crm / help / sending-an-estimate`.
- [ ] **Iconography audit** — confirm every icon used on callscraper.com
      is available in `lucide-react` (the CRM's sole icon set). If not,
      produce a pinned mapping table so the two products stay
      consistent.
- [ ] **Accessibility review** — every interactive element in the
      cross-product flow passes WCAG 2.1 AA (keyboard reachable, 3:1
      text contrast, visible focus ring). The CRM side already enforces
      this; callscraper.com's side should match.

---

## 11. Reference — live CRM pages the designer can study

The current CRM has 44 real pages. The ones most relevant for understanding
the visual system:

- `/crm/customers/all-profiles` — table patterns, search, row drawer.
- `/crm/customers/[id]` — detail layout, left rail + tabbed content.
- `/crm/dispatch/command-center` — status dots, inline popover, bulk
  actions.
- `/crm/accounting/receivables` — summary cards + aging strip + keyboard-
  navigable table.
- `/crm/accounting/invoices/[id]` — detail header, line-item table, inline
  payment recorder.
- `/crm/calendars/team` — FullCalendar integration.
- `/crm/settings/tariffs/library/[id]` — complex editor with right-side
  live preview.
- `/crm/estimate/[id]?t=…` — **the only light-themed surface**; customer-
  facing estimate signing page.

When in doubt about a new design decision, find the closest existing CRM
page and mirror its treatment.

---

## 12. Where to ask questions

- **Technical integration** (JWT format, webhook shape, env vars):
  open an issue referencing `INTEGRATION.md` in the CRM repo. Ken (the
  callscraper.com developer) handles these.
- **Design tokens, layout grammar, components**: file an issue titled
  `design:…` against the CRM repo. Shane or the CRM designer handles.
- **Copy / product voice**: use the locked-vocabulary list in §9.1.
  When in doubt, copy an existing CRM page's language and mirror its
  rhythm.

---

## Appendix — files the designer may want to reference

- `apps/web/tailwind.config.ts` — the single source for tokens.
- `apps/web/src/app/globals.css` — base CSS (body bg, border color).
- `apps/web/src/components/ui/` — the 7 reusable primitives (Button,
  Input, Field, EmptyState, StatusBadge, ErrorBanner,
  InlineEditableTable).
- `apps/web/src/components/TopBar.tsx` — the shared TopBar that
  callscraper.com will embed.
- `apps/web/src/lib/tokens.ts` — the status-style token map.
- `INTEGRATION.md` (repo root) — Ken-facing technical contract.
- `docs/ROUTE_INVENTORY.md` — the full 73-route map.
