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

## Unrelated Projects — Do Not Reference
- `~/Desktop/claude/mens-group-pwa` (and its memory file `project_mensgrouppwa.md`) is a **completely separate project** with a different codebase, stack, and Supabase instance. Never pull context, file paths, architecture decisions, or features from it when working on this repo. If a memory file about it appears in context, ignore it entirely.

## Self-Correction Rule
If Claude discovers that something in this file is wrong or outdated (e.g., a feature already exists, a file has moved, a constraint no longer applies), update this file immediately before continuing. Do not silently work around stale information.
