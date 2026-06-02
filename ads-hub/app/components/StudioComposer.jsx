"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// The studio centerpiece (mirrors the Higgsfield Marketing Studio prompt bar): describe the ad, then pick
// Type · Hook · Setting · Placement. It composes those into a brief and hands off to the existing Create
// flow (Create reads ?brief/?output/?spec) — no duplicate generation logic, every feature intact.
const OUTPUTS = [["auto", "Type: auto"], ["presenter", "Presenter"], ["video", "Video b-roll"], ["image", "Image"], ["copy", "Copy only"]];
const PLACEMENTS = [["auto", "Placement: auto"], ["meta_story_vertical", "Reels 9:16"], ["meta_feed_square", "Feed 1:1"], ["meta_feed_portrait", "Feed 4:5"], ["meta_landscape", "Landscape 16:9"]];

// HOOKS — Stunt or Subtle only (per brand guardrail): proven scroll-stoppers, never gimmicky-dishonest.
const HOOKS = [
  ["", "Hook: auto"],
  ["open on a calm, confident host speaking directly to camera", "Subtle · Direct to camera"],
  ["open on a street interview asking a host about their short-term-rental income", "Subtle · Interview"],
  ["open on a slow cinematic push into a beautifully furnished unit", "Subtle · Slow reveal"],
  ["open on an extreme close-up that slowly tilts up to reveal the space", "Subtle · Close-up tilt"],
  ["open on a fast match-cut from a bare, empty unit to a fully furnished one", "Stunt · Empty→furnished"],
  ["open on a punchy speed-ramped move sweeping through the space", "Stunt · Speed-ramp reveal"],
  ["open on the estimated monthly income range animating on screen as a clearly-labelled estimate", "Stunt · Numbers drop"],
];

// SETTINGS — REALISTIC backgrounds only (per brand guardrail): premium STR locations, no absurd scenes.
const SETTINGS = [
  ["", "Setting: auto"],
  ["set in a beautifully furnished modern living room", "Living room"],
  ["set in a bright modern kitchen", "Kitchen"],
  ["set in a serene bedroom with a city or coastal view", "Bedroom"],
  ["set on a private balcony or terrace at golden hour", "Balcony / terrace"],
  ["set at a rooftop pool or lounge overlooking the skyline", "Rooftop"],
  ["set by floor-to-ceiling windows in warm natural light", "By the windows"],
  ["set in an upscale building lobby or entrance", "Lobby"],
  ["set on a real urban street, handheld walking shot", "Urban street"],
];

export default function StudioComposer() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [output, setOutput] = useState("auto");
  const [spec, setSpec] = useState("auto");
  const [hook, setHook] = useState("");
  const [setting, setSetting] = useState("");

  const go = () => {
    const brief = [idea.trim(), hook && `Hook: ${hook}`, setting && `Setting: ${setting}`].filter(Boolean).join(". ");
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
          <select value={hook} onChange={(e) => setHook(e.target.value)} aria-label="Hook">{HOOKS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}</select>
          <select value={setting} onChange={(e) => setSetting(e.target.value)} aria-label="Setting">{SETTINGS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}</select>
          <select value={spec} onChange={(e) => setSpec(e.target.value)} aria-label="Placement">{PLACEMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <button className="btn hcomposer-go" onClick={go}>Generate →</button>
        </div>
      </div>
    </div>
  );
}
