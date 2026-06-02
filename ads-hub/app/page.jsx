import Link from "next/link";
import { loadConfig } from "@/lib/config";
import { readQueue, readApprovals } from "@/lib/store";
import WeeklySummary from "@/app/components/WeeklySummary";
import FirstVisit from "@/app/components/FirstVisit";
import HeroVideo from "@/app/components/HeroVideo";
import CreativeGallery from "@/app/components/CreativeGallery";

export const dynamic = "force-dynamic";

// Cinematic hero scenes (stills in /public/hero; video drops in later). Crossfade is pure CSS.
const SCENES = ["01-bedroom-city", "02-over-city", "03-sky", "04-tulum-aerial", "05-villa-door", "06-ski-resort", "07-cottage-fire", "08-highrise-night"];
const HERO_DUR = SCENES.length * 5;

// "Generate across formats" — studio-style entry tiles. Each deep-links into Create with the output type,
// placement, and a brief scaffold prefilled (Create already reads ?output/?spec/?brief). STR-adapted from
// the Higgsfield Marketing Studio ad formats; the studio still QAs + gates everything (D-04).
const FORMATS = [
  { label: "Cinematic TV Spot", desc: "Broadcast-grade commercial b-roll", output: "video", spec: "meta_landscape", brief: "A cinematic, broadcast-grade short-term-rental commercial — sweeping b-roll of a beautifully furnished luxury rental, warm editorial grade, smooth gimbal motion." },
  { label: "UGC Host", desc: "A presenter talks to camera", output: "presenter", spec: "meta_story_vertical", brief: "A confident, natural on-camera host walks through a furnished short-term rental and explains how Revarity builds and runs Airbnbs for serious investors." },
  { label: "Hyper Motion", desc: "Dynamic, high-energy motion", output: "video", spec: "meta_story_vertical", brief: "High-energy hyper-motion b-roll of a stunning short-term rental — fast, smooth speed-ramped camera moves through the space, premium and kinetic." },
  { label: "Property Tour", desc: "Walk the whole space", output: "video", spec: "meta_story_vertical", brief: "A smooth walking property tour through a beautifully furnished luxury short-term rental, revealing each room with cinematic gimbal motion." },
  { label: "Before / After", desc: "The transformation", output: "image", spec: "before_after_split", brief: "A before/after of a short-term rental unit — bare and empty on one side, fully designed, furnished and styled on the other. The Revarity transformation." },
  { label: "Tutorial", desc: "How it works", output: "presenter", spec: "meta_story_vertical", brief: "A clear, friendly explainer: a host walks through how Revarity sources a deal, designs and furnishes the unit, and runs it end-to-end for the investor." },
  { label: "World Tour", desc: "A locations journey", output: "video", spec: "meta_landscape", brief: "A luxury short-term-rental world tour — a smooth journey across iconic destinations, each revealed through the window of a furnished rental." },
  { label: "Lifestyle B-roll", desc: "Aspirational moments", output: "video", spec: "meta_feed_portrait", brief: "Aspirational lifestyle b-roll inside a luxury short-term rental — coffee by floor-to-ceiling windows, golden-hour light, an aspirational figure enjoying the space (not speaking to camera)." },
];

export default async function Studio() {
  const cfg = await loadConfig();
  const [queue, approvals] = await Promise.all([readQueue(), readApprovals()]);
  const dec = approvals.decisions || {};
  const pass = queue.filter((c) => c.qa === "pass").length;
  const approved = Object.values(dec).filter((v) => v === "approve").length;
  const awaiting = queue.filter((c) => !dec[c.id]).length;
  const gallery = queue.filter((c) => dec[c.id] !== "reject").slice(0, 12); // hide already-rejected from Recent creatives
  const src = (c) => c.video_url || c.ad_url || c.image_url || `/api/image?id=${encodeURIComponent(c.id)}&v=ad`;

  return (
    <>
      <FirstVisit />
      <HeroVideo scenes={SCENES} heroDur={HERO_DUR} />

      <div className="grid cards4">
        <div className="stat"><div className="k">In review queue</div><div className="v">{queue.length}</div><div className="sub">finished ads</div></div>
        <div className="stat"><div className="k">Awaiting approval</div><div className="v good">{awaiting}</div><div className="sub">need your eyes</div></div>
        <div className="stat"><div className="k">Approved → ready</div><div className="v">{approved}</div><div className="sub">to hand to David</div></div>
        <div className="stat"><div className="k">Monthly plan</div><div className="v">${(cfg.budgetMonthly || 0).toLocaleString()}<small> · CPL ≤ ${cfg.kpi.cpl_usd_max}</small></div><div className="sub">$375/mo offer · no rev share</div></div>
      </div>

      <div className="qa-row">
        <Link className="qa" href="/create"><div className="t">Generate creatives</div><div className="s">Run the engine across angles → finished ads</div></Link>
        <Link className="qa" href="/review"><div className="t">Review &amp; approve</div><div className="s">{awaiting} creatives waiting on you</div></Link>
        <Link className="qa" href="/budget"><div className="t">Plan budget</div><div className="s">Test / scale split · target leads</div></Link>
      </div>

      <div className="sec"><h2>Generate across formats</h2><Link className="link" href="/create">Open the studio →</Link></div>
      <div className="fmt-grid">
        {FORMATS.map((f) => (
          <Link key={f.label} className="fmt-tile" href={`/create?output=${f.output}&spec=${f.spec}&brief=${encodeURIComponent(f.brief)}`}>
            <div className="fmt-in">
              <div className="fmt-t">{f.label}</div>
              <div className="fmt-d">{f.desc}</div>
              <span className="fmt-go">Generate →</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="sec"><h2>Pipeline</h2></div>
      <div className="pipe">
        <div className="pl"><div className="n">{queue.length}</div><div className="l">Generated</div></div>
        <div className="pl"><div className="n">{pass}</div><div className="l">QA passed</div></div>
        <div className="pl"><div className="n">{approved}</div><div className="l">Approved</div></div>
        <div className="pl live"><div className="n">—</div><div className="l">Live (human-launched)</div></div>
      </div>

      <div className="sec"><h2>Recent creatives</h2><Link className="link" href="/review">Open review queue →</Link></div>
      {gallery.length === 0 ? (
        <div className="gate"><span>Queue is empty — generate a run to populate the studio.</span></div>
      ) : (
        <CreativeGallery creatives={gallery.map((c) => ({
          id: c.id,
          headline: c.headline || "",
          body: c.body || "",
          cta: c.cta || "",
          angle_id: c.angle_id || "",
          spec: c.spec || "",
          qa: c.qa || "review",
          pricing_flag: c.pricing_flag || "",
          vertical: !!c.vertical,
          src: src(c),
        }))} />
      )}

      <div className="sec"><h2>This week</h2><a className="link" href="/api/summary">Raw data →</a></div>
      <WeeklySummary />

      <div className="sec"><h2>Top performers <span className="ph">Phase 2</span></h2></div>
      <div className="gate"><span>Live CPL / CPC / CPA per creative activates once spend is live + the Meta Ads connection is wired. The loop proposes winners; a human scales them.</span></div>
    </>
  );
}
