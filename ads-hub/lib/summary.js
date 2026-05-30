/**
 * Weekly snapshot from INTERNAL data (queue + approvals + budget plan). Meta/live performance is
 * intentionally out until spend + a Meta token exist; this is the honest "what happened" view Malcolm
 * can read or send. Pure function — no I/O.
 */
const WEEK_MS = 7 * 24 * 3600 * 1000;

export function computeSummary(queue, approvals, config, now = Date.now()) {
  const dec = approvals?.decisions || {};
  const total = queue.length;

  const qa = { pass: 0, review: 0, fail: 0, other: 0 };
  for (const c of queue) {
    if (c.qa === "pass") qa.pass++;
    else if (c.qa === "review") qa.review++;
    else if (c.qa === "fail") qa.fail++;
    else qa.other++;
  }
  const decVals = Object.values(dec);
  const approved = decVals.filter((v) => v === "approve").length;
  const hold = decVals.filter((v) => v === "hold").length;
  const reject = decVals.filter((v) => v === "reject").length;
  const awaiting = queue.filter((c) => !dec[c.id]).length;

  const weekGen = queue.filter((c) => c.created_at && now - c.created_at < WEEK_MS).length;
  const hubGen = queue.filter((c) => String(c.id).startsWith("hub-generated")).length;
  const qaPassRate = total ? Math.round((qa.pass / total) * 100) : 0;

  const byAngle = {};
  for (const c of queue) {
    const a = c.angle_id || "—";
    (byAngle[a] ||= { id: a, total: 0, approved: 0 });
    byAngle[a].total++;
    if (dec[c.id] === "approve") byAngle[a].approved++;
  }
  const angleRows = Object.values(byAngle).sort((a, b) => b.total - a.total);

  const budgetMonthly = config?.budgetMonthly || 0;
  const cpl = config?.kpi?.cpl_usd_max || 0;
  const estLeads = cpl ? Math.floor(budgetMonthly / cpl) : 0;

  const text = [
    "Revarity ads — weekly snapshot",
    `• Creatives in queue: ${total} (${weekGen} added in the last 7 days; ${hubGen} hub-generated).`,
    `• QA: ${qa.pass} pass / ${qa.review} to review / ${qa.fail} fail (${qaPassRate}% pass).`,
    `• Approvals: ${approved} approved, ${hold} on hold, ${reject} rejected, ${awaiting} awaiting your OK.`,
    `• Plan: $${budgetMonthly.toLocaleString()}/mo at ≤ $${cpl} CPL → ~${estLeads} leads/mo (target).`,
    `• Top angles: ${angleRows.slice(0, 3).map((r) => `${r.id} (${r.total})`).join(", ") || "—"}.`,
    "• Live performance (CPL/CPC/CPA, revenue): pending — activates when Meta + spend are connected.",
  ].join("\n");

  return { total, qa, qaPassRate, approved, hold, reject, awaiting, weekGen, hubGen, angleRows, budgetMonthly, cpl, estLeads, text, generatedAt: now };
}
