"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import StudioPicker from "./StudioPicker";

// The studio centerpiece (mirrors the Higgsfield Marketing Studio prompt bar): describe the ad, pick a
// Type + Placement (quick selects) and a Hook + Setting (full modal pickers), then Generate. It composes
// the picks into a brief and hands off to the existing Create flow (?brief/?output/?spec).
const OUTPUTS = [["auto", "Type: auto"], ["presenter", "Presenter"], ["video", "Video b-roll"], ["image", "Image"], ["copy", "Copy only"]];
const PLACEMENTS = [["auto", "Placement: auto"], ["meta_story_vertical", "Reels 9:16"], ["meta_feed_square", "Feed 1:1"], ["meta_feed_portrait", "Feed 4:5"], ["meta_landscape", "Landscape 16:9"]];

// HOOKS — Stunt or Subtle only (per brand guardrail): proven scroll-stoppers, never gimmicky-dishonest.
const HOOKS = [
  { value: "open on a calm, confident host speaking directly to camera", label: "Direct to camera", cat: "Subtle", desc: "Host speaks calmly, straight to lens." },
  { value: "open on a candid street interview asking a host about their short-term-rental income", label: "Interview", cat: "Subtle", desc: "Street Q&A — a real, candid opener." },
  { value: "open on a slow cinematic push into a beautifully furnished unit", label: "Slow reveal", cat: "Subtle", desc: "A slow, cinematic push into the space." },
  { value: "open on an extreme close-up that slowly tilts up to reveal the space", label: "Close-up tilt", cat: "Subtle", desc: "Extreme close-up, slow tilt-up reveal." },
  { value: "open on a fast match-cut from a bare, empty unit to the same unit fully furnished", label: "Empty → furnished", cat: "Stunt", desc: "Snap from bare room to fully styled." },
  { value: "open on a punchy speed-ramped move sweeping through the space", label: "Speed-ramp reveal", cat: "Stunt", desc: "Punchy speed-ramp through the unit." },
  { value: "open on the estimated monthly income range animating on screen as a clearly-labelled estimate", label: "Numbers drop", cat: "Stunt", desc: "Income range animates on — labelled estimate." },
];
// SETTINGS — REALISTIC backgrounds only (per brand guardrail): premium STR locations, no absurd scenes.
const SETTINGS = [
  { value: "set in a beautifully furnished modern living room", label: "Living room", desc: "Furnished modern living room.", thumb: "/settings/living-room.png" },
  { value: "set in a bright modern kitchen", label: "Kitchen", desc: "Bright, sleek modern kitchen.", thumb: "/settings/kitchen.png" },
  { value: "set in a serene bedroom with a city or coastal view", label: "Bedroom", desc: "Serene bedroom, great view.", thumb: "/settings/bedroom.png" },
  { value: "set on a private balcony or terrace at golden hour", label: "Balcony / terrace", desc: "Private balcony at golden hour.", thumb: "/settings/balcony.png" },
  { value: "set at a rooftop pool or lounge overlooking the skyline", label: "Rooftop", desc: "Rooftop pool over the skyline.", thumb: "/settings/rooftop.png" },
  { value: "set by floor-to-ceiling windows in warm natural light", label: "By the windows", desc: "Floor-to-ceiling window light.", thumb: "/settings/windows.png" },
  { value: "set in an upscale building lobby or entrance", label: "Lobby", desc: "Upscale building lobby.", thumb: "/settings/lobby.png" },
  { value: "set on a real urban street, handheld walking shot", label: "Urban street", desc: "Real urban street, handheld.", thumb: "/settings/street.png" },
];

export default function StudioComposer() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [output, setOutput] = useState("auto");
  const [spec, setSpec] = useState("auto");
  const [hook, setHook] = useState(null);
  const [setting, setSetting] = useState(null);
  const [picker, setPicker] = useState(null); // "hook" | "setting" | null

  const go = () => {
    const brief = [idea.trim(), hook && `Hook: ${hook.value}`, setting && `Setting: ${setting.value}`].filter(Boolean).join(". ");
    const p = new URLSearchParams({ output, spec });
    if (brief) p.set("brief", brief);
    router.push(`/create?${p.toString()}`);
  };
  const onKey = (e) => { if (e.key === "Enter") go(); };

  return (
    <div className="studio-hero">
      <div className="k"><span className="d" /> Revarity Ads Studio</div>
      <h1>Describe it. <em>We film it.</em></h1>
      <p>Type the ad you want, pick a hook and a setting — the studio writes the words, designs the frame, and films the dream. Screened and approved before a dollar moves.</p>
      <div className="hcomposer">
        <input className="hcomposer-in" value={idea} onChange={(e) => setIdea(e.target.value)} onKeyDown={onKey}
          placeholder="Describe what happens in the ad…" aria-label="Describe the ad" />
        <div className="hcomposer-row">
          <select value={output} onChange={(e) => setOutput(e.target.value)} aria-label="Type">{OUTPUTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <button type="button" className={"hcomposer-chip" + (hook ? " on" : "")} onClick={() => setPicker("hook")}>{hook ? hook.label : "Hook"} <span className="cv">▾</span></button>
          <button type="button" className={"hcomposer-chip" + (setting ? " on" : "")} onClick={() => setPicker("setting")}>{setting ? setting.label : "Setting"} <span className="cv">▾</span></button>
          <select value={spec} onChange={(e) => setSpec(e.target.value)} aria-label="Placement">{PLACEMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <button className="btn hcomposer-go" onClick={go}>Generate →</button>
        </div>
      </div>

      <StudioPicker
        open={picker === "hook"} onClose={() => setPicker(null)}
        title="Hooks that stop the scroll" subtitle="The first 3 seconds decide if your ad gets watched or skipped. Pick a proven opener."
        tabs={["All", "Stunt", "Subtle"]} items={HOOKS} selected={hook?.value} onPick={setHook}
      />
      <StudioPicker
        open={picker === "setting"} onClose={() => setPicker(null)}
        title="Settings that set the scene" subtitle="Choose where the story unfolds — realistic, premium locations only."
        items={SETTINGS} selected={setting?.value} onPick={setSetting}
      />
    </div>
  );
}
