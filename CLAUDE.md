# meal-rotation

React PWA for the Covey Space meal rotation feature.

## Stack
- React, Vite 8, vite-plugin-pwa@1.3.0 (peer deps explicitly support Vite ^8.0.0)
- Supabase (Postgres + Auth + Edge Functions + Push Notifications)
- Project ref: `ktmlyzwpgvhrwfgyoeiq`

## Branches & Deployment
- `origin/staging` → staging (staging)
- `origin/main` → prod
- **Never push to `origin/main` without explicit "push to prod" from the user**

## Edge Functions
Located in `supabase/functions/`. Deploy with:
```
supabase functions deploy <function-name>
```

### Active functions
- `send-chat-reaction-push` — fires on `reactions` INSERT (webhook: `on_chat_reaction_insert`). Sends push notification to message owner when someone reacts; skips self-reactions.
- `send-birthday-push` — fires daily at 8 AM UTC via pg_cron. Sends birthday push to all group members except the birthday person. Deploy with `--no-verify-jwt`. See migration_57.

## Events Feature
- `events` table + `event_rsvps` table + `events_enabled` column on `group_settings`. See migration_58.
- When adding new `*_enabled` columns to `group_settings`, also update `~/coveyspace-admin/src/components/DashboardClient.jsx` → `FeatureFlags`.
- `sync-hubspot-contact` — fires on `profiles` INSERT (webhook: `on_profile_insert_hubspot`). Upserts new user into HubSpot CRM.

## HubSpot Integration
- Token stored in Supabase secret: `HUBSPOT_PRIVATE_TOKEN`
- Custom contact properties: `coveyspace_group` (Single-line text), `coveyspace_joined_at` (Date)
- **`coveyspace_joined_at` requires a Unix millisecond timestamp at midnight UTC — NOT an ISO string.** HubSpot Date properties reject ISO strings silently.
- Uses HubSpot Service Keys (not Private Apps — Private Apps have moved to Legacy Apps in HubSpot settings)

## PWA / Service Worker
- `registerType: 'prompt'` with `visibilitychange` auto-apply and splash-active auto-apply
- Banner shown for mid-session updates

## Migrations
SQL migration docs live in `supabase/migration_XX_*.sql`. These are documentation files (no schema changes) that record webhook setup steps and configuration decisions.

## Related Projects

### coveyspace-admin (`~/coveyspace-admin`)
Next.js 16 admin dashboard at `admin.coveyspace.com`. Reads from the same Supabase project (`ktmlyzwpgvhrwfgyoeiq`) via service role key.
- **Feature flags** are displayed per-group in `src/components/DashboardClient.jsx` → `FeatureFlags` function. Whenever a new `*_enabled` column is added to `group_settings`, add a matching entry to the `flags` array there.
- Staging: `admin-staging.coveyspace.com` (`origin/staging`). Prod: `admin.coveyspace.com` (`origin/main`). Same push rules apply.

## Unrelated Projects — Do Not Reference
- `~/Desktop/claude/mens-group-pwa` (and its memory file `project_mensgrouppwa.md`) is a **completely separate project** with a different codebase, stack, and Supabase instance. Never pull context, file paths, architecture decisions, or features from it when working on this repo. If a memory file about it appears in context, ignore it entirely.

## Editing Code
Always use the Edit tool directly to make code changes. Do not write Python scripts to apply string replacements — it is slower, more error-prone, and harder to review. The only exception is if the Edit tool is actively mangling the file (e.g., converting ASCII quotes to smart quotes), in which case flag the issue explicitly rather than silently defaulting to Python.

## Self-Correction Rule
If Claude discovers that something in this file is wrong or outdated (e.g., a feature already exists, a file has moved, a constraint no longer applies), update this file immediately before continuing. Do not silently work around stale information.

## Double Check Rule
ALWAYS double check your work before reporting it as done. Re-read changed files, verify logic, and confirm nothing was missed or broken.

## Design System

### Colors
- **Page background**: `bg-sunrise-50` (`#FBF8F4`) — warm off-white
- **Primary accent**: `ember` (`#C4622D`) — CTAs, focus rings, active states
- **Supporting palette**: `coral` (`#B85A3A`), `lagoon` (`#E8A838`), `sage` (`#A1CCA6`)
- **Color in cards lives in icon/badge boxes only** — never use a brand color as the full card background. Tints by context: `bg-amber-50` (meals/dates), `bg-ember/10` (ember items), `bg-lagoon-50` (lagoon items), `bg-coral/10` (coral items), `bg-sage-50` (prayer/sage items)

### Cards
- Standard card: `bg-white rounded-2xl border border-stone-100 shadow-sm`
- Elevated/interactive card: bump shadow to `shadow`
- Never use `rounded-xl` for cards — that's for buttons, inputs, and icon boxes

### Buttons
- Primary: `bg-ember text-white rounded-xl` (hover: `hover:bg-ember-700`)
- Secondary: `border border-stone-200 text-stone-500 rounded-lg hover:border-ember hover:text-ember hover:bg-ember/5`
- Destructive: `border border-red-200 text-red-500 rounded-xl hover:bg-red-50`
- Small inline: `px-3 py-1.5 rounded-lg text-xs font-medium`

### Rounded corners
- `rounded-2xl` — cards, modals, full-screen sheets
- `rounded-xl` — buttons (primary), inputs, icon boxes, segment pill containers
- `rounded-lg` — small secondary buttons
- `rounded-full` — avatar circles, pill badges, nav dots

### Shadows
- `shadow-sm` — standard card
- `shadow` — slightly elevated card
- `shadow-xl` — modals and bottom sheets

### Segment controls
Container: `bg-stone-100 rounded-xl p-1`
Active tab: `bg-ember text-white rounded-lg shadow-sm`
Inactive tab: `text-stone-500 hover:text-stone-700`

### Typography
- Page title: `text-3xl font-bold text-stone-800`
- Card/section header: `text-xl font-bold text-stone-800`
- Card primary text: `text-base font-semibold text-stone-800`
- Secondary/subtitle: `text-sm text-stone-500`
- Muted metadata: `text-xs text-stone-400`
- Section labels: `text-xs font-semibold uppercase tracking-wide text-stone-500`

### Modals & sheets
- Backdrop: `fixed inset-0 bg-black/50`
- Sheet: `bg-white rounded-2xl shadow-xl`
- Use `animate-modal-in` / `animate-modal-out` and `animate-overlay-in` / `animate-overlay-out` for transitions

### Inputs
`border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent`

## QA Rule
After every code change, QA the affected functionality before reporting done. Use one of:
- **Playwright static tests** (`npx playwright test e2e/<spec>.spec.js --project=chromium`) — source-level correctness checks, no server needed
- **Playwright browser tests** (`npx playwright test --config playwright.staging.config.js`) — full runtime tests against localhost:5173
- **QA agent** — spawn a subagent to review the changed code for bugs and regressions

**This is a loop**: if QA finds issues, fix them and re-run QA. Keep iterating — fix, QA, fix, QA — until all checks are clean and no new issues are found. Do not report work as done until the loop is clean.
