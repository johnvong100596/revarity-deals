import { NextResponse } from "next/server";
import { claimViolations } from "@/lib/claims";
import { genCopy, buildImagePrompt, renderImage, primeAngles, specDims } from "@/lib/connectors";
import { scoreCreative } from "@/lib/score";
import { appendCreatives, readQueue, readApprovals, publicImageUrl, appendComputeLog, readComputeLog, appendMcpLog } from "@/lib/store";
import { listFolderImages, driveConfigured } from "@/lib/drive";
import { estimateCredits } from "@/lib/computeCost";
import { newId } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Remote MCP connector (Streamable HTTP, stateless) — D-17. Team members add
 * https://ads.revarity.com/api/mcp to Cowork (Settings → Connectors → custom connector)
 * with a per-member bearer key from MCP_API_KEYS ("name:key,name2:key2").
 *
 * DRAFT SCOPE ONLY — exactly four tools: submit_idea / list_queue / get_draft /
 * list_library_photos. No approve, no publish, no delete, no settings, no budget —
 * those stay human, in the UI (D-04). The claims lock (lib/claims, APR blocklist
 * included) gates every submission; every call that touches the queue is logged with
 * the key that sent it (state/mcp-log.json).
 *
 * Spend: submit_idea queues for the next batch at ZERO cost by default. generate_now
 * rides the P0 cost path — per-call estimate + MCP_DAILY_CREDITS_CAP (default 50/day
 * across all keys) — and produces ONE image draft (the cheapest real creative);
 * video stays operator-only in the UI.
 */

const PROTOCOL_DEFAULT = "2025-03-26";
const SUPPORTED_PROTOCOLS = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);
const DAILY_CAP = () => Math.max(0, Number(process.env.MCP_DAILY_CREDITS_CAP) || 50);

/* ── auth: Authorization: Bearer <key> → member name from MCP_API_KEYS ── */
function memberForRequest(req) {
  // Two ways to present the key: Authorization: Bearer <key>, or ?key=<key> in the connector
  // URL. The query form exists because claude.ai custom connectors can't send custom headers —
  // the URL is the only channel a member can put their key in. Internal tool, keys rotate via
  // env; the trade-off is accepted and logged in D-17.
  //
  // KEYS MUST BE URL-SAFE ([A-Za-z0-9_-] only). Learned the hard way (2026-07-05): a key
  // containing '&' is truncated by query-string parsing and one containing '#' never leaves
  // the browser (fragment). Rotation = change MCP_API_KEYS, redeploy.
  let key = "";
  const h = req.headers.get("authorization") || "";
  if (h.startsWith("Bearer ")) key = h.slice(7).trim();
  if (!key) { try { key = (new URL(req.url).searchParams.get("key") || "").trim(); } catch {} }
  key = key.replace(/^["']+|["']+$/g, ""); // forgive pasted quotes
  if (!key) return null;
  for (const pair of (process.env.MCP_API_KEYS || "").split(",")) {
    const i = pair.indexOf(":");
    if (i <= 0) continue;
    const name = pair.slice(0, i).trim();
    const k = pair.slice(i + 1).trim();
    if (!name || !k) continue;
    // Accept the bare personal key, and forgive the "name:key" paste form.
    if (key === k || key === `${name}:${k}`) return name;
  }
  return null;
}

/* ── plain-language claims gate (same lock as everywhere else; APR blocklist included) ── */
function claimsGate(...texts) {
  const hits = claimViolations(texts.filter(Boolean).join("\n"));
  if (!hits.length) return null;
  const kinds = [...new Set(hits.map((h) => h.kind))].join(", ");
  return `That wording trips the claims lock (${kinds}) and can't become an ad. The only allowed money claim is "$0 down for qualified properties"; APR/credit language and urgency/guarantee/income promises are blocked. Move unconfirmed promises to DM replies and resubmit.`;
}

async function mcpSpentToday() {
  const today = new Date().toISOString().slice(0, 10);
  const log = await readComputeLog();
  return log
    .filter((e) => (e.at || "").slice(0, 10) === today && (e.note || "").startsWith("mcp:"))
    .reduce((s, e) => s + (Number(e.credits) || 0), 0);
}

const queueStatus = (c, decisions) => decisions[c.id] || (c.source === "mcp-idea" && !c.hasImg && !c.video_url ? "idea-queued-for-next-batch" : "pending-review");

/* ── the four tools — nothing else is exposed, by design. MCP annotations tell clients
      honestly which are read-only (safe to auto-allow) vs. which write a draft. ── */
const TOOLS = [
  {
    name: "submit_idea",
    description: "Submit an ad idea (brief + optional format/photo hints) as a DRAFT in the Review queue. Runs the claims lock first. Default: queued for the next batch — zero spend. Set generate_now=true to create ONE image draft immediately (cost-estimated, counted against the shared daily cap). Nothing you submit is ever published or approved by this tool — a human reviews every draft in the hub (D-04).",
    annotations: { title: "Submit idea", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        brief: { type: "string", description: "The ad idea in plain words — offer angle, scene, feeling. The marketing brain writes the actual copy." },
        format: { type: "string", enum: ["auto", "meta_feed_square", "meta_feed_portrait", "meta_story_vertical", "meta_landscape", "before_after_split"], description: "Placement hint (default auto)." },
        photo_hints: { type: "string", description: "Optional: which real library photos to lean on (use list_library_photos for names)." },
        generate_now: { type: "boolean", description: "true = generate one image draft immediately (estimated ~2 credits, daily-capped). Default false = free, queued for the next batch." },
      },
      required: ["brief"],
    },
  },
  {
    name: "list_queue",
    description: "List the Review queue — statuses only (no copy, no media). Shows where each draft sits: idea-queued / pending-review / approve / hold / reject.",
    annotations: { title: "List queue", readOnlyHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_draft",
    description: "Status + preview link for one draft by id.",
    annotations: { title: "Get draft", readOnlyHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Draft id from submit_idea or list_queue." } }, required: ["id"] },
  },
  {
    name: "list_library_photos",
    description: "Names + thumbnails of the real listing photos in the Drive library, so briefs can reference real photos by name. (Real photos only — AI interiors are retired from creative.)",
    annotations: { title: "List library photos", readOnlyHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {} },
  },
];

async function runTool(name, args, member) {
  if (name === "submit_idea") {
    const brief = String(args?.brief || "").trim().slice(0, 2000);
    if (!brief) throw Object.assign(new Error("brief is required"), { invalidParams: true });
    const format = SUPPORTED_FORMATS.has(args?.format) ? args.format : "auto";
    const photoHints = String(args?.photo_hints || "").trim().slice(0, 400);

    // Claims lock BEFORE anything is stored or spent (APR blocklist included).
    const blocked = claimsGate(brief, photoHints);
    if (blocked) {
      await appendMcpLog({ member, tool: name, note: `BLOCKED by claims lock: ${brief.slice(0, 120)}` });
      return { blocked: true, reason: blocked };
    }

    const id = `hub-generated/${newId("mcp").slice(4)}`;

    if (!args?.generate_now) {
      // Default: FREE — the idea lands as a pending draft card; the next batch / an operator picks it up.
      const rec = {
        id, angle_id: "MCP", variant: "IDEA", spec: format, dimensions: null,
        headline: brief.slice(0, 90), body: brief, cta: "",
        source: "mcp-idea", submitted_by: member, photo_hints: photoHints || null, created_at: Date.now(),
        qa: {
          image_layer_verdict: "review",
          image_layer_reasons: [
            `idea from ${member} via the remote connector — queued for the next batch, nothing generated yet (0 credits)`,
            photoHints ? `photo hints: ${photoHints}` : null,
          ].filter(Boolean),
          qa_model: "",
        },
      };
      await appendCreatives([{ rec }]);
      await appendMcpLog({ member, tool: name, draft_id: id, credits: 0, note: `queued: ${brief.slice(0, 120)}` });
      return { draft_id: id, status: "idea-queued-for-next-batch", spend: "0 credits", note: "A human reviews every draft in the hub before anything else happens." };
    }

    // generate_now: the P0 cost path — per-call estimate + shared daily cap, then ONE image draft.
    const est = estimateCredits("image");
    const cap = DAILY_CAP();
    const spent = await mcpSpentToday();
    if (spent + est > cap) {
      await appendMcpLog({ member, tool: name, note: `REFUSED: daily cap (spent ~${spent}/${cap} cr)` });
      return { blocked: true, reason: `Today's connector budget is used up (~${spent} of ${cap} credits). The idea was NOT queued — resubmit without generate_now for a free draft, or try tomorrow.` };
    }

    await primeAngles();
    const fullBrief = photoHints ? `${brief}\nLean on these REAL library photos: ${photoHints}` : brief;
    const [copy] = await genCopy({ angleId: "", brief: fullBrief, n: 1 });
    if (!copy) throw new Error("copy generation returned nothing — try again");
    const copyBlocked = claimsGate(copy.headline, copy.body, copy.cta);
    if (copyBlocked) {
      await appendMcpLog({ member, tool: name, note: `BLOCKED post-gen by claims lock: ${brief.slice(0, 120)}` });
      return { blocked: true, reason: `The generated copy tripped the claims lock before any image was rendered (no spend). ${copyBlocked}` };
    }
    const spec = format === "auto" ? "meta_feed_square" : format;
    const prompt = buildImagePrompt({ headline: copy.headline, angleId: "", spec, extra: fullBrief });
    const [adPng, scores] = await Promise.all([
      renderImage(prompt, { final: true }),
      scoreCreative({ headline: copy.headline, body: copy.body, cta: copy.cta, angleId: "", spec, brief: fullBrief }),
    ]);
    const d = specDims(spec);
    const rec = {
      id, angle_id: "MCP", variant: "HUB", spec, dimensions: `${d.w}x${d.h}`,
      headline: copy.headline, body: copy.body, cta: copy.cta, pricing_flag: copy.pricing_flag,
      source: "mcp", submitted_by: member, brief: fullBrief, created_at: Date.now(), scores,
      qa: { image_layer_verdict: "review", image_layer_reasons: [`generated from ${member}'s idea via the remote connector — review before approve`], qa_model: "" },
    };
    await appendCreatives([{ rec, adPng }]);
    await appendComputeLog({ kind: "image", credits: est, note: `mcp:${member} ${id}` });
    await appendMcpLog({ member, tool: name, draft_id: id, credits: est, note: `generated now: ${brief.slice(0, 120)}` });
    return {
      draft_id: id, status: "generated-pending-human-review", spend: `~${est} credits`,
      daily_remaining: `~${Math.max(0, Math.round((cap - spent - est) * 10) / 10)} of ${cap} connector credits left today`,
      note: "The draft sits in the Review queue — a human approves or removes it there.",
    };
  }

  if (name === "list_queue") {
    const [queue, approvals] = await Promise.all([readQueue(), readApprovals()]);
    const decisions = approvals.decisions || {};
    return {
      count: queue.length,
      drafts: queue.map((c) => ({ id: c.id, status: queueStatus(c, decisions), created_at: c.created_at || null })),
    };
  }

  if (name === "get_draft") {
    const id = String(args?.id || "").trim();
    if (!id) throw Object.assign(new Error("id is required"), { invalidParams: true });
    const [queue, approvals] = await Promise.all([readQueue(), readApprovals()]);
    const c = queue.find((x) => x.id === id);
    if (!c) return { found: false, note: "No draft with that id (it may have been removed)." };
    let preview = c.video_url || null;
    if (!preview && c.hasImg) preview = (await publicImageUrl(id, "ad").catch(() => null)) || null;
    return {
      found: true, id, status: queueStatus(c, approvals.decisions || {}),
      check: c.qa || "review",
      preview_link: preview,
      note: preview ? undefined : "No public preview for this draft — see it signed in at ads.revarity.com/review.",
    };
  }

  if (name === "list_library_photos") {
    if (!driveConfigured()) return { configured: false, note: "The Drive photo library isn't connected in this environment yet." };
    const files = await listFolderImages(undefined, { max: 40 });
    return { count: files.length, photos: files.map((f) => ({ name: f.name, id: f.id, thumbnail: f.thumbnailLink || null })) };
  }

  throw Object.assign(new Error(`unknown tool: ${name}`), { methodNotFound: true });
}

const SUPPORTED_FORMATS = new Set(["auto", "meta_feed_square", "meta_feed_portrait", "meta_story_vertical", "meta_landscape", "before_after_split"]);

/* ── JSON-RPC 2.0 plumbing (stateless Streamable HTTP: JSON responses, no SSE/session) ── */
const rpcResult = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

/**
 * NO HTTP 401 FROM THIS ENDPOINT — EVER (Cena, 2026-07-05). Claude only attempts the OAuth
 * dance when it sees HTTP 401/WWW-Authenticate; if the endpoint never speaks HTTP-auth,
 * connector registration always succeeds and a bad key fails LOUDLY inside the tools instead.
 * So: initialize / tools/list / ping are open (harmless metadata — tool names only), and the
 * key is enforced per tools/call, with auth failures returned as JSON-RPC errors in a 200.
 * Security unchanged: no tool runs without a valid key; caps and the submission log still apply.
 */
const AUTH_FAIL_MSG = "Invalid or missing key — check your connector URL. It should be https://ads.revarity.com/api/mcp?key=<your-personal-key> (no spaces or quotes around the key). Nothing ran.";

async function handleMessage(msg, member) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return rpcError(msg?.id ?? null, -32600, "invalid request");
  }
  const isNotification = msg.id === undefined || msg.id === null;
  try {
    switch (msg.method) {
      case "initialize": {
        const asked = msg.params?.protocolVersion;
        return rpcResult(msg.id, {
          protocolVersion: SUPPORTED_PROTOCOLS.has(asked) ? asked : PROTOCOL_DEFAULT,
          capabilities: { tools: {} },
          serverInfo: { name: "revarity-ads-hub", version: "1.0.0" },
          instructions: `Draft-scope connector for the Revarity ad studio${member ? ` (signed in as ${member})` : " (no valid key on this connection — tools will refuse until the URL carries ?key=<your-personal-key>)"}. Four tools: submit_idea, list_queue, get_draft, list_library_photos. Everything lands as a DRAFT for human review — nothing here approves, publishes, deletes, or spends beyond the capped generate_now. The only allowed money claim is "$0 down for qualified properties".`,
        });
      }
      case "ping":
        return rpcResult(msg.id, {});
      case "tools/list":
        return rpcResult(msg.id, { tools: TOOLS });
      case "tools/call": {
        const { name, arguments: args } = msg.params || {};
        if (!member) {
          // Key enforced HERE, in-band — never as HTTP auth.
          appendMcpLog({ member: "(invalid-key)", tool: String(name || ""), note: "tools/call refused: no valid key" }).catch(() => {});
          return rpcError(msg.id, -32001, AUTH_FAIL_MSG);
        }
        try {
          const out = await runTool(name, args || {}, member);
          return rpcResult(msg.id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], isError: !!out?.blocked });
        } catch (e) {
          if (e.methodNotFound) return rpcError(msg.id, -32602, e.message);
          if (e.invalidParams) return rpcError(msg.id, -32602, e.message);
          // tool execution errors travel in-band per MCP so the model can read them
          return rpcResult(msg.id, { content: [{ type: "text", text: `Tool failed: ${e?.message || e}` }], isError: true });
        }
      }
      default:
        if (msg.method.startsWith("notifications/")) return null; // acknowledged silently
        return isNotification ? null : rpcError(msg.id, -32601, `method not found: ${msg.method}`);
    }
  } catch (e) {
    return isNotification ? null : rpcError(msg.id, -32603, String(e?.message || e));
  }
}

export async function POST(req) {
  const member = memberForRequest(req); // null is fine — enforced per tools/call, in-band
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json(rpcError(null, -32700, "parse error"), { status: 400 });
  }
  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map((m) => handleMessage(m, member)))).filter(Boolean);
    if (!responses.length) return new NextResponse(null, { status: 202 });
    return NextResponse.json(responses);
  }
  const res = await handleMessage(body, member);
  if (!res) return new NextResponse(null, { status: 202 });
  return NextResponse.json(res);
}

// Stateless server: no SSE stream, no sessions to terminate.
export async function GET() {
  return NextResponse.json({ ok: false, error: "This MCP endpoint is stateless — POST JSON-RPC messages to it." }, { status: 405 });
}
export async function DELETE() {
  return new NextResponse(null, { status: 405 });
}
