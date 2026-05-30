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

## What's left (needs you — one real setup)
1. **Connect a real Meta/Instagram account.** The Connect buttons exist, but actually posting + reading view counts needs a one-time Meta-side setup (a Meta app + permission to publish, then sign in through the button). Until that's wired, scheduling just safely **queues** — nothing posts on its own.
2. **Auto-double-down on winners** (the "post 24/7, do more of what gets views" loop) is built to **light up the moment a channel is connected** — once views flow, it ranks winners and makes more like them.

## Your concepts
- 15 ad concepts from your swipe file → `Desktop/ads/REVARITY-CONCEPTS.md` (IG + Meta, static + short-video, all 5 angles).

## Decisions locked
- Channels: organic **and** paid · Posting: **approve-the-queue** (you OK the batch, then it posts) · Connect: per-person button, you control which ads go to your account.

## Notes / to revisit (not urgent)
- **State privacy:** the app's small state files (connections, schedule, settings) are stored as *public* blobs. Low sensitivity (your own handle + a schedule, no secrets), but worth moving to private storage in a deliberate pass — it needs a small change to how those files are read, across the app.
- **Local `.env` keys** stay on your machine / in Vercel; none are in the repo (verified).

_Everything above is committed and pushed; the site auto-runs the latest._
