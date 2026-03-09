# Shared Savings Tracker (Supabase + Vercel)

This app supports:
- Sign up / sign in
- Personal savings + spending tracking
- Friend requests
- Per-friend visibility control (`Allow View` / `Revoke View`)
- Friends activity feed (only from friends who allowed you)
- Light/dark mode, toasts, animations, and improved auth UX

## Production readiness changes included

- Supabase keys are no longer hardcoded in `app.js`.
- Runtime config is loaded from:
  1. `config.js` (local dev fallback)
  2. `/api/config.js` (Vercel env-driven override)
- Added `vercel.json` security headers.

## Files to know

- `index.html`: app UI
- `app.js`: app logic
- `supabase-setup.sql`: DB schema + RLS policies
- `config.js`: local fallback config (placeholders)
- `api/config.js`: serves runtime config from Vercel env vars
- `vercel.json`: platform headers

## 1) Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase-setup.sql`.
3. In Supabase Auth settings, set your Site URL after you get your Vercel domain.

## 2) Local run (optional)

For local development, set real values in `config.js`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Then run from a local static server (recommended) instead of file://.

## 3) Deploy to Vercel (recommended)

### Vercel Dashboard method

1. Push this folder to GitHub/GitLab/Bitbucket.
2. In Vercel: `Add New -> Project`.
3. Import the repo.
4. Set these Environment Variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy.

### Vercel CLI method

1. Install CLI: `npm i -g vercel`
2. In project folder: `vercel`
3. Set env vars:
   - `vercel env add NEXT_PUBLIC_SUPABASE_URL production`
   - `vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production`
4. Redeploy production: `vercel --prod`

## 4) Post-deploy checklist

1. Open deployed URL and confirm no console errors.
2. Sign up and sign in works.
3. Add savings/spending updates totals.
4. Friend request + accept flow works.
5. Allow/revoke visibility works.
6. Friends feed only shows authorized data.
7. In Supabase Auth, add your Vercel URL to allowed redirect/site URLs.

## Security notes

- `SUPABASE_ANON_KEY` is safe for frontend usage; it is meant to be public.
- Never expose Supabase `service_role` key in frontend code.
- RLS in `supabase-setup.sql` protects data access by user and visibility permissions.
