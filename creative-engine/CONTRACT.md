# Higgsfield "agents" API — reverse-engineered contract

Captured 2026-05-30 from `@higgsfield/cli` v0.1.40 (`hf.exe`, a Go binary) + a forwarding capture
proxy (`_capture.mjs`). This is what `higgsfield.mjs` (our dependency-free direct client) implements,
so the engine and the deployed app can generate without the CLI binary.

## Hosts (override via env)
| Purpose | Default base | Env override |
|---|---|---|
| API | `https://fnf.higgsfield.ai` | `HIGGSFIELD_API_URL` |
| Device auth / token refresh | `https://fnf-device-auth.higgsfield.ai` | `HIGGSFIELD_DEVICE_AUTH_URL` |
| (dev API) | `https://dev-fnf.higgsfield.ai` | — |

## Auth
- Header on every API call: `Authorization: Bearer <access_token>` **and** `x-hf-mcp-client-name: claude_code`.
- Tokens live in `~/.config/higgsfield/credentials.json` → `{ access_token: "hf_…", refresh_token: "hfr_…" }`
  (path override: `HIGGSFIELD_CREDENTIALS_PATH`). Written by `hf auth login`.
- **Access token expires (~daily).** An expired token returns `401 {"detail":"Invalid or expired token"}`.
  Refresh: `POST {DEVICE_AUTH}/refresh` with `{ "refresh_token": "hfr_…" }` → `{ access_token, refresh_token, expires_in }`.
  (Field names confirmed from the binary; body/response shape pending one live capture — see TODO.)

## Routes
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/agents/balance` | — | `{ email, credits, subscription_plan_type }` |
| GET | `/agents/models` | — | `[ { job_set_type, display_name, type, params:<JSON-Schema> } ]` |
| GET | `/agents/transactions` | — | recent credit transactions |
| POST | `/agents/uploads?type=image` | `{}` (empty) | `{ id, type, url, upload_url }` — `upload_url` is a presigned **S3 PUT** (eu-north-1), valid 24h |
| PUT | `<upload_url>` (S3, not the API host) | raw file bytes, `Content-Type: image/png` | `200` (must match the signed `content-type`) |
| POST | `/agents/uploads/{id}/confirm?type=image` | `{}` (empty) | `{ id, status:"uploaded" }` |
| POST | `/agents/jobs/cost` | job body (below) | `{ credits, credits_exact }` — **free, no spend** |
| POST | `/agents/jobs` | job body (below) | `[ "<job_id>" ]` (array of ids) |
| GET | `/agents/jobs/{job_id}` | — | job record (poll this; see status) |

`/agents/jobs/poll`, `/agents/workspaces[/select|/unselect]`, `/agents/custom-references`,
`/agents/marketing-studio/*`, `/agents/product-photoshoot/enhance`, `/agents/marketplace-cards/enhance`
also exist (not needed for image→video).

## Job body (cost + create, identical)
```json
{
  "job_set_type": "seedance1_5",
  "params": {
    "aspect_ratio": "16:9",
    "duration": 4,
    "resolution": "1080p",
    "prompt": "Slow cinematic push-in …",
    "medias": [ { "data": { "id": "<media_input_id>", "type": "media_input" }, "role": "start_image" } ]
  }
}
```
- **Video** models take the image under `params.medias[].data` with `role:"start_image"`.
  **Image** models (e.g. `nano_banana`) instead take `params.input_images:[{ id, type }]`.
- Per-model param keys (from `/agents/models` JSON-Schema), e.g. seedance: `duration ∈ {"4","8","12"}`,
  `resolution ∈ {480p,720p,1080p}`, `aspect_ratio` incl. `21:9`. cinematic_studio_video_v2: `mode ∈ {pro,std}`,
  `genre`. kling2_6: `sound:bool` (defaults **true** — set false for a muted hero), `duration ∈ {"5","10"}`.

## Job status lifecycle (poll `GET /agents/jobs/{id}`)
```jsonc
{ "id":"…", "status":"queued", "job_set_type":"seedance1_5", "display_name":"Seedance 1.5 Pro",
  "result_url": null, "min_result_url": null, "created_at": 1780115252.4, "params": { "width":1920, "height":1080, … } }
```
`status`: `queued` → `in_progress` → `completed`. On `completed`, `result_url` is the mp4 (CloudFront,
e.g. `https://d8j0ntlcm91z4.cloudfront.net/user_…/hf_<ts>_<id>.mp4`). Treat `failed`/`canceled` as terminal errors.

## Image→video, end to end
upload (`POST /uploads` → PUT bytes → `POST …/confirm`) → `POST /agents/jobs` → poll `GET /agents/jobs/{id}`
until `completed` → download `result_url`. Implemented in `higgsfield.mjs#imageToVideo()`.

## Reproduce the capture
```bash
node creative-engine/_capture.mjs                 # forwarding proxy on :8799 → fnf.higgsfield.ai
HIGGSFIELD_API_URL=http://127.0.0.1:8799 hf generate create seedance1_5 \
  --prompt "…" --image still.png --resolution 1080p --duration 4 --wait --json
# every request/response (method, route, headers, body) lands in creative-engine/_capture.log
```

## TODO (one safe step, when no batch is running)
Capture the exact `/refresh` request/response: back up credentials.json, run a 2nd proxy
(`HF_UPSTREAM=https://fnf-device-auth.higgsfield.ai CAP_PORT=8800 node _capture.mjs`),
point `HIGGSFIELD_DEVICE_AUTH_URL=http://127.0.0.1:8800`, invalidate only the `access_token`
(keep `refresh_token`), run `hf account status` to force a refresh, then restore.
