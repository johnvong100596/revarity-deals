import { loadConfig } from "@/lib/config";
import { keyStatus, COPY_MODEL } from "@/lib/connectors";
import { hasVeo } from "@/lib/veo";
import { hasFal } from "@/lib/fal";
import { hasCloudKey } from "@/lib/higgsfield-cloud";
import SettingsClient from "@/app/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = await loadConfig();
  const geminiOn = !!process.env.GEMINI_API_KEY;
  const arcadsOn = !!(process.env.ARCADS_CLIENT_ID && process.env.ARCADS_CLIENT_SECRET);

  // Full model catalog with live connection status — every lane the engine can route to, shown for transparency.
  const copyModel = { label: "Marketing brain — copy, scoring, direction", model: COPY_MODEL, provider: "Anthropic · Claude", on: keyStatus().copy, hint: "set ANTHROPIC_API_KEY" };
  const imageModels = [
    { label: "Fast — drafts & variations", model: process.env.IMG_MODEL || "gemini-3.1-flash-image-preview", provider: "Google Gemini · Nano Banana", on: geminiOn, hint: "set GEMINI_API_KEY" },
    { label: "Pro — final ultra-real render", model: process.env.IMG_FINAL_MODEL || "gemini-3-pro-image-preview", provider: "Google Gemini · Nano Banana", on: geminiOn, hint: "set GEMINI_API_KEY" },
  ];
  const videoModels = [
    { label: "Presenter + premium b-roll (native audio)", model: process.env.VEO_MODEL || "veo-3.1-generate-preview", provider: "Google · Veo 3.1", on: hasVeo(), hint: "set GEMINI_API_KEY" },
    { label: "B-roll at volume", model: "kling-video v2 master", provider: "Kling · via fal.ai", on: hasFal(), hint: "set FAL_KEY" },
    { label: "B-roll fast & cheap", model: "kling v2.5-turbo", provider: "Kling Turbo · via fal.ai", on: hasFal(), hint: "set FAL_KEY" },
    { label: "Motion on a brand still", model: process.env.HF_MODEL || "seedance1_5", provider: "Higgsfield", on: hasCloudKey(), hint: "set HF_API_KEY + HF_API_SECRET" },
    { label: "UGC talking-head — gated lane", model: "arcads", provider: "Arcads · contracted only", on: arcadsOn, hint: "set ARCADS_CLIENT_ID + SECRET" },
  ];

  return <SettingsClient config={config} copyModel={copyModel} imageModels={imageModels} videoModels={videoModels} />;
}
