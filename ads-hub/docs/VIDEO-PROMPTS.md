# ads.revarity.com — Video generation prompts

_Last updated 2026-05-30._

The home hero and the per-tab tutorials are wired to play `.mp4` files that **drop in with no code change**:

| Surface | File the app looks for | Fallback if missing |
| --- | --- | --- |
| Home hero background | `public/hero/hero-loop.mp4` | the 8-still Ken-Burns crossfade (already shipping) |
| Per-tab tutorial | `public/tutorials/<tab>.mp4` (`create`, `swipe`, `review`, `schedule`, `budget`, `monitor`) | the animated step-walkthrough (already shipping) |

Both players reveal the video only on the browser's `canplay` event, so a missing/slow file never flashes a broken frame — render when ready, drop it in, done.

**Hard specs for the hero:** 16:9, 1920×1080 (or 2560×1440), H.264 MP4, **silent** (it's `muted`), **seamless loop** (last frame flows into the first), ~18–28s, target < 8 MB (it's a background — compress hard with `-crf 28 -preset slow`). Editorial / cinematic color grade to match the premium aesthetic (no flat-vector, no on-screen text or logos).

---

## 1. Hero — the "dream-destination drone journey" (seamless loop)

This is the centerpiece. It mirrors the 8 stills already in `public/hero/` (`01-bedroom-city → 08-highrise-night`) so the storyboard is proven.

### 1a. Master prompt (one continuous take — for Veo 3 / Sora / Kling 2.x / Runway Gen-3)

> **Continuous single-take aerial drone journey, seamless loop, cinematic 16:9, golden-hour editorial color grade, no text or logos, no people in frame.**
> Begin inside a sun-washed Tulum villa bedroom, linen curtains drifting; the camera glides forward through open doors onto warm white sand. It skims low and fast over turquoise surf, then tilts up and pushes into a deep blue sky, accelerating through a single soft cloud — **the cloud fills the frame as a clean match-cut**. We emerge descending between gleaming Dubai skyscrapers at dusk, sweeping toward one glowing high-rise apartment window. Pull back and bank over a snow-dusted alpine ski resort bathed in pink alpenglow, then drift past a cozy timber cottage with firelight flickering in the windows. Finally rise over a glittering nighttime city skyline and curve gently back toward the lit villa where we started — **the final framing matches the opening so the clip loops invisibly.**
> Motion: smooth FPV/dolly flight, steady speed, no hard cuts, no whip-pans; transitions are motion-matched (push-through-cloud, rise-over-ridge, bank-around-tower). Lighting: warm golden hour → blue-hour dusk → night, graded filmic with gentle bloom and shallow haze. Mood: aspirational, calm, premium travel.

**Loop tip:** generate ~24s, then in post trim so frame 0 ≈ last frame; apply a 0.5–1s crossfade dissolve from tail to head (`xfade`) to hide any seam.

### 1b. Per-model notes

- **Veo 3 (Gemini API / Vertex / Flow):** best at long coherent camera moves and match-cuts. Feed the master prompt as one shot; if it caps clip length, render the 8 segments below and stitch.
- **Kling 2.x / Runway Gen-3:** strong on aerial b-roll; keep each prompt ≤ ~10s, use "start frame" = one of our stills for continuity, stitch.
- **Sora:** good for the dreamy transitions; emphasize "single continuous shot, no cuts."
- **Higgsfield (already wired in `lib/higgsfield-cloud.js`):** ⚠️ its `image2video/dop` model animates **one still with subtle motion** — it will **not** produce a 6–7 location fly-through in one call. Use it to bring each of the 8 stills to life (subtle push-in / parallax), then stitch + crossfade. See `scripts/render-hero.mjs`.

### 1c. Segment shot-list (the stitched approach — one clip per existing still)

Render each ~3–4s, start-frame = the matching still, then concatenate with 0.6s crossfades.

| # | Start still | Motion prompt (append "slow, smooth, cinematic, no text") |
| --- | --- | --- |
| 1 | `01-bedroom-city` | "slow push-in through a sunlit villa bedroom toward open doors and bright daylight beyond" |
| 2 | `02-over-city` | "aerial drift forward high over a coastal city at golden hour, gentle parallax" |
| 3 | `03-sky` | "push up into deep blue sky through a soft cloud that fills the frame" |
| 4 | `04-tulum-aerial` | "descend and skim low over turquoise surf and white sand, banking gently" |
| 5 | `05-villa-door` | "glide toward a glowing villa doorway / high-rise window at dusk" |
| 6 | `06-ski-resort` | "rise over a snow-dusted alpine ski resort in pink alpenglow" |
| 7 | `07-cottage-fire` | "drift past a cozy timber cottage with warm firelight in the windows" |
| 8 | `08-highrise-night` | "bank over a glittering night city skyline, curving back toward warm light (loop point)" |

Stitch (ffmpeg, equal-length clips, crossfades + final loop seam):

```bash
# concat with 0.6s crossfades, then add a tail→head dissolve so it loops cleanly
ffmpeg -i seg1.mp4 -i seg2.mp4 -i seg3.mp4 -i seg4.mp4 \
       -i seg5.mp4 -i seg6.mp4 -i seg7.mp4 -i seg8.mp4 \
  -filter_complex "[0][1]xfade=transition=fade:duration=0.6:offset=3.4[a]; \
                   [a][2]xfade=transition=fade:duration=0.6:offset=6.8[b]; \
                   [b][3]xfade=transition=fade:duration=0.6:offset=10.2[c]; \
                   [c][4]xfade=transition=fade:duration=0.6:offset=13.6[d]; \
                   [d][5]xfade=transition=fade:duration=0.6:offset=17.0[e]; \
                   [e][6]xfade=transition=fade:duration=0.6:offset=20.4[f]; \
                   [f][7]xfade=transition=fade:duration=0.6:offset=23.8[v]" \
  -map "[v]" -an -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p public/hero/hero-loop.mp4
```

---

## 2. Per-tab tutorial clips (~10–20s each, silent, 16:9 or 4:3)

**Recommended:** the highest-fidelity tutorial is a **real screen-capture** of the actual UI doing the thing (e.g. on `/budget`: typing a monthly number, dragging the test/scale split, watching the lead estimate update), trimmed to the key moment, exported silent. That always matches the real product. Drop it at `public/tutorials/<tab>.mp4`.

If you'd rather AI-generate a motion-graphic explainer, here are prompts (style: "clean dark-UI motion graphic, violet→cyan accent, soft glassmorphism, animated cursor, no voiceover, no real brand text"):

- **`budget.mp4`** — "Animated dark dashboard: a cursor types a monthly budget into a field; a slider splits the bar into 'Test' and 'Scale'; a 'leads' number ticks up as a target cost-per-lead is set. Calm, precise, premium fintech feel."
- **`create.mp4`** — "Cursor types a sentence into a prompt box, clicks Generate; three ad cards fade in one by one with images and headlines. Creative-studio vibe."
- **`review.mp4`** — "A grid of ad cards; cursor clicks Approve (green check), Hold (amber), Reject (coral) across a few; a tally counter updates. Decisive, clean."
- **`schedule.mp4`** — "Approved ad cards drag onto a weekly calendar; account chips (IG/FB) toggle on; a 'You launch it' badge stays prominent. Human-in-control feel."
- **`swipe.mp4`** — "A library of reference-ad cards; cursor saves a few into a 'patterns' tray that flows toward a Create button. Research-to-build motion."
- **`monitor.mp4`** — "Live performance tiles (CPL/CPC/CPA) animate in; one creative highlights as a 'winner'; a human hand-cursor clicks 'scale'. Analytics, restrained."

Each tutorial player auto-reveals the video over the written steps the moment `<tab>.mp4` can play — so you can ship clips one tab at a time.

---

## 3. Where files go (quick reference)

```
public/
  hero/
    hero-loop.mp4        ← §1
    01-bedroom-city.png … 08-highrise-night.png   (existing stills / fallback + segment start-frames)
    clips/               ← optional: per-segment renders from scripts/render-hero.mjs
  tutorials/
    create.mp4  swipe.mp4  review.mp4  schedule.mp4  budget.mp4  monitor.mp4   ← §2
```
