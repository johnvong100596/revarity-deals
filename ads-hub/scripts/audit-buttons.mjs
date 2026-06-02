// Dev audit: exercise every newly-added button's backend route against the running hub (same route code
// + engines as prod) and rerun generation across all 5 angles. Run with the dev server up on :4321:
//   node scripts/audit-buttons.mjs
const B = process.env.B || "http://localhost:4321";

async function post(p, body, ms = 150000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  const started = Date.now();
  try {
    const r = await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ac.signal });
    let j = {}; try { j = await r.json(); } catch {}
    return { status: r.status, ...j, _ms: Date.now() - started };
  } catch (e) { return { error: String(e.message || e), _ms: Date.now() - started }; }
  finally { clearTimeout(t); }
}
function detail(r) {
  if (!r.ok) return `HTTP ${r.status || "?"} ${(r.error || "").slice(0, 120)}`;
  if (r.id) return `id=${r.id}`;
  if (r.angle?.id) return `angle=${r.angle.id}`;
  if (r.plan) return `${r.plan.shots?.length || 0} shots → engines: ${(r.plan.shots || []).map((s) => s.engine).join(", ")}`;
  if (r.variants) return `${r.variants.length} variants`;
  return "ok";
}
const log = (label, r) => console.log(`${r.ok ? "PASS" : "FAIL"} · ${label} · ${detail(r)} · ${Math.round(r._ms / 1000)}s`);

const ANGLES = ["AD1_DEAL_LIST", "AD2_CLEANING_QUOTE", "AD3_INCOME_ESTIMATE", "AD4_STARTER_GUIDE", "AD5_DIRECT_OFFER"];

(async () => {
  console.log("=== RERUN ALL ANGLES — one image per angle (Create / format-tiles / hero-composer backend) ===");
  for (const a of ANGLES) {
    const r = await post("/api/generate", { type: "image", angleId: a, brief: "" });
    log(`generate image · ${a}${r.headline ? ` · "${String(r.headline).slice(0, 48)}"` : ""}`, r);
  }
  console.log("=== NEW BUTTON BACKENDS ===");
  log("variations  (Create '✨ N variations' + Review per-card)", await post("/api/variations", { idea: "A host walks through a Tulum penthouse explaining how Revarity builds Airbnbs for investors", n: 2, output: "image" }));
  log("concepts    (Create 'Auto: N from angle')", await post("/api/concepts", { angleId: "AD3_INCOME_ESTIMATE", n: 2, output: "image" }));
  log("angle       (Settings 'Generate new angle')", await post("/api/angle", { brief: "tax benefits for first-time Airbnb hosts" }));
  log("director    (Create 'Plan it' / auto + engine routing)", await post("/api/director", { idea: "A confident host walks through a Tulum penthouse and explains how Revarity builds Airbnbs for serious investors", output: "auto", format: "auto" }));
  console.log("DONE");
})();
