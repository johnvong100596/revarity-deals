# Audio Integration Research: Artlist.io API vs. API-First Alternatives

**For:** ads.revarity.com (STR ad-creative generator) — adding AI voiceover + background music to generated video ads
**Date:** 2026-05-30
**Author:** Research memo

---

## TL;DR — Can we use Artlist as an API?

- **No, not for generation.** Artlist has a real API (`developer.artlist.io`), but it is an **Enterprise *catalog* API** — it searches/streams/downloads Artlist's existing licensed **stock music** library. It does **not** expose their AI Voiceover or AI Music *generation* tools as an API.
- The Artlist **AI Suite / AI Toolkit** (AI Image, AI Video, **AI Voiceover**, **AI Music**) is **web-UI only**. There is no documented programmatic endpoint for any of the generative tools.
- Access to even the catalog API is **sales-gated**: keys are issued by an account manager (OAuth2 client-credentials), "self-service developer portal coming soon." So no same-day self-serve integration.
- **Notable:** Artlist's new AI Music feature is just **Google Lyria 3 Pro** under the hood. Lyria 3 Pro is directly available via the **Gemini API and Vertex AI**. So we can get the exact same music engine, via a real API, by going to Google directly — bypassing Artlist entirely.
- **Recommendation:** Go API-first. **ElevenLabs for voiceover** + **Google Lyria 3 (Gemini API/Vertex) or Mubert for music**. Both fit the existing async-job pattern. Use Artlist only if a human picks library tracks in a UI — not worth wiring up for automated generation.

---

## What Artlist actually offers

**Two distinct things, only one of which is an API:**

1. **Artlist Enterprise Music API** (`developer.artlist.io`) — REAL, but catalog-only.
   - Capabilities: browse catalog, search/filter (mood, BPM, vocal type, duration), stream, and **download** existing royalty-free tracks. Endpoints include Song / Artist / Album / Download / Search.
   - Auth: **OAuth 2.0 client-credentials** (server-to-server), Bearer tokens valid ~1 hour. Rate-limited.
   - Access: **keys issued via account manager / enterprise sales** — no self-serve signup today ("self-service developer portal will be available soon").
   - Stated use cases: (a) "generative media applications" — but only to **auto-pair an existing track** to a video's mood/pacing, **not** to generate audio; (b) embedding a native music-search experience in an app.
   - **It does NOT generate voiceover or music.**

2. **Artlist AI Suite / AI Toolkit** (`artlist.io/ai`) — generative, but **web-UI only, no API.**
   - **AI Voiceover:** TTS up to ~5,000 chars/gen, 70+ languages, custom/cloned voices, speech-to-speech.
   - **AI Music:** as of **March 2026** powered by **Google Lyria 3 Pro** — text-to-music or up to 10 image inputs, structural control (intro/verse/chorus/outro), tracks up to 3 min.
   - **AI Image / AI Video** and "Artlist Studio" round out the toolkit.
   - Sold via credit-based **AI Starter / AI Professional** plans. All consumed through the website; **no developer endpoints documented** for any of these.

**Bottom line:** The thing we'd want (programmatic VO + music generation) is exactly the thing Artlist does **not** expose. The thing they do expose (catalog API) requires an enterprise sales motion and still only gives stock tracks.

---

## Licensing notes (high level)

- Artlist licenses **do** cover paid ads — but **only on the right plan**. The **Pro / Business** license covers commercial projects, advertising, client/agency work, branded content, and monetization across YouTube/Meta/TikTok/TV/web. The cheaper **Social** license is **personal channels only** and explicitly **does not** cover client/brand work — so it would **not** cover STR client ad campaigns.
- Coverage is **perpetual**: anything published while a license is active stays cleared even after the subscription lapses. Includes a sync license for social platforms.
- For the **API alternatives below**: commercial/ad use is generally fine on **paid tiers**, but with two cautions: (1) **free tiers usually forbid commercial use / require attribution**, and (2) AI-music vendors **trained on unlicensed audio (Suno, Udio)** carry residual copyright/Content-ID risk. Vendors trained on **licensed data (Google Lyria 3, Beatoven, Mubert, Stability)** are the safer choice for paid ads. Always confirm each vendor's current TOS before shipping to client campaigns.

---

## Alternatives (API-first)

### Voiceover / TTS

| Provider | One-liner | Rough pricing | Commercial ad use |
|---|---|---|---|
| **ElevenLabs** | Best-in-class natural VO, cloning, 70+ langs; mature API/SDK | ~$5/mo Starter → $99/mo Pro; Flash ~$0.05/1k tokens; PAYG available | Yes on **paid** plans (free = attribution, no commercial) |
| **OpenAI TTS** | Simple, cheap, fits existing OpenAI workflows; 10 voices, no cloning | ~$15 / 1M chars; 4,096 char/request cap | Yes |
| **Cartesia (Sonic)** | Lowest latency (sub-100ms TTFA); good for real-time, fine for content | Credit-based; free 10k → ~$299/mo Scale | Yes on paid |
| **Google / Azure TTS** | Enterprise breadth — Azure 400+ voices / 140+ langs | Google/Azure Neural ~$16/1M (0.5M free/mo); HD ~$100/1M | Yes |
| **PlayHT** | Decent quality, flexible PAYG + subscriptions | Turbo ~$15/1M → PlayDialog ~$100/1M; subs $39–$999/mo | Yes on paid |

### AI Music

| Provider | One-liner | Rough pricing | Commercial ad use |
|---|---|---|---|
| **Google Lyria 3 / 3 Pro** | Same engine Artlist uses; **licensed training data**; 3-min tracks, structural control | Via **Gemini API / Vertex AI** (usage-based; public preview) | Yes — **licensed data = lowest legal risk**, made for commercial/API |
| **Mubert** | Purpose-built **product API** (prompt/BPM/mood/image → royalty-free track) | Subscription/usage tiers; royalty-free output | Yes — explicitly royalty-free for commercial |
| **Beatoven.ai** | Ethical, **licensed-only training**; API available | ~$8/mo Personal → $24/mo Pro | Yes on paid |
| **Loudly** | Affordable royalty-free generator with API | ~$5.99/mo+ | Yes on paid |
| **Stability AI — Stable Audio 2.5** | Enterprise audio model (music/SFX), built for commercial | Enterprise/API pricing | Yes — built for commercial |
| **Suno** | Highest consumer quality, but **NO official API** (only reverse-engineered 3rd-party wrappers) | Pro $8/mo, Premier $24/mo (UI) | Commercial on paid **UI** plans; **unofficial APIs are TOS/legal risk** |
| **Udio** | Similar to Suno; **no public API**; same MUG/Sony/Warner litigation overhang | n/a (no official API) | Risky — avoid for client ads |

---

## Recommendation + integration sketch

**Recommended stack:**
- **Voiceover → ElevenLabs API.** Best quality-per-dollar, real SDK, multilingual, clean commercial rights on paid tiers. Start on Creator/Pro.
- **Music → Google Lyria 3 (Gemini API / Vertex AI)** as primary, with **Mubert** as a fallback/alternative.
  - Lyria is literally the engine Artlist resells for AI Music, but available as a first-class API with **licensed training data** (lowest ad-copyright risk). If we want zero GCP setup, **Mubert** is a fast product-focused API; **Beatoven** is a cheap licensed-data alternative.
- **Skip Artlist's API for generation.** Only revisit Artlist (Enterprise catalog API or Pro-plan UI) if a human-in-the-loop wants to hand-pick curated library tracks — and only on a **Pro/Business** license, since Social doesn't cover client ad work.

**Why this fits the existing app:** ads.revarity.com already runs Higgsfield image→video and **polls async video jobs**. Audio generation slots into that same async-job pattern.

**Minimal integration approach (Next.js, mirrors current Higgsfield flow):**
1. **New server routes** (App Router route handlers / server actions): `POST /api/audio/voiceover` and `POST /api/audio/music`. Keep ElevenLabs and Lyria/Mubert keys server-side only (env vars, never client).
2. **Voiceover:** call ElevenLabs TTS with the ad script → receive MP3/PCM. ElevenLabs is typically fast enough to be near-synchronous, but wrap it in the **same job record** as everything else so the UI is uniform.
3. **Music:** submit a prompt (genre/mood/BPM derived from the ad's vibe + desired duration) to Lyria/Mubert. Treat as an **async job** exactly like the Higgsfield video jobs — enqueue, store a `jobId`, and let the existing **poller** check status until the track URL is ready.
4. **Storage:** drop finished VO + music files into the same blob storage the rendered videos use (e.g., Vercel Blob), keyed to the creative.
5. **Mux:** in the final render/compose step, **layer VO over background music under the video** (duck the music under the VO). This can be done with an ffmpeg compose step server-side, or passed to whatever already stitches the final ad.
6. **Job schema:** add an `audio` sub-status (`voiceover`, `music`) to the existing creative job so the front end shows progress alongside the video — no new polling infra needed.

**Net:** ElevenLabs (VO) + Lyria-via-Gemini/Vertex or Mubert (music), both behind server routes that reuse the existing async-job + poller machinery. No enterprise sales call required, and rights are clean for paid STR ads on paid tiers.

---

## Sources (actually retrieved)

- Artlist Enterprise API — Welcome / overview: https://developer.artlist.io/welcome
- Artlist Enterprise API — Use Cases: https://developer.artlist.io/use-cases
- Artlist Enterprise API — Authentication: https://developer.artlist.io/authentication
- Web search (Artlist API docs, capabilities, OAuth2): results from `developer.artlist.io/responses-api`, `/general-terms`, `/dictionaries`, and Artlist Music API blog
- Web search (Artlist AI products, Lyria 3 Pro integration Mar 2026, AI Voiceover, AI Suite plans): `artlist.io/ai`, `artlist.io/blog/new-artlist-ai-features/`, `help.artlist.io` AI Suite article, Music Business Worldwide
- Web search (Artlist license / commercial / paid-ads coverage): `help.artlist.io` "Understanding Artlist's license", Artlist Zendesk "Commercial projects and advertising"
- Web search (ElevenLabs pricing/commercial 2026): `elevenlabs.io/pricing/api`, BIGVU, Cekura
- Web search (Suno API status + pricing/commercial): `aimlapi.com/blog/the-suno-api-reality`, `suno.com/pricing`, MusicGPT blog
- Web search (Mubert / Loudly / Beatoven APIs + commercial): `mubert.com/api`, `beatoven.ai`, Mureka "best AI music API platforms"
- Web search (OpenAI/Cartesia/PlayHT/Google/Azure TTS pricing 2026): Deepgram, Novita, Gladia comparisons; `developers.openai.com/api/docs/pricing`
- Web search (Google Lyria 3 / Vertex AI + Stability Audio, commercial/licensed): `cloud.google.com/blog` Lyria 3 on Vertex AI, `blog.google` Lyria 3 Pro, Stability AI Stable Audio 2.5

*Note on uncertainty: Marketing pages (`artlist.io/enterprise`, `artlist.io/ai`, the AI-Suite help article) returned HTTP 403 to the fetcher, so those AI-product and exact-pricing details come from search-result summaries rather than direct page reads. The core conclusion — that Artlist's API is catalog-only and the generative tools are UI-only — is corroborated directly by the fetched `developer.artlist.io` docs. Alternative-vendor prices are approximate and change frequently; confirm current TOS/pricing before committing.*
