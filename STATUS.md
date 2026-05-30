# Revarity Ads — where things stand

**Live:** https://ads.revarity.com · **Code:** github.com/johnvong100596/revarity-deals

Plain-English snapshot so anyone can pick this up.

## What works right now (live)
- **Welcome tour** — first-time visitors get a 5-step plain-English walkthrough (`/welcome`, "Guide" in the menu).
- **Make ads** — type what you want (or paste an ad you like); it writes the words + makes the picture, and can make short videos too. Generate as many as you want.
- **Mine winners** — paste competitor ads; it learns the *framework* (never copies) and feeds your future ads.
- **Review & approve** — see everything it made, thumbs-up the keepers. Nothing leaves without your yes.
- **Schedule + Connect** — Connect buttons for Instagram / Facebook / Meta Ads; queue approved ads to post times; an AI "ads expert" suggests when to post and which to push first.
- **Budget, Weekly summary, Settings** — plan spend, see a weekly snapshot, edit targets, see what's connected.
- **Video** — works durably on the Higgsfield Cloud key (auto-topup), so it won't break again.

## The autopilot loop is now fully built
The whole **post → track → double-down** runpath is wired and live (inert until you switch it on):
- **Schedule → Autopilot → "Enable autopilot"** button (greyed out until a channel is connected).
- An hourly job then: posts your **approved + scheduled** ads → reads each post's **views** → ranks winners → **auto-drafts more like the winners** (into Review for your OK).
- It's completely safe until ON: nothing posts or spends unless autopilot is enabled, a channel is connected, **and** the Meta token is set.

### To make posting actually go live (one setup)
Set these in Vercel (Project → Settings → Environment Variables) — that's the only remaining wiring:
- `META_ACCESS_TOKEN` — long-lived token (scopes: instagram_content_publish, pages_manage_posts, read_insights)
- `META_IG_USER_ID` — your Instagram Business account id (for Instagram)
- `META_PAGE_ID` — your Facebook Page id (for Facebook)
- (`META_AD_ACCOUNT_ID` — for paid ads later; paid publishing is still a stub)

Then: open **Schedule** → **Connect** the channel → **Enable autopilot**. Posting/insight calls live in `ads-hub/lib/meta.js` (Instagram + Facebook organic are implemented to the Graph API — validate them on your first real post). You can dry-run the loop anytime: `GET /api/cron?dryRun=1` (with the CRON_SECRET) shows exactly what it *would* do, no side effects.

## Your concepts
- 15 ad concepts from your swipe file → `Desktop/ads/REVARITY-CONCEPTS.md` (IG + Meta, static + short-video, all 5 angles).

## Decisions locked
- Channels: organic **and** paid · Posting: **approve-the-queue** (you OK the batch, then it posts) · Connect: per-person button, you control which ads go to your account.

## Notes / to revisit (not urgent)
- **State privacy:** the app's small state files (connections, schedule, settings) are stored as *public* blobs. Low sensitivity (your own handle + a schedule, no secrets), but worth moving to private storage in a deliberate pass — it needs a small change to how those files are read, across the app.
- **Local `.env` keys** stay on your machine / in Vercel; none are in the repo (verified).

_Everything above is committed and pushed; the site auto-runs the latest._
