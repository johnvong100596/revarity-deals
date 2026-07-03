/**
 * lib/voicePrebake.js — the "pre-made audio buffer" provider behind the voice seam.
 *
 * The money-arc has 3 FIXED beats (problem / we-do-it-all / CTA) whose lines never
 * change — so their Zoe VO is baked ONCE and committed under assets/vo/, then reused
 * across every ad forever. Nightly renders never call live TTS: fixed beats always
 * resolve here, and approved hooks get baked in via put() (batched on approval).
 * Only a brand-new, not-yet-baked hook falls through to live TTS / "VO pending".
 *
 * Keyed by the EXACT requested line (whitespace-normalized). No network, no deps.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "vo");
const MANIFEST = path.join(DIR, "manifest.json");

const norm = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
const keyOf = (t) => crypto.createHash("sha1").update(norm(t)).digest("hex").slice(0, 16);

function load() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, "utf8")); }
  catch { return { entries: [] }; }
}

/** Index normalized-text → entry (built fresh each call so put() during a run is seen). */
function index() {
  const m = load();
  const byText = new Map();
  for (const e of m.entries || []) if (e && e.text && e.file) byText.set(norm(e.text), e);
  return { m, byText };
}

/** Is there a prebaked buffer for this exact line? */
export function hasPrebake(text) {
  const { byText } = index();
  const e = byText.get(norm(text));
  return !!(e && fs.existsSync(path.join(DIR, e.file)));
}

/** Return the prebaked mp3 Buffer for this line, or null. */
export function getPrebake(text) {
  const { byText } = index();
  const e = byText.get(norm(text));
  if (!e) return null;
  const f = path.join(DIR, e.file);
  return fs.existsSync(f) ? fs.readFileSync(f) : null;
}

/**
 * Add/replace a prebaked line (used by the hook-prebake step on approval). Writes
 * the mp3 and updates the manifest. `kind` defaults to "hook". Idempotent by text.
 */
export function putPrebake(text, buffer, { kind = "hook", beat = "hook" } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  const file = `${kind}-${keyOf(text)}.mp3`;
  fs.writeFileSync(path.join(DIR, file), buffer);
  const m = load();
  m.entries = (m.entries || []).filter((e) => norm(e.text) !== norm(text));
  m.entries.push({ kind, beat, text: norm(text), file });
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
  return file;
}

/** All prebaked lines (for a preflight/coverage report). */
export function listPrebake() {
  return (load().entries || []).map((e) => ({ kind: e.kind, beat: e.beat, text: e.text, file: e.file }));
}
